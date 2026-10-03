import {parcelContains} from './observation.js';
export const CENTER=[2.289,48.802];
export const project=([lon,lat])=>[(lon-CENTER[0])*73300,(CENTER[1]-lat)*111320];
export const unproject=([x,y])=>[CENTER[0]+x/73300,CENTER[1]-y/111320];
export function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
export const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export function nearest(nodes,p){let best=0,d=Infinity;nodes.forEach((n,i)=>{const dd=distance(n.p,p);if(dd<d){d=dd;best=i;}});return best;}
function polygonArea(ps){return Math.abs(ps.reduce((s,p,i)=>{const q=ps[(i+1)%ps.length];return s+p[0]*q[1]-q[0]*p[1];},0)/2);}
function polygonCenter(poly){
 let area=0,x=0,y=0;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],cross=a[0]*b[1]-b[0]*a[1];area+=cross;x+=(a[0]+b[0])*cross;y+=(a[1]+b[1])*cross;}
 return Math.abs(area)>1e-8?[x/(3*area),y/(3*area)]:poly.reduce((s,p)=>[s[0]+p[0]/poly.length,s[1]+p[1]/poly.length],[0,0]);
}
function onSegment(p,a,b){
 const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1))),point=[a[0]+t*dx,a[1]+t*dy];return{p:point,t,distance:distance(p,point)};
}
function polygonDistance(p,poly){let best=Infinity;for(let i=0;i<poly.length;i++)best=Math.min(best,onSegment(p,poly[i],poly[(i+1)%poly.length]).distance);return best;}
function areaContains(p,area){return insideCommune(p,area.geometry)&&polygonDistance(p,area.poly)>1e-7;}
// Test the interior, rather than blocking a public sidewalk along a park boundary.
function entersArea(a,b,area){
 if(Math.max(a[0],b[0])<area.bounds[0]||Math.min(a[0],b[0])>area.bounds[2]||Math.max(a[1],b[1])<area.bounds[1]||Math.min(a[1],b[1])>area.bounds[3])return false;
 const dx=b[0]-a[0],dy=b[1]-a[1],cuts=[0,1];for(let i=0;i<area.poly.length;i++){const c=area.poly[i],d=area.poly[(i+1)%area.poly.length],ex=d[0]-c[0],ey=d[1]-c[1],den=dx*ey-dy*ex;if(Math.abs(den)<1e-12)continue;const t=((c[0]-a[0])*ey-(c[1]-a[1])*ex)/den,u=((c[0]-a[0])*dy-(c[1]-a[1])*dx)/den;if(t>0&&t<1&&u>=0&&u<=1)cuts.push(t);}
 cuts.sort((x,y)=>x-y);for(let i=1;i<cuts.length;i++){const t=(cuts[i-1]+cuts[i])/2;if(areaContains([a[0]+t*dx,a[1]+t*dy],area))return true;}return false;
}
function nearArea(a,b,area,radius){
 if(Math.max(a[0],b[0])<area.bounds[0]-radius||Math.min(a[0],b[0])>area.bounds[2]+radius||Math.max(a[1],b[1])<area.bounds[1]-radius||Math.min(a[1],b[1])>area.bounds[3]+radius)return false;
 return polygonDistance(a,area.poly)<=radius||polygonDistance(b,area.poly)<=radius||area.poly.some(p=>onSegment(p,a,b).distance<=radius);
}
function crossingMetadata(tags={}){
 const crossing=tags.footway==='crossing'||tags.highway==='crossing'||Boolean(tags.crossing&&tags.crossing!=='no')||tags['crossing:signals']==='yes';
 const signals=tags.crossing==='traffic_signals'||tags['crossing:signals']==='yes'||crossing&&tags.highway==='traffic_signals';
 return{crossing,crossingType:crossing?(signals?'traffic_signals':tags.crossing&&tags.crossing!=='no'?tags.crossing:'unknown'):null};
}
function walkingMetadata(tags,wayId){
 return{wayId,streetId:tags.name?`street:${tags.name.trim().toLocaleLowerCase('fr')}`:`way:${wayId}`,highway:tags.highway,footway:tags.footway||null,...crossingMetadata(tags),sidewalk:tags.sidewalk||tags['sidewalk:both']||null,sidewalkLeft:tags['sidewalk:left']||null,sidewalkRight:tags['sidewalk:right']||null,surface:tags.surface||null,green:false,greenSource:null};
}
export function createDemo(){
 const random=rng(92020),nodes=[],edges=[],buildings=[],parks=[];const n=22;
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const p=[(x-10.5)*93+Math.sin(y*.35)*95+(random()-.5)*28,(y-10.5)*95+Math.sin(x*.28)*110+(random()-.5)*28];
  nodes.push({p,adj:[],weight:1,name:'Rue illustrative',...crossingMetadata()});
 }
 const add=(a,b,main)=>{const horizontal=b-a===1,street=horizontal?Math.floor(a/n):a%n,metadata={...walkingMetadata({highway:main?'tertiary':'residential',sidewalk:'both'},`demo:${horizontal?'h':'v'}:${street}`),streetId:`demo:${horizontal?'h':'v'}:${street}`},len=distance(nodes[a].p,nodes[b].p);nodes[a].adj.push({to:b,len,...metadata});nodes[b].adj.push({to:a,len,...metadata});edges.push({a,b,main,name:main?'Axe principal illustratif':'Rue résidentielle illustrative',...metadata});};
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const id=y*n+x;if(x<n-1)add(id,id+1,y===8||y===14);if(y<n-1)add(id,id+n,x===10||x===16);
  const park=(x>2&&x<6&&y>5&&y<10)||(x>13&&x<17&&y>14&&y<18);
  if(x<n-1&&y<n-1){const p=nodes[id].p;if(park){parks.push([p,[p[0]+76,p[1]],[p[0]+76,p[1]+76],[p[0],p[1]+76]]);nodes[id].weight=.04;}
   else{for(let k=0;k<3;k++){const bx=p[0]+18+(k%2)*35,by=p[1]+17+Math.floor(k/2)*37;const poly=[[bx,by],[bx+24,by],[bx+24,by+27],[bx,by+27]];buildings.push({poly,p:[bx+12,by+13],weight:x>7&&x<15?4:1,node:id});}nodes[id].weight=x>7&&x<15?4:1;}
  }
 }
 const destinations=[];for(let i=0;i<nodes.length;i++){const x=i%n,y=Math.floor(i/n),green=(x>2&&x<6&&y>5&&y<10)||(x>13&&x<17&&y>14&&y<18);if(green)destinations.push({node:i,type:'green',name:'Espace vert illustratif',source:'demo',accessKnown:false});}
 const greenNodes=new Set(destinations.map(d=>d.node));for(const edge of edges)if(greenNodes.has(edge.a)||greenNodes.has(edge.b)){edge.green=true;edge.greenSource='demo';for(const [from,to]of[[edge.a,edge.b],[edge.b,edge.a]]){const adj=nodes[from].adj.find(e=>e.to===to);adj.green=true;adj.greenSource='demo';}}
 const doors=buildings.filter((_,i)=>i%3===0).map(b=>({p:nodes[b.node].p,node:b.node,synthetic:true}));
 return{mode:'demo',nodes,edges,buildings,parks,doors,destinations,boundary:null,population:null,source:'Fond schématique • géographie non réelle'};
}
export function insideCommune(p,geometry){
 if(!geometry?.coordinates?.length)return true;
 const polygons=geometry.type==='MultiPolygon'?geometry.coordinates:[geometry.coordinates];
 const inRing=ring=>{let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
 return polygons.some(rings=>inRing(rings[0])&&!rings.slice(1).some(inRing));
}
// Cemetery boundaries are excluded from the dog-walking network.
export function cemeteryAreas(osm){
 const nodes=new Map(osm.elements.filter(e=>e.type==='node').map(e=>[e.id,e]));
 const ways=new Map(osm.elements.filter(e=>e.type==='way').map(e=>[e.id,e]));
 const tagged=e=>e.tags?.landuse==='cemetery'||e.tags?.amenity==='grave_yard';
 const ring=ids=>ids.map(id=>nodes.get(id)).filter(Boolean).map(n=>[n.lon,n.lat]);
 const areas=[];
 for(const w of ways.values())if(tagged(w)&&w.nodes.length>=4&&w.nodes[0]===w.nodes.at(-1))areas.push({type:'Polygon',coordinates:[ring(w.nodes)]});
 for(const r of osm.elements.filter(e=>e.type==='relation'&&tagged(e))){
  const stitch=role=>{const parts=(r.members||[]).filter(m=>m.type==='way'&&(m.role||'outer')===role).map(m=>ways.get(m.ref)?.nodes.slice()).filter(Boolean),rings=[];
   while(parts.length){const ids=parts.pop();while(ids[0]!==ids.at(-1)){const i=parts.findIndex(p=>p[0]===ids.at(-1)||p.at(-1)===ids.at(-1));if(i<0)break;const p=parts.splice(i,1)[0];if(p.at(-1)===ids.at(-1))p.reverse();ids.push(...p.slice(1));}if(ids.length>=4&&ids[0]===ids.at(-1))rings.push(ring(ids));}return rings;};
  const holes=stitch('inner');for(const outer of stitch('outer'))areas.push({type:'Polygon',coordinates:[outer,...holes.filter(h=>insideCommune(h[0],{type:'Polygon',coordinates:[outer]}))]});
 }
 return areas;
}
export function crossesCemetery(a,b,areas){
 const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
 const intersects=(c,d)=>Math.max(Math.min(a[0],b[0]),Math.min(c[0],d[0]))<=Math.min(Math.max(a[0],b[0]),Math.max(c[0],d[0]))&&Math.max(Math.min(a[1],b[1]),Math.min(c[1],d[1]))<=Math.min(Math.max(a[1],b[1]),Math.max(c[1],d[1]))&&cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0;
 return areas.some(area=>insideCommune(a,area)||insideCommune(b,area)||area.coordinates.some(ring=>ring.some((p,i)=>intersects(p,ring[(i+1)%ring.length]))));
}
// A specific pedestrian permission takes precedence over general vehicle/access
// restrictions. Dog prohibitions still apply to a dog-walking simulation.
function allowsDogWalking(tags){
 const restricted=new Set(['no','private','customers','permit','delivery','agricultural','forestry','destination']);
 const publicFoot=new Set(['yes','designated','permissive']);
 if(!tags.highway||tags.dog==='no'||restricted.has(tags.foot))return false;
 if(['motorway','motorway_link','trunk','trunk_link','construction','proposed'].includes(tags.highway))return false;
 return !restricted.has(tags.access)||publicFoot.has(tags.foot);
}
export function parseOSM(osm,commune){
 if(!osm?.elements?.length)throw new Error('Aucune donnée OpenStreetMap reçue.');
 const cemeteries=cemeteryAreas(osm);
 const rawNodes=new Map(osm.elements.filter(e=>e.type==='node').map(e=>[e.id,e]));const nodes=[],index=new Map(),edges=[],buildings=[],parks=[];
 const greenAreas=[];
 for(const w of osm.elements){const t=w.tags||{};if(w.type!=='way'||!(t.leisure==='park'||['grass','forest','recreation_ground'].includes(t.landuse))||w.nodes?.[0]!==w.nodes?.at(-1))continue;const poly=w.nodes.map(id=>rawNodes.get(id)).filter(Boolean).map(r=>project([r.lon,r.lat]));if(poly.length<4)continue;const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);greenAreas.push({poly,geometry:{type:'Polygon',coordinates:[poly]},bounds:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)],center:polygonCenter(poly),name:t.name||'Espace vert',allowed:allowsDogWalking({...t,highway:'footway'}),accessKnown:['yes','permissive'].includes(t.access)||['yes','designated','permissive'].includes(t.foot)});}
 const restrictedGreens=greenAreas.filter(area=>!area.allowed);
 const get=id=>{if(index.has(id))return index.get(id);const r=rawNodes.get(id);if(!r)return null;const i=nodes.length;index.set(id,i);nodes.push({p:project([r.lon,r.lat]),adj:[],weight:.05,name:'Voie piétonne',...crossingMetadata(r.tags)});return i;};
 for(const w of osm.elements){if(w.type!=='way')continue;const t=w.tags||{};
  if(allowsDogWalking(t)){
   const metadata=walkingMetadata(t,w.id);for(let j=1;j<w.nodes.length;j++){const a=get(w.nodes[j-1]),b=get(w.nodes[j]);if(a===null||b===null||a===b)continue;if(!insideCommune(unproject([(nodes[a].p[0]+nodes[b].p[0])/2,(nodes[a].p[1]+nodes[b].p[1])/2]),commune.geometry))continue;if(crossesCemetery(unproject(nodes[a].p),unproject(nodes[b].p),cemeteries)||restrictedGreens.some(area=>entersArea(nodes[a].p,nodes[b].p,area)))continue;const len=distance(nodes[a].p,nodes[b].p);if(len<=0)continue;nodes[a].adj.push({to:b,len,...metadata});nodes[b].adj.push({to:a,len,...metadata});nodes[a].name=nodes[b].name=t.name||'Voie piétonne';edges.push({a,b,main:['primary','secondary','tertiary'].includes(t.highway),name:t.name||'Voie piétonne',...metadata});}
  }else if(t.building||t.leisure==='park'||t.landuse==='grass'||t.landuse==='forest'){
   const poly=w.nodes.map(id=>rawNodes.get(id)).filter(Boolean).map(r=>project([r.lon,r.lat]));if(poly.length<3)continue;const center=polygonCenter(poly);if(!insideCommune(unproject(center),commune.geometry))continue;
   if(t.building){if(cemeteries.some(area=>insideCommune(unproject(center),area)))continue;const residential=['yes','apartments','house','residential','detached','semidetached_house','terrace'].includes(t.building)&&!t.office&&!t.shop&&!t.amenity;buildings.push({poly,p:center,weight:residential?polygonArea(poly)*Math.max(1,Math.min(15,Number(t['building:levels'])|| (t.building==='apartments'?4:1))):0});}else parks.push(poly);
  }
 }
 if(nodes.length<10)throw new Error('Réseau piéton insuffisant.');
 // Keep the largest connected walking component: no routes jump between disconnected streets.
 const seen=new Set();let largest=[];for(let i=0;i<nodes.length;i++){if(seen.has(i))continue;const group=[],stack=[i];seen.add(i);while(stack.length){const u=stack.pop();group.push(u);for(const e of nodes[u].adj)if(!seen.has(e.to)){seen.add(e.to);stack.push(e.to);}}if(group.length>largest.length)largest=group;}
 const keep=new Set(largest),remap=new Map(largest.map((old,i)=>[old,i]));const clean=largest.map(old=>({...nodes[old],adj:[]}));
 let cleanEdges=edges.filter(e=>keep.has(e.a)&&keep.has(e.b)).map(e=>({...e,a:remap.get(e.a),b:remap.get(e.b)}));
 const publicGreens=greenAreas.filter(area=>area.allowed);
 const entrances=[];for(const r of rawNodes.values())if(r.tags?.entrance&&r.tags.entrance!=='no'&&!cemeteries.some(area=>insideCommune([r.lon,r.lat],area))&&insideCommune([r.lon,r.lat],commune.geometry))entrances.push({p:project([r.lon,r.lat]),node:null});
 const originalNodes=clean.slice(),splits=new Map(),segmentKey=edge=>edge.a<edge.b?`${edge.a}:${edge.b}`:`${edge.b}:${edge.a}`;
 // An anchor is a point on an existing public segment, never a new line from a
 // building across its parcel. Projections and the 3 m reuse threshold are
 // geometric assumptions; they do not claim a surveyed entrance.
 for(const b of buildings){const entrance=b.weight>0?entrances.filter(e=>polygonDistance(e.p,b.poly)<=2).sort((a,c)=>distance(a.p,b.p)-distance(c.p,b.p))[0]:null,source=entrance?.p||b.p,nearestNode=nearest(originalNodes,source);b.node=nearestNode;if(b.weight<=0)continue;
  let best=null;for(let i=0;i<cleanEdges.length;i++){const edge=cleanEdges[i];if(edge.crossing)continue;const projected=onSegment(source,clean[edge.a].p,clean[edge.b].p);if(!best||projected.distance<best.distance)best={...projected,edge:i};}
  if(!best||best.distance>=100)continue;const edge=cleanEdges[best.edge],length=distance(clean[edge.a].p,clean[edge.b].p),endpoint=best.t<.5?edge.a:edge.b;
  if(Math.min(best.t,1-best.t)*length<=2)b.node=endpoint;
  else if(distance(originalNodes[nearestNode].p,source)-best.distance>3){const key=segmentKey(edge),t=edge.a<edge.b?best.t:1-best.t,anchors=splits.get(key)||[],existing=anchors.find(a=>Math.abs(a.t-t)*length<=2);if(existing)b.node=existing.node;else{b.node=clean.length;clean.push({p:best.p,adj:[],weight:0,name:edge.name,...crossingMetadata(),anchorSource:entrance?'osm-entrance-projection':'building-projection'});anchors.push({t,node:b.node});splits.set(key,anchors);}}
  clean[b.node].weight+=b.weight;if(entrance)entrance.node=b.node;
 }
 const splitEdges=[];for(const edge of cleanEdges){const anchors=splits.get(segmentKey(edge));if(!anchors){splitEdges.push(edge);continue;}const order=[...anchors].sort((a,b)=>edge.a<edge.b?a.t-b.t:b.t-a.t),chain=[edge.a,...order.map(a=>a.node),edge.b];for(let j=1;j<chain.length;j++)splitEdges.push({...edge,a:chain[j-1],b:chain[j]});}cleanEdges=splitEdges;
 for(const edge of cleanEdges){const a=clean[edge.a].p,b=clean[edge.b].p,inside=publicGreens.some(area=>entersArea(a,b,area));if(inside||publicGreens.some(area=>nearArea(a,b,area,12))){edge.green=true;edge.greenSource=inside?'osm-area-interior':'osm-area-proximity';}}
 for(const edge of cleanEdges){const {a,b,...metadata}=edge,len=distance(clean[a].p,clean[b].p);clean[a].adj.push({to:b,len,...metadata});clean[b].adj.push({to:a,len,...metadata});}
 const destinations=[];for(const area of publicGreens){const candidates=clean.map((node,i)=>({node:i,p:node.p})).filter(n=>areaContains(n.p,area)&&clean[n.node].adj.length);if(!candidates.length)continue;candidates.sort((a,b)=>distance(a.p,area.center)-distance(b.p,area.center));destinations.push({node:candidates[0].node,type:'green',name:area.name,source:'osm-area',accessKnown:area.accessKnown});}
 const doors=[];for(const entrance of entrances){const node=entrance.node??nearest(clean,entrance.p);if(distance(clean[node].p,entrance.p)<35)doors.push({p:entrance.p,node,synthetic:false});}
 if(!doors.length)for(const b of buildings.filter(b=>b.weight>0)){if(distance(clean[b.node].p,b.p)<40)doors.push({p:clean[b.node].p,node:b.node,synthetic:true});}
 return{mode:'real',nodes:clean,edges:cleanEdges,buildings,parks,doors,destinations,boundary:commune.geometry,population:commune.properties.population,source:'OpenStreetMap contributors • données publiques'};
}
export async function fetchRealData(signal){
 const headers=typeof window==='undefined'?{'User-Agent':'KikifaitpipiChatillon/1.0 urban walking research','Accept':'application/json,text/html;q=0.9,*/*;q=0.8'}:{'Accept':'application/json,text/html;q=0.9,*/*;q=0.8'};
 const g=await fetch('https://geo.api.gouv.fr/communes/92020?fields=nom,population,contour&format=geojson&geometry=contour',{signal});if(!g.ok)throw new Error('Population indisponible : HTTP '+g.status);const commune=await g.json();
 const flat=commune.geometry.coordinates.flat(commune.geometry.type==='MultiPolygon'?2:1),lons=flat.map(p=>p[0]),lats=flat.map(p=>p[1]);const box=[Math.min(...lats),Math.min(...lons),Math.max(...lats),Math.max(...lons)].join(',');
 const query=`[out:json][timeout:25][maxsize:33554432];(way["highway"](${box});way["building"](${box});way["leisure"="park"](${box});way["landuse"="grass"](${box});nwr["landuse"="cemetery"](${box});nwr["amenity"="grave_yard"](${box});node["entrance"](${box}););(._;>;);out body;`;
 const endpoints=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];let lastError;
 for(const endpoint of endpoints){try{const r=await fetch(endpoint+'?data='+encodeURIComponent(query),{signal,headers});if(!r.ok)throw new Error('OpenStreetMap : HTTP '+r.status);const osm=await r.json();if(osm.remark)throw new Error(osm.remark);return {osm,commune};}catch(e){lastError=e;if(signal?.aborted)throw e;}}
 throw lastError;
}
export function parseCadastre(collection){
 if(collection?.type!=='FeatureCollection'||!Array.isArray(collection.features))throw new Error('GeoJSON cadastral invalide.');
 const result=[];for(const f of collection.features){if(f.properties?.code_insee&&f.properties.code_insee!=='92020')continue;const polygons=f.geometry?.type==='MultiPolygon'?f.geometry.coordinates:f.geometry?.type==='Polygon'?[f.geometry.coordinates]:[];
  const projected=polygons.filter(rings=>rings[0]?.length>=3).map(rings=>rings.map(r=>r.map(project)));if(!projected.length)continue;
  const main=projected.reduce((largest,rings)=>polygonArea(rings[0])>polygonArea(largest[0])?rings:largest),center=polygonCenter(main[0]);
  result.push({polygons:projected,rings:main,center,id:f.properties?.idu||String(f.id),label:`${f.properties?.section||''} ${f.properties?.numero||''}`.trim()});
 }
 return result;
}
export function parcelAt(parcels,p){
 return parcels.find(parcel=>parcelContains(parcel,p));
}
export async function fetchCadastre(signal){
 const features=[];let start=0,total=Infinity;while(start<total){
  const params=new URLSearchParams({SERVICE:'WFS',VERSION:'2.0.0',REQUEST:'GetFeature',TYPENAMES:'CADASTRALPARCELS.PARCELLAIRE_EXPRESS:parcelle',OUTPUTFORMAT:'application/json',SRSNAME:'urn:ogc:def:crs:OGC:1.3:CRS84',CQL_FILTER:"code_insee='92020'",COUNT:'5000',STARTINDEX:String(start)});
  const r=await fetch('https://data.geopf.fr/wfs/ows?'+params,{signal});if(!r.ok)throw new Error('Cadastre IGN : HTTP '+r.status);const data=await r.json();if(!Array.isArray(data.features)||data.features.length===0)throw new Error('Réponse cadastrale vide ou incomplète.');features.push(...data.features);total=Number(data.numberMatched??data.totalFeatures);if(!Number.isFinite(total))throw new Error('Nombre total de parcelles inconnu.');start=features.length;if(start>20000)throw new Error('Réponse cadastrale excessive.');
 }
 if(features.some(f=>f.properties?.code_insee!=='92020'))throw new Error('Filtre cadastral communal non respecté.');
 const ids=features.map(f=>f.properties?.idu||f.id);if(new Set(ids).size!==features.length)throw new Error('Parcelles dupliquées dans la pagination.');
 return{type:'FeatureCollection',features,numberMatched:features.length,numberReturned:features.length,retrievedAt:new Date().toISOString(),source:'DGFiP / IGN · Parcellaire Express (PCI)',license:'Licence Ouverte 2.0'};
}
