import {distance} from './geography.js';

// Cafazzo et al. (2012) supports a qualitative preference for crossroads for
// male raised-leg marking in its free-ranging study population. These spatial
// coefficients are explicit scenario assumptions, not estimates from that paper.
export const MARKING_ASSUMPTIONS=Object.freeze({radiusMeters:8,junctionWeight:2,uniformShare:.5,branchToleranceDegrees:25,excludeCrossings:true});
const junctionCaches=new WeakMap(),EPSILON=1e-8,TAU=Math.PI*2;

function physicalBranches(graph,node){
 let cache=junctionCaches.get(graph);if(!cache){cache=new Map();junctionCaches.set(graph,cache);}
 if(cache.has(node))return cache.get(node);
 const origin=graph.nodes[node],angles=[];
 for(const edge of origin.adj||[]){
  const next=graph.nodes[edge.to];if(!next||edge.to===node)continue;
  const dx=next.p[0]-origin.p[0],dy=next.p[1]-origin.p[1];if(Math.hypot(dx,dy)<=EPSILON)continue;
  angles.push((Math.atan2(dy,dx)+TAU)%TAU);
 }
 if(angles.length<3){cache.set(node,angles.length);return angles.length;}
 angles.sort((a,b)=>a-b);
 // Open the angular circle at its largest gap. A branch straddling 0/360
 // degrees then stays together, without chaining a broad fan into one branch.
 let cut=0,gap=-1;
 for(let i=0;i<angles.length;i++){const next=i+1<angles.length?angles[i+1]:angles[0]+TAU,d=next-angles[i];if(d>gap){gap=d;cut=(i+1)%angles.length;}}
 const tolerance=MARKING_ASSUMPTIONS.branchToleranceDegrees*Math.PI/180;
 let groups=0,start=-Infinity;
 for(let i=0;i<angles.length;i++){const index=(cut+i)%angles.length,angle=angles[index]+(index<cut?TAU:0);if(angle-start>tolerance+EPSILON){groups++;start=angle;}}
 cache.set(node,groups);return groups;
}

function union(intervals){
 const result=[];
 for(const interval of [...intervals].sort((a,b)=>a.start-b.start)){
  if(interval.end-interval.start<=EPSILON)continue;
  const previous=result.at(-1);
  if(previous&&interval.start<=previous.end+EPSILON)previous.end=Math.max(previous.end,interval.end);
  else result.push({...interval});
 }
 return result;
}

function subtract(intervals,blocked){
 const result=[];let next=0;
 for(const interval of intervals){
  let start=interval.start;while(next<blocked.length&&blocked[next].end<=start+EPSILON)next++;
  for(let i=next;i<blocked.length&&blocked[i].start<interval.end-EPSILON;i++){
   if(blocked[i].start>start+EPSILON)result.push({start,end:Math.min(blocked[i].start,interval.end)});
   start=Math.max(start,blocked[i].end);if(start>=interval.end-EPSILON)break;
  }
  if(start<interval.end-EPSILON)result.push({start,end:interval.end});
 }
 return result;
}

function clampDistance(value,total){if(Number.isNaN(value)||typeof value!=='number')return 0;return Math.max(0,Math.min(total,value));}
function crossing(edge){return edge.footway==='crossing'||Boolean(edge.crossing&&edge.crossing!=='no');}

/**
 * Map a uniformly sampled arclength to a normalized marking distribution.
 * This changes spatial placement only: no random draws, counts, stop durations,
 * route points or physical street connections are created by this module.
 * The graph is immutable for the lifetime of its cached junction classification.
 */
export function createMarkingDistribution(graph,path){
 const {radiusMeters,junctionWeight,uniformShare}=MARKING_ASSUMPTIONS;
 if(!Array.isArray(path))throw new TypeError('A marking route must be an array of node indices.');
 const nodes=graph?.nodes||[],lengths=[0],blocked=[];
 for(const node of path)if(!Number.isInteger(node)||!nodes[node])throw new RangeError('A marking route contains an invalid node.');
 for(let i=1;i<path.length;i++){
  const from=nodes[path[i-1]],to=nodes[path[i]],edges=(from.adj||[]).filter(edge=>edge.to===path[i]);
  if(!edges.length)throw new Error('A marking route contains a segment outside the walking network.');
  const start=lengths.at(-1),end=start+distance(from.p,to.p);lengths.push(end);
  if(edges.some(crossing))blocked.push({start,end});
 }
 const totalMeters=lengths.at(-1),junctions=[],windows=[];
 for(let i=0;i<path.length;i++){
  const branches=physicalBranches(graph,path[i]);if(branches<3)continue;
  junctions.push({node:path[i],distance:lengths[i],branches});
  windows.push({start:Math.max(0,lengths[i]-radiusMeters),end:Math.min(totalMeters,lengths[i]+radiusMeters)});
 }
 const intervals=subtract(union(windows),union(blocked)),boostedMeters=intervals.reduce((sum,interval)=>sum+interval.end-interval.start,0);
 const metadata={totalMeters,junctions,intervals,boostedMeters,radiusMeters,junctionWeight,uniformShare};
 const identity=value=>clampDistance(value,totalMeters);
 if(totalMeters<=EPSILON||boostedMeters<=EPSILON||totalMeters-boostedMeters<=EPSILON)return {...metadata,isIdentity:true,mapDistance:identity};

 const normalizer=totalMeters+(junctionWeight-1)*boostedMeters,segments=[];let position=0,source=0;
 const add=(end,weight)=>{
  if(end-position<=EPSILON)return;
  // Express probability mass in source metres: input is already a uniform
  // distance in [0,total], so inversion needs no extra random number.
  const density=uniformShare+(1-uniformShare)*totalMeters*weight/normalizer;
  const next=source+(end-position)*density;segments.push({start:position,end,sourceStart:source,sourceEnd:next,density});position=end;source=next;
 };
 for(const interval of intervals){add(interval.start,1);add(interval.end,junctionWeight);}add(totalMeters,1);
 const mapDistance=value=>{
  const input=clampDistance(value,totalMeters);if(input===0||input===totalMeters)return input;
  let low=0,high=segments.length-1;
  while(low<high){const middle=(low+high)>>1;if(input>segments[middle].sourceEnd)low=middle+1;else high=middle;}
  const segment=segments[low];return Math.max(segment.start,Math.min(segment.end,segment.start+(input-segment.sourceStart)/segment.density));
 };
 return {...metadata,isIdentity:false,mapDistance};
}
