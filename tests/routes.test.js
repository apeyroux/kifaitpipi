import test from 'node:test';
import assert from 'node:assert/strict';
import {distance,rng} from '../src/geography.js';
import {route,chooseRoute,createWalkingProfile,chooseWalkIntent,planWalk} from '../src/routes.js';

function network(points,edges,destinations=[]){
 const nodes=points.map(p=>({p,adj:[]}));
 for(const [a,b,metadata={}] of edges){const len=distance(points[a],points[b]);nodes[a].adj.push({to:b,len,...metadata});nodes[b].adj.push({to:a,len,...metadata});}
 return {nodes,destinations};
}
const square=()=>network([[0,0],[100,0],[100,100],[0,100]],[[0,1],[1,2],[2,3],[3,0]]);
function valid(graph,result,home=0){
 assert.ok(result);assert.equal(result.path[0],home);assert.equal(result.path.at(-1),home);
 let meters=0;for(let i=1;i<result.path.length;i++){const edge=graph.nodes[result.path[i-1]].adj.find(e=>e.to===result.path[i]);assert.ok(edge,'each step is an existing network edge');meters+=edge.len;}
 assert.ok(Math.abs(meters-result.meters)<1e-7);
}

test('a modest repeat is preferable to a disproportionate triangular return',()=>{
 const graph=network([[0,0],[100,0],[50,150]],[[0,1],[1,2],[2,0]]);
 for(let seed=0;seed<20;seed++){const walk=chooseRoute(graph,0,200,rng(seed));valid(graph,walk);assert.equal(walk.meters,200);assert.deepEqual(walk.path,[0,1,0]);assert.equal(walk.returnDetour,1);}
});

test('complete budget produces the square loop, with no new intersection choices',()=>{
 const graph=square();
 for(let seed=0;seed<30;seed++){const path=route(graph,0,400,rng(seed));assert.equal(path.length,5);assert.equal(new Set(path.slice(0,-1)).size,4);const result=chooseRoute(graph,0,400,rng(seed));valid(graph,result);assert.equal(result.meters,400);assert.equal(result.overlapMeters,0);}
});

test('a cul-de-sac retraces its access while retaining the available loop',()=>{
 const graph=network([[-100,0],[0,0],[100,0],[100,100],[0,100]],[[0,1],[1,2],[2,3],[3,4],[4,1]]);
 const walk=chooseRoute(graph,0,600,rng(7));valid(graph,walk);assert.equal(walk.meters,600);assert.equal(walk.overlapMeters,100);
 const uses=new Map();for(let i=1;i<walk.path.length;i++){const key=[walk.path[i-1],walk.path[i]].sort().join(':');uses.set(key,(uses.get(key)||0)+1);}
 assert.equal(uses.get('0:1'),2);for(const [key,count] of uses)if(key!=='0:1')assert.equal(count,1);
});

test('a home midway along a street can complete its block instead of turning up an unfinished street',()=>{
 const graph=network([[50,0],[0,0],[0,100],[100,100],[100,0],[0,150],[0,500]],[[0,1],[1,2],[2,3],[3,4],[4,0],[2,5],[5,6]]);
 for(const intent of ['local','familiar'])for(const target of [400,450,500])for(let seed=0;seed<10;seed++){
  const walk=chooseRoute(graph,0,target,rng(seed),{intent});valid(graph,walk);
  assert.equal(walk.meters,400);assert.equal(walk.overlapMeters,0);assert.ok(!walk.path.includes(5));assert.ok(!walk.path.includes(6));
 }
});

test('a slightly shorter circuit is preferred to padding it with a mid-street out-and-back',()=>{
 const graph=network([[0,0],[100,0],[100,100],[0,100],[100,150],[100,500]],[[0,1],[1,2],[2,3],[3,0],[2,4],[4,5]]);
 for(const intent of ['local','familiar'])for(let seed=0;seed<10;seed++){
  const walk=chooseRoute(graph,0,500,rng(seed),{intent});valid(graph,walk);
  assert.equal(walk.meters,400);assert.equal(walk.overlapMeters,0);assert.ok(!walk.path.includes(4));
 }
});

test('extra residential and geometry points do not change the choice of a circuit',()=>{
 const points=[[0,0],[100,0],[100,100],[0,100],[100,500]],edges=[[0,1],[1,2],[2,3],[3,0],[2,4]];
 const simple=network(points,edges),subdivided=network([...points,[100,150],[100,200],[100,250]],[[0,1],[1,2],[2,3],[3,0],[2,5],[5,6],[6,7],[7,4]]);
 subdivided.nodes[5].anchorSource='building-projection';
 for(let seed=0;seed<10;seed++){
  const a=chooseRoute(simple,0,500,rng(seed)),b=chooseRoute(subdivided,0,500,rng(seed));valid(simple,a);valid(subdivided,b);
  assert.equal(a.meters,b.meters);assert.deepEqual(a.path,b.path);
 }
});

