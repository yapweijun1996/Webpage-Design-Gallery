import {registry} from '../icons.js';
import {swatch as s} from './tokens.js';

import {atlasSize,lowAtlasSize,atlasCells,plateRect} from './atlas-layout.js';
function canvas(w,h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function image(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Strip only the edge-connected photographic white mat. Retain enclosed white
// lettering, original colours and the complete silhouette of the official mark.
export function trimLogo(img) {
  const scale = Math.min(1,768/img.width,512/img.height);
  const c = canvas(Math.max(1,Math.round(img.width*scale)),Math.max(1,Math.round(img.height*scale)));
  const ctx = c.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(img,0,0,c.width,c.height);
  const {width:w,height:h} = c, pixels = ctx.getImageData(0,0,w,h), a = pixels.data;
  const queue = new Int32Array(w*h), visited = new Uint8Array(w*h);
  let end=0;
  function visit(i) {
    if (visited[i]) return;
    visited[i]=1;
    const p=i*4;
    if (a[p+3]<12 || Math.min(a[p],a[p+1],a[p+2])>=244) {
      a[p+3]=0; queue[end++]=i;
    }
  }
  for(let x=0;x<w;x++){visit(x);visit((h-1)*w+x);}
  for(let y=0;y<h;y++){visit(y*w);visit(y*w+w-1);}
  for(let j=0;j<end;j++){
    const i=queue[j];
    if(i%w)visit(i-1);
    if(i%w<w-1)visit(i+1);
    if(i>=w)visit(i-w);
    if(i+w<w*h)visit(i+w);
  }
  let left=w,top=h,right=-1,bottom=-1;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(a[(y*w+x)*4+3]>24){
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
  }
  if(right<left)return null;
  ctx.putImageData(pixels,0,0);
  const cropped=canvas(right-left+1,bottom-top+1);
  cropped.getContext('2d').drawImage(c,-left,-top);
  return cropped;
}
function contained(image,x,y,w,h) {
  const k=Math.min(w/image.width,h/image.height);
  return {x:x+(w-image.width*k)/2,y:y+(h-image.height*k)/2,w:image.width*k,h:image.height*k};
}
function draw(ctx,img,r){ctx.drawImage(img,r.x,r.y,r.w,r.h);}

function finish(ctx,w,h,c) {
  const p=c.palette;
  ctx.fillStyle=p.fascia;ctx.fillRect(0,0,w,h);
  if(c.finish==='timber-slat'){
    for(let x=0;x<w;x+=h*.155){
      ctx.fillStyle='rgba(0,0,0,.30)';ctx.fillRect(x,0,2,h);
      ctx.fillStyle='rgba(255,216,150,.18)';ctx.fillRect(x+2,0,1,h);
    }
  } else if(c.finish==='stone') {
    ctx.strokeStyle='rgba(255,240,209,.09)';
    for(let i=0;i<6;i++){
      ctx.beginPath();ctx.moveTo(i*w/5-h*.8,h);
      ctx.bezierCurveTo(i*w/5,h*.7,i*w/5-h*.18,h*.5,i*w/5+h*.5,0);ctx.stroke();
    }
  }
  const sheen=ctx.createLinearGradient(0,0,c.finish==='glass'?w*.3:0,h);
  const gloss={matte:.08,stone:.13,'timber-slat':.16,lacquer:.27,glass:.34}[c.finish];
  sheen.addColorStop(0,`rgba(255,238,204,${gloss})`);
  sheen.addColorStop(.38,'rgba(255,238,204,0)');
  sheen.addColorStop(1,'rgba(0,0,0,.20)');
  ctx.fillStyle=sheen;ctx.fillRect(0,0,w,h);
  if(c.preset==='t3-cafe'){
    // Small trailing leaves at the ends of the slats are architectural ornament.
    for(const side of [-1,1]){
      ctx.save();ctx.translate(side<0?h*.13:w-h*.13,0);ctx.scale(-side,1);
      ctx.strokeStyle=s.leaf;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(0,0);
      ctx.quadraticCurveTo(h*.08,h*.24,h*.01,h*.57);ctx.stroke();
      for(let i=0;i<5;i++){
        ctx.fillStyle=i%2?s.leaf:p.accent;
        ctx.beginPath();ctx.ellipse(h*(i%2?.06:.015),h*(.06+i*.094),h*.022,h*.049,i%2?.65:-.65,0,2*Math.PI);ctx.fill();
      }
      ctx.restore();
    }
  }
  ctx.strokeStyle=p.trim;ctx.lineWidth=Math.max(1,h*.013);
  ctx.strokeRect(h*.036,h*.036,w-h*.072,h*.928);
  ctx.save();
  if(c.backlight!=='none'){
    ctx.shadowColor=p.glow;ctx.shadowBlur=h*.06;
    ctx.fillStyle=c.backlight==='neon-line'?p.glow:p.trim;
    ctx.fillRect(h*.07,h*.926,w-h*.14,h*.019);
  }
  ctx.restore();
  // Recessed pools and a fine inlay remain visible on the baked distance face.
  for(const u of [.17,.5,.83]){
    const pool=ctx.createRadialGradient(w*u,0,0,w*u,0,h*.46);
    pool.addColorStop(0,'rgba(255,221,162,.20)');pool.addColorStop(1,'rgba(255,221,162,0)');
    ctx.fillStyle=pool;ctx.fillRect(w*u-h*.46,0,h*.92,h*.46);
    ctx.fillStyle=s.highlight;ctx.beginPath();ctx.ellipse(w*u,h*.056,h*.026,h*.009,0,0,Math.PI*2);ctx.fill();
  }
  ctx.fillStyle=p.accent;ctx.fillRect(w*.055,h*.91,w*.12,h*.014);
}

// Isolate only photographed letter ink for non-anchor relief, leaving badges
// and pictorial logos flat. Coordinates are in the trimmed official artwork.
function letterMask(mark,config) {
  const {width:w,height:h}=mark;
  const c=canvas(w,h),ctx=c.getContext('2d');
  ctx.drawImage(mark,0,0);
  const pixels=ctx.getImageData(0,0,w,h),a=pixels.data;
  const [u,v,rw,rh]=config.inkRegion??[0,0,1,1];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=4*(y*w+x),r=a[i],g=a[i+1],b=a[i+2];
    const keep=x/w>=u && x/w<u+rw && y/h>=v && y/h<v+rh &&
      (config.letterInk==='all' || (config.letterInk==='dark' && Math.max(r,g,b)<150) ||
       (config.letterInk==='red' && r>g*1.35+25 && r>b*1.2) ||
       (config.letterInk==='pale' && r>190 && g>175));
    if(!keep)a[i+3]=0;
  }
  ctx.putImageData(pixels,0,0);
  return c;
}
function lockup(ctx,w,h,c,logo,door,blade=false) {
  const mask=canvas(w,h), ink=mask.getContext('2d');
  const fallback=!logo || c.lockup==='wordmark-only';
  const mark=fallback?door:logo;
  const relief=canvas(w,h), reliefCtx=relief.getContext('2d');
  const caption=fallback || (c.caption && c.lockup!=='monogram' && !blade);
  const stacked=c.lockup==='logo-top' || (blade && fallback);
  const usable=h*(blade?.58:c.fasciaInkHeight), top=blade?h*.10:(h-usable)/2;
  let labelX=w/2,labelY=top+usable*.52,labelW=w*.88;
  let markBounds=null;
  if(mark){
    let box={x:w*.065,y:top,w:w*.87,h:usable};
    if(caption){
      if(stacked) {
        box={x:w*.08,y:top,w:w*.84,h:usable*.44};
        labelY=top+usable*.74;
      } else {
        box={x:w*.065,y:top,w:w*(fallback?.115:c.captionLogoWidth),h:usable};
        labelW=w*(fallback?.72:.85-c.captionLogoWidth);
        labelX=fallback?w*.57:w*.94-labelW/2;
      }
    }
    const r=contained(mark,box.x,box.y,box.w,box.h);
    if(!fallback)markBounds=[r.x/w,r.y/h,r.w/w,r.h/h];
    // A narrow enamel bed supports dark photographic ink, including Sony black.
    // Preserve the manufacturer's colours even when the surround is dark.
    if(c.carrier && !fallback){
      const edge=h*.33, foil=ctx.createLinearGradient(r.x-edge,0,r.x+r.w+edge,0);
      const stop=edge/(r.w+2*edge);
      foil.addColorStop(0,'rgba(248,233,202,0)');foil.addColorStop(stop,s.enamel);
      foil.addColorStop(1-stop,s.enamel);foil.addColorStop(1,'rgba(248,233,202,0)');
      ctx.fillStyle=foil;ctx.fillRect(r.x-edge,h*.075,r.w+2*edge,h*(blade?.62:.82));
    }
    draw(ink,mark,r);
    if(!blade && !fallback){
      if(c.relief)draw(reliefCtx,mark,r);
      else if(c.letterInk)draw(reliefCtx,letterMask(mark,c),r);
    }
  }
  if(caption){
    const font=c.typography==='modern'?'600 SIZEpx Arial, sans-serif':
      c.typography==='editorial'?'500 SIZEpx Georgia, serif':'bold SIZEpx Georgia, serif';
    // An official letter-ink relief already supplies the raised name. Its
    // legibility caption stays on the baked face at every distance.
    const layers=c.letterInk && !fallback ? [ink] : [ink,reliefCtx];
    for(const layer of layers){
      const name=c.captionText??c.brand;
      const words=name.split(/\s+/);
      const candidates=[[name]];
      if(!blade && !stacked)for(let i=1;i<words.length;i++)
        candidates.push([words.slice(0,i).join(' '),words.slice(i).join(' ')]);
      // Fit actual ink, including descenders, to the available panel. Long
      // names can use two tightly spaced lines without shrinking both to fit
      // the width of the unbroken name.
      layer.font=font.replace('SIZE','100');
      const height=usable*(stacked?.44:.95);
      let best;
      for(const lines of candidates){
        const metrics=lines.map(line=>layer.measureText(line));
        const ascent=Math.max(...metrics.map(m=>m.actualBoundingBoxAscent));
        const descent=Math.max(...metrics.map(m=>m.actualBoundingBoxDescent));
        const leading=ascent+descent+6;
        const inkHeight=ascent+descent+leading*(lines.length-1);
        const scale=Math.min(labelW/Math.max(...metrics.map(m=>m.width)),height/inkHeight,
          usable*(stacked?.49:.82)/100);
        if(!best || scale>best.scale)best={lines,ascent,inkHeight,leading,scale};
      }
      const {lines,ascent,inkHeight,leading,scale}=best;
      layer.font=font.replace('SIZE',String(100*scale));
      layer.textAlign='center';layer.textBaseline='alphabetic';layer.fillStyle=c.palette.letter;
      const baseline=labelY+(ascent-inkHeight/2)*scale;
      lines.forEach((line,i)=>layer.fillText(line,labelX,baseline+i*leading*scale));
    }
  }
  ctx.save();
  if(c.backlight==='halo'){ctx.shadowColor=c.palette.glow;ctx.shadowBlur=h*.052;}
  ctx.drawImage(mask,0,h*.016);ctx.restore();
  ctx.drawImage(mask,0,0);
  if(blade){
    const plate=plateRect({x:0,y:0,w,h});
    ctx.fillStyle=c.palette.fascia;ctx.fillRect(plate.x,plate.y,plate.w,plate.h);
    ctx.strokeStyle=c.palette.trim;ctx.lineWidth=1;ctx.strokeRect(plate.x,plate.y,plate.w,plate.h);
    ctx.fillStyle=c.palette.letter;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font='600 '+Math.round(h*.16)+'px Arial';ctx.fillText(c.id,w/2,plate.y+plate.h*.53);
  }
  return {mask,relief,markBounds};
}
function paintPoster(ctx,c,img,r){
  ctx.save();ctx.translate(r.x,r.y);
  ctx.fillStyle=c.palette.trim;ctx.fillRect(0,0,r.w,r.h);
  ctx.fillStyle=s.enamel;ctx.fillRect(3,3,r.w-6,r.h-6);
  if(img) draw(ctx,img,contained(img,5,5,r.w-10,r.h-10));
  else {ctx.fillStyle=s.charcoal;ctx.font='bold 24px Georgia';ctx.textAlign='center';ctx.fillText(c.brand,r.w/2,r.h/2,r.w-16);}
  ctx.restore();
}
export async function bakeAtlas(configs,assetBase) {
  const sheet=canvas(atlasSize,atlasSize), ctx=sheet.getContext('2d',{willReadFrequently:true});
  const tiles=new Map();
  const neutral=await image('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(registry.door.replace('currentColor',s.brass)));
  await Promise.all(configs.map(async c=>{
    const [src,poster]=await Promise.all([
      c.logoFile?image(new URL(c.id==='S01'?'new-moon-logo.svg':'brands/'+c.logoFile,assetBase)):null,
      c.poster?image(new URL('brand-kit/'+c.poster+'-hero.webp',assetBase)):null
    ]);
    const logo=src&&trimLogo(src), cells=atlasCells(Number(c.id.slice(1))-1);
    const masks={};
    for(const kind of ['fascia','blade']){
      const r=cells[kind], h=r.h, w=kind==='blade'?r.w:Math.round(h*c.size.width/c.size.height);
      const face=canvas(w,h), painter=face.getContext('2d');
      finish(painter,w,h,c);
      const {mask,relief,markBounds}=lockup(painter,w,h,c,logo,neutral,kind==='blade');
      draw(ctx,face,r);
      if(kind==='fascia'){
        // Alpha stores the near-field emissive mask in the existing RGBA texture.
        const pixels=ctx.getImageData(r.x,r.y,r.w,h), aux=canvas(r.w,h), auxCtx=aux.getContext('2d');
        auxCtx.drawImage(mask,0,0,r.w,h);
        const alpha=auxCtx.getImageData(0,0,r.w,h).data;
        for(let i=3;i<alpha.length;i+=4)pixels.data[i]=128+(alpha[i]>>1);
        ctx.putImageData(pixels,r.x,r.y);
        const mh=40,mw=Math.round(w/h*mh), small=canvas(mw,mh), smallCtx=small.getContext('2d');
        smallCtx.drawImage(relief,0,0,mw,mh);
        masks.width=mw;masks.height=mh;masks.markBounds=markBounds;
        const rgba=smallCtx.getImageData(0,0,mw,mh).data;
        masks.ink=Uint8Array.from({length:mw*mh},(_,i)=>rgba[4*i+3]>127?1:0);
      }
    }
    paintPoster(ctx,c,poster,cells.poster);
    tiles.set(c.id,{cells,mask:masks});
  }));
  const lowSheet=canvas(lowAtlasSize,lowAtlasSize), low=lowSheet.getContext('2d');
  low.imageSmoothingQuality='high';
  low.drawImage(sheet,0,0,lowAtlasSize,lowAtlasSize);
  return {sheet,lowSheet,tiles};
}
