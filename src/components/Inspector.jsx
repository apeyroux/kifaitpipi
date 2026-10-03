import {X,MapPin,Info} from 'lucide-react';
import {unproject} from '../geography.js';
export default function Inspector({point,stats,radius,setRadius,time,onClose}){
 const parcel=point.parcel,ll=unproject(point.p),max=Math.max(0,...stats.hours),complete=time>=1440,current=complete?null:Math.floor(time/60);
 const estimate=value=>value?`≈ ${value.toLocaleString('fr-FR')}`:'0';
 return <aside className={`inspector ${parcel?'parcel-inspector':''}`} aria-label={parcel?'Observation de la parcelle':'Observation du point'}>
  <div className="inspector-heading"><span>{parcel?'Parcelle d’observation':'Point d’observation'}</span><button className="icon-button" aria-label="Fermer l’observation" onClick={onClose}><X size={18}/></button></div>
  <h3><MapPin size={17}/>{point.name}</h3>{parcel?<p className="coordinates">Contours officiels · DGFiP / IGN</p>:<p className="coordinates">{ll[1].toFixed(6)}, {ll[0].toFixed(6)}</p>}
  {parcel?<p className="parcel-info">Référence {parcel.id}</p>:null}
  <label className="radius">{parcel?'Marge autour de la parcelle':'Rayon d’observation'} <select value={radius} onChange={e=>setRadius(Number(e.target.value))}>{parcel?<option value={0}>Parcelle seule</option>:null}<option value={5}>5 m</option><option value={15}>15 m</option><option value={30}>30 m</option><option value={60}>60 m</option><option value={100}>100 m</option></select></label>
  <div className="daily"><span>Promenades estimées <Info size={14}/></span><strong data-testid="daily-count">{estimate(stats.total)} <small>/ jour</small></strong><span>Journée complète · 00:00–24:00</span></div>
  <div className="mini-stats">
   <div><strong>{complete?'24:00':estimate(stats.hours[current])}</strong><span>{complete?'Journée complète':`entre ${current}h et ${current+1}h`}</span></div>
   <div><strong>{estimate(stats.urinations)}</strong><span>mictions / marquages par jour</span></div>
   <div><strong>{estimate(stats.defecations)}</strong><span>défécations par jour</span></div>
  </div>
  <div className="chart-head">Promenades par heure <span>{max>0&&stats.peak!==null?`pic ${stats.peak}h`:'aucun passage simulé'}</span></div>
  <div className="histogram" aria-label="Promenades estimées par heure sur la journée complète"><div className="chart-grid"><span>{max}</span><span>{Math.round(max/2)}</span><span>0</span></div><div className="bars">{stats.hours.map((v,h)=><div key={h} className={h===current?'bar current':'bar'} style={{height:`${v/(max||1)*100}%`}} title={`${h}h–${h+1}h : ${estimate(v)} promenades`}><span>{v}</span></div>)}</div></div>
  <div className="chart-labels"><span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>24h</span></div>
  <p className="inspector-note">Ce panneau décrit la journée entière ; la chaleur cumule seulement jusqu’au curseur. {stats.sampleTrips??0} parcours échantillonnés {parcel?'dans cette zone':'dans ce rayon'}, puis pondérés. Chaque promenade compte une fois par jour et par heure touchée. {parcel?`Zone de calcul : toute la parcelle${radius?` et ses abords à ${radius} m`:''}. La marge inclut les rues voisines ; elle ne garantit pas une précision réelle.`:`Le rayon de ${radius} m définit la zone de calcul ; il ne garantit pas une précision de ${radius} m.`} Aucun passage dans l’échantillon ne prouve une absence réelle.</p>
 </aside>;
}
