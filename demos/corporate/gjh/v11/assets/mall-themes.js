// Theme identifiers and visual roles are local trusted data, never URLs or code
// supplied through storage. Each seasonal pack is registered only after review.
export const THEME_STORAGE_KEY = 'gjh-v11-mall-theme-v1';
export const EVERYDAY = Object.freeze({
  id:'everyday', label:'Everyday',
  materials:Object.freeze({floorTextured:0xe8dbc6,floorFlat:0xdac8ae,ceiling:0xf0e8d9,ceilingGlow:0xb3a286,ceilingGlowIntensity:.55,
    wall:0xc9c4b6,green:0x153c30,ivory:0xe3d6b7,brass:0xb59b62,wood:0x6b4931,oak:0xa28055,timber:0xa48b67,timberAlt:0xa08763,
    glass:0xd7e9df,glassOpacity:.19,glassRoughness:.08,glassMetalness:.08,glow:0xffe7b4,glowEmission:0xffd08a,glowIntensity:1.2,
    liftStone:0xdfd5c4,liftGreen:0x183a30,liftGate:0xb59b62,liftGlassOpacity:.24}),
  lighting:Object.freeze({sky:0xe5eef0,ground:0x665e50,ambient:.72,key:0xffe0bc,keyIntensity:2.6,fill:0xcbdde5,fillIntensity:.4}),
  decorationRefs:Object.freeze([])
});
export const LUNAR_NEW_YEAR = Object.freeze({
  id:'lunar-new-year',label:'Lunar New Year',
  materials:Object.freeze({...EVERYDAY.materials,ceiling:0xf3dfc1,ceilingGlow:0xc3946b,wall:0xe0c8aa,
    green:0x7c1d22,ivory:0xf4dfbb,brass:0xd4aa53,wood:0x67402a,oak:0xa16f43,
    glass:0xe9e3d4,glow:0xffe4ae,glowEmission:0xffbf76,liftGreen:0x792027,liftGate:0x6a2022}),
  lighting:Object.freeze({...EVERYDAY.lighting,sky:0xffead7,ground:0x876142,key:0xffd09a,fill:0xffe0be}),
  decorationRefs:Object.freeze(['lunar-new-year'])
});
export const CHRISTMAS = Object.freeze({
  id:'christmas',label:'Christmas',
  materials:Object.freeze({...EVERYDAY.materials,ceiling:0xeee5d7,ceilingGlow:0xc7a77a,wall:0xe0d8c6,
    green:0x174638,ivory:0xeee6d0,brass:0xd0ae65,wood:0x644733,oak:0xa17d51,
    glass:0xe0eee7,glow:0xffe9bc,glowEmission:0xffc97c,liftGreen:0x21483b,liftGate:0x34584a}),
  lighting:Object.freeze({...EVERYDAY.lighting,sky:0xfff0d9,ground:0x796445,key:0xffd39a,fill:0xffe7ca}),
  decorationRefs:Object.freeze(['christmas'])
});
export const DEEPAVALI = Object.freeze({
  id:'deepavali',label:'Deepavali',
  materials:Object.freeze({...EVERYDAY.materials,ceiling:0xf1e0d5,ceilingGlow:0xc99b82,wall:0xe5d5c4,
    green:0x5e285c,ivory:0xf5e6c8,brass:0xd9ad59,wood:0x704c38,oak:0xa67d52,
    glass:0xece3e2,glow:0xffe4a8,glowEmission:0xffbd70,liftGreen:0x5e2c60,liftGate:0x513254}),
  lighting:Object.freeze({...EVERYDAY.lighting,sky:0xffeadc,ground:0x80604d,key:0xffce95,fill:0xffe1c5}),
  decorationRefs:Object.freeze(['deepavali'])
});
export const MALL_THEMES = Object.freeze([EVERYDAY,LUNAR_NEW_YEAR,CHRISTMAS,DEEPAVALI]);

/** Stage a trusted theme before a synchronous commit. Prepared resources belong
 * to the stage and are disposed on supersession, cancellation or replacement. */
