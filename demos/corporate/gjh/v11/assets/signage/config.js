import {slotCapacity} from './atlas-layout.js';
import {presets} from './presets.js';

// Logo IDs resolve only through brands/logo-sources.json (status "found").
// "caption" is for artwork without a legible Latin store name.
const store = (preset, options = {}) => ({preset, ...options});
export const stores = Object.freeze({
  // The yellow crescent occupies (6,5)–(102,134) in the trimmed 675 × 139 SVG.
  S01:store('t1-classic',{relief:true,palette:{fascia:'#3d483f'},faceGlaze:{colour:'#7d786d',opacity:.14},logoModule:'sign_logo3d_new_moon',logoRegion:[6/675,5/139,96/675,129/139]}),
  S02:store('t3-cafe',{relief:true,fasciaInkHeight:.88}),
  S03:store('t8-kids',{letterInk:'dark',faceGlaze:{colour:'#000000',opacity:.15},palette:{fascia:'#ccbaa5'}}),
  S04:store('t6-beauty',{carrier:true,caption:true,letterInk:'pale',inkRegion:[0,0,1,.64]}),
  S05:store('heritage-red',{caption:true,captionLogoWidth:.14}),
  S06:store('t5-book',{carrier:true,letterInk:'all',inkRegion:[.45,0,.55,1]}),
  S07:store('heritage-red',{caption:true,carrier:true}),
  S08:store('midnight',{letterInk:'red'}),
  S09:store('midnight',{caption:true}),
  S10:store('t7-home',{caption:true,fasciaInkHeight:.92}),
  S11:store('heritage-red',{caption:true}),
  S12:store('t5-book',{caption:true,carrier:true}),
  S13:store('t4-tech',{carrier:true,letterInk:'dark'}),
  S14:store('t6-beauty',{carrier:true,letterInk:'all',inkRegion:[.52,0,.48,1]}),
  S15:store('t2-fashion',{carrier:true,letterInk:'all'}),
  S16:store('t4-tech',{caption:true,captionText:'GP Batteries',letterInk:'pale'}),
  S17:store('t2-fashion',{letterInk:'all'})
});

