'use strict';
const fs=require('node:fs'), path=require('node:path'), http=require('node:http'), assert=require('node:assert/strict');
const puppeteer=require(process.env.POM_PUPPETEER || 'puppeteer-core');
const root=path.resolve(process.argv[2]);
const mode=process.argv[3]||'audit';
const manifest=JSON.parse(fs.readFileSync(process.argv[4]||path.join(root,'study-assets.json')));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.webp':'image/webp'};
const server=http.createServer((req,res)=>{
 try {
 const name=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if (!name.startsWith(root+path.sep)) return res.writeHead(404).end();
 const buf=fs.readFileSync(name);
 res.writeHead(200,{'Content-Type':mime[path.extname(name)]||'application/octet-stream','Cache-Control':'no-store'}).end(buf);
 } catch{res.writeHead(404).end();}
});
const sizes=[{width:1440,height:1050},{width:768,height:1024},{width:390,height:844}];
const baseChrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
async function entry() {
  await new Promise((ok,bad)=>server.once('error',bad).listen(0,'127.0.0.1',ok));
  const start='http://127.0.0.1:'+server.address().port+'/';
  const browser=await puppeteer.launch({executablePath:process.env.POM_CHROME||baseChrome,headless:true,args:['--disable-background-networking']});
  try{
   if(mode==='screens'){
    fs.mkdirSync(path.join(root,'screenshots'),{recursive:true});
    fs.mkdirSync(path.join(root,'assets'),{recursive:true});
    const p=await browser.newPage();
    await p.setViewport({width:1000,height:640});
    for(const entry of manifest.filter(f=>f.endsWith('.webp'))){
     const id=path.basename(entry,'.webp');
     const page=await p.goto(start+'studies/'+id+'/en/index.html',{waitUntil:'load'}); assert.equal(page.status(),200);
     await p.screenshot({path:path.join(root,entry),type:'webp',quality:78});
    }
    await p.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
    for(const size of sizes){
     await p.setViewport(size);
     const r=await p.goto(start+'index.html',{waitUntil:'load'}); assert.equal(r.status(),200);
     assert.equal(await p.$$eval('.hub-card',all=>all.length),20);
     await p.screenshot({path:path.join(root,'screenshots',size.width+'.png'),type:'png'});
    }
    await p.setViewport({width:640,height:400});await p.goto(start+'index.html',{waitUntil:'load'});
    await p.screenshot({path:path.join(root,'assets','thumbnail.webp'),type:'webp',quality:88});
    await p.close();
    console.log('PASS: real Chrome gallery screenshots and thumbnail captured');
    return;
   }
   let tasks = manifest.filter(s=>s.endsWith('.html')).flatMap(file=>[1440,390].map(width=>({file,width})));
   tasks.push({file:'index.html',width:1440},{file:'index.html',width:390});
   const failures=[]; let done=0;
   const workers=Array.from({length:4},async()=>{
    const p=await browser.newPage();
    try{
     await p.setRequestInterception(true);
     p.on('request',r=>{ if(r.url().startsWith(start)) void r.continue().catch(()=>{});else void r.abort().catch(()=>{}); });
     while(tasks.length){
      const {file,width}=tasks.shift();
      const requestErrors=[];
      const track=r=>{if(r.status()>=400&&!r.url().endsWith('/manifest.webmanifest'))requestErrors.push(r.url());};
      p.on('response',track);
      try{
       await p.setViewport({width,height:width===390?844:1050});
       const res=await p.goto(start+file,{waitUntil:'load',timeout:13000});
       assert.equal(res.status(),200);
       const computed=await p.evaluate(()=>{
        const main=document.querySelector('main'), h=document.querySelector('h1'), head=document.querySelector('header');
        const brand=document.querySelector('.brand');
        const c=getComputedStyle;
        return {language:document.documentElement.lang,overflow:document.documentElement.scrollWidth-innerWidth,
          render:h?.getBoundingClientRect().height>0 && main?.getBoundingClientRect().height>0 && head?.getBoundingClientRect().height>0,
          h1:document.querySelectorAll('h1').length,brand:!!brand?.textContent.trim(), top: c(document.body).backgroundColor,
          text: c(document.body).color, current:document.querySelectorAll('.nav [aria-current=page]').length,
          styles:[...document.styleSheets].length, langs:document.querySelectorAll('.langs a').length,
          langRefs:[...document.querySelectorAll('.langs a')].map(x=>x.getAttribute('href')),
          stale:[...document.querySelectorAll('a[href]')].some(x=>x.getAttribute('href')===''),
          headLinks:[...document.querySelectorAll('.header-inner a')].every(a=>a.getBoundingClientRect().height>=39 || a.className==='brand')};
       });
       assert.ok(computed.render&&computed.h1===1&&computed.brand&&!computed.stale);
       assert.ok(computed.overflow<=1,'horizontal overflow '+computed.overflow);
       if(file!=='index.html'){
        assert.equal(computed.language,file.split('/')[2]);assert.equal(computed.langs,3);assert.equal(computed.current,1);
        assert.ok(computed.headLinks&&computed.styles>=2,'missing styles or touch targets');assert.equal(computed.langRefs.length,3);
       }
       if(requestErrors.length)throw new Error('failed internal requests '+requestErrors.join(' '));
      }catch(e){failures.push({file,width,reason:e.message});}
      finally{p.off('response',track);done++;}
     }
    } finally{await p.close();}
   });
   await Promise.all(workers);
   const journey=await browser.newPage();
   try {
    await journey.setViewport({width:390,height:844});
    await journey.goto(start+'index.html',{waitUntil:'load'});
    const click=async selector=>Promise.all([journey.waitForNavigation({waitUntil:'load'}),journey.click(selector)]);
    await click('.hub-card .hub-art');
    assert.ok(new URL(journey.url()).pathname.endsWith('/en/index.html'));
    await click('.nav a[href="services.html"]');
    await click('.langs a[hreflang="zh-Hans"]');
    assert.ok(new URL(journey.url()).pathname.endsWith('/zh-Hans/services.html'));
    await click('.nav a[href="cases.html"]');
    await click('.langs a[hreflang="ms"]');
    assert.ok(new URL(journey.url()).pathname.endsWith('/ms/cases.html'));
    await click('.nav a[href="contact.html"]');
    assert.equal(await journey.$eval('.contact-panel a[href^="https://wa.me/"]',a=>a.getAttribute('href')),'https://wa.me/60182727900');
    await click('.study-strip a');
    assert.equal(new URL(journey.url()).pathname,'/index.html');
    console.log('PASS: mobile hub → design → service → Chinese → case → Malay → contact → hub');
   } finally{await journey.close();}
   console.log(JSON.stringify({viewports:[1440,390],navigations:done,failures},null,2));
   assert.equal(failures.length,0,'browser navigation, styling or mobile geometry failure');
  }finally{await browser.close();}
}
entry().catch(e=>{console.error(e); process.exitCode=1;}).finally(()=>server.close());
