import {readdir,stat,readFile} from 'node:fs/promises';
const root=new URL('../dist/',import.meta.url);let count=0;
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=new URL(entry.name+(entry.isDirectory()?'/':''),dir);if(entry.isDirectory())await walk(path);else{count++;if((await stat(path)).size>25*1024*1024)throw new Error(`Fichier supérieur à la limite Cloudflare Pages de 25 MiB : ${entry.name}`);}}}
await walk(root);if(count>20000)throw new Error('Plus de 20 000 fichiers.');
for(const file of ['index.html','_headers','_redirects','data/chatillon.json','data/parcels.json','data/sources.json'])await stat(new URL(file,root));
const data=JSON.parse(await readFile(new URL('data/chatillon.json',root))),parcels=JSON.parse(await readFile(new URL('data/parcels.json',root)));
if(data.commune?.properties?.code!=='92020'||!data.osm?.elements?.length)throw new Error('Données géographiques de Châtillon manquantes.');
if(parcels.features.length!==parcels.numberMatched||parcels.features.some(f=>f.properties.code_insee!=='92020'))throw new Error('Cadastre incomplet ou hors commune.');
console.log(`Cloudflare Pages : ${count} fichiers, données embarquées et limites vérifiées. Aucun serveur applicatif nécessaire.`);