test('a purposeful green stop on a side street remains visited before continuing the circuit',()=>{
 const graph=network([[0,0],[100,0],[100,100],[0,100],[100,150],[100,500]],[[0,1],[1,2],[2,3],[3,0],[2,4],[4,5]],[{node:4,type:'green',name:'Small garden'}]);
 const walk=chooseRoute(graph,0,500,rng(4),{intent:'green'});valid(graph,walk);
 assert.ok(walk.path.includes(4));assert.equal(walk.waypoint.name,'Small garden');assert.ok(walk.meters<=560);
});

test('a multi-stop outing does not return home between two separate circuits',()=>{
 const points=[];for(let y=0;y<4;y++)for(let x=0;x<6;x++)points.push([x*100,y*100]);
 const edges=[];for(let y=0;y<4;y++)for(let x=0;x<6;x++){const node=y*6+x;if(x<5)edges.push([node,node+1]);if(y<3)edges.push([node,node+6]);}
 const graph=network(points,edges,[{node:1,type:'green',name:'Nearby park'}]);
 for(let seed=0;seed<30;seed++){
  const walk=chooseRoute(graph,0,1000,rng(seed),{intent:'green'});valid(graph,walk);
  assert.ok(walk.path.includes(1));assert.ok(!walk.path.slice(1,-1).includes(0));
 }
});

test('a green outing reaches an accessible destination within its complete budget',()=>{
 const graph=network([[0,0],[100,0],[100,100],[0,100],[1000,1000]],[[0,1],[1,2],[2,3],[3,0]], [{node:2,type:'green',name:'Accessible park'},{node:4,type:'green',name:'Disconnected park'}]);
 const profile=createWalkingProfile(graph,0,rng(4)),walk=planWalk(graph,profile,400,'green',rng(9));valid(graph,walk);assert.equal(walk.intent,'green');assert.ok(walk.path.includes(2));assert.ok(!walk.path.includes(4));assert.ok(walk.meters<=400*1.12);assert.equal(walk.waypoints[0].name,'Accessible park');
});

test('a nearby green stop can belong to a full circuit rather than a micro-outing',()=>{
 const graph=network([[0,0],[100,0],[200,0],[200,100],[100,100],[0,100]],[[0,1],[1,2],[2,3],[3,4],[4,5],[5,0]], [{node:1,type:'green',name:'Small square'}]);
 const walk=chooseRoute(graph,0,600,rng(8),{intent:'green'});valid(graph,walk);assert.ok(walk.path.includes(1));assert.equal(walk.meters,600);assert.equal(walk.overlapMeters,0);
});

test('a nearby park is preferred to a farther park that happens to fit half the budget',()=>{
 const points=[];for(let y=0;y<4;y++)for(let x=0;x<6;x++)points.push([x*100,y*100]);
 const edges=[];for(let y=0;y<4;y++)for(let x=0;x<6;x++){const node=y*6+x;if(x<5)edges.push([node,node+1]);if(y<3)edges.push([node,node+6]);}
 const graph=network(points,edges,[{node:1,type:'green',name:'Nearby park'},{node:5,type:'green',name:'Farther park'}]);
 const walk=chooseRoute(graph,0,1000,rng(2),{intent:'green'});valid(graph,walk);assert.equal(walk.waypoint.node,1);assert.ok(walk.meters>=800);assert.ok(walk.meters<=1120);
});

test('green network segments attract local and familiar outings without any destination records',()=>{
 const graph=network([[0,0],[100,0],[100,100],[0,100],[-100,0],[-100,-100],[0,-100]],[[0,1,{green:true}],[1,2,{green:true}],[2,3,{green:true}],[3,0,{green:true}],[0,4],[4,5],[5,6],[6,0]]);
 for(const intent of ['local','familiar']){const walk=chooseRoute(graph,0,400,rng(2),{intent});valid(graph,walk);assert.equal(walk.greenFraction,1);assert.equal(walk.meters,400);assert.ok(!walk.path.includes(5));}
});

test('green intentions include ordinary morning and evening outings when the estimated budget permits',()=>{
 const graph=square();graph.destinations=[{node:2,type:'green'}];
 const profile=createWalkingProfile(graph,0,rng(3));profile.targetMeters=800;profile.greenAffinity=.6;
 assert.equal(profile.greenMinimumRoundTrip,400);
 for(const hour of [7,21])assert.equal(chooseWalkIntent(profile,hour,'weekday',()=>.6),'green');
 profile.targetMeters=300;for(const hour of [7,13,21])assert.notEqual(chooseWalkIntent(profile,hour,'weekend',()=>.6),'green');
 profile.targetMeters=800;for(const hour of [3,23])assert.notEqual(chooseWalkIntent(profile,hour,'weekend',()=>.6),'green');
});

