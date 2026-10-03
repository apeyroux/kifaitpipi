import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemo,distance} from '../src/geography.js';
import {DEFAULTS,simulate,scheduleTrips,statistics} from '../src/simulation.js';
const graph=createDemo();
test('moving time follows walking distance at the assigned speed, including after stops',()=>{
 const sim=simulate(graph,{...DEFAULTS,households:100,ownership:100,walks:3,duration:25});
 for(const trip of sim.trips){
  assert.ok(trip.walkingSpeed>=50&&trip.walkingSpeed<=80);
  const pauses=new Map(trip.stops.map(s=>[s.index,s.duration]));let meters=0;
  let movingTotal=0;
  for(let i=1;i<trip.points.length;i++){const d=distance(trip.points[i-1],trip.points[i]);meters+=d;const moving=trip.times[i]-trip.times[i-1]-(pauses.get(i-1)||0);assert.ok(trip.speeds[i]>0);assert.ok(Math.abs(moving-d/trip.speeds[i])<1e-8);movingTotal+=moving;}
  assert.ok(Math.abs(meters-trip.meters)<1e-8);
  assert.ok(Math.abs(trip.duration-(movingTotal+trip.stops.reduce((n,s)=>n+s.duration,0)))<1e-8);
 }
});
test('scheduling separates a dog\'s outings across the midnight boundary',()=>{
 for(const proposals of [[{start:10,duration:40},{start:1430,duration:50}],[{start:400,duration:50},{start:420,duration:50},{start:430,duration:50}]]){
  const trips=scheduleTrips(proposals);
  assert.equal(trips.length,proposals.length);
  for(let i=0;i<trips.length;i++){const next=trips[(i+1)%trips.length].start+(i===trips.length-1?1440:0);assert.ok(next-trips[i].start-trips[i].duration>=30-1e-8);}
 }
});
test('daily fecal expectation remains near the daily setting when walking time increases',()=>{
 for(const settings of [{walks:1,duration:10},{walks:6,duration:60}]){
  const sim=simulate(graph,{...DEFAULTS,...settings,households:900,ownership:100});
  const count=sim.trips.reduce((n,t)=>n+t.stops.filter(s=>s.type==='defecation').length,0);
  assert.ok(Math.abs(count/sim.sample-2)<.2);
 }
});
test('hourly elimination counts reconcile with daily counts and midnight',()=>{
 const trip={points:[[0,0],[10,0],[20,0]],times:[0,5,10],start:1430,weight:1,duration:10,stops:[{index:1,at:5,duration:1,type:'urination'},{index:2,at:10,duration:1,type:'defecation'}]};
 const stats=statistics({trips:[trip]},[10,0],50);assert.equal(stats.sampleTrips,1);assert.equal(stats.urinationHours[23],1);assert.equal(stats.defecationHours[0],1);assert.equal(stats.urinationHours.reduce((a,b)=>a+b),stats.urinations);assert.equal(stats.defecationHours.reduce((a,b)=>a+b),stats.defecations);
 const empty=statistics({trips:[]},[0,0],5);assert.equal(empty.peak,null);assert.equal(empty.sampleTrips,0);
});
test('finishing at an hour boundary does not invent a passage in the following hour',()=>{
 const trip={points:[[0,0],[10,0]],times:[0,10],start:50,weight:1,stops:[]};
 const stats=statistics({trips:[trip]},[5,0],20);assert.equal(stats.hours[0],1);assert.equal(stats.hours[1],0);
});
