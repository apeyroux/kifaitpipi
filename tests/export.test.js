import test from 'node:test';
import assert from 'node:assert/strict';
import {scenarioCsv} from '../src/export.js';

const settings={seed:92020,day:'weekend',population:36705,households:17646,ownership:22,dogsPerHousehold:1,walks:3,duration:25,urinationRate:.2,defecationsPerDay:2};
const stats={hours:Array(24).fill(0),urinationHours:Array(24).fill(0),defecationHours:Array(24).fill(0),sampleTrips:2,total:8,urinations:4,defecations:1};
const scenario={settings,stats,point:{name:'Rue du Parc',p:[0,0]},radius:5,graph:{mode:'real',source:'OpenStreetMap'}};

test('CSV preserves the selected point, all scenario settings, hourly events and daily totals',()=>{
 const copy={...stats,hours:stats.hours.with(7,8),urinationHours:stats.urinationHours.with(7,4),defecationHours:stats.defecationHours.with(7,1)};
 const csv=scenarioCsv({...scenario,stats:copy}),lines=csv.slice(1).split('\r\n');
 assert.equal(csv.charCodeAt(0),0xfeff);assert.equal(lines.length,25);
 const headers=lines[0].split(';'),row=Object.fromEntries(lines[8].split(';').map((v,i)=>[headers[i],v]));
 assert.equal(row.heure_debut,'7');assert.equal(row.heure_fin,'8');
 assert.equal(row.promenades_estimees,'8');assert.equal(row.mictions_marquages_estimes,'4');assert.equal(row.defecations_estimees,'1');
 assert.equal(row.longitude,'2.289');assert.equal(row.latitude,'48.802');assert.equal(row.rayon_m,'5');
 assert.equal(row.promenades_jour_estimees,'8');assert.equal(row.parcours_echantillon_dans_rayon,'2');
 for(const [key,value] of Object.entries(settings))assert.equal(row[`scenario_${key}`],String(value));
 assert.equal(scenarioCsv({...scenario,point:null}),null);
});

test('CSV quotes source text and prevents spreadsheet names from becoming formulas',()=>{
 const csv=scenarioCsv({...scenario,point:{...scenario.point,name:'=HYPERLINK("https://example.com");test'}});
 assert.ok(csv.includes('"\'=HYPERLINK(""https://example.com"");test"'));
 const negative=scenarioCsv({...scenario,point:{name:'Position',p:[-1000000,0]}});
 assert.ok(negative.includes(';-11.353'));
});

test('parcel CSV identifies the complete cadastral zone and margin instead of a point radius',()=>{
 const csv=scenarioCsv({...scenario,radius:5,point:{p:[0,0],name:'Parcelle AB 0001',parcel:{id:'92020000AB0001',label:'AB 0001'}}});
 const [header,line]=csv.slice(1).split('\r\n'),headers=header.split(';'),row=Object.fromEntries(line.split(';').map((v,i)=>[headers[i],v]));
 assert.equal(row.mode_observation,'parcelle');assert.equal(row.parcelle_id,'92020000AB0001');assert.equal(row.parcelle_reference,'AB 0001');
 assert.equal(row.marge_parcelle_m,'5');assert.equal(row.rayon_m,'');assert.equal(row.parcours_echantillon_zone,'2');assert.equal(row.parcours_echantillon_dans_rayon,'');
});
