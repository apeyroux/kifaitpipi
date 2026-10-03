import {distance} from './geography.js';

// Route choices are made for a whole outing. The coefficients below describe
// an exploratory scenario, rather than measured behaviour in Châtillon.
const MAX_TREES=40, RETURN_DETOUR=1.5, BUDGET_TOLERANCE=.12;
const graphCaches=new WeakMap();
const edgeKey=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));

class Heap{
 constructor(){this.items=[];}
 push(cost,node){const item=[cost,node],a=this.items;let i=a.length;a.push(item);while(i>0){const p=(i-1)>>1;if(a[p][0]<=cost)break;a[i]=a[p];i=p;}a[i]=item;}
 pop(){const a=this.items,top=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1][0]<a[c][0])c++;if(a[c][0]>=last[0])break;a[i]=a[c];i=c;}a[i]=last;}return top;}
 get length(){return this.items.length;}
}

function street(edge){return edge.streetId??edge.wayId??edge.name??null;}
function comfort(edge){
 let factor=({primary:1.35,primary_link:1.35,secondary:1.22,secondary_link:1.22,tertiary:1.1,tertiary_link:1.1,residential:1.02})[edge.highway]??1;
 if(edge.sidewalk==='no'&&factor>1)factor+=.12;
 if(['cobblestone','sett','sand'].includes(edge.surface))factor+=.06;
 return Math.max(.8,edge.green?factor*.9:factor);
}
function crossingCost(edge){return edge.footway==='crossing'||edge.crossing&&edge.crossing!=='no'?6:0;}

function indexGraph(graph){
 let cached=graphCaches.get(graph);if(cached)return cached;
 const adj=graph.nodes.map((node,from)=>{
  const neighbours=new Map();
  for(const edge of node.adj||[]){
   if(!Number.isInteger(edge.to)||!graph.nodes[edge.to]||edge.to===from)continue;
   const len=Number.isFinite(edge.len)&&edge.len>=0?edge.len:distance(node.p,graph.nodes[edge.to].p);
   const item={...edge,from,len,street:street(edge),factor:comfort(edge),crossingCost:crossingCost(edge)};
   const old=neighbours.get(edge.to);
   if(!old||len*item.factor+item.crossingCost<old.len*old.factor+old.crossingCost)neighbours.set(edge.to,item);
  }
  return [...neighbours.values()];
 });
 const lookup=adj.map(edges=>new Map(edges.map(edge=>[edge.to,edge])));
 const symmetric=adj.every((edges,from)=>edges.every(edge=>{const reverse=lookup[edge.to].get(from);return reverse&&Math.abs(reverse.len-edge.len)<1e-7;}));
 const reverseAdj=symmetric?adj:adj.map(()=>[]);
 if(!symmetric)for(let from=0;from<adj.length;from++)for(const edge of adj[from])reverseAdj[edge.to].push({to:from,len:edge.len});
 const destinations=(graph.destinations||[]).filter(d=>d.type==='green'&&Number.isInteger(d.node)&&graph.nodes[d.node]&&adj[d.node].length);
 cached={graph,adj,reverseAdj,symmetric,lookup,destinations,trees:new Map()};graphCaches.set(graph,cached);return cached;
}

function turnCost(cache,previous,current,edge){
 if(previous<0||cache.adj[current].length<3)return 0;
 const a=cache.graph.nodes[previous].p,b=cache.graph.nodes[current].p,c=cache.graph.nodes[edge.to].p;
 const ux=b[0]-a[0],uy=b[1]-a[1],vx=c[0]-b[0],vy=c[1]-b[1],length=Math.hypot(ux,uy)*Math.hypot(vx,vy);
 const angle=length?8*(1-clamp((ux*vx+uy*vy)/length,-1,1))/2:0;
 const incoming=cache.lookup[previous]?.get(current),changesStreet=incoming?.street!=null&&edge.street!=null&&incoming.street!==edge.street;
 return angle+(changesStreet?5:0);
}

function tree(cache,home,preferred){
 const n=cache.adj.length,costs=new Float64Array(n).fill(Infinity),meters=new Float64Array(n).fill(Infinity),parents=new Int32Array(n).fill(-1),heap=new Heap();
 costs[home]=meters[home]=0;heap.push(0,home);
 while(heap.length){
  const [cost,u]=heap.pop();if(cost!==costs[u])continue;
  for(const edge of cache.adj[u]){
   const next=cost+(preferred?edge.len*edge.factor+edge.crossingCost+turnCost(cache,parents[u],u,edge):edge.len);
   if(next<costs[edge.to]){costs[edge.to]=next;meters[edge.to]=meters[u]+edge.len;parents[edge.to]=u;heap.push(next,edge.to);}
  }
 }
 return {distances:preferred?meters:costs,parents};
}