function luminance(hex) {
  const [r,g,b] = hex.slice(1).match(/../g).map(pair => parseInt(pair,16)/255)
    .map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
  return .2126*r + .7152*g + .0722*b;
}
export function contrast(a,b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
const options = {
  lockup:['logo-left','logo-top','wordmark-only','monogram'],
  typography:['heritage','editorial','modern'], backlight:['halo','underglow','neon-line','none'],
  finish:['lacquer','matte','timber-slat','stone','glass']
};
export function bayWidth(bay) {
  return bay.side === 'north' ? bay.maxX-bay.minX : bay.maxZ-bay.minZ;
}
export function fasciaBand(bay) {
  // The tracked north-anchor label ends at 4.14 m. Its structural fascia
  // ends at 4.7 + 1.55/2. Keep the artwork above the existing HUD target.
  if(Number(bay.number)<=3)return {bottom:4.15,top:5.475,clearance:0};
  return {bottom:4.02,top:5.48,clearance:.10};
}
function tint(base,accent) {
  const channels=[1,3,5].map(i=>
    Math.round(.84*parseInt(base.slice(i,i+2),16)+.16*parseInt(accent.slice(i,i+2),16)));
  return '#'+channels.map(v=>v.toString(16).padStart(2,'0')).join('');
}
export function resolveConfig(id, settings, bay, kit, receipts) {
  const presetId=settings?.preset??'t1-classic';
  if (!settings || !Object.hasOwn(presets,presetId)) throw Error('Invalid signage preset: '+id);
  const slot=Number(bay.number);
  if (!/^S\d{2}$/.test(id) || id!=='S'+bay.number || slot<1 || slot>slotCapacity || !kit[id])
    throw Error('Invalid signage slot: '+id);
  const preset=presets[presetId];
  const {limits} = preset;
  const span = bayWidth(bay);
  const band=fasciaBand(bay);
  const size = {width:Math.min(limits.width[1], span-.65), height:band.top-band.bottom-band.clearance, depth:.04, ...settings.size};
  for (const [key,[min,max]] of Object.entries(limits)) {
    if (!Number.isFinite(size[key]) || size[key]<min || size[key]>max) throw Error(id+' invalid '+key);
  }
  if (size.width > span-.4 || size.height>band.top-band.bottom || !Number.isFinite(span)) throw Error(id+' sign exceeds its bay');
  const accent=kit[id].palette[0].hex;
  const fascia=tint(preset.palette.fascia,accent);
  const config = {preset:'t1-classic', lockup:'logo-left', brand:kit[id].brand, logo:id, poster:id,
    fasciaInkHeight:.80, captionLogoWidth:.28, blade:true, pulse:true, relief:false, carrier:false, caption:false, lodDistance:16, ...preset, ...settings, id, size,
    palette:{...preset.palette, fascia,accent, ...settings.palette}};
  const glaze = config.faceGlaze;
  if (glaze && (!/^#[0-9a-f]{6}$/i.test(glaze.colour) ||
      !Number.isFinite(glaze.opacity) || glaze.opacity < 0 || glaze.opacity > .25))
    throw Error(id+' invalid face glaze');
  if (!(config.captionLogoWidth>=.12 && config.captionLogoWidth<=.30)) throw Error(id+' invalid caption logo width');
  if (!(config.fasciaInkHeight>=.5 && config.fasciaInkHeight<=.92)) throw Error(id+' invalid ink height');
  if (config.captionText!==undefined && (typeof config.captionText!=='string' || !config.captionText.trim())) throw Error(id+' invalid caption');
  if (typeof config.brand !== 'string' || !config.brand.trim()) throw Error(id+' missing brand');
  for (const [key,allowed] of Object.entries(options)) {
    if (!allowed.includes(config[key])) throw Error(id+' invalid '+key);
  }
  for (const key of ['blade','pulse','relief','caption','carrier']) if (typeof config[key] !== 'boolean') throw Error(id+' invalid '+key);
  if (!(Number.isFinite(config.lodDistance) && config.lodDistance>0)) throw Error(id+' invalid LOD distance');
  if (!Object.values(config.palette).every(v=>/^#[0-9a-f]{6}$/i.test(v)) ||
      contrast(config.palette.letter,config.palette.fascia)<4.5) throw Error(id+' invalid palette or letter contrast');
  if (config.logo !== null && config.logo !== id) throw Error(id+' invalid logo ID');
  if (config.poster !== null && config.poster !== id) throw Error(id+' invalid poster ID');
  if (config.logoModule && (!config.relief || !/^sign_logo3d_[a-z0-9_]+$/.test(config.logoModule))) throw Error(id+' invalid relief module');
  if (config.letterInk && !['all','red','dark','pale'].includes(config.letterInk)) throw Error(id+' invalid letter ink');
  for (const r of [config.logoRegion,config.inkRegion]) {
    if (!r) continue;
    if (!Array.isArray(r) || r.length!==4 || !r.every(Number.isFinite) ||
        r[0]<0 || r[1]<0 || r[2]<=0 || r[3]<=0 || r[0]+r[2]>1 || r[1]+r[3]>1) throw Error(id+' invalid logo region');
  }
  const receipt = receipts[config.logo];
  config.logoFile = receipt?.status === 'found' && receipt.file?.startsWith(id+'-') && /^S\d{2}-[a-z0-9-]+\.webp$/.test(receipt.file) ? receipt.file : null;
  if (!config.logoFile) config.lockup = 'wordmark-only';
  return config;
}

export function selectSignLod(tier, distance, inFrustum, cutoff) {
  if (!inFrustum) return 'culled';
  return distance <= cutoff && ['balanced','detailed'].includes(tier) ? tier : 'baked';
}
