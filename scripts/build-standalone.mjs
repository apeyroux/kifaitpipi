import {readFile, writeFile} from 'node:fs/promises';

// Package the built application for direct opening with file://, without a server.
const root = new URL('../dist/', import.meta.url);
let html = await readFile(new URL('index.html', root), 'utf8');
const jsPath = html.match(/<script[^>]+src="([^"]+)"[^>]*><\/script>/)?.[1];
const cssPath = html.match(/<link[^>]+href="([^"]+\.css)"[^>]*>/)?.[1];
if (!jsPath || !cssPath) throw new Error('Build Vite manquant ou format inattendu.');
const asset = path => new URL(path.replace(/^\//, ''), root);
let css = await readFile(asset(cssPath), 'utf8');
for (const match of [...css.matchAll(/url\(([^)]+)\)/g)]) {
  const path = match[1].replace(/^["']|["']$/g, '');
  if (path.startsWith('data:')) continue;
  const bytes = await readFile(asset(path));
  const mime = path.endsWith('.woff2') ? 'font/woff2' : 'font/woff';
  css = css.replace(match[0], `url(data:${mime};base64,${bytes.toString('base64')})`);
}
const data = {};
for (const name of ['chatillon', 'parcels', 'sources']) {
  data[`/data/${name}.json`] = JSON.parse(await readFile(asset(`/data/${name}.json`), 'utf8'));
}
const embedded = JSON.stringify(data).replace(/</g, '\\u003c');
const bootstrap = `const localData=${embedded};const originalFetch=window.fetch.bind(window);window.fetch=(url,options)=>Object.hasOwn(localData,url)?(options?.signal?.aborted?Promise.reject(new DOMException('Aborted','AbortError')):Promise.resolve(new Response(JSON.stringify(localData[url]),{headers:{'Content-Type':'application/json'}}))):originalFetch(url,options);`;
const js = await readFile(asset(jsPath), 'utf8');
html = html.replace(/<script[^>]+src="[^"]+"[^>]*><\/script>/, () => `<script type="module">${bootstrap}${js.replace(/<\/script/gi, '<\\/script')}</script>`);
html = html.replace(/<link[^>]+href="[^"]+\.css"[^>]*>/, () => `<style>${css}</style>`);
const favicon = await readFile(asset('/favicon.svg'));
html = html.replace('/favicon.svg', `data:image/svg+xml;base64,${favicon.toString('base64')}`);
const output = new URL('../kikifaitpipi-autonome.html', import.meta.url);
await writeFile(output, html);
console.log(`Version autonome créée : ${output.pathname}`);
