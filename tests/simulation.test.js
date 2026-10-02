import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemo,parseOSM} from '../src/geography.js';
import {DEFAULTS,simulate,statistics,profile,tripState} from '../src/simulation.js';
const graph=createDemo(),settings={...DEFAULTS,population:1000,households:480},sim=simulate(graph,settings);
test('deterministic seeded walks stay on connected streets and return home',()=>{
 assert.deepEqual(sim,simulate(graph,settings));assert.equal(sim.trips.length,sim.sample*settings.walks);
 for(const t of sim.trips){assert.deepEqual(t.points[0],t.points.at(-1));for(let i=1;i<t.points.length;i++){const a=graph.nodes.findIndex(n=>n.p===t.points[i-1]),b=graph.nodes.findIndex(n=>n.p===t.points[i]);assert.ok(graph.nodes[a].adj.some(e=>e.to===b));}assert.ok(t.times.every((v,i)=>i===0||v>=t.times[i-1]));}
});
test('day total deduplicates return visits while hourly counts use crossing time',()=>{
 const trip={points:[[-100,0],[100,0],[-100,0]],times:[0,10,20],start:7*60+50,weight:2,stops:[]};
 const result=statistics({trips:[trip]},[0,0],10);assert.equal(result.total,2);assert.equal(result.hours[7],2);assert.equal(result.hours[8],2);assert.equal(result.hours[12],0);
 assert.equal(statistics({trips:[trip]},[0,200],10).total,0);
});
test('trail survives the whole walk, pauses at the entrance, then fades',()=>{
 const trip={points:[[0,0],[10,0],[0,0]],times:[0,5,11],start:60,duration:11,stops:[{index:1,at:5,duration:1,door:{p:[10,0]}}]};
 const paused=tripState(trip,65.5);assert.deepEqual(paused.p,[10,0]);assert.ok(paused.stop);assert.equal(paused.points.length,2);
 assert.equal(tripState(trip,70).points.length,3);assert.ok(tripState(trip,71.25).alpha<1);assert.equal(tripState(trip,72),null);
});
test('zero ownership and zero pause probability produce zero corresponding events',()=>{
 const empty=simulate(graph,{...settings,ownership:0});assert.equal(empty.dogs,0);assert.equal(empty.trips.length,0);
 const noStops=simulate(graph,{...settings,stopChance:0});assert.ok(noStops.trips.every(t=>t.stops.length===0));
});
test('temporal profiles are normalized, with a delayed weekend morning',()=>{
 for(const day of ['weekday','weekend'])assert.ok(Math.abs(profile(day).reduce((a,b)=>a+b,0)-1)<1e-10);
 assert.ok(profile('weekday')[7]>profile('weekend')[7]);assert.ok(profile('weekend')[10]>profile('weekday')[10]);
});
test('OSM importer excludes disconnected networks and assigns building mass',()=>{
 const node=(id,lon,lat,tags)=>({type:'node',id,lon,lat,tags});const elements=[];for(let i=0;i<12;i++)elements.push(node(i,2.289+i*.0001,48.802));elements.push(node(20,2.28,48.81),node(21,2.2801,48.81));elements.push({type:'way',id:100,nodes:Array.from({length:12},(_,i)=>i),tags:{highway:'residential',name:'Rue test'}},{type:'way',id:101,nodes:[20,21],tags:{highway:'footway'}});
 elements.push(node(30,2.289,48.8021),node(31,2.2891,48.8021),node(32,2.2891,48.8022),node(33,2.289,48.8022),{type:'way',id:102,nodes:[30,31,32,33,30],tags:{building:'apartments','building:levels':'4'}});
 const g=parseOSM({elements},{geometry:{coordinates:[]},properties:{population:37000}});assert.equal(g.nodes.length,12);assert.equal(g.buildings.length,1);assert.ok(g.nodes.some(n=>n.weight>1));assert.equal(g.mode,'real');
});
test('a circle traversal straddling an hour boundary contributes to both hours',()=>{
 const trip={points:[[-100,0],[100,0]],times:[0,20],start:7*60+50,weight:1,stops:[]};
 const result=statistics({trips:[trip]},[0,0],20);assert.equal(result.total,1);assert.equal(result.hours[7],1);assert.equal(result.hours[8],1);
});
test('cadastre keeps only Châtillon parcels and preserves polygon holes',async()=>{
 const {parseCadastre,parcelAt}=await import('../src/geography.js');
 const data={type:'FeatureCollection',features:[{id:'a',properties:{code_insee:'92020',idu:'92020A',section:'AB',numero:'001'},geometry:{type:'Polygon',coordinates:[[[2.289,48.802],[2.290,48.802],[2.290,48.801],[2.289,48.801],[2.289,48.802]],[[2.2894,48.8016],[2.2896,48.8016],[2.2896,48.8014],[2.2894,48.8014],[2.2894,48.8016]]]}},{id:'b',properties:{code_insee:'92023'},geometry:{type:'Polygon',coordinates:[]}}]};
 const p=parseCadastre(data);assert.equal(p.length,1);assert.equal(parcelAt(p,[10,10]).id,'92020A');assert.equal(parcelAt(p,[36.65,55.66]),undefined);
});
