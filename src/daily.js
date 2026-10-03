// Calendar-day overlays are derived from the scenario, never from playback history.
// Seeking backward, replaying, and changing speed therefore cannot double-count.
const DAY=1440;
const mix=(a,b,f)=>[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];
export function dailySegments(trips){
 const segments=[];
 for(const trip of trips){
  const pauses=new Map(trip.stops.map(s=>[s.index,s.duration]));
  for(let i=1;i<trip.points.length;i++){
   const begin=trip.start+trip.times[i-1]+(pauses.get(i-1)||0),end=trip.start+trip.times[i];
   if(end<=begin)continue;
   for(const shift of [0,-DAY]){
    const start=begin+shift,finish=end+shift,lo=Math.max(0,start),hi=Math.min(DAY,finish);if(hi<=lo)continue;
    segments.push({a:mix(trip.points[i-1],trip.points[i],(lo-start)/(finish-start)),b:mix(trip.points[i-1],trip.points[i],(hi-start)/(finish-start)),start:lo,end:hi,color:trip.color});
   }
  }
 }
 return segments.sort((a,b)=>a.start-b.start);
}
export function segmentUntil(segment,time){
 if(time<=segment.start)return null;
 return {a:segment.a,b:mix(segment.a,segment.b,Math.min(1,(time-segment.start)/(segment.end-segment.start)))};
}
function series(entries){
 entries.sort((a,b)=>a.time-b.time);let sum=0;
 return {times:entries.map(e=>e.time),sums:entries.map(e=>(sum+=e.weight)),total:entries.reduce((n,e)=>n+e.weight,0)};
}
export function valueUntil(series,time){
 // Half-open interval [00:00, selected time): no future events at midnight.
 let lo=0,hi=series.times.length;while(lo<hi){const mid=(lo+hi)>>1;if(series.times[mid]<time)lo=mid+1;else hi=mid;}
 return lo?series.sums[lo-1]:0;
}
export function heatIndex(trips,kind='urination'){
 const cellSize=10,radius=30,cells=new Map(),events=[];
 for(const trip of trips)for(const stop of trip.stops){
  const type=stop.type||'urination';if(type!=='urination'&&type!=='defecation')continue;if(kind!=='all'&&kind!==type)continue;
  const p=trip.points[stop.index],time=((trip.start+stop.at)%DAY+DAY)%DAY,weight=trip.weight;events.push({time,weight});
  // A normalized compact kernel preserves the weighted number of events.
  const candidates=[];let sum=0;
  for(let x=Math.floor((p[0]-radius)/cellSize);x<=Math.floor((p[0]+radius)/cellSize);x++)for(let y=Math.floor((p[1]-radius)/cellSize);y<=Math.floor((p[1]+radius)/cellSize);y++){
   const d=Math.hypot((x+.5)*cellSize-p[0],(y+.5)*cellSize-p[1]);if(d>=radius)continue;
   const kernel=(1-(d/radius)**2)**2;candidates.push({x,y,kernel});sum+=kernel;
  }
  for(const {x,y,kernel} of candidates){const key=`${x}:${y}`;if(!cells.has(key))cells.set(key,{x,y,entries:[]});cells.get(key).entries.push({time,weight:weight*kernel/sum});}
 }
 const indexed=Array.from(cells.values(),({x,y,entries})=>({x,y,...series(entries)}));
 let max=0;for(const cell of indexed)max=Math.max(max,cell.total);
 return {cells:indexed,events:series(events),max,cellSize,radius,kind};
}
