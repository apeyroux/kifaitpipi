import {unproject} from './geography.js';

function cell(value){
 // Spreadsheet text stays text, including names sourced from OpenStreetMap.
 let text=value==null?'':String(value);
 if(typeof value==='string'&&/^[\s]*[=+@-]/.test(text))text="'"+text;
 return /[;"\r\n]/.test(text)?`"${text.replaceAll('"','""')}"`:text;
}

export function scenarioCsv({stats,point,radius,settings,graph}){
 if(!point?.p)return null;
 const [longitude,latitude]=unproject(point.p);
 const metadata={point_nom:point.name,longitude,latitude,rayon_m:radius,mode_geographique:graph.mode,source_geographique:graph.source,periode:'Journée complète 00:00–24:00',parcours_echantillon_dans_rayon:stats.sampleTrips,promenades_jour_estimees:stats.total,mictions_marquages_jour_estimes:stats.urinations,defecations_jour_estimees:stats.defecations};
 for(const key of Object.keys(settings).sort())metadata[`scenario_${key}`]=settings[key];
 const headers=['heure_debut','heure_fin','promenades_estimees','mictions_marquages_estimes','defecations_estimees',...Object.keys(metadata)];
 const rows=stats.hours.map((walks,h)=>[h,h+1,walks,stats.urinationHours?.[h]??'',stats.defecationHours?.[h]??'',...Object.values(metadata)]);
 return '\uFEFF'+[headers,...rows].map(row=>row.map(cell).join(';')).join('\r\n');
}
