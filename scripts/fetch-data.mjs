import {mkdir,writeFile,rename,rm} from 'node:fs/promises';
import {fetchRealData,parseOSM} from '../src/geography.js';
const out=new URL('../public/data/chatillon.json',import.meta.url),temporary=new URL('../public/data/chatillon.json.tmp',import.meta.url);
console.log('Récupération du contour, de la population et du réseau piéton de Châtillon (92020)…');
try {
 const data=await fetchRealData(AbortSignal.timeout(120000));const parsed=parseOSM(data.osm,data.commune);
 if(!Number.isFinite(parsed.population)||parsed.population<1000)throw new Error('Population manquante ou incohérente.');
 await mkdir(new URL('../public/data/',import.meta.url),{recursive:true});
 await writeFile(temporary,JSON.stringify({...data,retrievedAt:new Date().toISOString(),sources:['https://geo.api.gouv.fr/communes/92020','https://overpass-api.de/api/interpreter']}));await rename(temporary,out);
 console.log(`Données validées : ${parsed.population} habitants, ${parsed.nodes.length} nœuds connectés, ${parsed.buildings.length} bâtiments, ${parsed.doors.length} entrées/proxies. Relancez le site ou rechargez la page.`);
 console.log('La possession de chiens et les comportements restent des hypothèses : vérifiez le baromètre FACCO et calibrez les paramètres.');
}catch(error){await rm(temporary,{force:true});console.error('Échec de la récupération :',error.message);console.error('Vérifiez l’accès à geo.api.gouv.fr et overpass-api.de. Les données déjà enregistrées restent inchangées.');process.exitCode=1;}
