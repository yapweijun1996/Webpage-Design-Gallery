import {FESTIVAL_CALENDAR, resolveAutoTheme} from './festival-calendar.js';

// Theme identifiers and visual roles are local trusted data, never URLs or code
// supplied through storage. Each seasonal pack is registered only after review.
export const THEME_STORAGE_KEY = 'gjh-v11-mall-theme-v1';
const AUTOMATIC = {id:'automatic',label:'Automatic (follows the calendar)'};
export const EVERYDAY = Object.freeze({
  id:'everyday', label:'Everyday',
  materials:Object.freeze({floorTextured:0xe8dbc6,floorFlat:0xdac8ae,ceiling:0xf0e8d9,ceilingGlow:0xb3a286,ceilingGlowIntensity:.55,
    wall:0xc9c4b6,green:0x153c30,ivory:0xe3d6b7,brass:0xb59b62,wood:0x6b4931,oak:0xa28055,timber:0xa48b67,timberAlt:0xa08763,
    glass:0xd7e9df,glassOpacity:.19,glassRoughness:.08,glassMetalness:.08,glow:0xffe7b4,glowEmission:0xffd08a,glowIntensity:1.2,
    liftStone:0xdfd5c4,liftGreen:0x183a30,liftGate:0xb59b62,liftGlassOpacity:.24}),
  lighting:Object.freeze({sky:0xffedda,ground:0x8c7055,ambient:1.05,key:0xffd4a2,keyIntensity:2.25,fog:0xd9b996,exposure:1.03}),
  decorationRefs:Object.freeze([])
});
export const LUNAR_NEW_YEAR = Object.freeze({
  id:'lunar-new-year',label:'Lunar New Year',
  materials:Object.freeze({...EVERYDAY.materials,ceiling:0xf3dfc1,ceilingGlow:0xc3946b,wall:0xe0c8aa,
    green:0x7c1d22,ivory:0xf4dfbb,brass:0xd4aa53,wood:0x67402a,oak:0xa16f43,
    glass:0xe9e3d4,glow:0xffe4ae,glowEmission:0xffbf76,liftGreen:0x792027,liftGate:0x6a2022}),
  lighting:Object.freeze({...EVERYDAY.lighting,sky:0xffead7,ground:0x90694e,key:0xffd09a,keyIntensity:2.2,fog:0xe1b58f,exposure:1.01}),
  decorationRefs:Object.freeze(['lunar-new-year'])
});
export const CHRISTMAS = Object.freeze({
  id:'christmas',label:'Christmas',
  materials:Object.freeze({...EVERYDAY.materials,ceiling:0xeee5d7,ceilingGlow:0xc7a77a,wall:0xe0d8c6,
    green:0x174638,ivory:0xeee6d0,brass:0xd0ae65,wood:0x644733,oak:0xa17d51,
    glass:0xe0eee7,glow:0xffe9bc,glowEmission:0xffc97c,liftGreen:0x21483b,liftGate:0x34584a}),
  lighting:Object.freeze({...EVERYDAY.lighting,sky:0xfff0d9,ground:0x857057,key:0xffd9ac,keyIntensity:2.2,fog:0xd7bc9f,exposure:1.03}),
  decorationRefs:Object.freeze(['christmas'])
});
export const DEEPAVALI = Object.freeze({
  id:'deepavali',label:'Deepavali',
  materials:Object.freeze({...EVERYDAY.materials,ceiling:0xf1e0d5,ceilingGlow:0xc99b82,wall:0xe5d5c4,
    green:0x5e285c,ivory:0xf5e6c8,brass:0xd9ad59,wood:0x704c38,oak:0xa67d52,
    glass:0xece3e2,glow:0xffe4a8,glowEmission:0xffbd70,liftGreen:0x5e2c60,liftGate:0x513254}),
  lighting:Object.freeze({...EVERYDAY.lighting,sky:0xffeadc,ground:0x8e6b54,key:0xffce95,keyIntensity:2.15,fog:0xdcb492,exposure:1.04}),
  decorationRefs:Object.freeze(['deepavali'])
});
export const MALL_THEMES = Object.freeze([EVERYDAY,LUNAR_NEW_YEAR,CHRISTMAS,DEEPAVALI]);

/** Stage a trusted theme before a synchronous commit. Prepared resources belong
 * to the stage and are disposed on supersession, cancellation or replacement. */