function homeTrees(cache,home){
 let trees=cache.trees.get(home);
 if(trees){cache.trees.delete(home);cache.trees.set(home,trees);return trees;}
 const metric=tree(cache,home,false);
 trees={metric,returnMetric:cache.symmetric?metric:tree({...cache,adj:cache.reverseAdj},home,false),preferred:tree(cache,home,true)};
 cache.trees.set(home,trees);
 if(cache.trees.size>MAX_TREES)cache.trees.delete(cache.trees.keys().next().value);
 return trees;
}

function fromTree(parents,home,goal){
 const path=[goal];
 while(path.at(-1)!==home){const previous=parents[path.at(-1)];if(previous<0||path.length>parents.length)return null;path.push(previous);}
 return path.reverse();
}
function lengthOf(cache,path){let meters=0;for(let i=1;i<path.length;i++){const edge=cache.lookup[path[i-1]].get(path[i]);if(!edge)return Infinity;meters+=edge.len;}return meters;}
function usedEdges(path){const used=new Set();for(let i=1;i<path.length;i++)used.add(edgeKey(path[i-1],path[i]));return used;}

// A bounded search favours continuity and comfortable streets. The tree gives
// an exact metric lower bound when the destination is home. A feasible metric
// path remains available if the preference search exhausts its distance budget.
function findPath(cache,start,goal,{used=new Set(),previous=-1,maxMeters=Infinity,homeDistances}={}){
 if(start===goal)return [start];
 const n=cache.adj.length,costs=new Float64Array(n).fill(Infinity),meters=new Float64Array(n).fill(Infinity),parents=new Int32Array(n).fill(-1),heap=new Heap();
 const lower=u=>homeDistances?homeDistances[u]:distance(cache.graph.nodes[u].p,cache.graph.nodes[goal].p);
 // Green preferences reduce cost, but never metric distance. Keep the search
 // heuristic admissible while checking the physical budget with the full bound.
 const heuristic=u=>lower(u)*.8;
 if(lower(start)>maxMeters+1e-7)return null;
 costs[start]=meters[start]=0;heap.push(heuristic(start),start);
 while(heap.length){
  const [estimate,u]=heap.pop();if(estimate>costs[u]+heuristic(u)+1e-7)continue;
  if(u===goal)return fromTree(parents,start,goal);
  for(const edge of cache.adj[u]){
   const walked=meters[u]+edge.len;if(walked+lower(edge.to)>maxMeters+1e-7)continue;
   const prior=u===start?previous:parents[u];
   const cost=costs[u]+edge.len*edge.factor+edge.crossingCost+turnCost(cache,prior,u,edge)+(used.has(edgeKey(u,edge.to))?edge.len*.35:0);
   if(cost<costs[edge.to]){costs[edge.to]=cost;meters[edge.to]=walked;parents[edge.to]=u;heap.push(cost+heuristic(edge.to),edge.to);}
  }
 }
 return null;
}

function normalGoals(cache,trees,home,target,heading){
 const origin=cache.graph.nodes[home].p,bins=Array(4).fill(null);let fallback=null;
 for(let node=0;node<cache.adj.length;node++){
  const d=trees.metric.distances[node],back=trees.returnMetric.distances[node];if(node===home||!Number.isFinite(d+back)||d<=0)continue;
  const delta=Math.abs(d+back-target)/target;
  if(!fallback||delta<fallback.score)fallback={node,score:delta};
  if(d+back>target*(1+BUDGET_TOLERANCE)||d<target*.18)continue;
  const p=cache.graph.nodes[node].p,angle=(Math.atan2(p[1]-origin[1],p[0]-origin[0])-heading+Math.PI*4)%(Math.PI*2),bin=Math.floor(angle/(Math.PI/2));
  const centralAngle=(bin+.5)*Math.PI/2,score=delta+Math.abs(angle-centralAngle)*.035;
  if(!bins[bin]||score<bins[bin].score)bins[bin]={node,score};
 }
 const goals=bins.filter(Boolean).sort((a,b)=>a.score-b.score).map(g=>({node:g.node}));
 if(!goals.length&&fallback)goals.push({node:fallback.node});return goals;
}

