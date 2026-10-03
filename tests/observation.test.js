import test from 'node:test';
import assert from 'node:assert/strict';
import {parcelContains,parcelObservation,parcelZone} from '../src/observation.js';
import {parseCadastre,unproject} from '../src/geography.js';
import {statistics} from '../src/simulation.js';

const square=(x,y,size)=>[[x,y],[x+size,y],[x+size,y+size],[x,y+size],[x,y]];
const parcel={id:'92020000AB0001',label:'AB 0001',center:[50,50],rings:[square(0,0,100)]};
const trip=(points,times,start=0,stops=[])=>({points,times,start,stops,weight:2});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} differs from ${b}`);

test('two clicks within one parcel select the same cadastral observation; streets and holes do not select a neighbour',()=>{
 assert.deepEqual(parcelObservation([parcel],[1,1]),parcelObservation([parcel],[99,99]));
 assert.deepEqual(parcelObservation([parcel],[0,50]).parcel,parcel);
 assert.equal(parcelObservation([parcel],[-1,50]),null);
 assert.equal(parcelObservation([],[50,50]),null);
 const withHole={...parcel,rings:[parcel.rings[0],square(40,40,20)]};
 assert.equal(parcelObservation([withHole],[50,50]),null);
 assert.equal(parcelContains(withHole,[40,50]),true);
});

test('parcels count routes along the full frontage, independently of a clicked point',()=>{
 const sim={trips:[trip([[-10,-3],[110,-3],[-10,-3]],[0,20,40],470),trip([[50,-10],[50,-6]],[0,10],470)]};
 const a=statistics(sim,[1,1],5,parcel),b=statistics(sim,[99,99],5,parcel);
 assert.deepEqual(a,b);assert.equal(a.total,2);assert.equal(a.sampleTrips,1);
 assert.equal(a.hours[7],2);assert.equal(a.hours[8],2);
 assert.equal(statistics(sim,[50,50],0,parcel).total,0);
});

test('polygon intervals preserve hour boundaries and deduplicate round trips',()=>{
 const sim={trips:[trip([[-100,50],[200,50],[-100,50]],[0,60,120],420)]};
 const stats=statistics(sim,[50,50],0,parcel);
 assert.equal(stats.total,2);assert.equal(stats.hours[7],2);assert.equal(stats.hours[8],2);assert.equal(stats.hours[9],0);
 const intervals=parcelZone(parcel,0).intervals([-100,50],[200,50]);
 assert.equal(intervals.length,1);near(intervals[0][0],1/3);near(intervals[0][1],2/3);
});

test('holes and concave recesses remain excluded instead of counting the bounding box',()=>{
 const withHole={...parcel,rings:[parcel.rings[0],square(40,40,20)]},zone=parcelZone(withHole,0);
 assert.equal(zone.contains([50,50]),false);assert.deepEqual(zone.intervals([45,50],[55,50]),[]);
 assert.deepEqual(zone.intervals([0,50],[100,50]),[[0,.4],[.6,1]]);
 assert.equal(parcelZone(withHole,5).contains([42,50]),true);
 assert.equal(parcelZone(withHole,5).contains([50,50]),false);
 const concave={...parcel,rings:[[[0,0],[100,0],[100,20],[20,20],[20,100],[0,100],[0,0]]]};
 assert.deepEqual(parcelZone(concave,0).intervals([25,25],[90,90]),[]);
 assert.deepEqual(parcelZone(concave,5).intervals([26,26],[90,90]),[]);
});

test('distance buffers have circular corners and exact edge crossing intervals',()=>{
 const zone=parcelZone(parcel,5);
 assert.equal(zone.contains([-3,-4]),true);assert.equal(zone.contains([-4,-4]),false);
 const intervals=zone.intervals([-10,-3],[110,-3]);
 assert.equal(intervals.length,1);near(intervals[0][0],6/120);near(intervals[0][1],114/120);
 assert.deepEqual(zone.intervals([10,10],[10,10]),[[0,1]]);
 assert.deepEqual(zone.intervals([-50,-50],[-50,-50]),[]);
});

test('multipart cadastral geometry selects, renders and counts as one parcel, leaving gaps outside',()=>{
 const geometry=[ [square(0,0,10)], [square(100,0,10)] ];
 const [multi]=parseCadastre({type:'FeatureCollection',features:[{properties:{code_insee:'92020',idu:'multiple',section:'AB',numero:'2'},geometry:{type:'MultiPolygon',coordinates:geometry.map(rings=>rings.map(ring=>ring.map(unproject)))}}]});
 assert.equal(multi.polygons.length,2);
 assert.deepEqual(parcelObservation([multi],[5,5]),parcelObservation([multi],[105,5]));
 assert.equal(parcelObservation([multi],[50,5]),null);
 const stats=statistics({trips:[trip([[-10,5],[120,5]],[0,130],0)]},multi.center,0,multi);
 assert.equal(stats.total,2);assert.equal(stats.hours[0],2);assert.equal(stats.hours[1],2);assert.equal(stats.hours[2],0);
});

test('hourly counts exclude time spent crossing a multipart gap, including midnight',()=>{
 const multi={...parcel,polygons:[[square(0,0,10)],[square(100,0,10)]]};
 const stats=statistics({trips:[trip([[0,5],[110,5]],[0,110],1430)]},multi.center,0,multi);
 assert.equal(stats.total,2);assert.equal(stats.hours[23],2);assert.equal(stats.hours[0],0);assert.equal(stats.hours[1],2);
});

test('events use the same parcel margin and count each elimination once',()=>{
 const points=[[0,0],[90,-3],[50,50],[50,-6],[0,0]];
 const stops=[{index:1,at:5,duration:1,type:'urination'},{index:2,at:10,duration:1,type:'defecation'},{index:3,at:15,duration:1,type:'urination'}];
 const stats=statistics({trips:[trip(points,[0,5,10,15,20],1430,stops)]},parcel.center,5,parcel);
 assert.equal(stats.urinations,2);assert.equal(stats.defecations,2);assert.equal(stats.stops,4);
 assert.equal(stats.urinationHours[23],2);assert.equal(stats.defecationHours[0],2);
 assert.equal(stats.total,2);
});
