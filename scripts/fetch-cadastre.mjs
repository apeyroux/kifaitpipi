import {writeFile,rename,rm,mkdir} from 'node:fs/promises';
import {fetchCadastre,parseCadastre} from '../src/geography.js';
const out=new URL('../public/data/parcels.json',import.meta.url),temp=new URL('../public/data/parcels.json.tmp',import.meta.url);
console.log('Récupération paginée du cadastre de Châtillon via IGN / DGFiP…');
try{const data=await fetchCadastre(AbortSignal.timeout(120000));const parcels=parseCadastre(data);if(!parcels.length)throw new Error('Aucune parcelle valide.');await mkdir(new URL('../public/data/',import.meta.url),{recursive:true});await writeFile(temp,JSON.stringify(data));await rename(temp,out);console.log(`${data.features.length} parcelles validées, ${parcels.length} polygones. Rechargez le site.`);}catch(e){await rm(temp,{force:true});console.error('Échec cadastral :',e.message,'Les données précédentes restent inchangées.');process.exitCode=1;}