export function createMallThemeCoordinator({registry=MALL_THEMES, storage, now=()=>new Date(), prepare=async theme=>({value:theme,dispose(){}}), commit=()=>{}, notify=()=>{}}={}) {
  const records=new Map();
  for(const theme of registry){
    if(!theme || typeof theme.id!=='string' || !theme.id || typeof theme.label!=='string' || !theme.label || records.has(theme.id)) throw new TypeError('Invalid theme registry');
    records.set(theme.id,theme);
  }
  if(!records.has('everyday')) throw new TypeError('Everyday theme is required');
  const calendar = FESTIVAL_CALENDAR.filter(festival=>records.has(festival.theme));
  let active='everyday', preference=AUTOMATIC.id, auto=null, pending=null, interactive=false, message='', saved=true, generation=0, suspended=false, currentStage=null, destroyed=false, controller=null;
  try {
    if(!storage) throw Error('Storage unavailable');
    const value=storage.getItem(THEME_STORAGE_KEY);
    if(records.has(value)) preference=value;
    else if(value && value!==AUTOMATIC.id) message='Saved theme is unavailable. Everyday is active.';
  } catch { saved=false; message='Everyday is active for this session. Theme settings could not be saved.'; }
  const state=()=>Object.freeze({active,label:records.get(active).label,preference,auto,pending,message,saved,suspended});
  const publish=()=>notify(state());
  function persist(){
    try {
      if(preference===AUTOMATIC.id) storage.removeItem(THEME_STORAGE_KEY);
      else storage.setItem(THEME_STORAGE_KEY,preference);
      saved=true;
    } catch { saved=false; }
  }
  const release=stage=>{try{stage?.dispose?.();}catch{/* Cleanup cannot replace the active theme. */}};
  function cancelPending(){
    generation++;controller?.abort();controller=null;pending=null;interactive=false;
  }
  function complete(choice,calendar,save,alreadyActive=false){
    preference=choice;auto=calendar;
    if(save) persist();
    const label=records.get(active).label;
    message=auto ? '' : saved ? `${label} is ${alreadyActive?'already ':''}active.` :
      `${label} is active for this session. Theme settings could not be saved.`;
    publish();
    return true;
  }
  function calendarChoice(){
    const result=resolveAutoTheme(now(),calendar);
    return {...result,festivalLabel:records.get(result.festival?.theme)?.label};
  }
  async function select(choice){
    if(destroyed||suspended){message='Theme settings are unavailable while the scene recovers.';publish();return false;}
    if(choice===AUTOMATIC.id){
      const calendar=calendarChoice();
      return apply(calendar.theme,choice,calendar,true);
    }
    if(!records.has(choice)){cancelPending();message='That theme is unavailable. The current theme is unchanged.';publish();return false;}
    return apply(choice,choice,null,true);
  }
  async function apply(id,choice,calendar,save=false){
    const wasPending=Boolean(pending);
    cancelPending();
    const epoch=generation;
    if(id===active && !wasPending){
      try { if(save && !calendar) commit(records.get(active),records.get(active),currentStage); }
      catch { message='Theme could not be applied. The current theme is unchanged.';publish();return false; }
      return complete(choice,calendar,save,true);
    }
    controller=new AbortController();const signal=controller.signal;
    pending=id;interactive=save;message=`Preparing ${records.get(id).label}…`;publish();let stage;
    try {
      stage=await prepare(records.get(id),{signal});
      if(!stage || !Object.hasOwn(stage,'value') || typeof stage.dispose!=='function') throw new Error('Invalid theme stage');
      if(epoch!==generation||suspended||destroyed){release(stage);return false;}
      // commit must be synchronous and restore previous scene values if it fails.
      commit(stage.value,records.get(active),stage);
      const previous=currentStage;currentStage=stage;active=id;pending=null;controller=null;interactive=false;
      release(previous);
      return complete(choice,calendar,save);
    } catch {
      release(stage);
      if(epoch!==generation||destroyed)return false;
      // Keep following the calendar if its current decoration pack is unavailable.
      if(save && calendar){preference=choice;auto=null;persist();}
      pending=null;controller=null;interactive=false;message='Theme could not be applied. The current theme is unchanged.';publish();return false;
    }
  }
  async function refresh(){
    if(destroyed || suspended || pending || preference!==AUTOMATIC.id) return false;
    const calendar=calendarChoice();
    return apply(calendar.theme,preference,calendar);
  }
  return Object.freeze({state, options:()=>[AUTOMATIC,...records.values()].map(({id,label})=>({id,label})), definition:()=>records.get(active), select, refresh,
    async restore(){
      if(destroyed || suspended || pending) return false;
      if(preference===AUTOMATIC.id) return refresh();
      return preference===active || apply(preference,preference,null);
    },
    cancel({interactiveOnly=false}={}){if(destroyed||!pending||(interactiveOnly&&!interactive))return;cancelPending();message=`${records.get(active).label} remains active.`;publish();},
    suspend(){if(destroyed)return;cancelPending();suspended=true;message='Theme settings are unavailable while the scene recovers.';publish();},
    resume(){if(destroyed)return;suspended=false;message=auto?'':saved?`${records.get(active).label} is active.`:`${records.get(active).label} is active for this session. Theme settings could not be saved.`;publish();},
    destroy(){if(destroyed)return;destroyed=true;cancelPending();release(currentStage);currentStage=null;}});
}
