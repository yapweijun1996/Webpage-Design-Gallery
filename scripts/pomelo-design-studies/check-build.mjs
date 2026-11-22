import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const root=path.resolve(process.argv[2]);const manifest=JSON.parse(fs.readFileSync(process.argv[3]||path.join(root,'study-assets.json')));
assert.equal(new Set(manifest).size,manifest.length);
const htmlPaths=manifest.filter(p=>p.endsWith('.html'));assert.equal(htmlPaths.length,240);
const ids=new Set(),stories=new Set(),layouts=new Set(),titles=new Set();let refs=0;
for(const rel of ['index.html',...htmlPaths]){
 const f=path.join(root,rel);const s=fs.readFileSync(f,'utf8');assert.equal([...s.matchAll(/<h1(?:\s[^>]*)?>/g)].length,1,rel);
 if(rel!=='index.html'){
   const [,id,lang,page]=rel.split('/');ids.add(id);
   assert.ok(s.includes('<html lang="'+lang+'"'),rel);assert.equal([...s.matchAll(/<link rel="alternate"/g)].length,3,rel);
   assert.ok(s.includes('<main id="main">'),rel);assert.ok(s.includes('name="viewport" content="width=device-width,initial-scale=1"'),rel);
   assert.ok(s.includes('noindex,follow'),rel);
   const title=(s.match(/<title>(.*?)<\/title>/)||[])[1];assert.ok(title && !titles.has(lang+title),rel);titles.add(lang+title);
   if(page==='index.html'&&lang==='en'){
      layouts.add(s.match(/data-layout="([^"]+)"/)[1]);const h=s.match(/<div class="story-wrap">[^]*?<h3>(.*?)<\/h3>/)?.[1];assert.ok(h,rel);stories.add(h);
   }
 }
 for(const [,ref] of s.matchAll(/\b(?:href|src)="([^"]+)"/g)){
   if(ref.startsWith('#')){assert.ok(s.includes('id="'+ref.slice(1)+'"'),rel+' -> '+ref);continue;}
   if(/^https:\/\//.test(ref)){assert.ok(['https://pomelostem.com/','https://wa.me/60182727900'].includes(ref),ref);continue;}
   if(rel==='index.html'&&['./manifest.webmanifest','../../../../index.html'].includes(ref))continue;
   refs++; const dest=path.resolve(path.dirname(f),ref);assert.ok(dest.startsWith(root+path.sep)&&fs.statSync(dest).isFile(),rel+' -> '+ref);
 }
}
assert.equal(ids.size,20);assert.equal(layouts.size,20);assert.equal(stories.size,20);
console.log('PASS: 20 distinct layouts and stories, 240 localized pages, '+refs+' resolved internal references');
