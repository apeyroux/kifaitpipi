import {rng,distance} from './geography.js';
import {createWalkingProfile,chooseWalkIntent,planWalk} from './routes.js';
import {walkingGeometry,addSniffing,crossingActivities,walkingTimeline} from './walking.js';
import {createMarkingDistribution} from './marking.js';
import {parcelZone} from './observation.js';
export {route,chooseRoute} from './routes.js';
export const DEFAULTS={population:36705,households:17646,dogsPerHousehold:1,ownership:22,walks:2,duration:25,urinationRate:.2,defecationsPerDay:2,seed:92020,day:'weekday'};
export const COLORS=['#68f4d2','#5ac9ff','#a893ff','#7dfbe3'];
const normal=(random)=>Math.sqrt(-2*Math.log(Math.max(.00001,random())))*Math.cos(2*Math.PI*random());
export function profile(day){const peaks=day==='weekend'?[[9.5,1.4,.32],[14,1.5,.23],[19,1.5,.45]]:[[7.5,1,.34],[12.5,1,.2],[18.5,1.4,.46]];const weights=Array.from({length:24},(_,h)=>peaks.reduce((s,[m,sd,w])=>s+w*Math.exp(-.5*((h+.5-m)/sd)**2)/sd,0)+.001);const sum=weights.reduce((a,b)=>a+b,0);return weights.map(w=>w/sum);}
function weightedIndex(weights,random){const sum=weights.reduce((a,b)=>a+b,0);let r=random()*sum;for(let i=0;i<weights.length;i++){r-=weights[i];if(r<=0)return i;}return weights.length-1;}
export function eliminationEvents(routePoints,minutes,urinationRate,defecationRate,random,{defecationCount,urinationDistribution}={}){
 const lengths=[0];for(let i=1;i<routePoints.length;i++)lengths.push(lengths.at(-1)+distance(routePoints[i-1],routePoints[i]));
 const total=lengths.at(-1),targets=[];
 if(defecationCount!==undefined&&total>0)for(let i=0;i<defecationCount;i++)targets.push({distance:random()*total,type:'defecation'});
 for(const [type,rate] of [['urination',urinationRate],['defecation',defecationCount===undefined?defecationRate:0]])if(rate>0&&total>0){let t=0;while((t+=-Math.log(Math.max(1e-12,1-random()))/rate)<minutes)targets.push({distance:t/minutes*total,type});}
 targets.sort((a,b)=>a.distance-b.distance);
 // Assign the original pause draws before redistributing urinary positions.
 // Placement changes neither event counts nor the duration of any elimination.
 for(const event of targets){
  event.duration=event.type==='defecation'?.5+random():.25+random()*.5;
  if(event.type==='urination'&&urinationDistribution)event.distance=urinationDistribution.mapDistance(event.distance);
 }
 targets.sort((a,b)=>a.distance-b.distance);
 const points=[routePoints[0]],stops=[];let next=0;
 for(let i=1;i<routePoints.length;i++){
  while(next<targets.length&&targets[next].distance<lengths[i]){const event=targets[next++],f=(event.distance-lengths[i-1])/(lengths[i]-lengths[i-1]);const a=routePoints[i-1],b=routePoints[i];points.push([a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f]);stops.push({index:points.length-1,type:event.type,duration:event.duration});}
  points.push(routePoints[i]);
 }
 return {points,stops};
}
export function urinaryEvents(points,minutes,rate,random){return eliminationEvents(points,minutes,rate,0,random);}
function poisson(mean,random){let elapsed=0,count=0;if(mean<=0)return 0;while((elapsed+=-Math.log(Math.max(1e-12,1-random())))<mean)count++;return count;}
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
 const dogs=Math.max(0,Math.round(settings.households*settings.ownership/100*settings.dogsPerHousehold));const sample=Math.min(dogs,900),weight=sample?dogs/sample:0;
 const weights=graph.nodes.map(n=>n.weight??1),hourly=profile(settings.day),trips=[];
 const fecalMean=settings.defecationsPerDay??DEFAULTS.defecationsPerDay;
 for(let dog=0;dog<sample;dog++){
  // Independent streams keep daily counts and traits stable when route planning
  // or the number of outings changes how many random values are consumed.
  const dogSeed=(settings.seed+Math.imul(dog+1,0x9e3779b1))|0,random=rng(dogSeed);
  const home=weightedIndex(weights,random),individualRate=(settings.urinationRate??DEFAULTS.urinationRate)*(.5+random()),walkingSpeed=50+30*random(),sniffRate=.12+random()*.12,outings=[];
  const walkingProfile=createWalkingProfile(graph,home,rng(dogSeed^0x51ed270b)),fecalRandom=rng(dogSeed^0x6ac690c5),dailyFecal=poisson(fecalMean,fecalRandom);
  for(let w=0;w<settings.walks;w++){
   const outingSeed=(dogSeed+Math.imul(w+1,0x45d9f3b))|0,outingRandom=rng(outingSeed);
   let quantile=(w+outingRandom())/settings.walks,hour=0;for(;hour<23;hour++){quantile-=hourly[hour];if(quantile<=0)break;}
   walkingProfile.targetMeters=settings.duration*walkingSpeed*.8;
   const start=hour*60+outingRandom()*60,intent=chooseWalkIntent(walkingProfile,hour,settings.day,outingRandom);
   const durationFactor=intent==='local'?.8:intent==='green'?1.15:1;
   const desired=Math.max(8,settings.duration*durationFactor*(1+normal(outingRandom)*.15));
   const targetMoving=Math.max(2,(desired*(1-individualRate*.5)-fecalMean/settings.walks)/(1+sniffRate*.25));
   const chosen=planWalk(graph,walkingProfile,targetMoving*walkingSpeed*.94,intent,outingRandom);if(!chosen)continue;
   const geometry=walkingGeometry(graph,chosen.path,walkingSpeed,rng(outingSeed^0x7f4a7c15));
   const crossings=crossingActivities(graph,chosen.path,geometry,rng(outingSeed^0x19b043f7));
   outings.push({dog,home,start,desired,intent:chosen.intent??intent,circuitId:chosen.circuitId,reusedCircuit:chosen.reusedCircuit,waypoints:chosen.waypoints,returnDetour:chosen.returnDetour,repeatedFraction:chosen.repeatedFraction,meters:geometry.meters,walkingSpeed,movingMinutes:geometry.movingMinutes,geometry,crossings,marking:createMarkingDistribution(graph,chosen.path),outingSeed,fecal:0,weight,color:COLORS[dog%COLORS.length]});
  }
  if(!outings.length)continue;
  for(let i=0;i<dailyFecal;i++)outings[weightedIndex(outings.map(t=>t.movingMinutes),fecalRandom)].fecal++;
  for(const trip of outings){
   const sniffing=addSniffing({points:trip.geometry.points,stops:[]},trip.geometry,sniffRate,rng(trip.outingSeed^0x2f16e9a7));
   const sniffMinutes=sniffing.stops.reduce((n,s)=>n+s.duration,0);
   const crossingMinutes=trip.crossings.stops.reduce((n,s)=>n+s.duration,0);
   const exposure=(trip.movingMinutes+trip.fecal+sniffMinutes+crossingMinutes)/Math.max(.1,1-individualRate*.5);
   const elimination=eliminationEvents(trip.geometry.points,exposure,individualRate,0,rng(trip.outingSeed^0x3a75bdb9),{defecationCount:trip.fecal,urinationDistribution:trip.marking});
   // Merge the already sampled activities without drawing new random values.
   const {points,stops}=mergeActivities(trip.geometry.points,[sniffing,trip.crossings,elimination]);
   Object.assign(trip,{points,stops,...walkingTimeline(points,stops,trip.geometry)});
   delete trip.geometry;delete trip.crossings;delete trip.marking;delete trip.outingSeed;delete trip.fecal;
  }
  trips.push(...scheduleTrips(outings));
 }
 return{dogs,trips,weight,sample,seed:settings.seed,totalWalks:trips.length*weight,meanDuration:trips.length?trips.reduce((n,t)=>n+t.duration,0)/trips.length:0,meanDistance:trips.length?trips.reduce((n,t)=>n+t.meters,0)/trips.length:0};
}
function mergeActivities(routePoints,groups){
 const targets=[];
 for(const group of groups){let meters=0,next=0;for(let i=0;i<group.points.length;i++){
  if(i)meters+=distance(group.points[i-1],group.points[i]);
  while(next<group.stops.length&&group.stops[next].index===i){const stop=group.stops[next++];targets.push({meters,type:stop.type,duration:stop.duration});}
 }}
 targets.sort((a,b)=>a.meters-b.meters);
 const points=[routePoints[0]],stops=[];let meters=0,next=0;
 for(let i=1;i<routePoints.length;i++){
  const a=routePoints[i-1],b=routePoints[i],len=distance(a,b),end=meters+len;
  while(next<targets.length&&targets[next].meters<end){const target=targets[next++],f=Math.max(0,(target.meters-meters)/(len||1));points.push([a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f]);stops.push({index:points.length-1,type:target.type,duration:target.duration});}
  points.push(b);meters=end;
 }
 return {points,stops};
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
export function statistics(sim,p,radius,parcel=null){const zone=parcel?parcelZone(parcel,radius):null,hours=Array(24).fill(0),urinationHours=Array(24).fill(0),defecationHours=Array(24).fill(0);let total=0,stops=0,urinations=0,defecations=0,sampleTrips=0;for(const trip of sim.trips){const seenHours=new Set();let hit=false;
 // Projection roundoff at an exact hour must not create a phantom next hour.
 const addHours=(from,to)=>{const snap=t=>Math.abs(t/60-Math.round(t/60))<1e-9?Math.round(t/60)*60:t;from=snap(from);to=snap(to);const end=to>from?Math.ceil(to/60):Math.floor(from/60)+1;for(let h=Math.floor(from/60);h<end;h++)seenHours.add((h%24+24)%24);};
 for(let i=1;i<trip.points.length;i++){const intervals=zone?zone.intervals(trip.points[i-1],trip.points[i]):[segmentCircleInterval(trip.points[i-1],trip.points[i],p,radius)].filter(Boolean);if(!intervals.length)continue;hit=true;const priorStop=trip.stops.find(s=>s.index===i-1),begin=trip.start+trip.times[i-1]+(priorStop?.duration||0),end=trip.start+trip.times[i];for(const interval of intervals)addHours(begin+(end-begin)*interval[0],begin+(end-begin)*interval[1]);}
 for(const s of trip.stops)if(zone?zone.contains(trip.points[s.index]):distance(trip.points[s.index],p)<=radius){const type=s.type||'urination';if(type==='urination'||type==='defecation'){stops+=trip.weight;const hour=Math.floor(((trip.start+s.at)%1440+1440)%1440/60);if(type==='defecation'){defecations+=trip.weight;defecationHours[hour]+=trip.weight;}else{urinations+=trip.weight;urinationHours[hour]+=trip.weight;}}hit=true;addHours(trip.start+s.at,trip.start+s.at+s.duration);}
 if(hit){sampleTrips++;total+=trip.weight;for(const h of seenHours)hours[h]+=trip.weight;}
 }
 return{sampleTrips,urinationHours:urinationHours.map(Math.round),defecationHours:defecationHours.map(Math.round),total:Math.round(total),hours:hours.map(Math.round),stops:Math.round(stops),urinations:Math.round(urinations),defecations:Math.round(defecations),peak:total>0?hours.indexOf(Math.max(...hours)):null};}
export const clock=time=>time===1440?'24:00':`${String(Math.floor(time/60)%24).padStart(2,'0')}:${String(Math.floor(time%60)).padStart(2,'0')}`;
