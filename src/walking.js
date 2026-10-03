import {distance} from './geography.js';

const angle=(a,b,c)=>{
 const u=[b[0]-a[0],b[1]-a[1]],v=[c[0]-b[0],c[1]-b[1]];
 return Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/(Math.hypot(...u)*Math.hypot(...v)||1))));
};

// Speeds change with the street, not at each OSM geometry point. Braking adds
// points on the existing segment, so corners and observation geometry stay exact.
export function walkingGeometry(graph,path,baseSpeed,random){
 const points=[graph.nodes[path[0]].p],legs=[];let meters=0,movingMinutes=0,street,pace=baseSpeed;
 const add=(p,speed,green)=>{
  const len=distance(points.at(-1),p);if(len<1e-9)return;
  legs.push({start:meters,end:meters+len,speed,green});points.push(p);
  meters+=len;movingMinutes+=len/speed;
 };
 for(let i=1;i<path.length;i++){
  const a=graph.nodes[path[i-1]],b=graph.nodes[path[i]],edge=a.adj.find(e=>e.to===path[i]);
  const key=edge?.streetId??edge?.wayId??'unnamed';
  if(key!==street){street=key;pace=baseSpeed*(.9+random()*.14);}
  const c=i+1<path.length?graph.nodes[path[i+1]]:null,nextEdge=c?b.adj.find(e=>e.to===path[i+1]):null;
  const braking=b.crossing||(nextEdge?.crossing&&!edge?.crossing)||(c&&angle(a.p,b.p,c.p)>35*Math.PI/180);
  const len=distance(a.p,b.p);
  if(braking&&len>2){const last=Math.min(6,len/3),f=1-last/len;add([a.p[0]+(b.p[0]-a.p[0])*f,a.p[1]+(b.p[1]-a.p[1])*f],pace,!!edge?.green);add(b.p,pace*.7,!!edge?.green);}
  else add(b.p,pace,!!edge?.green);
 }
 return {points,legs,meters,movingMinutes};
}

// Sniffing is an activity, not an elimination event. Keep a distinct stop type
// through the timeline; observers and heat maps filter it explicitly.
export function addSniffing({points,stops},geometry,rate,random){
 const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths.at(-1)+distance(points[i-1],points[i]));
 const targets=stops.map(s=>({...s,distance:lengths[s.index]}));
 const weights=geometry.legs.map(l=>(l.end-l.start)*(l.green?1.7:1)),sum=weights.reduce((a,b)=>a+b,0);
 if(rate>0&&sum>0){let t=0;while((t+=-Math.log(Math.max(1e-12,1-random()))/rate)<geometry.movingMinutes){
  let choice=random()*sum,index=0;for(;index<weights.length-1&&choice>=weights[index];index++)choice-=weights[index];
  const leg=geometry.legs[index],position=leg.start+(leg.end-leg.start)*random();
  targets.push({distance:position,type:'sniff',duration:(5+20*random())/60});
 }}
 targets.sort((a,b)=>a.distance-b.distance);
 const result=[points[0]],activities=[];let next=0;
 for(let i=1;i<points.length;i++){
  while(next<targets.length&&targets[next].distance<lengths[i]){
   const target=targets[next++],f=(target.distance-lengths[i-1])/(lengths[i]-lengths[i-1]||1),a=points[i-1],b=points[i];
   result.push([a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f]);
   const {distance:position,index:oldIndex,at:oldAt,...stop}=target;
   activities.push({...stop,index:result.length-1});
  }
  result.push(points[i]);
 }
 return {points:result,stops:activities};
}

// A mapped crossing can require a short wait. Consecutive crossing segments
// represent one crossing, even when OSM subdivides it. No traffic state is inferred.
export function crossingActivities(graph,path,geometry,random){
 const lengths=[0];for(let i=1;i<geometry.points.length;i++)lengths.push(lengths.at(-1)+distance(geometry.points[i-1],geometry.points[i]));
 const stops=[];let meters=0,pointIndex=0,previous;
 for(let i=0;i<path.length;i++){
  const node=graph.nodes[path[i]],edge=i+1<path.length?node.adj.find(e=>e.to===path[i+1]):null;
  const startsCrossing=edge?.crossing&&!previous?.crossing;
  const isolatedCrossing=edge&&node.crossing&&!edge.crossing&&!previous?.crossing;
  if(startsCrossing||isolatedCrossing){
   let signal=[node.crossingType,edge?.crossingType].includes('traffic_signals');
   if(startsCrossing)for(let j=i;j+1<path.length;j++){
    const crossingEdge=graph.nodes[path[j]].adj.find(e=>e.to===path[j+1]);if(!crossingEdge?.crossing)break;
    if(crossingEdge.crossingType==='traffic_signals'||graph.nodes[path[j+1]].crossingType==='traffic_signals')signal=true;
   }
   if(random()<(signal?.7:.55)){
    while(pointIndex<lengths.length-1&&lengths[pointIndex]<meters-1e-7)pointIndex++;
    stops.push({index:pointIndex,type:'crossing',duration:(signal?5+40*random():2+10*random())/60});
   }
  }
  if(edge)meters+=distance(node.p,graph.nodes[edge.to].p);previous=edge;
 }
 return {points:geometry.points,stops};
}

export function walkingTimeline(points,stops,geometry){
 const times=[0],speeds=[0],pauses=new Map(stops.map(s=>[s.index,s]));let meters=0,legIndex=0;
 for(let i=1;i<points.length;i++){
  const pause=pauses.get(i-1);if(pause)pause.at=times[i-1];
  const len=distance(points[i-1],points[i]);
  while(legIndex<geometry.legs.length-1&&meters>=geometry.legs[legIndex].end-1e-7)legIndex++;
  const speed=geometry.legs[legIndex]?.speed||1;
  times.push(times.at(-1)+(pause?.duration||0)+len/speed);speeds.push(speed);meters+=len;
 }
 const last=pauses.get(points.length-1);if(last){last.at=times.at(-1);}
 return {times,speeds,duration:times.at(-1)+(last?.duration||0)};
}
