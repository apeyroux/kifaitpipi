export const CENTER=[2.289,48.802];
export const project=([lon,lat])=>[(lon-CENTER[0])*73300,(CENTER[1]-lat)*111320];
export const unproject=([x,y])=>[CENTER[0]+x/73300,CENTER[1]-y/111320];
export function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
export const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export function nearest(nodes,p){let best=0,d=Infinity;nodes.forEach((n,i)=>{const dd=distance(n.p,p);if(dd<d){d=dd;best=i;}});return best;}
function polygonArea(ps){return Math.abs(ps.reduce((s,p,i)=>{const q=ps[(i+1)%ps.length];return s+p[0]*q[1]-q[0]*p[1];},0)/2);}
export function createDemo(){
 const random=rng(92020),nodes=[],edges=[],buildings=[],parks=[];const n=22;
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const p=[(x-10.5)*93+Math.sin(y*.35)*95+(random()-.5)*28,(y-10.5)*95+Math.sin(x*.28)*110+(random()-.5)*28];
  nodes.push({p,adj:[],weight:1,name:'Rue illustrative'});
 }
 const add=(a,b,main)=>{const len=distance(nodes[a].p,nodes[b].p);nodes[a].adj.push({to:b,len});nodes[b].adj.push({to:a,len});edges.push({a,b,main,name:main?'Axe principal illustratif':'Rue résidentielle illustrative'});};
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const id=y*n+x;if(x<n-1)add(id,id+1,y===8||y===14);if(y<n-1)add(id,id+n,x===10||x===16);
  const park=(x>2&&x<6&&y>5&&y<10)||(x>13&&x<17&&y>14&&y<18);
  if(x<n-1&&y<n-1){const p=nodes[id].p;if(park){parks.push([p,[p[0]+76,p[1]],[p[0]+76,p[1]+76],[p[0],p[1]+76]]);nodes[id].weight=.04;}
   else{for(let k=0;k<3;k++){const bx=p[0]+18+(k%2)*35,by=p[1]+17+Math.floor(k/2)*37;const poly=[[bx,by],[bx+24,by],[bx+24,by+27],[bx,by+27]];buildings.push({poly,p:[bx+12,by+13],weight:x>7&&x<15?4:1,node:id});}nodes[id].weight=x>7&&x<15?4:1;}
  }
 }
 const doors=buildings.filter((_,i)=>i%3===0).map(b=>({p:nodes[b.node].p,node:b.node,synthetic:true}));
 return{mode:'demo',nodes,edges,buildings,parks,doors,boundary:null,population:null,source:'Fond schématique • géographie non réelle'};
}
export function insideCommune(p,geometry){
 if(!geometry?.coordinates?.length)return true;
 const polygons=geometry.type==='MultiPolygon'?geometry.coordinates:[geometry.coordinates];
 const inRing=ring=>{let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
 return polygons.some(rings=>inRing(rings[0])&&!rings.slice(1).some(inRing));
}
export function parseOSM(osm,commune){
 if(!osm?.elements?.length)throw new Error('Aucune donnée OpenStreetMap reçue.');
 const rawNodes=new Map(osm.elements.filter(e=>e.type==='node').map(e=>[e.id,e]));const nodes=[],index=new Map(),edges=[],buildings=[],parks=[];
 const get=id=>{if(index.has(id))return index.get(id);const r=rawNodes.get(id);if(!r)return null;const i=nodes.length;index.set(id,i);nodes.push({p:project([r.lon,r.lat]),adj:[],weight:.05,name:'Voie piétonne'});return i;};
 for(const w of osm.elements){if(w.type!=='way')continue;const t=w.tags||{};
  if(t.highway&&!['motorway','motorway_link','trunk','trunk_link','construction','proposed'].includes(t.highway)&&t.access!=='private'&&t.foot!=='no'){
   for(let j=1;j<w.nodes.length;j++){const a=get(w.nodes[j-1]),b=get(w.nodes[j]);if(a===null||b===null||a===b)continue;if(!insideCommune(unproject([(nodes[a].p[0]+nodes[b].p[0])/2,(nodes[a].p[1]+nodes[b].p[1])/2]),commune.geometry))continue;const len=distance(nodes[a].p,nodes[b].p);nodes[a].adj.push({to:b,len});nodes[b].adj.push({to:a,len});nodes[a].name=nodes[b].name=t.name||'Voie piétonne';edges.push({a,b,main:['primary','secondary','tertiary'].includes(t.highway),name:t.name||'Voie piétonne'});}
  }else if(t.building||t.leisure==='park'||t.landuse==='grass'||t.landuse==='forest'){
   const poly=w.nodes.map(id=>rawNodes.get(id)).filter(Boolean).map(r=>project([r.lon,r.lat]));if(poly.length<3)continue;const center=poly.reduce((s,p)=>[s[0]+p[0]/poly.length,s[1]+p[1]/poly.length],[0,0]);if(!insideCommune(unproject(center),commune.geometry))continue;
   if(t.building){const p=poly.reduce((s,q)=>[s[0]+q[0]/poly.length,s[1]+q[1]/poly.length],[0,0]);const residential=['yes','apartments','house','residential','detached','semidetached_house','terrace'].includes(t.building)&&!t.office&&!t.shop&&!t.amenity;buildings.push({poly,p,weight:residential?polygonArea(poly)*Math.max(1,Math.min(15,Number(t['building:levels'])|| (t.building==='apartments'?4:1))):0});}else parks.push(poly);
  }
 }
 if(nodes.length<10)throw new Error('Réseau piéton insuffisant.');
 // Keep the largest connected walking component: no routes jump between disconnected streets.
 const seen=new Set();let largest=[];for(let i=0;i<nodes.length;i++){if(seen.has(i))continue;const group=[],stack=[i];seen.add(i);while(stack.length){const u=stack.pop();group.push(u);for(const e of nodes[u].adj)if(!seen.has(e.to)){seen.add(e.to);stack.push(e.to);}}if(group.length>largest.length)largest=group;}
 const keep=new Set(largest),remap=new Map(largest.map((old,i)=>[old,i]));const clean=largest.map(old=>({...nodes[old],adj:nodes[old].adj.filter(e=>keep.has(e.to)).map(e=>({...e,to:remap.get(e.to)}))}));
 const cleanEdges=edges.filter(e=>keep.has(e.a)&&keep.has(e.b)).map(e=>({...e,a:remap.get(e.a),b:remap.get(e.b)}));
 for(const b of buildings){b.node=nearest(clean,b.p);if(distance(clean[b.node].p,b.p)<100)clean[b.node].weight+=b.weight;}
 const doors=[];for(const r of rawNodes.values())if(r.tags?.entrance&&r.tags.entrance!=='no'&&insideCommune([r.lon,r.lat],commune.geometry)){const p=project([r.lon,r.lat]),node=nearest(clean,p);if(distance(clean[node].p,p)<35)doors.push({p,node,synthetic:false});}
 if(!doors.length)for(const b of buildings.filter(b=>b.weight>0)){if(distance(clean[b.node].p,b.p)<40)doors.push({p:clean[b.node].p,node:b.node,synthetic:true});}
 return{mode:'real',nodes:clean,edges:cleanEdges,buildings,parks,doors,boundary:commune.geometry,population:commune.properties.population,source:'OpenStreetMap contributors • données publiques'};
}
export async function fetchRealData(signal){
 const headers=typeof window==='undefined'?{'User-Agent':'KifaitpipiChatillon/1.0 urban walking research','Accept':'application/json,text/html;q=0.9,*/*;q=0.8'}:{'Accept':'application/json,text/html;q=0.9,*/*;q=0.8'};
 const g=await fetch('https://geo.api.gouv.fr/communes/92020?fields=nom,population,contour&format=geojson&geometry=contour',{signal});if(!g.ok)throw new Error('Population indisponible : HTTP '+g.status);const commune=await g.json();
 const flat=commune.geometry.coordinates.flat(commune.geometry.type==='MultiPolygon'?2:1),lons=flat.map(p=>p[0]),lats=flat.map(p=>p[1]);const box=[Math.min(...lats),Math.min(...lons),Math.max(...lats),Math.max(...lons)].join(',');
 const query=`[out:json][timeout:25][maxsize:33554432];(way["highway"](${box});way["building"](${box});way["leisure"="park"](${box});way["landuse"="grass"](${box});node["entrance"](${box}););(._;>;);out body;`;
 const endpoints=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];let lastError;
 for(const endpoint of endpoints){try{const r=await fetch(endpoint+'?data='+encodeURIComponent(query),{signal,headers});if(!r.ok)throw new Error('OpenStreetMap : HTTP '+r.status);const osm=await r.json();if(osm.remark)throw new Error(osm.remark);return {osm,commune};}catch(e){lastError=e;if(signal?.aborted)throw e;}}
 throw lastError;
}
export function parseCadastre(collection){
 if(collection?.type!=='FeatureCollection'||!Array.isArray(collection.features))throw new Error('GeoJSON cadastral invalide.');
 const result=[];for(const f of collection.features){if(f.properties?.code_insee&&f.properties.code_insee!=='92020')continue;const polygons=f.geometry?.type==='MultiPolygon'?f.geometry.coordinates:f.geometry?.type==='Polygon'?[f.geometry.coordinates]:[];
  for(const rings of polygons){if(!rings[0]?.length)continue;const projected=rings.map(r=>r.map(project)),outer=projected[0],center=outer.reduce((s,p)=>[s[0]+p[0]/outer.length,s[1]+p[1]/outer.length],[0,0]);result.push({rings:projected,center,id:f.properties?.idu||String(f.id),label:`${f.properties?.section||''} ${f.properties?.numero||''}`.trim()});}
 }
 return result;
}
export function parcelAt(parcels,p){
 const inRing=ring=>{let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
 return parcels.find(parcel=>inRing(parcel.rings[0])&&!parcel.rings.slice(1).some(inRing));
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
