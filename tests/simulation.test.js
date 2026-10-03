import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemo,parseOSM,cemeteryAreas,crossesCemetery,unproject} from '../src/geography.js';
import {DEFAULTS,simulate,statistics,profile,tripState} from '../src/simulation.js';
const graph=createDemo(),settings={...DEFAULTS,population:1000,households:480},sim=simulate(graph,settings);
test('deterministic seeded walks stay on connected streets and return home',()=>{
 assert.deepEqual(sim,simulate(graph,settings));assert.equal(sim.trips.length,sim.sample*settings.walks);
 for(const t of sim.trips){assert.deepEqual(t.points[0],t.points.at(-1));for(let i=1;i<t.points.length;i++){assert.ok(graph.edges.some(e=>{const a=graph.nodes[e.a].p,b=graph.nodes[e.b].p;const on=p=>Math.abs(Math.hypot(p[0]-a[0],p[1]-a[1])+Math.hypot(p[0]-b[0],p[1]-b[1])-Math.hypot(a[0]-b[0],a[1]-b[1]))<1e-6;return on(t.points[i-1])&&on(t.points[i]);}));}assert.ok(t.times.every((v,i)=>i===0||v>=t.times[i-1]));}
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
test('zero ownership and zero elimination rates produce zero corresponding events',()=>{
 const empty=simulate(graph,{...settings,ownership:0});assert.equal(empty.dogs,0);assert.equal(empty.trips.length,0);
 const noStops=simulate(graph,{...settings,urinationRate:0,defecationsPerDay:0});assert.ok(noStops.trips.every(t=>t.stops.length===0));
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
test('real walking graph never enters or crosses the communal cemetery',async()=>{
 const {readFile}=await import('node:fs/promises');const data=JSON.parse(await readFile(new URL('../public/data/chatillon.json',import.meta.url),'utf8'));
 const areas=cemeteryAreas(data.osm);assert.ok(areas.length>0);
 const graph=parseOSM(data.osm,data.commune);assert.ok(graph.nodes.length>100);
 for(const edge of graph.edges)assert.equal(crossesCemetery(unproject(graph.nodes[edge.a].p),unproject(graph.nodes[edge.b].p),areas),false);
 for(const node of graph.nodes)assert.ok(node.adj.length>0);
});
test('cemetery crossing detects a segment with both endpoints outside',()=>{
 const area={type:'Polygon',coordinates:[[[0,0],[2,0],[2,2],[0,2],[0,0]]]};
 assert.equal(crossesCemetery([-1,1],[3,1],[area]),true);
 assert.equal(crossesCemetery([-1,-1],[3,-1],[area]),false);
});
test('urinary event rate follows the configured mean independently of doors',async()=>{
 const {urinaryEvents}=await import('../src/simulation.js');const {rng}=await import('../src/geography.js');const random=rng(1234);let count=0;
 for(let i=0;i<4000;i++){const result=urinaryEvents([[0,0],[1000,0]],25,.2,random);count+=result.stops.length;for(const stop of result.stops){assert.equal(stop.type,'urination');assert.ok(result.points[stop.index][0]>0&&result.points[stop.index][0]<1000);}}
 assert.ok(Math.abs(count/4000-5)<.15);assert.equal(urinaryEvents([[0,0],[1000,0]],25,0,random).stops.length,0);
});

test('defecation rate matches its reference and counters separate both event types',async()=>{
 const {eliminationEvents}=await import('../src/simulation.js');const {rng}=await import('../src/geography.js');const random=rng(2345);let fecal=0,urine=0;
 for(let i=0;i<4000;i++){const result=eliminationEvents([[0,0],[1000,0]],25,.2,.04,random);for(const stop of result.stops)stop.type==='defecation'?fecal++:urine++;assert.ok(result.stops.every((stop,j)=>j===0||stop.index>result.stops[j-1].index));}
 assert.ok(Math.abs(fecal/4000-1)<.08);assert.ok(Math.abs(urine/4000-5)<.15);
 const result=statistics({trips:[{points:[[0,0],[10,0],[20,0],[0,0]],times:[0,2,4,6],start:0,weight:3,stops:[{index:1,at:2,duration:.5,type:'urination'},{index:2,at:4,duration:1,type:'defecation'}]}]},[15,0],10);
 assert.equal(result.urinations,3);assert.equal(result.defecations,3);assert.equal(result.stops,6);assert.equal(result.total,3);
 assert.ok(eliminationEvents([[0,0],[1000,0]],25,0,.1,random).stops.every(s=>s.type==='defecation'));
});

test('walks form a loop when an alternate street returns home',async()=>{
 const {route}=await import('../src/simulation.js');const {rng}=await import('../src/geography.js');
 const nodes=[[0,0],[100,0],[100,100],[0,100]].map(p=>({p,adj:[]}));for(let i=0;i<4;i++){const j=(i+1)%4;nodes[i].adj.push({to:j,len:100});nodes[j].adj.push({to:i,len:100});}
 for(let seed=0;seed<30;seed++){const path=route({nodes},0,400,rng(seed));assert.equal(path[0],0);assert.equal(path.at(-1),0);assert.equal(path.length,5);assert.equal(new Set(path.slice(0,-1)).size,4);}
});
test('a cul-de-sac only retraces the unavoidable access to a loop',async()=>{
 const {route}=await import('../src/simulation.js');const {rng}=await import('../src/geography.js');
 const nodes=[[-100,0],[0,0],[100,0],[100,100],[0,100]].map(p=>({p,adj:[]}));for(const [a,b] of [[0,1],[1,2],[2,3],[3,4],[4,1]]){nodes[a].adj.push({to:b,len:100});nodes[b].adj.push({to:a,len:100});}
 const path=route({nodes},0,600,rng(7));assert.equal(path.at(-1),0);const uses=new Map();for(let i=1;i<path.length;i++){const key=[path[i-1],path[i]].sort().join(':');uses.set(key,(uses.get(key)||0)+1);}assert.equal(uses.get('0:1'),2);for(const [edge,count] of uses)if(edge!=='0:1')assert.equal(count,1);
});
