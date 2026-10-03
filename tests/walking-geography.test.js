import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemo,distance,parseOSM,unproject} from '../src/geography.js';

const commune={geometry:{coordinates:[]},properties:{population:37000}};
const node=(id,p,tags={})=>{const[lon,lat]=unproject(p);return{type:'node',id,lon,lat,tags};};
const way=(id,nodes,tags)=>({type:'way',id,nodes,tags});
function street(){return[...Array.from({length:12},(_,i)=>node(i,[i*20,-80])),way(1,Array.from({length:12},(_,i)=>i),{highway:'residential',name:'Rue Test',sidewalk:'both',surface:'asphalt'})];}
function longStreet(){return[...Array.from({length:12},(_,i)=>node(i,[i?80+i*20:0,-80])),way(1,Array.from({length:12},(_,i)=>i),{highway:'residential',name:'Rue Test',sidewalk:'both',surface:'asphalt'})];}
function park(tags={},connected=true){return[
 node(20,[40,20]),node(21,[100,30]),node(22,[160,20]),
 way(2,connected?[2,20,21,22,8]:[20,21,22],{highway:'footway',footway:'sidewalk',surface:'fine_gravel'}),
 node(30,[20,0]),node(31,[180,0]),node(32,[180,60]),node(33,[20,60]),
 way(3,[30,31,32,33,30],{leisure:'park',name:'Parc Test',...tags}),
];}
const parse=elements=>parseOSM({elements},commune);
function assertConnected(graph){const seen=new Set([0]),stack=[0];while(stack.length){const u=stack.pop();for(const e of graph.nodes[u].adj)if(!seen.has(e.to)){seen.add(e.to);stack.push(e.to);}}assert.equal(seen.size,graph.nodes.length);}

test('street and pedestrian metadata survive import in both directions',()=>{
 const elements=street();elements[5].tags={highway:'crossing',crossing:'uncontrolled'};
 elements.push(way(5,[4,5],{highway:'footway',footway:'crossing',name:'Passage Test',crossing:'uncontrolled',surface:'paving_stones','sidewalk:left':'separate'}));
 const graph=parse(elements),edge=graph.edges.find(e=>e.wayId===5);
 assert.equal(edge.highway,'footway');assert.equal(edge.footway,'crossing');assert.equal(edge.crossing,true);assert.equal(edge.surface,'paving_stones');assert.equal(edge.sidewalkLeft,'separate');assert.equal(edge.streetId,'street:passage test');
 for(const[from,to]of[[edge.a,edge.b],[edge.b,edge.a]]){const adj=graph.nodes[from].adj.find(e=>e.wayId===5&&e.to===to);assert.equal(adj.streetId,edge.streetId);assert.equal(adj.crossing,true);assert.equal(adj.surface,edge.surface);}
 assert.ok(graph.nodes.some(n=>n.crossing));assert.equal(graph.edges.find(e=>e.wayId===1).sidewalk,'both');
});

test('crossing=no is not a pedestrian crossing and signal metadata is explicit',()=>{
 const elements=street();elements[5].tags={highway:'crossing','crossing:signals':'yes'};
 elements.push(way(5,[4,5],{highway:'footway',footway:'crossing',crossing:'traffic_signals'}),way(6,[6,7],{highway:'footway',crossing:'no'}),way(7,[7,8],{highway:'footway',footway:'crossing',crossing:'no'}));
 const graph=parse(elements);assert.equal(graph.edges.find(e=>e.wayId===5).crossingType,'traffic_signals');assert.ok(graph.nodes.some(n=>n.crossingType==='traffic_signals'));
 assert.equal(graph.edges.find(e=>e.wayId===6).crossing,false);assert.equal(graph.edges.find(e=>e.wayId===6).crossingType,null);assert.equal(graph.edges.find(e=>e.wayId===7).crossing,true);
});

test('green destinations use an existing public network node with access provenance',()=>{
 const graph=parse([...street(),...park({access:'yes'})]);
 assert.equal(graph.destinations.length,1);const destination=graph.destinations[0];assert.equal(destination.name,'Parc Test');assert.equal(destination.type,'green');assert.equal(destination.source,'osm-area');assert.equal(destination.accessKnown,true);assert.ok(graph.nodes[destination.node].p[1]>0);assert.ok(graph.nodes[destination.node].adj.length);
 assert.ok(graph.edges.some(e=>e.green&&e.greenSource==='osm-area-interior'));assert.ok(graph.nodes.some(n=>n.adj.some(e=>e.green)));assertConnected(graph);
 const unspecified=parse([...street(),...park()]);assert.equal(unspecified.destinations[0].accessKnown,false);
});

