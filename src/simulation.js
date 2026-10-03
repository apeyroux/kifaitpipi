import {rng,distance} from './geography.js';
export const DEFAULTS={population:36705,households:17646,dogsPerHousehold:1,ownership:22,walks:3,duration:25,urinationRate:.2,defecationsPerDay:2,seed:92020,day:'weekday'};
export const COLORS=['#68f4d2','#5ac9ff','#a893ff','#7dfbe3'];
const normal=(random)=>Math.sqrt(-2*Math.log(Math.max(.00001,random())))*Math.cos(2*Math.PI*random());
export function profile(day){const peaks=day==='weekend'?[[9.5,1.4,.32],[14,1.5,.23],[19,1.5,.45]]:[[7.5,1,.34],[12.5,1,.2],[18.5,1.4,.46]];const weights=Array.from({length:24},(_,h)=>peaks.reduce((s,[m,sd,w])=>s+w*Math.exp(-.5*((h+.5-m)/sd)**2)/sd,0)+.001);const sum=weights.reduce((a,b)=>a+b,0);return weights.map(w=>w/sum);}
function weightedIndex(weights,random){const sum=weights.reduce((a,b)=>a+b,0);let r=random()*sum;for(let i=0;i<weights.length;i++){r-=weights[i];if(r<=0)return i;}return weights.length-1;}
// Metric shortest path with a penalty for streets already used on the outward leg.
function returnPath(graph,from,home,usedEdges){
 const edgeKey=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
 const costs=new Float64Array(graph.nodes.length).fill(Infinity),parents=new Int32Array(graph.nodes.length).fill(-1),heap=[];
 const push=item=>{let i=heap.length;heap.push(item);while(i>0){const p=(i-1)>>1;if(heap[p][0]<=item[0])break;heap[i]=heap[p];i=p;}heap[i]=item;};
 const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1][0]<heap[c][0])c++;if(heap[c][0]>=last[0])break;heap[i]=heap[c];i=c;}heap[i]=last;}return top;};
 costs[from]=0;push([0,from]);
 while(heap.length){const [cost,u]=pop();if(cost!==costs[u])continue;if(u===home)break;
  for(const e of graph.nodes[u].adj){const next=cost+e.len*(usedEdges.has(edgeKey(u,e.to))?8:1);if(next<costs[e.to]){costs[e.to]=next;parents[e.to]=u;push([next,e.to]);}}
 }
 if(!Number.isFinite(costs[home]))return null;
 const path=[home];while(path.at(-1)!==from)path.push(parents[path.at(-1)]);return path.reverse();
}
export function route(graph,start,targetMeters,random){
 const path=[start],visited=new Set([start]),usedEdges=new Set();let u=start,meters=0;
 const edgeKey=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
 // Do not revisit nodes on the outward leg, and prefer avoiding dead ends.
 for(let k=0;k<600&&meters<targetMeters/2;k++){
  let candidates=graph.nodes[u].adj.filter(e=>!visited.has(e.to));if(!candidates.length)break;
  const continuing=candidates.filter(e=>graph.nodes[e.to].adj.some(next=>!visited.has(next.to)&&next.to!==u));if(continuing.length)candidates=continuing;else if(path.length>1)break;
  const choice=weightedIndex(candidates.map(e=>{const away=distance(graph.nodes[e.to].p,graph.nodes[start].p);return 1+Math.min(2,away/Math.max(1,targetMeters/4));}),random),e=candidates[choice];
  usedEdges.add(edgeKey(u,e.to));u=e.to;path.push(u);visited.add(u);meters+=e.len;
 }
 // A different return street is preferred when a cycle exists. Bridges and
 // cul-de-sacs necessarily share segments; never invent a shortcut off-road.
 const back=returnPath(graph,u,start,usedEdges);if(back)path.push(...back.slice(1));else path.push(...path.slice(0,-1).reverse());
 return path;
}
export function eliminationEvents(routePoints,minutes,urinationRate,defecationRate,random,{defecationCount}={}){
 const lengths=[0];for(let i=1;i<routePoints.length;i++)lengths.push(lengths.at(-1)+distance(routePoints[i-1],routePoints[i]));
 const total=lengths.at(-1),targets=[];
 if(defecationCount!==undefined&&total>0)for(let i=0;i<defecationCount;i++)targets.push({distance:random()*total,type:'defecation'});
 for(const [type,rate] of [['urination',urinationRate],['defecation',defecationCount===undefined?defecationRate:0]])if(rate>0&&total>0){let t=0;while((t+=-Math.log(Math.max(1e-12,1-random()))/rate)<minutes)targets.push({distance:t/minutes*total,type});}
 targets.sort((a,b)=>a.distance-b.distance);
 const points=[routePoints[0]],stops=[];let next=0;
 for(let i=1;i<routePoints.length;i++){
  while(next<targets.length&&targets[next].distance<lengths[i]){const event=targets[next++],f=(event.distance-lengths[i-1])/(lengths[i]-lengths[i-1]);const a=routePoints[i-1],b=routePoints[i];points.push([a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f]);stops.push({index:points.length-1,type:event.type,duration:event.type==='defecation'?.5+random():.25+random()*.5});}
  points.push(routePoints[i]);
 }
 return {points,stops};
}
export function urinaryEvents(points,minutes,rate,random){return eliminationEvents(points,minutes,rate,0,random);}
function poisson(mean,random){let elapsed=0,count=0;if(mean<=0)return 0;while((elapsed+=-Math.log(Math.max(1e-12,1-random())))<mean)count++;return count;}
function pathLength(graph,path){let total=0;for(let i=1;i<path.length;i++)total+=distance(graph.nodes[path[i-1]].p,graph.nodes[path[i]].p);return total;}
export function chooseRoute(graph,home,targetMeters,random){
 let best=null,error=Infinity;
 for(let attempt=0;attempt<6;attempt++){const path=route(graph,home,targetMeters,random),meters=pathLength(graph,path),delta=Math.abs(meters-targetMeters);if(meters>0&&delta<error){best={path,meters};error=delta;}if(best&&error<=targetMeters*.15)break;}
 return best;
}
export function scheduleTrips(outings,rest=30){
 if(!outings.length)return [];
 const sorted=[...outings].sort((a,b)=>a.start-b.start);let best=null,bestShift=Infinity;
 // Try each overnight gap. Shifts preserve order and never overlap a dog's
 // next outing, including the repeated day's first outing.
 for(let anchor=0;anchor<sorted.length;anchor++){
  const scheduled=[];let end=-Infinity,shift=0;
  for(let k=0;k<sorted.length;k++){const index=(anchor+k)%sorted.length,trip=sorted[index],proposed=trip.start+(index<anchor?1440:0),start=Math.max(proposed,end+rest);scheduled.push({...trip,start});shift+=(start-proposed)**2;end=start+trip.duration;}
  if(end+rest<=scheduled[0].start+1440&&shift<bestShift){best=scheduled;bestShift=shift;}
 }
 if(!best)throw new Error('Les sorties dépassent la durée disponible dans une journée. Réduisez leur nombre ou leur durée.');
 return best.map(trip=>({...trip,start:trip.start%1440})).sort((a,b)=>a.start-b.start);
}
export function simulate(graph,settings){
 const random=rng(settings.seed),dogs=Math.max(0,Math.round(settings.households*settings.ownership/100*settings.dogsPerHousehold));const sample=Math.min(dogs,900),weight=sample?dogs/sample:0;const weights=graph.nodes.map(n=>n.weight),hourly=profile(settings.day),trips=[];
 const fecalMean=settings.defecationsPerDay??DEFAULTS.defecationsPerDay;
 for(let dog=0;dog<sample;dog++){
  const home=weightedIndex(weights,random),individualRate=(settings.urinationRate??DEFAULTS.urinationRate)*(.5+random()),walkingSpeed=50+30*random(),outings=[];
  const dailyFecal=poisson(fecalMean,random);
  for(let w=0;w<settings.walks;w++){
   let quantile=(w+random())/settings.walks,hour=0;for(;hour<23;hour++){quantile-=hourly[hour];if(quantile<=0)break;}
   const start=hour*60+random()*60,desired=Math.max(8,settings.duration*(1+normal(random)*.22));
   const targetMoving=Math.max(2,desired*(1-individualRate*.5)-fecalMean/settings.walks),chosen=chooseRoute(graph,home,targetMoving*walkingSpeed,random);if(!chosen)continue;
   outings.push({dog,home,start,desired,path:chosen.path,meters:chosen.meters,walkingSpeed,movingMinutes:chosen.meters/walkingSpeed,fecal:0,weight,color:COLORS[dog%COLORS.length]});
  }
  if(!outings.length)continue;
  for(let i=0;i<dailyFecal;i++)outings[weightedIndex(outings.map(t=>t.movingMinutes),random)].fecal++;
  for(const trip of outings){
   // Expected total exposure includes pauses; actual movement always obeys
   // the assigned walking speed. Pauses and event counts can vary the duration.
   const exposure=(trip.movingMinutes+trip.fecal)/Math.max(.1,1-individualRate*.5);
   const {points,stops}=eliminationEvents(trip.path.map(i=>graph.nodes[i].p),exposure,individualRate,0,random,{defecationCount:trip.fecal});
   const times=[0];for(let i=1;i<points.length;i++)times.push(times.at(-1)+distance(points[i-1],points[i])/walkingSpeed);
   for(const stop of stops){stop.at=times[stop.index];for(let i=stop.index+1;i<times.length;i++)times[i]+=stop.duration;}
   Object.assign(trip,{points,times,stops,duration:times.at(-1)});delete trip.path;delete trip.fecal;
  }
  trips.push(...scheduleTrips(outings));
 }
 return{dogs,trips,weight,sample,seed:settings.seed,totalWalks:trips.length*weight,meanDuration:trips.length?trips.reduce((n,t)=>n+t.duration,0)/trips.length:0,meanDistance:trips.length?trips.reduce((n,t)=>n+t.meters,0)/trips.length:0};
}
export function tripState(trip,time){const elapsed=(time-trip.start+1440)%1440;if(elapsed>trip.duration+.5)return null;const alpha=elapsed>trip.duration?Math.max(0,1-(elapsed-trip.duration)/.5):1;let i=1;while(i<trip.times.length&&trip.times[i]<=elapsed)i++;if(i>=trip.points.length)return{points:trip.points,p:trip.points.at(-1),alpha,stop:null};
 const stop=trip.stops.find(s=>elapsed>=s.at&&elapsed<s.at+s.duration);if(stop)return{points:trip.points.slice(0,stop.index+1),p:trip.points[stop.index],alpha,stop};
 const earlier=trip.stops.find(s=>s.index===i-1);const from=trip.times[i-1]+(earlier?.duration||0),to=trip.times[i];const f=Math.max(0,Math.min(1,(elapsed-from)/(to-from||1)));const a=trip.points[i-1],b=trip.points[i],p=[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];return{points:[...trip.points.slice(0,i),p],p,alpha,stop:null};
}
export function segmentCircle(a,b,p,r){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return distance([a[0]+dx*t,a[1]+dy*t],p)<=r?t:null;}
export function segmentCircleInterval(a,b,p,r){
 const dx=b[0]-a[0],dy=b[1]-a[1],fx=a[0]-p[0],fy=a[1]-p[1],aa=dx*dx+dy*dy;
 if(aa===0)return distance(a,p)<=r?[0,1]:null;
 const bb=2*(fx*dx+fy*dy),cc=fx*fx+fy*fy-r*r,disc=bb*bb-4*aa*cc;if(disc<0)return null;
 const lo=Math.max(0,(-bb-Math.sqrt(disc))/(2*aa)),hi=Math.min(1,(-bb+Math.sqrt(disc))/(2*aa));return lo<=hi?[lo,hi]:null;
}
export function statistics(sim,p,radius){const hours=Array(24).fill(0),urinationHours=Array(24).fill(0),defecationHours=Array(24).fill(0);let total=0,stops=0,urinations=0,defecations=0,sampleTrips=0;for(const trip of sim.trips){const seenHours=new Set();let hit=false;
 const addHours=(from,to)=>{const end=to>from?Math.ceil(to/60):Math.floor(from/60)+1;for(let h=Math.floor(from/60);h<end;h++)seenHours.add((h%24+24)%24);};
 for(let i=1;i<trip.points.length;i++){const interval=segmentCircleInterval(trip.points[i-1],trip.points[i],p,radius);if(!interval)continue;hit=true;const priorStop=trip.stops.find(s=>s.index===i-1),begin=trip.start+trip.times[i-1]+(priorStop?.duration||0),end=trip.start+trip.times[i];addHours(begin+(end-begin)*interval[0],begin+(end-begin)*interval[1]);}
 for(const s of trip.stops)if(distance(trip.points[s.index],p)<=radius){stops+=trip.weight;const hour=Math.floor(((trip.start+s.at)%1440+1440)%1440/60);if(s.type==='defecation'){defecations+=trip.weight;defecationHours[hour]+=trip.weight;}else{urinations+=trip.weight;urinationHours[hour]+=trip.weight;}hit=true;addHours(trip.start+s.at,trip.start+s.at+s.duration);}
 if(hit){sampleTrips++;total+=trip.weight;for(const h of seenHours)hours[h]+=trip.weight;}
 }
 return{sampleTrips,urinationHours:urinationHours.map(Math.round),defecationHours:defecationHours.map(Math.round),total:Math.round(total),hours:hours.map(Math.round),stops:Math.round(stops),urinations:Math.round(urinations),defecations:Math.round(defecations),peak:total>0?hours.indexOf(Math.max(...hours)):null};}
export const clock=time=>time===1440?'24:00':`${String(Math.floor(time/60)%24).padStart(2,'0')}:${String(Math.floor(time%60)).padStart(2,'0')}`;
