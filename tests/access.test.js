import test from 'node:test';
import assert from 'node:assert/strict';
import {parseOSM} from '../src/geography.js';

function graphWithWay(tags){
 const nodes=Array.from({length:12},(_,i)=>({type:'node',id:i,lon:2.289+i*.0001,lat:48.802}));
 return parseOSM({elements:[...nodes,
  {type:'way',id:100,nodes:nodes.map(n=>n.id),tags:{highway:'residential',name:'Public street'}},
  {type:'way',id:101,nodes:[0,11],tags:{highway:'footway',name:'Candidate way',...tags}},
 ]},{geometry:{coordinates:[]},properties:{population:37000}});
}
const included=tags=>graphWithWay(tags).edges.some(e=>e.name==='Candidate way');

test('public dog routes exclude general restricted access and pedestrian prohibitions',()=>{
 for(const access of ['no','private','customers','permit','delivery','agricultural','forestry','destination'])assert.equal(included({access}),false,access);
 for(const foot of ['no','private','customers','permit'])assert.equal(included({access:'yes',foot}),false,foot);
 assert.equal(included({}),true);
 assert.equal(included({access:'permissive'}),true);
});

test('explicit public pedestrian permission overrides general access, but not dog prohibitions',()=>{
 for(const foot of ['yes','designated','permissive'])for(const access of ['no','private']){
  assert.equal(included({access,foot}),true,`${access} / ${foot}`);
  assert.equal(included({access,foot,dog:'no'}),false,`${access} / ${foot} / dog=no`);
 }
});

test('steps remain walkable while construction and proposed roads remain excluded',()=>{
 assert.equal(included({highway:'steps'}),true);
 for(const highway of ['construction','proposed','motorway','motorway_link','trunk','trunk_link'])assert.equal(included({highway,foot:'yes'}),false,highway);
});
