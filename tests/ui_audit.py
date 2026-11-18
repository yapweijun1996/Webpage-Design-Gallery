"""Read-only UI/UX browser audit candidates: python tests/ui_audit.py <url> <out-dir>.

Captures fold and full-page screenshots at six viewports and reports deterministic DOM candidates
(overflow, small or unnamed controls, alt text, headings, tiny text, console errors, keyboard focus).
It does not replace manual review, axe-core or a real-device check.
"""
import os, sys, json
from pathlib import Path
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8811/index.html'
S = Path(sys.argv[2] if len(sys.argv) > 2 else 'artifacts/ui-audit'); S.mkdir(parents=True, exist_ok=True); S = str(S)
sizes=[(320,720),(390,844),(430,932),(768,1024),(1024,768),(1440,900)]
rep={}
JS='''()=>{
 const doc=document.documentElement, out={overflow:doc.scrollWidth>innerWidth+2, scrollW:doc.scrollWidth, vw:innerWidth};
 const vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};
 const ctl=[...document.querySelectorAll('a[href],button,input,select,textarea,[role=button],summary')].filter(vis);
 out.controls=ctl.length;
 out.small=ctl.map(e=>{const r=e.getBoundingClientRect();return [e.tagName,(e.getAttribute('aria-label')||e.innerText||e.id||'').trim().slice(0,28),Math.round(r.width),Math.round(r.height)]}).filter(a=>a[3]<44||a[2]<44);
 out.unnamed=ctl.filter(e=>!(e.getAttribute('aria-label')||e.innerText||e.getAttribute('title')||e.labels?.length||e.getAttribute('alt'))).map(e=>e.outerHTML.slice(0,120));
 out.imgsNoAlt=[...document.images].filter(i=>!i.hasAttribute('alt')).length;
 out.imgsBroken=[...document.images].filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.src.slice(-50));
 const h=[...document.querySelectorAll('h1,h2,h3,h4')].map(e=>+e.tagName[1]);
 out.h1=h.filter(x=>x===1).length; out.headingJumps=h.map((x,i)=>i&&x-h[i-1]>1?[h[i-1],x]:null).filter(Boolean);
 out.title=document.title; out.lang=doc.lang; out.viewportMeta=!!document.querySelector('meta[name=viewport]');
 const small=[...document.querySelectorAll('p,li,a,span,button,label,small')].filter(vis).map(e=>parseFloat(getComputedStyle(e).fontSize)).filter(x=>x<12);
 out.tinyText=small.length;
 return out}'''
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ.get('GALLERY_CHROME') or None,headless=False)
    for w,h in sizes:
        ctx=b.new_context(viewport={'width':w,'height':h},device_scale_factor=2 if w<500 else 1,has_touch=w<800)
        pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)[:150])); pg.on('console',lambda m:errs.append('console:'+m.text[:120]) if m.type=='error' else None)
        pg.goto(URL,wait_until='load'); pg.wait_for_timeout(1500)
        d=pg.evaluate(JS); d['errors']=errs
        pg.screenshot(path=f"{S}/home_{w}_fold.png"); pg.screenshot(path=f"{S}/home_{w}_full.png",full_page=True)
        d['pageH']=pg.evaluate('document.documentElement.scrollHeight')
        rep[f'{w}x{h}']=d; ctx.close()
    # keyboard: first 12 tab stops visible focus
    ctx=b.new_context(viewport={'width':1440,'height':900}); pg=ctx.new_page(); pg.goto(URL); pg.wait_for_timeout(1000)
    stops=[]
    for i in range(14):
        pg.keyboard.press('Tab'); stops.append(pg.evaluate("(()=>{const e=document.activeElement;const s=getComputedStyle(e);return [e.tagName,(e.getAttribute('aria-label')||e.innerText||'').trim().slice(0,24),s.outlineStyle+' '+s.outlineWidth]})()"))
    rep['tabstops']=stops
    b.close()
json.dump(rep,open(S+'/audit.json','w'),indent=1)
for k,v in rep.items():
    if k=='tabstops': print('TAB',v); continue
    print(k,'overflow',v['overflow'],'controls',v['controls'],'small<44:',len(v['small']),'unnamed',len(v['unnamed']),'noalt',v['imgsNoAlt'],'broken',v['imgsBroken'],'h1',v['h1'],'jumps',v['headingJumps'],'tiny<12px',v['tinyText'],'pageH',v['pageH'],'err',v['errors'])
print('title/lang',rep['390x844']['title'],rep['390x844']['lang'])
print('small@390',rep['390x844']['small'][:14])
