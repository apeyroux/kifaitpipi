import {useEffect,useRef,useState} from 'react';
import {Plus,Minus,LocateFixed} from 'lucide-react';
import {nearest,distance,project,parcelAt} from '../geography.js';
import {tripState} from '../simulation.js';
function path(ctx,ps,toScreen,close=false){ctx.beginPath();ps.forEach((p,i)=>{const [x,y]=toScreen(p);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});if(close)ctx.closePath();}
export default function MapCanvas({parcels,graph,sim,time,layers,point,radius,onPoint,placing}){
 const ref=useRef(),outer=useRef(),cache=useRef(),drag=useRef();const [size,setSize]=useState([1000,800]),[view,setView]=useState({zoom:1,x:0,y:0});
 const xs=graph.nodes.map(n=>n.p[0]),ys=graph.nodes.map(n=>n.p[1]);const minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);const scale=Math.min(size[0]/(maxx-minx+120),size[1]/(maxy-miny+120))*view.zoom;
 const toScreen=p=>[(p[0]-(minx+maxx)/2)*scale+size[0]/2+view.x,(p[1]-(miny+maxy)/2)*scale+size[1]/2+view.y];
 const toWorld=p=>[(p[0]-size[0]/2-view.x)/scale+(minx+maxx)/2,(p[1]-size[1]/2-view.y)/scale+(miny+maxy)/2];
 useEffect(()=>{const observer=new ResizeObserver(([entry])=>setSize([entry.contentRect.width,entry.contentRect.height]));observer.observe(outer.current);return()=>observer.disconnect();},[]);
 useEffect(()=>{
  const dpr=window.devicePixelRatio||1,canvas=document.createElement('canvas');canvas.width=size[0]*dpr;canvas.height=size[1]*dpr;const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);ctx.fillStyle='#101b27';ctx.fillRect(0,0,...size);
  // Geographic layers are cached; only the walking overlay is repainted on time changes.
  for(const poly of graph.parks){path(ctx,poly,toScreen,true);ctx.fillStyle='#15362f';ctx.fill();ctx.strokeStyle='#20463c';ctx.lineWidth=1;ctx.stroke();}
  if(layers.parcels)for(const parcel of parcels){ctx.beginPath();for(const ring of parcel.rings){ring.forEach((p,i)=>{const q=toScreen(p);i?ctx.lineTo(...q):ctx.moveTo(...q);});ctx.closePath();}ctx.fillStyle='#4552740b';ctx.fill('evenodd');ctx.strokeStyle='#54618088';ctx.lineWidth=.65;ctx.stroke();if(view.zoom>=2.3){const p=toScreen(parcel.center);ctx.fillStyle='#8994ac';ctx.font='8px DM Sans, sans-serif';ctx.fillText(parcel.label,...p);}}
  if(graph.boundary){const polygons=graph.boundary.type==='MultiPolygon'?graph.boundary.coordinates:[graph.boundary.coordinates];ctx.setLineDash([4,5]);ctx.strokeStyle='#7bb6a75c';ctx.lineWidth=1;for(const polygon of polygons){path(ctx,polygon[0].map(project),toScreen,true);ctx.stroke();}ctx.setLineDash([]);}
  for(const b of graph.buildings){path(ctx,b.poly,toScreen,true);ctx.fillStyle=layers.housing&&b.weight>0?'#243447':'#1a2635';ctx.fill();ctx.strokeStyle='#2b3c4e';ctx.lineWidth=.5;ctx.stroke();}
  for(const e of graph.edges){path(ctx,[graph.nodes[e.a].p,graph.nodes[e.b].p],toScreen);ctx.lineWidth=e.main?8:4;ctx.strokeStyle='#0a131e';ctx.stroke();ctx.lineWidth=e.main?3:1.25;ctx.strokeStyle=e.main?'#405266':'#314154';ctx.stroke();}
  if(graph.mode==='demo'){
   const labels=[[-510,-200,'Secteur résidentiel A'],[240,420,'Secteur résidentiel B'],[-680,170,'Espace vert illustratif'],[440,-590,'Quartier illustratif']];ctx.font='11px Inter, sans-serif';ctx.textAlign='center';for(const [x,y,label]of labels){const p=toScreen([x,y]);ctx.fillStyle=label.includes('vert')?'#66aa91':'#7a8ba0';ctx.fillText(label,...p);}
  }else{
   const drawn=new Set();ctx.font='10px Inter, sans-serif';ctx.fillStyle='#95a5b6';for(const e of graph.edges){if(!e.main||drawn.has(e.name))continue;drawn.add(e.name);const a=toScreen(graph.nodes[e.a].p),b=toScreen(graph.nodes[e.b].p);ctx.save();ctx.translate((a[0]+b[0])/2,(a[1]+b[1])/2);let angle=Math.atan2(b[1]-a[1],b[0]-a[0]);if(angle>Math.PI/2||angle<-Math.PI/2)angle+=Math.PI;ctx.rotate(angle);ctx.fillText(e.name,0,-7);ctx.restore();}
  }
  cache.current=canvas;
 },[graph,parcels,size,view,layers.housing,layers.parcels]);
 useEffect(()=>{
  const canvas=ref.current,dpr=window.devicePixelRatio||1;canvas.width=size[0]*dpr;canvas.height=size[1]*dpr;const ctx=canvas.getContext('2d');if(cache.current)ctx.drawImage(cache.current,0,0);ctx.scale(dpr,dpr);
  if(layers.flows||layers.stops)for(const trip of sim.trips){const state=tripState(trip,time);if(!state)continue;ctx.globalAlpha=state.alpha;
   if(layers.flows){path(ctx,state.points,toScreen);ctx.strokeStyle=trip.color;ctx.lineJoin='round';ctx.lineCap='round';ctx.lineWidth=1.25;ctx.shadowBlur=8;ctx.shadowColor=trip.color;ctx.stroke();const p=toScreen(state.p);ctx.beginPath();ctx.arc(...p,2.5,0,Math.PI*2);ctx.fillStyle='#edfffa';ctx.shadowBlur=12;ctx.fill();}
   if(layers.stops&&state.stop){const p=toScreen(state.p);ctx.strokeStyle='#ffbe60';ctx.fillStyle='#ffd48a';ctx.shadowColor='#ffc463';ctx.shadowBlur=13;ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(...p,6,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(...p,2.8,0,Math.PI*2);ctx.fill();}
  }
  ctx.globalAlpha=1;ctx.shadowBlur=0;
  if(point){const p=toScreen(point.p);ctx.beginPath();ctx.arc(...p,radius*scale,0,Math.PI*2);ctx.fillStyle='#78efd01a';ctx.fill();ctx.strokeStyle='#75e9cf66';ctx.setLineDash([3,4]);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(...p,10,0,Math.PI*2);ctx.strokeStyle='#9ef7e2';ctx.lineWidth=1.5;ctx.stroke();ctx.beginPath();ctx.arc(...p,4,0,Math.PI*2);ctx.fillStyle='#8ef1d8';ctx.shadowColor='#78eaca';ctx.shadowBlur=14;ctx.fill();ctx.shadowBlur=0;}
 },[graph,sim,time,size,view,layers,point,radius]);
 const choose=(x,y)=>{const p=toWorld([x,y]),n=graph.nodes[nearest(graph.nodes,p)];onPoint({p,name:graph.mode==='demo'?'Point exploratoire':n.name,parcel:parcelAt(parcels,p)});};
 return <div className={`map-canvas ${placing?'placing':''}`} ref={outer}><canvas ref={ref} aria-label="Carte interactive des promenades. Cliquez pour analyser un point." tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'){choose(size[0]/2,size[1]/2);}}} onPointerDown={e=>{drag.current={x:e.clientX,y:e.clientY,v:view};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(!drag.current)return;const d=drag.current;if(!placing)setView({...view,x:d.v.x+e.clientX-d.x,y:d.v.y+e.clientY-d.y});}} onPointerUp={e=>{const d=drag.current;drag.current=null;if(!d)return;if(distance([e.clientX,e.clientY],[d.x,d.y])<5||placing){const box=e.currentTarget.getBoundingClientRect();choose(e.clientX-box.left,e.clientY-box.top);}}} onWheel={e=>setView(v=>({...v,zoom:Math.min(4,Math.max(.7,v.zoom*(e.deltaY<0?1.1:.9)))}))}/><div className="map-controls"><button aria-label="Zoom avant" onClick={()=>setView(v=>({...v,zoom:Math.min(4,v.zoom*1.2)}))}><Plus size={18}/></button><button aria-label="Zoom arrière" onClick={()=>setView(v=>({...v,zoom:Math.max(.7,v.zoom/1.2)}))}><Minus size={18}/></button><button aria-label="Recentrer la carte" onClick={()=>setView({zoom:1,x:0,y:0})}><LocateFixed size={18}/></button></div><div className="map-scale"><span style={{width:100*scale}}>100 m</span></div></div>;
}
