// Local coordinates are metres. A parcel zone is its complete geometry plus
// an optional distance from its boundaries, including holes and separate parts.
const EPS=1e-8;
export const parcelPolygons=parcel=>parcel.polygons??[parcel.rings];
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const subtract=(a,b)=>[a[0]-b[0],a[1]-b[1]];
function edgeDistance(p,a,b){
 const d=subtract(b,a),q=subtract(p,a),length=d[0]**2+d[1]**2;
 const t=Math.max(0,Math.min(1,(q[0]*d[0]+q[1]*d[1])/(length||1)));
 return Math.hypot(q[0]-t*d[0],q[1]-t*d[1]);
}
function ringPosition(p,ring){
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[j],b=ring[i];
  if(edgeDistance(p,a,b)<=EPS)return 0;
  if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return inside?1:-1;
}
export function parcelContains(parcel,p){
 return parcelPolygons(parcel).some(rings=>ringPosition(p,rings[0])>=0&&!rings.slice(1).some(ring=>ringPosition(p,ring)===1));
}
export function parcelObservation(parcels,p){
 const parcel=parcels.find(candidate=>parcelContains(candidate,p));
 return parcel?{p:parcel.center,name:`Parcelle ${parcel.label||parcel.id}`,parcel}:null;
}
function circleInterval(a,d,center,radius){
 const q=subtract(a,center),aa=d[0]**2+d[1]**2;
 if(aa===0)return Math.hypot(...q)<=radius?[0,1]:null;
 const bb=2*(q[0]*d[0]+q[1]*d[1]),cc=q[0]**2+q[1]**2-radius**2,disc=bb*bb-4*aa*cc;
 if(disc<0)return null;
 const lo=Math.max(0,(-bb-Math.sqrt(disc))/(2*aa)),hi=Math.min(1,(-bb+Math.sqrt(disc))/(2*aa));
 return lo<=hi?[lo,hi]:null;
}
function slab(interval,start,delta,min,max){
 if(Math.abs(delta)<EPS)return start>=min-EPS&&start<=max+EPS?interval:null;
 const a=(min-start)/delta,b=(max-start)/delta;
 const lo=Math.max(interval[0],Math.min(a,b)),hi=Math.min(interval[1],Math.max(a,b));
 return lo<=hi?[lo,hi]:null;
}
function mergeIntervals(intervals){
 intervals.sort((a,b)=>a[0]-b[0]);const merged=[];
 for(const interval of intervals){const last=merged.at(-1);if(last&&interval[0]<=last[1]+EPS)last[1]=Math.max(last[1],interval[1]);else merged.push(interval.slice());}
 return merged;
}
export function parcelZone(parcel,buffer=0){
 const polygons=parcelPolygons(parcel),edges=[];let minx=Infinity,maxx=-Infinity,miny=Infinity,maxy=-Infinity;
 const radius=Math.max(0,buffer);
 for(const rings of polygons)for(const ring of rings)for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length];
  minx=Math.min(minx,a[0]);maxx=Math.max(maxx,a[0]);miny=Math.min(miny,a[1]);maxy=Math.max(maxy,a[1]);
  if(a[0]!==b[0]||a[1]!==b[1])edges.push([a,b]);
 }
 const overlaps=(a,b=a)=>Math.max(a[0],b[0])>=minx-radius-EPS&&Math.min(a[0],b[0])<=maxx+radius+EPS&&Math.max(a[1],b[1])>=miny-radius-EPS&&Math.min(a[1],b[1])<=maxy+radius+EPS;
 const contains=p=>overlaps(p)&&(parcelContains(parcel,p)||radius>0&&edges.some(([a,b])=>edgeDistance(p,a,b)<=radius+EPS));
 return {contains,intervals(a,b){
  if(!overlaps(a,b))return [];
  const d=subtract(b,a);if(d[0]===0&&d[1]===0)return contains(a)?[[0,1]]:[];
  const cuts=[0,1],intervals=[];
  for(const [c,e] of edges){
   const edge=subtract(e,c),q=subtract(c,a),den=cross(d,edge);
   if(Math.abs(den)>EPS){
    const t=cross(q,edge)/den,u=cross(q,d)/den;
    if(t>=0&&t<=1&&u>=0&&u<=1)cuts.push(t);
   }else if(Math.abs(cross(q,d))<=EPS){
    const axis=Math.abs(d[0])>=Math.abs(d[1])?0:1;
    for(const p of [c,e]){const t=(p[axis]-a[axis])/d[axis];if(t>=0&&t<=1)cuts.push(t);}
   }
   if(radius===0)continue;
   // The distance buffer around an edge is a rectangle with circular ends.
   for(const center of [c,e]){const interval=circleInterval(a,d,center,radius);if(interval)intervals.push(interval);}
   const length=Math.hypot(...edge),unit=edge.map(v=>v/length),from=subtract(a,c);
   const along=from[0]*unit[0]+from[1]*unit[1],travel=d[0]*unit[0]+d[1]*unit[1];
   let interval=slab([0,1],along,travel,0,length);
   if(interval)interval=slab(interval,cross(unit,from),cross(unit,d),-radius,radius);
   if(interval)intervals.push(interval);
  }
  cuts.sort((x,y)=>x-y);
  for(let i=1;i<cuts.length;i++){
   const from=cuts[i-1],to=cuts[i],t=(from+to)/2;
   if(parcelContains(parcel,[a[0]+d[0]*t,a[1]+d[1]*t]))intervals.push([from,to]);
  }
  // A tangential contact with the cadastral boundary also counts as a passage.
  for(const t of cuts)if(parcelContains(parcel,[a[0]+d[0]*t,a[1]+d[1]*t]))intervals.push([t,t]);
  return mergeIntervals(intervals);
 }};
}