function describe(cache,path,home,outwardMeters,shortestReturnMeters,waypoints,target,intent){
 const counts=new Map();let meters=0,overlapMeters=0,turns=0,majorMeters=0,greenMeters=0,preferenceCost=0;
 for(let i=1;i<path.length;i++){
  const edge=cache.lookup[path[i-1]].get(path[i]),key=edgeKey(path[i-1],path[i]);meters+=edge.len;
  if(counts.has(key))overlapMeters+=edge.len;counts.set(key,(counts.get(key)||0)+1);
  const turn=turnCost(cache,i>1?path[i-2]:-1,path[i-1],edge);if(turn>2)turns++;
  preferenceCost+=edge.len*edge.factor+edge.crossingCost+turn;
  if(edge.green)greenMeters+=edge.len;
  if(['primary','primary_link','secondary','secondary_link'].includes(edge.highway))majorMeters+=edge.len;
 }
 const returnMeters=meters-outwardMeters;
 const repeatedFraction=meters?overlapMeters/meters:0;
 return {path,meters,home,waypoints,waypoint:waypoints.find(p=>p.type==='green')??waypoints.at(-1),outwardMeters,returnMeters,shortestReturnMeters,returnDetour:shortestReturnMeters>0?returnMeters/shortestReturnMeters:1,overlapMeters,repeatedFraction,overlap:repeatedFraction,turns,majorMeters,greenMeters,greenFraction:meters?greenMeters/meters:0,preferenceCost,intent,targetMeters:target,budgetLimited:Math.abs(meters-target)>target*.25};
}

function candidate(cache,trees,home,target,goals,intent){
 let outward=[home],outwardMeters=0;
 for(let i=0;i<goals.length;i++){
  const goal=goals[i].node,start=outward.at(-1),reserve=trees.returnMetric.distances[goal],budget=target*(1+BUDGET_TOLERANCE)-outwardMeters-reserve;
  let leg;
  if(start===home){
   const metric=fromTree(trees.metric.parents,home,goal),preferred=fromTree(trees.preferred.parents,home,goal);
   leg=preferred&&trees.preferred.distances[goal]<=trees.metric.distances[goal]*1.15+1e-7&&trees.preferred.distances[goal]<=budget+1e-7?preferred:metric;
  }else leg=findPath(cache,start,goal,{previous:outward.at(-2)??-1,used:usedEdges(outward),maxMeters:budget});
  if(!leg)return null;
  outward.push(...leg.slice(1));outwardMeters+=lengthOf(cache,leg);
 }
 const end=outward.at(-1),shortest=trees.returnMetric.distances[end],remaining=target*(1+BUDGET_TOLERANCE)-outwardMeters;
 if(remaining<shortest-1e-7)return null;
 const back=findPath(cache,end,home,{used:usedEdges(outward),previous:outward.at(-2)??-1,maxMeters:Math.min(remaining,shortest*RETURN_DETOUR),homeDistances:trees.returnMetric.distances})??fromTree(trees.returnMetric.parents,home,end)?.reverse();
 if(!back)return null;
 return describe(cache,[...outward,...back.slice(1)],home,outwardMeters,shortest,goals,target,intent);
}

function routeScore(result,target,intent){
 const fit=Math.abs(result.meters-target)/target;
 return fit*4+result.repeatedFraction*(intent==='local'?.12:.45)+(result.preferenceCost/result.meters-1)*.6-result.greenFraction*.12+(intent==='green'?(result.greenRoundTrip??0)/target*.8:0);
}

export function chooseRoute(graph,home,targetMeters,random,options={}){
 if(!graph?.nodes?.[home]||!Number.isFinite(targetMeters)||targetMeters<=0)return null;
 const cache=indexGraph(graph),trees=homeTrees(cache,home),intent=options.intent??'familiar',heading=(options.profile?.heading??random()*Math.PI*2)+(options.variant??0)*Math.PI*2/(options.profile?.maxCircuits??4)+(random()-.5)*.3;
 const regular=normalGoals(cache,trees,home,targetMeters,heading);
 const tripDistance=node=>trees.metric.distances[node]+trees.returnMetric.distances[node];
 const greens=cache.destinations.filter(d=>trees.metric.distances[d.node]>0&&tripDistance(d.node)<=targetMeters*(1+BUDGET_TOLERANCE)).sort((a,b)=>tripDistance(a.node)-tripDistance(b.node)).slice(0,3);
 let proposals=regular.map(goal=>[goal]),actualIntent=intent;
 if(intent==='green'){
  if(greens.length){
   proposals=greens.map(green=>[green]);
   // A nearby park can be a stop on a larger circuit rather than forcing a
   // tiny out-and-back. Only real graph paths connect the two destinations.
   const nearby=greens[0];if(trees.metric.distances[nearby.node]<targetMeters*.42)for(const goal of regular)if(goal.node!==nearby.node)proposals.push([nearby,goal]);
  }else actualIntent='familiar';
 }else if(greens.length&&tripDistance(greens[0].node)<targetMeters*.55){
  // Even a local or familiar outing may pass through a nearby green area. It
  // competes with other whole circuits and cannot overrun the outing's budget.
  const nearby=greens[0];for(const goal of regular.slice(0,2))if(goal.node!==nearby.node)proposals.push([nearby,goal]);
 }
 let best=null,bestScore=Infinity;
 for(const goals of proposals){const result=candidate(cache,trees,home,targetMeters,goals,actualIntent);if(!result||result.meters<=0)continue;const green=goals.find(g=>g.type==='green');if(green)result.greenRoundTrip=tripDistance(green.node);const score=routeScore(result,targetMeters,actualIntent)+(options.avoidSignatures?.has(result.path.join(':'))?.25:0);if(score<bestScore){best=result;bestScore=score;}}
 if(!best&&regular.length){
  // Networks with a single long access edge may have no circuit inside the
  // budget. Return the closest possible connected outing, explicitly marked.
  const goal=regular[0].node,out=fromTree(trees.metric.parents,home,goal),back=fromTree(trees.returnMetric.parents,home,goal)?.reverse();
  if(out&&back){const meters=lengthOf(cache,out);best=describe(cache,[...out,...back.slice(1)],home,meters,trees.returnMetric.distances[goal],[{node:goal}],targetMeters,actualIntent);best.budgetLimited=true;}
 }
 if(best&&actualIntent!==intent)best.requestedIntent=intent;
 return best;
}