export function createMallThemeCoordinator({registry=MALL_THEMES, storage, prepare=async theme=>({value:theme,dispose(){}}), commit=()=>{}, notify=()=>{}}={}) {
  const records=new Map();
  for(const theme of registry){
    if(!theme || typeof theme.id!=='string' || !theme.id || typeof theme.label!=='string' || !theme.label || records.has(theme.id)) throw new TypeError('Invalid theme registry');
    records.set(theme.id,theme);
  }
  if(!records.has('everyday')) throw new TypeError('Everyday theme is required');
  let active='everyday', remembered=null, pending=null, message='', saved=true, generation=0, suspended=false, currentStage=null, destroyed=false, controller=null;
  try {
    if(!storage) throw Error('Storage unavailable');
    const value=storage.getItem(THEME_STORAGE_KEY);
    if(value && records.has(value)) remembered=value;
    else if(value) message='Saved theme is unavailable. Everyday is active.';
  } catch { saved=false; message='Everyday is active for this session. Theme settings could not be saved.'; }
  const state=()=>Object.freeze({active,label:records.get(active).label,pending,message,saved,suspended});
  const publish=()=>notify(state());
  const persist=()=>{try{if(!storage)throw Error('Storage unavailable');storage.setItem(THEME_STORAGE_KEY,active);saved=true;return true;}catch{saved=false;return false;}};
  const release=stage=>{try{stage?.dispose?.();}catch{/* Cleanup cannot replace the active theme. */}};
  async function select(id){
    if(destroyed||suspended){message='Theme settings are unavailable while the scene recovers.';publish();return false;}
    if(!records.has(id)){generation++;controller?.abort();controller=null;pending=null;message='That theme is unavailable. The current theme is unchanged.';publish();return false;}
    const epoch=++generation;controller?.abort();controller=null;
    if(id===active && !pending){
      try { commit(records.get(active),records.get(active),currentStage); }
      catch { message='Theme could not be applied. The current theme is unchanged.';publish();return false; }
      message=persist()?`${records.get(active).label} is already active.`:`${records.get(active).label} is active for this session. Theme settings could not be saved.`;publish();return true;
    }
    controller=new AbortController();const signal=controller.signal;
    pending=id;message=`Preparing ${records.get(id).label}…`;publish();let stage;
    try {
      stage=await prepare(records.get(id),{signal});
      if(!stage || !Object.hasOwn(stage,'value') || typeof stage.dispose!=='function') throw new Error('Invalid theme stage');
      if(epoch!==generation||suspended||destroyed){release(stage);return false;}
      // commit must be synchronous and restore previous scene values if it fails.
      commit(stage.value,records.get(active),stage);
      const previous=currentStage;currentStage=stage;active=id;pending=null;controller=null;
      message=persist()?`${records.get(id).label} is active.`:`${records.get(id).label} is active for this session. Theme settings could not be saved.`;
      release(previous);publish();return true;
    } catch {
      release(stage);
      if(epoch!==generation||destroyed)return false;
      pending=null;controller=null;message='Theme could not be applied. The current theme is unchanged.';publish();return false;
    }
  }
  return Object.freeze({state, options:()=>[...records.values()].map(({id,label})=>({id,label})), definition:()=>records.get(active), select,
    async restore(){const id=remembered;remembered=null;return !id || id===active ? true : select(id);},
    cancel(){if(destroyed||!pending)return;generation++;controller?.abort();controller=null;pending=null;message=`${records.get(active).label} remains active.`;publish();},
    suspend(){if(destroyed)return;generation++;controller?.abort();controller=null;pending=null;suspended=true;message='Theme settings are unavailable while the scene recovers.';publish();},
    resume(){if(destroyed)return;suspended=false;message=saved?`${records.get(active).label} is active.`:`${records.get(active).label} is active for this session. Theme settings could not be saved.`;publish();},
    destroy(){if(destroyed)return;destroyed=true;generation++;controller?.abort();controller=null;pending=null;release(currentStage);currentStage=null;}});
}
