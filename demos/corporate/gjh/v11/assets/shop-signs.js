import {fetchStartupAsset} from './startup-asset-pack.js';
import {eastShopPlacements} from './gallery-east-shops.js';
import {westShopPlacements} from './gallery-west-shops.js';
import {bayWidth,resolveConfig,stores} from './signage/config.js';
import {bakeAtlas} from './signage/atlas.js';
import {createSignageSystem} from './signage/runtime.js';

// Keep asset URLs relative to this direct child of assets/. This also holds
// after Bun folds the signage family into assets/world.bundle.js.
const assetBase=new URL('./',import.meta.url);
async function readJson(path){
  const response=await fetchStartupAsset(new URL(path,assetBase));
  if(!response.ok)throw Error('Unavailable shop artwork manifest: '+path);
  return response.json();
}
// Leave gallery merchandise sightlines open. The east/west fixture manifests
// use the same local X axis as the sign mount. Hang the lightbox above stock
// wherever the display and lightbox share a window.
function mountGraphics(bay){
  const n=Number(bay.number),x=-bayWidth(bay)/2+.98;
  const fixtures=eastShopPlacements[n]??westShopPlacements[n];
  if(!fixtures)return bay;
  const aboveDisplay=fixtures.some(({position})=>Math.abs(position[0]-x)<1.1);
  return {...bay,posterHeight:aboveDisplay?2.94:2.46};
}
export async function addShopSignAtlas(T,layout,scene){
  const [kit,receipts]=await Promise.all([readJson('brand-kit/brand-kit.json'),readJson('brands/logo-sources.json').catch(()=>({}))]);
  const bays=layout.slots.map(mountGraphics);
  const configs=bays.map(bay=>{
    const id='S'+bay.number;
    return resolveConfig(id,stores[id],bay,kit,receipts);
  });
  const bake=await bakeAtlas(configs,assetBase,fetchStartupAsset);
  return {...createSignageSystem(T,scene,configs,bays,bake,assetBase),
    configs:new Map(configs.map(config=>[config.id,config]))};
}