test('street continuity and safer parallel streets decide between equal-distance options',()=>{
 const graph=network([[0,0],[100,0],[100,100],[0,100]],[[0,1,{streetId:'busy',highway:'primary',crossing:'uncontrolled'}],[1,2,{streetId:'busy',highway:'primary'}],[0,3,{streetId:'quiet',highway:'footway'}],[3,2,{streetId:'quiet',highway:'footway'}]], [{node:2,type:'green'}]);
 const walk=chooseRoute(graph,0,400,rng(2),{intent:'green'});valid(graph,walk);assert.deepEqual(walk.path.slice(0,3),[0,3,2]);
});

test('equal-distance junction options prefer continuing the same named street',()=>{
 const graph=network([[0,0],[100,0],[0,100],[100,100],[200,0],[-100,100]],[[0,1,{streetId:'continuous'}],[1,3,{streetId:'continuous'}],[0,2,{streetId:'first'}],[2,3,{streetId:'second'}],[1,4,{streetId:'spur-a'}],[2,5,{streetId:'spur-b'}]], [{node:3,type:'green'}]);
 const walk=chooseRoute(graph,0,400,rng(2),{intent:'green'});valid(graph,walk);assert.deepEqual(walk.path.slice(0,3),[0,1,3]);
});

test('familiar outings reuse stable circuits and metadata without shared mutable paths',()=>{
 const graph=square(),random=rng(20),profile=createWalkingProfile(graph,0,random);
 assert.ok(profile.maxCircuits>=2&&profile.maxCircuits<=4);
 const first=planWalk(graph,profile,400,'familiar',random),second=planWalk(graph,profile,400,'familiar',random);
 valid(graph,first);valid(graph,second);assert.ok(first.circuitId);assert.equal(second.circuitId,first.circuitId);assert.equal(second.reusedCircuit,true);assert.deepEqual(second.path,first.path);assert.notEqual(second.path,profile.circuits[0].path);
 second.path.pop();assert.equal(profile.circuits[0].path.length,5);
});

test('profile and outing choices are reproducible for a seeded scenario',()=>{
 const graph=square();
 const run=()=>{const random=rng(25),profile=createWalkingProfile(graph,0,random);return [6,13,19].map(hour=>{const intent=chooseWalkIntent(profile,hour,'weekend',random);return planWalk(graph,profile,400,intent,random);});};
 assert.deepEqual(run(),run());
});

test('the lazy repertoire grows to multiple stable circuits when the network permits it',()=>{
 const points=[];for(let y=0;y<7;y++)for(let x=0;x<7;x++)points.push([x*100,y*100]);
 const edges=[];for(let y=0;y<7;y++)for(let x=0;x<7;x++){const node=y*7+x;if(x<6)edges.push([node,node+1]);if(y<6)edges.push([node,node+7]);}
 const graph=network(points,edges),random=rng(12),profile=createWalkingProfile(graph,24,random);
 for(const target of [800,1000,1200,800,1000,1200,800,1000,1200])valid(graph,planWalk(graph,profile,target,'familiar',random),24);
 assert.ok(profile.circuits.length>=2);assert.ok(profile.circuits.length<=profile.maxCircuits);assert.equal(new Set(profile.circuits.map(c=>c.signature)).size,profile.circuits.length);
});

test('an isolated origin never acquires an invented connection to another component',()=>{
 const graph=network([[0,0],[100,0],[200,0]],[[1,2]]);
 assert.equal(chooseRoute(graph,0,400,rng(3)),null);assert.deepEqual(route(graph,0,400,rng(3)),[0]);
});

test('a directed graph never invents a reverse edge for the return',()=>{
 const graph=network([[0,0],[100,0],[100,100]],[[0,1],[1,2]]);
 graph.nodes[1].adj=graph.nodes[1].adj.filter(e=>e.to!==0);
 assert.equal(chooseRoute(graph,0,400,rng(3)),null);
 const connected={nodes:graph.nodes.map(n=>({...n,adj:[...n.adj]}))};connected.nodes[2].adj.push({to:0,len:distance(graph.nodes[2].p,graph.nodes[0].p)});
 const walk=chooseRoute(connected,0,350,rng(3));valid(connected,walk);assert.deepEqual(walk.path,[0,1,2,0]);
});

test('a tiny tree reports its limitation instead of circling artificial connections',()=>{
 const graph=network([[0,0],[100,0],[200,0]],[[0,1],[1,2]]),walk=chooseRoute(graph,0,1500,rng(8));valid(graph,walk);assert.deepEqual(walk.path,[0,1,2,1,0]);assert.equal(walk.meters,400);assert.equal(walk.budgetLimited,true);
 const longAccess=network([[0,0],[100,0]],[[0,1]]),short=chooseRoute(longAccess,0,50,rng(1));valid(longAccess,short);assert.equal(short.meters,200);assert.equal(short.budgetLimited,true);
});

test('a linear network without a reachable junction still respects the return budget',()=>{
 const graph=network([[0,0],[50,0],[100,0],[500,0]],[[0,1],[1,2],[2,3]]),walk=chooseRoute(graph,0,200,rng(3));valid(graph,walk);
 assert.deepEqual(walk.path,[0,1,2,1,0]);assert.equal(walk.meters,200);
});