test('private or dog-prohibited greenery never creates destinations or through routes',()=>{
 for(const tags of[{access:'private'},{dog:'no'},{foot:'no'}]){const graph=parse([...street(),...park(tags)]);assert.equal(graph.destinations.length,0);assert.equal(graph.edges.some(e=>e.wayId===2),false);assert.equal(graph.edges.some(e=>e.green),false);assertConnected(graph);}
});

test('disconnected green paths remain excluded instead of gaining a synthetic entrance',()=>{
 const graph=parse([...street(),...park({access:'yes'},false)]);assert.equal(graph.destinations.length,0);assert.equal(graph.nodes.length,12);assert.equal(graph.edges.some(e=>e.wayId===2),false);assertConnected(graph);
});

test('green proximity is an explicit inference and cannot invent a park destination',()=>{
 const elements=street();elements.push(node(30,[80,-70]),node(31,[120,-70]),node(32,[120,-10]),node(33,[80,-10]),way(3,[30,31,32,33,30],{leisure:'park',access:'yes'}));
 const graph=parse(elements);assert.ok(graph.edges.some(e=>e.greenSource==='osm-area-proximity'));assert.equal(graph.edges.some(e=>e.greenSource==='osm-area-interior'),false);assert.equal(graph.destinations.length,0);assert.equal(graph.nodes.length,12);
});

test('a public sidewalk on a private park boundary remains usable',()=>{
 const elements=street();elements.push(node(30,[80,-80]),node(31,[120,-80]),node(32,[120,-10]),node(33,[80,-10]),way(3,[30,31,32,33,30],{leisure:'park',access:'private'}));
 const graph=parse(elements);assert.equal(graph.edges.length,11);assert.equal(graph.destinations.length,0);assert.equal(graph.edges.some(e=>e.green),false);assertConnected(graph);
});

test('residential anchors split the original segment and retain every direction and metadata',()=>{
 const elements=longStreet();
 elements.push(node(40,[40,-65]),node(41,[60,-65]),node(42,[60,-45]),node(43,[40,-45]),way(40,[40,41,42,43,40],{building:'house'}));
 elements.push(way(50,[1,0],{highway:'footway',name:'Accès Test',surface:'paving_stones'}));
 const graph=parse(elements),building=graph.buildings[0],anchor=graph.nodes[building.node];assert.ok(Math.abs(anchor.p[0]-50)<1e-6);assert.ok(Math.abs(anchor.p[1]+80)<1e-6);assert.equal(anchor.anchorSource,'building-projection');assert.ok(anchor.weight>0);assertConnected(graph);
 const parts=graph.edges.filter(e=>e.wayId===1&&Math.max(graph.nodes[e.a].p[0],graph.nodes[e.b].p[0])<=100+1e-6);
 assert.equal(parts.length,2);assert.ok(Math.abs(parts.reduce((sum,e)=>sum+distance(graph.nodes[e.a].p,graph.nodes[e.b].p),0)-100)<1e-6);assert.equal(graph.edges.filter(e=>e.wayId===50).length,2);
 for(const edge of parts)for(const[from,to]of[[edge.a,edge.b],[edge.b,edge.a]]){const adj=graph.nodes[from].adj.find(e=>e.wayId===1&&e.to===to);assert.equal(adj.surface,'asphalt');assert.equal(adj.streetId,'street:rue test');}
 assert.ok(graph.nodes.every(n=>n.adj.length>0));assert.ok(graph.nodes.every(n=>Math.abs(n.p[1]+80)<1e-6));
});

test('a surveyed building entrance guides projection without adding an off-network link',()=>{
 const elements=longStreet();elements.push(node(40,[41,-65]),node(41,[59,-65]),node(42,[59,-45]),node(43,[41,-45]),node(44,[43,-65],{entrance:'main'}),way(40,[40,44,41,42,43,40],{building:'house'}));
 const graph=parse(elements),anchor=graph.nodes[graph.buildings[0].node];assert.ok(Math.abs(anchor.p[0]-43)<1e-6);assert.ok(Math.abs(anchor.p[1]+80)<1e-6);assert.equal(anchor.anchorSource,'osm-entrance-projection');assert.equal(graph.doors[0].node,graph.buildings[0].node);assertConnected(graph);
});

test('demo geography provides the same metadata and green destination contract',()=>{
 const graph=createDemo();assert.ok(graph.destinations.length);assert.ok(graph.edges.some(e=>e.green));for(const edge of graph.edges){assert.ok(edge.wayId);assert.ok(edge.streetId);assert.ok(edge.highway);assert.equal(typeof edge.crossing,'boolean');assert.equal(typeof edge.green,'boolean');}assertConnected(graph);
});
