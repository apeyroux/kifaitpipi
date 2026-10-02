import {rng,distance} from './geography.js';
export const DEFAULTS={population:36705,households:17646,dogsPerHousehold:1,ownership:22,walks:3,duration:25,stopChance:18,seed:92020,day:'weekday'};
export const COLORS=['#68f4d2','#5ac9ff','#a893ff','#7dfbe3'];
const normal=(random)=>Math.sqrt(-2*Math.log(Math.max(.00001,random())))*Math.cos(2*Math.PI*random());
export function profile(day){const peaks=day==='weekend'?[[9.5,1.4,.32],[14,1.5,.23],[19,1.5,.45]]:[[7.5,1,.34],[12.5,1,.2],[18.5,1.4,.46]];const weights=Array.from({length:24},(_,h)=>peaks.reduce((s,[m,sd,w])=>s+w*Math.exp(-.5*((h+.5-m)/sd)**2)/sd,0)+.001);const sum=weights.reduce((a,b)=>a+b,0);return weights.map(w=>w/sum);}
function weightedIndex(weights,random){const sum=weights.reduce((a,b)=>a+b,0);let r=random()*sum;for(let i=0;i<weights.length;i++){r-=weights[i];if(r<=0)return i;}return weights.length-1;}
function route(graph,start,targetMeters,random){const path=[start];let prev=-1,u=start,meters=0;const visited=new Set([start]);for(let k=0;k<120&&meters<targetMeters/2;k++){
 const candidates=graph.nodes[u].adj;if(!candidates.length)break;const choice=weightedIndex(candidates.map(e=>e.to===prev?.04:visited.has(e.to)?.3:1),random);const e=candidates[choice];prev=u;u=e.to;path.push(u);visited.add(u);meters+=e.len;
 }
 // Breadth-first return path on actual connected streets; no straight-line shortcut.
 const parents=new Map([[u,null]]),queue=[u];for(let j=0;j<queue.length&&!parents.has(start);j++)for(const e of graph.nodes[queue[j]].adj)if(!parents.has(e.to)){parents.set(e.to,queue[j]);queue.push(e.to);}
 if(parents.has(start)){const back=[start];while(back.at(-1)!==u)back.push(parents.get(back.at(-1)));path.push(...back.reverse().slice(1));}else path.push(...path.slice(0,-1).reverse());
 return path;
}
export function simulate(graph,settings){
 const random=rng(settings.seed),dogs=Math.max(0,Math.round(settings.households*settings.ownership/100*settings.dogsPerHousehold));const sample=Math.min(dogs,900),weight=sample?dogs/sample:0;const weights=graph.nodes.map(n=>n.weight);const doorByNode=new Map();graph.doors.forEach(d=>doorByNode.set(d.node,d));const hourly=profile(settings.day),trips=[];
 for(let dog=0;dog<sample;dog++){
  const home=weightedIndex(weights,random);for(let w=0;w<settings.walks;w++){
   // Stratified inverse CDF gives each dog spread-out daily outings, while matching the aggregate profile.
   let quantile=(w+random())/settings.walks, hour=0;for(;hour<23;hour++){quantile-=hourly[hour];if(quantile<=0)break;}
   const start=hour*60+random()*60;const desired=Math.max(8,settings.duration*(1+normal(random)*.22));const path=route(graph,home,desired*65,random);const points=path.map(i=>graph.nodes[i].p);const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths.at(-1)+distance(points[i-1],points[i]));if(lengths.at(-1)===0)continue;
   const stops=[];const usedDoors=new Set();for(let i=1;i<path.length-1;i++){const door=doorByNode.get(path[i]);if(door&&!usedDoors.has(path[i])&&random()<settings.stopChance/100&&stops.length<5){stops.push({index:i,door,duration:.25+random()*.5});usedDoors.add(path[i]);}}
   const pauseTotal=stops.reduce((s,p)=>s+p.duration,0),moving=Math.max(4,desired-pauseTotal),times=lengths.map(l=>l/lengths.at(-1)*moving);for(const stop of stops){stop.at=times[stop.index];for(let i=stop.index+1;i<times.length;i++)times[i]+=stop.duration;}
   const duration=times.at(-1);trips.push({dog,home,start,duration,points,times,stops,weight,color:COLORS[dog%COLORS.length]});
  }
 }
 return{dogs,trips,weight,sample,seed:settings.seed,totalWalks:dogs*settings.walks};
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
export function statistics(sim,p,radius){const hours=Array(24).fill(0);let total=0,stops=0;for(const trip of sim.trips){const seenHours=new Set();let hit=false;
 const addHours=(from,to)=>{for(let h=Math.floor(from/60);h<=Math.floor(to/60);h++)seenHours.add(h%24);};
 for(let i=1;i<trip.points.length;i++){const interval=segmentCircleInterval(trip.points[i-1],trip.points[i],p,radius);if(!interval)continue;hit=true;const priorStop=trip.stops.find(s=>s.index===i-1),begin=trip.start+trip.times[i-1]+(priorStop?.duration||0),end=trip.start+trip.times[i];addHours(begin+(end-begin)*interval[0],begin+(end-begin)*interval[1]);}
 for(const s of trip.stops)if(distance(trip.points[s.index],p)<=radius){stops+=trip.weight;hit=true;addHours(trip.start+s.at,trip.start+s.at+s.duration);}
 if(hit){total+=trip.weight;for(const h of seenHours)hours[h]+=trip.weight;}
 }
 return{total:Math.round(total),hours:hours.map(Math.round),stops:Math.round(stops),peak:hours.indexOf(Math.max(...hours))};}
export const clock=time=>`${String(Math.floor(time/60)%24).padStart(2,'0')}:${String(Math.floor(time%60)).padStart(2,'0')}`;
