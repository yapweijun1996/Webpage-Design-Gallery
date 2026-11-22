import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {copy} from './content.mjs';
import {designCopy} from './localized-designs.mjs';
import {storiesA} from './stories-01-10.mjs';
import {storiesB} from './stories-11-20.mjs';
import {tokenizeStyles} from './tokenize.mjs';

const src = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.argv[2] || path.join(src, 'out'));
const outputPaths = [];
const write = (name, value) => {
  const target = path.join(out, name);
  fs.mkdirSync(path.dirname(target), {recursive:true});
  fs.writeFileSync(target, value);
  if (name !== 'index.html' && name !== 'study-assets.json') outputPaths.push(name);
};
const esc = value => String(value).replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const routes = ['index','services','cases','contact'];
const locales = {en:'en',zh:'zh-Hans',ms:'ms'};
const teams = [
 ['Brand & Editorial', '品牌与编辑', 'Jenama & Editorial', [1,2,3,4]],
 ['Product & Platforms', '产品与平台', 'Produk & Platform', [6,7,9,10]],
 ['Retail & Campaigns', '电商与门店', 'Runcit & Kempen', [8,11,12,13]],
 ['Case-led Storytelling', '案例叙事', 'Penceritaan Kes', [5,16,18,19]],
 ['Enterprise & Services', '企业服务', 'Perusahaan & Perkhidmatan', [14,15,17,20]],
];
const types = ['Editorial feature','Boutique studio','Architecture folio','Human-led brand','Operations journal','Bento product','Control-room SaaS','Retail campaign','Developer console','Product workbench','Pop commerce','Editorial directory','Neighbourhood shop','AI research lab','Enterprise network','Field brochure','Minimal consultancy','Digital canvas','Step-by-step story','Industrial craft'];
const designFiles = fs.readdirSync(path.join(src,'designs')).filter(x => x.endsWith('.json')).sort();
const designs = designFiles.map(file => JSON.parse(fs.readFileSync(path.join(src,'designs',file),'utf8')));
const stories = {...storiesA,...storiesB};
const official = 'https://pomelostem.com/';
const wa = 'https://wa.me/60182727900';
const words = {
 en:{story:'A possible story',example:'Illustrative scenario, not a client case study',examples:'More illustrative examples',version:'Design',type:'Web category',whatsapp:'Open WhatsApp',official:'Visit the official website',contact:'Before you get in touch',overview:'All 20 designs', next:'Next design',prev:'Previous design', min:'A distinct visual system and business story.'},
 zh:{story:'一种可能的业务故事',example:'情境示例，不是真实客户案例',examples:'更多示例',version:'设计方案',type:'网页类型',whatsapp:'打开 WhatsApp',official:'访问 Pomelo STEM 官网',contact:'联系前可以准备',overview:'全部 20 套设计',next:'下一套设计',prev:'上一套设计',min:'独立的视觉设计与业务故事。'},
 ms:{story:'Satu kemungkinan',example:'Senario ilustrasi, bukan kajian pelanggan sebenar',examples:'Lagi contoh ilustrasi',version:'Reka bentuk',type:'Kategori laman',whatsapp:'Buka WhatsApp',official:'Lawati laman rasmi',contact:'Sebelum menghubungi kami',overview:'Semua 20 reka bentuk',next:'Reka bentuk seterusnya',prev:'Reka bentuk sebelumnya',min:'Sistem visual dan kisah perniagaan yang tersendiri.'},
};
const brand = `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="15" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 26c9 0 6-13 16-13M17 26c6 0 11-4 11-13-8 0-12 4-11 13Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>Pomelo<strong> STEM</strong></span>`;
const links = (txt,items, current) => items.map(([href,label],i)=>`<a href="${href}"${i===current?' aria-current="page"':''}>${esc(label)}</a>`).join('');
const button = (href, label, className='button') => `<a class="${className}" href="${href}">${esc(label)} <span aria-hidden="true">↗</span></a>`;
const shape = (d, n) => {
  const c = d.color, a = d.art, shift = (n*23)%109;
  const dot = (x,y,r=8)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
  const stroke = (s,w=2)=>`<path d="${s}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const rec = (x,y,w,h,opacity=.8, rx=5)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${c}" opacity="${opacity}"/>`;
  let geom;
  if (['orbit','dots','seal','contour'].includes(a)){
    geom = Array.from({length:7},(_,i)=>`<ellipse cx="320" cy="205" rx="${44+i*37}" ry="${29+i*20}" transform="rotate(${(n*17)%95} 320 205)" fill="none" stroke="${c}" opacity="${.9-i*.09}" stroke-width="${i%3===0?3:1.4}"/>`).join('')+dot(320,205,26)+dot(185+shift,95,13)+dot(455,287,9);
  } else if (['matrix','grid','mosaic','blocks','cards','window'].includes(a)){
    geom = Array.from({length:28},(_,i)=>{const j=(i*9+n*3)%11;return rec(101+(i%7)*65,65+Math.floor(i/7)*67,44+(j%4)*4,37+(j%5)*4,.14+j*.074,a==='cards'?12:2);}).join('');
    geom += stroke('M94 316H545M95 54V321',1)+dot(518,88,16);
  } else if (['paper','columns','stairs','beam'].includes(a)){
    geom = Array.from({length:9},(_,i)=>{const h=55+(i*36+shift)%200;return rec(95+i*53,320-h,33,h,.22+(i%5)*.16,a==='paper'?12:1);}).join('')+stroke('M77 323H568',2)+dot(521,67,20);
  } else {
    geom=Array.from({length:8},(_,i)=>stroke(`M70 ${115+i*25} C188 ${30+shift+i*15} 228 ${369-i*17} 334 ${240-i*8} S${465+i*6} ${25+i*18} 568 ${97+i*28}`,i%4===0?4:1.5)).join('')+dot(143+shift,166,17)+dot(463,233,13);
  }
  return `<svg viewBox="0 0 640 400" aria-hidden="true" focusable="false"><path d="M47 57v-13h13m520 0h13v13m0 287v13h-13m-520 0H47v-13" stroke="${c}" opacity=".65" fill="none" stroke-width="2"/>${geom}<text x="51" y="384" fill="currentColor" opacity=".75" font-size="11" font-family="monospace">PS / ${String(n).padStart(2,'0')}   ○   ${esc(a.toUpperCase())}</text></svg>`;
};
const listCards = (items,{cls='cards',ordered=false}={}) => {
 const tag=ordered?'ol':'ul';
 return `<${tag} class="${cls}">${items.map(([title,desc,small],i)=>`<li class="card"><span class="card-no" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><h3>${esc(title)}</h3><p>${esc(desc)}</p>${small?`<small>${esc(small)}</small>`:''}</li>`).join('')}</${tag}>`;
};
const section = (eyebrow,title,intro,content) => `<section class="section shell"><header class="section-head"><p class="kicker">${esc(eyebrow)}</p><h2>${esc(title)}</h2>${intro?`<p>${esc(intro)}</p>`:''}</header>${content}</section>`;
function page(d,n,lang,route) {
  const m=copy[lang], w=words[lang], st=stories[d.id][lang], k=lang==='en'?d:designCopy[d.id][lang], ix=routes.indexOf(route);
  const base='../../../shared/';
  const dir=locales[lang];
  const nav=routes.map((r,i)=>[r+'.html',m.nav[i]]);
  const langSwitch=Object.entries(locales).map(([l,loc])=>`<a lang="${loc}" hreflang="${loc}" href="../${loc}/${route}.html"${l===lang?' aria-current="true"':''}>${esc(copy[l].label)}</a>`).join('');
  const storyBox = `<div class="story-wrap"><p class="scenario">${esc(w.example)}</p>${listCards(st.beats,{cls:'beats',ordered:true})}</div>`;
  const hero = `<section class="hero shell"><div class="hero-copy"><p class="kicker">${esc(k.eyebrow)}</p><h1>${esc(k.tagline)}</h1><p class="lede">${esc(k.deck)}</p><div class="actions">${button('services.html',m.cta)}${button('cases.html',m.nav[2],'text-link')}</div></div><div class="hero-art">${shape(d,n)}<p class="art-label"><span>${esc(d.name)}</span><span>${esc(w.version)} ${String(n).padStart(2,'0')}</span></p></div></section>`;
  const intro = (title,deck) => `<section class="page-intro shell"><div><p class="kicker">${esc(d.name)} / ${esc(m.nav[ix])}</p><h1>${esc(title)}</h1><p class="lede">${esc(deck)}</p></div><div class="page-art">${shape(d,n)}</div></section>`;
  const cta = `<aside class="bottom-cta shell"><p>${esc(m.contactIntro)}</p>${button('contact.html',m.contactCta)}</aside>`;
  let main;
  if(route==='index'){
    const one=section(w.story,st.title,'',storyBox);
    const two=section(m.nav[1],m.homeSection,m.homeIntro,listCards(m.serviceCards)+button('services.html',m.nav[1],'text-link'));
    const process=section(m.preview,m.processTitle,'',listCards(m.process,{cls:'process',ordered:true}));
    // Three narrative progressions, matched to visual families rather than one repeated homepage.
    main=hero+([0,3].includes(n%4)?two+one+process:n%4===1?one+two+process:one+process+two)+cta;
  } else if(route==='services'){
    main=intro(m.servicesTitle,m.servicesIntro)+section(m.nav[1],m.homeSection,'',listCards(m.serviceCards))+section(m.preview,m.processTitle,'',listCards(m.process,{cls:'process',ordered:true}))+cta;
  } else if(route==='cases'){
    main=intro(m.casesTitle,m.casesIntro)+section(w.story,st.title,'',storyBox)+section(m.nav[2],w.examples,'',listCards(m.caseCards,{cls:'cases'}))+cta;
  } else {
    main=intro(m.contactTitle,m.contactIntro)+`<section class="section contact-grid shell"><div class="contact-panel"><h2>${esc(w.contact)}</h2><ul>${m.contactTopics.map(topic=>`<li>${esc(topic)}</li>`).join('')}</ul></div><div class="contact-panel"><h2>Pomelo STEM</h2><p>${esc(m.contactNote)}</p><div class="actions">${button(wa,w.whatsapp)}${button(official,w.official,'text-link')}</div></div></section>`;
  }
  return `<!doctype html>
<html lang="${dir}" data-layout="${esc(d.layout)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><meta name="theme-color" content="${esc(d.color)}"><meta name="description" content="${esc(k.description)}"><title>${esc(m.nav[ix])} · ${esc(d.name)} · Pomelo STEM</title><link rel="icon" href="${base}mark.svg" type="image/svg+xml"><link rel="stylesheet" href="${base}study-tokens.css"><link rel="stylesheet" href="${base}common.css"><link rel="stylesheet" href="${base}${d.id}.css">${Object.values(locales).map(l=>`<link rel="alternate" hreflang="${l}" href="../${l}/${route}.html">`).join('')}</head>
<body><a href="#main" class="skip">${esc(m.skip)}</a>
<header class="masthead"><div class="shell header-inner"><a class="brand" href="index.html" aria-label="Pomelo STEM">${brand}</a><nav class="nav">${links(m,nav,ix)}</nav><nav class="langs" aria-label="Language">${langSwitch}</nav></div></header>
<div class="study-strip"><div class="shell"><a href="../../../index.html">← ${esc(w.overview)}</a><span>${esc(m.preview)} · ${String(n).padStart(2,'0')} / 20</span></div></div>
<main id="main">${main}</main>
<footer class="footer"><div class="shell"><div><a class="brand" href="index.html">${brand}</a><p>${esc(m.footer)}</p></div><nav>${links(m,nav,ix)}</nav><div class="study-pagination"><a href="../../${designs[(n+18)%20].id}/${dir}/${route}.html">← ${esc(w.prev)}</a><a href="../../${designs[n%20].id}/${dir}/${route}.html">${esc(w.next)} →</a></div></div></footer></body></html>`;
}
function hub() {
 const grouped = teams.map((team,g)=>`<section class="hub-group" id="category-${g+1}"><header><span>0${g+1} / 05</span><h2>${team[0]}</h2><p lang="zh-Hans">${team[1]}</p><p lang="ms">${team[2]}</p></header><div class="hub-grid">${team[3].map(n=>{
   const d=designs[n-1]; const href=`studies/${d.id}/`;
   return `<article class="hub-card"><a class="hub-art" href="${href}en/index.html" aria-label="${esc(d.name)}"><img src="shared/${d.id}.webp" width="1000" height="640" alt="" loading="lazy" decoding="async"></a><div class="hub-card-content"><p class="hub-label">${String(n).padStart(2,'0')} / ${esc(types[n-1])}</p><h3><a href="${href}en/index.html">${esc(d.name)}</a></h3><p>${esc(d.description)}</p><nav aria-label="${esc(d.name)} languages">${Object.entries(locales).map(([l,directory])=>`<a lang="${directory}" href="${href}${directory}/index.html">${esc(copy[l].label)}</a>`).join('')}</nav></div></article>`;
 }).join('')}</div></section>`).join('');
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#152420"><meta name="description" content="Compare twenty independent multilingual website design studies for Pomelo STEM."><title>20 website studies · Pomelo STEM</title><link rel="icon" href="shared/mark.svg" type="image/svg+xml"><link rel="stylesheet" href="shared/study-tokens.css"><link rel="stylesheet" href="shared/hub.css"><link rel="manifest" href="./manifest.webmanifest"></head><body><a class="skip" href="#main">Skip to content</a><header class="hub-header"><a class="brand" href="./index.html">${brand}</a><a href="../../../..//index.html">Webpage Design Gallery ↗</a></header><main id="main"><section class="hub-hero"><p class="hub-label">POMELO STEM · DESIGN EXPLORATION 01</p><h1>20 websites.<br>20 ways to tell the story.</h1><p>Compare four-page sites across twenty visual categories. Explore each design in English, Simplified Chinese or Malay. These are proposals, not changes to the official site.</p><p lang="zh-Hans">20 套独立多页设计，每套都有自己的视觉语言和业务故事。<span lang="ms"> 20 reka bentuk berbilang halaman, setiap satu dengan gaya dan kisah tersendiri.</span></p><nav aria-label="Design groups">${teams.map((t,i)=>`<a href="#category-${i+1}">${t[0]} ↓</a>`).join('')}</nav></section>${grouped}</main><footer class="hub-footer"><span>Pomelo STEM · Design studies · 20 × 4 × 3</span><a href="${official}">Official website ↗</a></footer></body></html>`.replace('../../../..//','../../../../');
}
if (designs.length!==20 || new Set(designs.map(d=>d.id)).size!==20 || new Set(designs.map(d=>d.layout)).size!==20) throw new Error('Expected twenty distinctly composed designs.');
const authoredStyles=Object.fromEntries([
 ...['common.css','hub.css'].map(file=>[file,fs.readFileSync(path.join(src,file),'utf8')]),
 ...designs.map(d=>[d.id+'.css',fs.readFileSync(path.join(src,'designs',d.id+'.css'),'utf8')]),
]);
const {styles,tokens}=tokenizeStyles(authoredStyles);
const registry=path.resolve(process.argv[3]||path.join(src,'../../design-system/pomelo-study-tokens.json'));
fs.writeFileSync(registry,JSON.stringify(tokens,null,2)+'\n');
for(const [file,css] of Object.entries(styles)) write('shared/'+file,css);
write('shared/mark.svg',fs.readFileSync(path.join(src,'mark.svg')));
outputPaths.push('shared/study-tokens.css');
for (const [i,d] of designs.entries()) {
 if (!/^\d\d-[a-z0-9-]+$/.test(d.id) || !/^#[0-9a-f]{6}$/i.test(d.color)) throw new Error('Invalid design: '+d.id);
 outputPaths.push('shared/'+d.id+'.webp');
 for(const [lang,folder] of Object.entries(locales)) {
   if (stories[d.id]?.[lang]?.beats.length!==3) throw new Error('Missing story '+d.id+' '+lang);
   for(const route of routes) write(`studies/${d.id}/${folder}/${route}.html`,page(d,i+1,lang,route));
 }
}
write('index.html',hub());
write('study-assets.json',JSON.stringify(outputPaths.sort(),null,2)+'\n');
console.log(`Built ${designs.length} themes, ${designs.length*3*4} localized pages, ${outputPaths.length} registered published assets in ${out}`);
