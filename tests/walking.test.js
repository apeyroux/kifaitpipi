import test from 'node:test';
import assert from 'node:assert/strict';
import {rng,distance,createDemo} from '../src/geography.js';
import {walkingGeometry,addSniffing,crossingActivities,walkingTimeline} from '../src/walking.js';
import {DEFAULTS,simulate,statistics,tripState} from '../src/simulation.js';
import {heatIndex,valueUntil,dailySegments} from '../src/daily.js';

test('a corner slows the approach while geometry and distance remain on the street',()=>{
 const nodes=[[0,0],[100,0],[100,100]].map(p=>({p,adj:[]}));
 nodes[0].adj=[{to:1,len:100,streetId:'A'}];nodes[1].adj=[{to:2,len:100,streetId:'B'}];
 const geometry=walkingGeometry({nodes},[0,1,2],60,rng(12));
 assert.deepEqual(geometry.points,[[0,0],[94,0],[100,0],[100,100]]);
 assert.equal(geometry.meters,200);assert.ok(geometry.legs[1].speed<geometry.legs[0].speed);
 assert.ok(geometry.points.every(p=>p[1]===0||p[0]===100));
});

test('geometry nodes on one street do not cause random changes in pace',()=>{
 const graph=xs=>({nodes:xs.map((x,i)=>({p:[x,0],adj:i<xs.length-1?[{to:i+1,len:xs[i+1]-x,streetId:'A'}]:[]}))});
 const simple=walkingGeometry(graph([0,100]),[0,1],60,rng(17));
 const subdivided=walkingGeometry(graph([0,20,40,60,80,100]),[0,1,2,3,4,5],60,rng(17));
 assert.ok(Math.abs(simple.movingMinutes-subdivided.movingMinutes)<1e-10);
});

test('sniffing adds time without adding elimination counters or heat',()=>{
 const trip={points:[[0,0],[10,0],[20,0]],times:[0,5,11],duration:11,start:60,weight:3,color:'#68f4d2',stops:[{index:1,at:5,duration:1,type:'sniff'}]};
 const stats=statistics({trips:[trip]},[10,0],5);
 assert.equal(stats.total,3);assert.equal(stats.stops,0);assert.equal(stats.urinations,0);assert.equal(stats.defecations,0);
 for(const kind of ['urination','defecation','all']){const heat=heatIndex([trip],kind);assert.equal(valueUntil(heat.events,1440),0);assert.equal(heat.cells.length,0);}
 assert.equal(tripState(trip,65.5).stop.type,'sniff');assert.deepEqual(tripState(trip,65.5).p,[10,0]);
 assert.equal(dailySegments([trip])[1].start,66);
});

test('sampled sniffing pauses have positive bounded duration and preserve all path segments',()=>{
 const geometry={points:[[0,0],[1000,0]],legs:[{start:0,end:1000,speed:60,green:true}],movingMinutes:1000/60,meters:1000};
 const activities=addSniffing({points:geometry.points,stops:[]},geometry,.24,rng(37));
 assert.ok(activities.stops.length>0);
 const timeline=walkingTimeline(activities.points,activities.stops,geometry);
 const pauses=activities.stops.reduce((n,s)=>n+s.duration,0);
 assert.ok(Math.abs(timeline.duration-(1000/60+pauses))<1e-9);
 for(const stop of activities.stops){assert.equal(stop.type,'sniff');assert.ok(stop.duration>=5/60&&stop.duration<=25/60);assert.equal(stop.at,timeline.times[stop.index]);}
 assert.ok(activities.points.every(p=>p[1]===0&&p[0]>=0&&p[0]<=1000));
 assert.ok(Math.abs(activities.points.slice(1).reduce((n,p,i)=>n+distance(activities.points[i],p),0)-1000)<1e-9);
});

test('waiting occurs at mapped crossings, with one wait for a subdivided crossing',()=>{
 const nodes=[[0,0],[10,0],[20,0],[30,0],[40,0]].map(p=>({p,adj:[]}));
 for(let i=0;i<4;i++)nodes[i].adj.push({to:i+1,len:10,streetId:'A',crossing:i===1||i===2,crossingType:'traffic_signals'});
 const graph={nodes},path=[0,1,2,3,4],geometry=walkingGeometry(graph,path,60,rng(3));
 const waits=crossingActivities(graph,path,geometry,()=>.5);
 assert.equal(waits.stops.length,1);assert.deepEqual(waits.points[waits.stops[0].index],[10,0]);
 assert.equal(waits.stops[0].type,'crossing');assert.equal(waits.stops[0].duration,25/60);
 assert.equal(crossingActivities(graph,path,geometry,()=>.99).stops.length,0);
 const timeline=walkingTimeline(waits.points,waits.stops,geometry),trip={...waits,...timeline,start:0,weight:1};
 assert.ok(tripState(trip,waits.stops[0].at+.1).stop);
 assert.equal(statistics({trips:[trip]},[10,0],5).stops,0);assert.equal(heatIndex([trip],'all').events.total,0);
});

test('a crossing node without a separately mapped footway has a bounded short wait',()=>{
 const nodes=[[0,0],[20,0],[40,0]].map(p=>({p,adj:[]}));nodes[1].crossing=true;
 for(let i=0;i<2;i++)nodes[i].adj.push({to:i+1,len:20,streetId:'A'});
 const graph={nodes},geometry=walkingGeometry(graph,[0,1,2],60,rng(1));
 const waits=crossingActivities(graph,[0,1,2],geometry,()=>.5);
 assert.equal(waits.stops.length,1);assert.deepEqual(waits.points[waits.stops[0].index],[20,0]);assert.equal(waits.stops[0].duration,7/60);
});

test('a signal mapped at the other end applies to the whole crossing in both directions',()=>{
 const nodes=[[0,0],[20,0]].map(p=>({p,adj:[]}));nodes[1].crossing=true;nodes[1].crossingType='traffic_signals';
 nodes[0].adj=[{to:1,len:20,crossing:true,crossingType:'unknown'}];nodes[1].adj=[{to:0,len:20,crossing:true,crossingType:'unknown'}];
 for(const path of [[0,1],[1,0]]){
  const graph={nodes},geometry=walkingGeometry(graph,path,60,rng(1)),waits=crossingActivities(graph,path,geometry,()=>.6);
  assert.equal(waits.stops.length,1);assert.equal(waits.stops[0].duration,29/60);
 }
});

test('the same dogs keep the same daily fecal counts across outing schedules',()=>{
 const graph=createDemo(),settings={...DEFAULTS,households:100,ownership:100};
 const counts=walks=>{
  const trips=simulate(graph,{...settings,walks}).trips;
  return Array.from({length:100},(_,dog)=>trips.filter(t=>t.dog===dog).reduce((n,t)=>n+t.stops.filter(s=>s.type==='defecation').length,0));
 };
 assert.deepEqual(counts(1),counts(4));
});
