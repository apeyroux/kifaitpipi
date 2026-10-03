import test from 'node:test';
import assert from 'node:assert/strict';
import {distance,rng} from '../src/geography.js';
import {createMarkingDistribution,MARKING_ASSUMPTIONS} from '../src/marking.js';
import {eliminationEvents} from '../src/simulation.js';
import {walkingGeometry} from '../src/walking.js';

function network(points,connections){
 const nodes=points.map(p=>({p,adj:[]}));
 for(const[a,b,metadata={}]of connections){const len=distance(points[a],points[b]);nodes[a].adj.push({to:b,len,...metadata});nodes[b].adj.push({to:a,len,...metadata});}
 return {nodes};
}
function tJunction(){return network([[0,0],[100,0],[200,0],[100,100]],[[0,1],[1,2],[1,3]]);}
const samples=(distribution,count=20000)=>Array.from({length:count},(_,i)=>distribution.mapDistance((i+.5)*distribution.totalMeters/count));
const near=(positions,center,radius=8)=>positions.filter(p=>Math.abs(p-center)<=radius).length/positions.length;

test('the normalized mixture increases local marking at a T junction without changing sample count',()=>{
 const distribution=createMarkingDistribution(tJunction(),[0,1,2]),uniform=Array.from({length:20000},(_,i)=>(i+.5)*200/20000),mapped=samples(distribution);
 assert.equal(mapped.length,uniform.length);assert.deepEqual(distribution.intervals,[{start:92,end:108}]);assert.equal(distribution.junctions.length,1);
 const expected=.5*(16/200)+.5*(2*16/(200+16));
 assert.ok(Math.abs(near(mapped,100)-expected)<.0001);assert.ok(near(mapped,100)>near(uniform,100)*1.4);
 assert.equal(MARKING_ASSUMPTIONS.junctionWeight,2);assert.equal(MARKING_ASSUMPTIONS.uniformShare,.5);
});

test('a straight street and a simple bend have no junction preference',()=>{
 for(const graph of [network([[0,0],[100,0],[200,0]],[[0,1],[1,2]]),network([[0,0],[100,0],[100,100]],[[0,1],[1,2]])]){
  const distribution=createMarkingDistribution(graph,[0,1,2]);assert.equal(distribution.isIdentity,true);assert.equal(distribution.junctions.length,0);for(const p of [0,25,100,175,200])assert.equal(distribution.mapDistance(p),p);
 }
});

test('subdividing the street or adding a projected building anchor does not change the distribution',()=>{
 const original=createMarkingDistribution(tJunction(),[0,1,2]);
 const graph=network([[0,0],[25,0],[100,0],[150,0],[200,0],[100,100]],[[0,1],[1,2],[2,3],[3,4],[2,5]]);graph.nodes[1].anchorSource='building-projection';
 const subdivided=createMarkingDistribution(graph,[0,1,2,3,4]);assert.deepEqual(subdivided.intervals,original.intervals);
 for(let p=0;p<=200;p+=.25)assert.ok(Math.abs(original.mapDistance(p)-subdivided.mapDistance(p))<1e-10);
});

test('coincident ways and branches within 25 degrees do not create a false junction',()=>{
 const graph=network([[0,0],[100,0],[200,0],[201,1]],[[0,1],[1,2],[1,2,{wayId:'duplicate'}],[1,3]]);
 const distribution=createMarkingDistribution(graph,[0,1,2]);assert.equal(distribution.isIdentity,true);assert.equal(distribution.junctions.length,0);
});

test('direction grouping joins duplicates across the zero-degree boundary',()=>{
 const graph=network([[0,0],[100,0],[-100,1],[100,-1]],[[0,1],[0,2],[0,3]]);
 const distribution=createMarkingDistribution(graph,[2,0,1]);assert.equal(distribution.isIdentity,true);assert.equal(distribution.junctions.length,0);
});

test('overlapping junction windows form a union instead of compounding attraction',()=>{
 const graph=network([[0,0],[100,0],[110,0],[210,0],[100,50],[110,-50]],[[0,1],[1,2],[2,3],[1,4],[2,5]]);
 const distribution=createMarkingDistribution(graph,[0,1,2,3]);assert.deepEqual(distribution.intervals,[{start:92,end:118}]);assert.equal(distribution.boostedMeters,26);
 const mass=samples(distribution).filter(p=>p>=92&&p<=118).length/20000,expected=.5*26/210+.5*52/236;assert.ok(Math.abs(mass-expected)<.0001);
});

test('crossing segments keep uniform support but receive no junction bonus',()=>{
 const graph=network([[0,0],[100,0],[110,0],[210,0],[100,50]],[[0,1],[1,2,{crossing:true}],[2,3],[1,4]]);
 const distribution=createMarkingDistribution(graph,[0,1,2,3]);assert.deepEqual(distribution.intervals,[{start:92,end:100}]);
 const mapped=samples(distribution);assert.ok(mapped.some(p=>p>100&&p<110));assert.ok(mapped.every(p=>p>=0&&p<=210));
});