export function route(graph,start,targetMeters,random){return chooseRoute(graph,start,targetMeters,random)?.path??[start];}

export function createWalkingProfile(graph,home,random){
 const cache=indexGraph(graph),trees=graph.nodes[home]?homeTrees(cache,home):null;
 const greenMinimumRoundTrip=trees?cache.destinations.reduce((best,d)=>Math.min(best,trees.metric.distances[d.node]+trees.returnMetric.distances[d.node]),Infinity):Infinity;
 return {home,heading:random()*Math.PI*2,maxCircuits:2+Math.floor(random()*3),id:Math.floor(random()*0xffffffff).toString(36),greenAffinity:.45+random()*.3,circuits:[],expansionAttempts:0,greenMinimumRoundTrip,hasGreenDestinations:Number.isFinite(greenMinimumRoundTrip)};
}

export function chooseWalkIntent(profile,hour,day,random){
 const budget=Number.isFinite(profile.targetMeters)&&profile.targetMeters>0?profile.targetMeters:Infinity;
 const feasible=profile.hasGreenDestinations&&profile.greenMinimumRoundTrip<=budget*(1+BUDGET_TOLERANCE);
 const proximity=Number.isFinite(budget)?1-.4*clamp(profile.greenMinimumRoundTrip/budget,0,1):1;
 const ordinaryHours=hour>=6&&hour<23,period=hour<9||hour>=19?.8:1;
 const green=feasible&&ordinaryHours?(day==='weekend'?.6:.45)*(profile.greenAffinity??.6)*proximity*period:0;
 const local=hour<9||hour>=21?.55:.25,r=random();
 return r<local?'local':r<local+green?'green':'familiar';
}

export function planWalk(graph,profile,targetMeters,intent,random){
 if(!profile?.circuits)return chooseRoute(graph,profile?.home,targetMeters,random,{intent});
 if(intent==='familiar'){
  const usable=profile.circuits.filter(c=>c.meters>=targetMeters*.78&&c.meters<=targetMeters*(1+BUDGET_TOLERANCE));
  const room=profile.circuits.length<profile.maxCircuits&&profile.expansionAttempts<profile.maxCircuits*2;
  const expand=room&&(profile.circuits.length<2||random()<.25);
  if(usable.length&&!expand){
   // Familiar outings reuse an entire circuit, with randomness only in the
   // choice between known circuits. Intersections are never redrawn.
   const weights=usable.map(c=>1/(.08+Math.abs(c.meters-targetMeters)/targetMeters));let value=random()*weights.reduce((a,b)=>a+b,0),chosen=usable.at(-1);
   for(let i=0;i<usable.length;i++){value-=weights[i];if(value<=0){chosen=usable[i];break;}}
   return {...chosen,path:[...chosen.path],waypoints:chosen.waypoints.map(p=>({...p})),intent,targetMeters,reusedCircuit:true,budgetLimited:Math.abs(chosen.meters-targetMeters)>targetMeters*.25};
  }
 }
 const result=chooseRoute(graph,profile.home,targetMeters,random,{profile,intent,variant:profile.circuits.length,avoidSignatures:new Set(profile.circuits.map(c=>c.signature))});profile.expansionAttempts++;if(!result)return null;
 const signature=result.path.join(':'),existing=profile.circuits.find(c=>c.signature===signature);
 if(existing)result.circuitId=existing.circuitId;
 else if(profile.circuits.length<profile.maxCircuits){result.circuitId=`${profile.home}-${profile.id}-${profile.circuits.length+1}`;profile.circuits.push({...result,path:[...result.path],waypoints:result.waypoints.map(p=>({...p})),signature});}
 return {...result,reusedCircuit:Boolean(existing)};
}
