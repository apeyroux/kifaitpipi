import test from 'node:test';
import assert from 'node:assert/strict';
import {dailySegments,segmentUntil,heatIndex,valueUntil} from '../src/daily.js';
const trip={points:[[0,0],[100,0],[0,0]],times:[0,5,11],start:60,duration:11,weight:3,color:'#68f4d2',stops:[{index:1,at:5,duration:1,type:'urination'}]};
test('daily trails retain finished walks and reveal no future route',()=>{
 const segments=dailySegments([trip]);assert.equal(segments.length,2);
 assert.equal(segmentUntil(segments[0],59),null);
 assert.deepEqual(segmentUntil(segments[0],62.5),{a:[0,0],b:[50,0]});
 assert.equal(segmentUntil(segments[1],65.5),null); // pause, no motion
 assert.deepEqual(segmentUntil(segments[1],70),{a:[100,0],b:[20,0]});
 assert.deepEqual(segmentUntil(segments[1],1440),{a:[100,0],b:[0,0]});
 assert.equal(segmentUntil(segments[1],0),null);
});
test('midnight splits walks without including future portions or duplicating them',()=>{
 const crossing={...trip,start:1435,points:[[0,0],[100,0]],times:[0,10],duration:10,stops:[]};
 const segments=dailySegments([crossing]);assert.equal(segments.length,2);
 assert.deepEqual(segments[0],{a:[50,0],b:[100,0],start:0,end:5,color:trip.color});
 assert.deepEqual(segments[1],{a:[0,0],b:[50,0],start:1435,end:1440,color:trip.color});
 assert.deepEqual(segmentUntil(segments[0],2),{a:[50,0],b:[70,0]});
});
test('heat conserves weighted event totals, filters types and counts each midnight event once',()=>{
 const t={...trip,start:1430,stops:[{index:0,at:1,type:'urination'},{index:1,at:15,type:'defecation'}]};
 for(const [kind,total] of [['urination',3],['defecation',3],['all',6]]){
  const heat=heatIndex([t],kind);assert.equal(valueUntil(heat.events,0),0);assert.equal(valueUntil(heat.events,1440),total);
  assert.ok(Math.abs(heat.cells.reduce((n,c)=>n+valueUntil(c,1440),0)-total)<1e-10);
  assert.equal(valueUntil(heat.events,6),kind==='urination'?0:3);
  assert.equal(valueUntil(heat.events,1432),total);
  assert.equal(valueUntil(heat.events,6),kind==='urination'?0:3); // rewind is derived, not accumulated twice
 }
});
test('heat intensity grows monotonically with a fixed full-day maximum',()=>{
 const t={...trip,stops:[{index:0,at:1,type:'urination'},{index:0,at:9,type:'urination'}]};
 const heat=heatIndex([t]);assert.ok(heat.max>0);
 for(const cell of heat.cells){assert.equal(valueUntil(cell,60),0);assert.ok(valueUntil(cell,65)<=valueUntil(cell,75));assert.ok(Math.abs(valueUntil(cell,65)*2-valueUntil(cell,75))<1e-12);assert.ok(valueUntil(cell,75)<=heat.max);}
 assert.equal(heatIndex([], 'all').max,0);assert.equal(heatIndex([t], 'defecation').cells.length,0);
});