test('mapping stays ordered and robust at route endpoints and empty or degenerate routes',()=>{
 const distribution=createMarkingDistribution(tJunction(),[0,1,2]),mapped=samples(distribution);
 assert.ok(mapped.every((p,i)=>i===0||p>mapped[i-1]));assert.equal(distribution.mapDistance(-10),0);assert.equal(distribution.mapDistance(0),0);assert.equal(distribution.mapDistance(200),200);assert.equal(distribution.mapDistance(Infinity),200);assert.equal(distribution.mapDistance(NaN),0);
 assert.equal(createMarkingDistribution({nodes:[]},[]).mapDistance(20),0);assert.equal(createMarkingDistribution(tJunction(),[1]).mapDistance(20),0);
 const tiny=network([[0,0],[2,0],[4,0],[2,2]],[[0,1],[1,2],[1,3]]),allBoosted=createMarkingDistribution(tiny,[0,1,2]);assert.equal(allBoosted.isIdentity,true);assert.equal(allBoosted.mapDistance(2),2);
});

test('mapping only changes position on existing route segments and rejects absent connections',()=>{
 const graph=tJunction(),distribution=createMarkingDistribution(graph,[0,1,2]),mapped=samples(distribution,100);
 for(const s of mapped){const point=s<=100?[s,0]:[100+(s-100),0];assert.ok(graph.nodes[0].adj.some(e=>e.to===1));assert.ok(point[0]>=0&&point[0]<=200&&point[1]===0);}
 assert.throws(()=>createMarkingDistribution(graph,[0,3]),/outside the walking network/);assert.throws(()=>createMarkingDistribution(graph,[0,99]),/invalid node/);
});

test('integrated placement preserves every count and pause draw while redistributing only urinations',()=>{
 const graph=tJunction(),distribution=createMarkingDistribution(graph,[0,1,2]),points=[graph.nodes[0].p,graph.nodes[1].p,graph.nodes[2].p];
 const baselineRandom=rng(6139),mappedRandom=rng(6139);let totalUrinations=0,baselineNear=0,mappedNear=0;
 const records=result=>result.stops.map(stop=>({type:stop.type,duration:stop.duration,point:result.points[stop.index]}));
 for(let walk=0;walk<2000;walk++){
  // Cover both the fixed daily allocation and the Poisson fecal event path.
  const options=walk%2?{}:{defecationCount:walk%3};
  const baseline=records(eliminationEvents(points,25,.2,.04,baselineRandom,options)),mapped=records(eliminationEvents(points,25,.2,.04,mappedRandom,{...options,urinationDistribution:distribution}));
  for(const type of ['urination','defecation']){
   const before=baseline.filter(e=>e.type===type),after=mapped.filter(e=>e.type===type);
   assert.equal(after.length,before.length);
   assert.deepEqual(after.map(e=>e.duration).sort((a,b)=>a-b),before.map(e=>e.duration).sort((a,b)=>a-b));
  }
  assert.deepEqual(mapped.filter(e=>e.type==='defecation'),baseline.filter(e=>e.type==='defecation'));
  const before=baseline.filter(e=>e.type==='urination'),after=mapped.filter(e=>e.type==='urination');totalUrinations+=before.length;
  baselineNear+=before.filter(e=>distance(e.point,graph.nodes[1].p)<=8).length;mappedNear+=after.filter(e=>distance(e.point,graph.nodes[1].p)<=8).length;
 }
 assert.ok(totalUrinations>9000);assert.ok(mappedNear>baselineNear*1.3);assert.ok(Math.abs(mappedNear/totalUrinations-(.5*16/200+.5*32/216))<.015);
 assert.equal(mappedRandom(),baselineRandom(),'spatial redistribution consumes no extra random values');
});

test('integrated identity and braking-point subdivisions leave elimination draws and physical locations invariant',()=>{
 const curve=network([[0,0],[100,0],[100,100]],[[0,1],[1,2]]),curvePath=[0,1,2],identity=createMarkingDistribution(curve,curvePath),curvePoints=curvePath.map(node=>curve.nodes[node].p);
 assert.deepEqual(eliminationEvents(curvePoints,25,.2,.04,rng(543),{urinationDistribution:identity}),eliminationEvents(curvePoints,25,.2,.04,rng(543)));
 const graph=tJunction(),path=[0,1,3],distribution=createMarkingDistribution(graph,path),points=path.map(node=>graph.nodes[node].p),geometry=walkingGeometry(graph,path,60,rng(11));
 assert.ok(geometry.points.length>points.length,'walking geometry inserts braking points before the turn');
 const simple=eliminationEvents(points,25,.2,.04,rng(1983),{defecationCount:2,urinationDistribution:distribution}),subdivided=eliminationEvents(geometry.points,25,.2,.04,rng(1983),{defecationCount:2,urinationDistribution:distribution});
 assert.equal(subdivided.stops.length,simple.stops.length);
 for(let i=0;i<simple.stops.length;i++){
  const a=simple.stops[i],b=subdivided.stops[i];assert.equal(b.type,a.type);assert.equal(b.duration,a.duration);assert.ok(distance(simple.points[a.index],subdivided.points[b.index])<1e-9);
 }
});
