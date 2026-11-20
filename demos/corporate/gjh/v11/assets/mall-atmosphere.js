import {createInstanceVisibility} from './packed-draw.js';
import {placeDecal} from './surface-decals.js';
import {interiorStores, worldInteriorBox} from './interiors/config.js';
import {kelvinColour} from './interiors/surfaces.js';

// Unknown adapters use the same conservative policy as integrated GPUs.
export function allowMallLightWash(deviceClass, context) {
  if (deviceClass === 'phone') return false;
  const debug = context.getExtension('WEBGL_debug_renderer_info');
  const adapter = debug && context.getParameter(debug.UNMASKED_RENDERER_WEBGL);
  return /GeForce|Quadro|NVIDIA RTX|Radeon RX (?!Vega |[0-9]+M Graphics)/i.test(adapter ?? '');
}

const SURFACES = {
  low:{roughness:1, emission:1, washOpacity:.86},
  balanced:{roughness:.91, emission:1.04, washOpacity:.90},
  detailed:{roughness:.85, emission:1.10, washOpacity:.94}
};

// Fixture tints are in display sRGB. Kelvin and focus coordinates still come
// from the shop programme. These tints describe the light, not the brand paint.
const SHOP_LAMPS = {
  S01:0xffd193, S02:0xf5dfa5, S03:0xe9eab8,
  S13:0xe3f1ff, S14:0xf8e3c2, S15:0xffc47d
};

export function shopLampTint(T, id) {
  const mood = interiorStores[id]?.ambient;
  return SHOP_LAMPS[id] ?? (mood ? kelvinColour(T,mood.kelvin).getHex() : 0xffffff);
}

export function createMallSurfaceAtmosphere(T, scene, {
  plane, poolMaterial, washes, floors, fixtures, vault, pools = [], shopNear
}) {
  // One main-pass batch shares the existing gradient texture. The opaque
  // surfaces keep their original shader programs and use the mall's PMREM.
  const washMaterial = poolMaterial.clone();
  const poolCount = pools.reduce((total, pool) => total + pool.transforms.length, 0);
  const washMesh = placeDecal(new T.InstancedMesh(plane,washMaterial,washes.length + poolCount),-1);
  const transform = new T.Object3D();
  const stripSlots = [], colours = [];
  washes.forEach(([x, y, z, width, depth, yaw, pitch, compact = false, tint = 0xffffff, gain = 1], index) => {
    stripSlots.push(compact);
    colours.push(new T.Color(tint).multiplyScalar(gain));
    transform.position.set(x,y,z);
    transform.rotation.set(pitch,yaw,0,'YXZ');
    transform.scale.set(width,depth,1);
    transform.updateMatrix();
    washMesh.setMatrixAt(index,transform.matrix);
  });
  const poolSlots = new Map();
  for (const {transforms, slots, deckLod} of pools) {
    transforms.forEach((matrix,index) => {
      const shop = slots?.[index] ?? null;
      const key = `pool:${deckLod}:${shop}`;
      poolSlots.set(key,{shop, deckLod});
      washMesh.setMatrixAt(stripSlots.length,matrix);
      stripSlots.push(key);
      colours.push(new T.Color(0xffffff));
    });
  }
  washMesh.name = 'Mall cove and storefront light wash';
  washMesh.computeBoundingSphere();
  scene.add(washMesh);
  // Allocate the colour attribute before the visibility packer and warm-up.
  if (colours.length) washMesh.setColorAt(0,colours[0]);
  const washVisibility = createInstanceVisibility(T, washMesh, {slots:stripSlots,
    colours:colours.length ? colours : undefined});

  const floorRoughness = floors.map(floor => floor.roughness);
  const vaultEmission = vault.emissiveIntensity;
  let fixtureEmission = fixtures.emissiveIntensity;
  let preset, broadWash;
  function setTier(tier, lightWash = true) {
    const next = Object.hasOwn(SURFACES,tier) ? SURFACES[tier] : SURFACES.low;
    const nextBroadWash = next !== SURFACES.low && lightWash;
    if (next === preset && nextBroadWash === broadWash) return false;
    preset = next;
    broadWash = nextBroadWash;
    floors.forEach((floor,index) => { floor.roughness = floorRoughness[index] * preset.roughness; });
    vault.emissiveIntensity = vaultEmission * preset.emission;
    fixtures.emissiveIntensity = fixtureEmission * preset.emission;
    washMaterial.opacity = preset.washOpacity;
    updateWash();
    return true;
  }
  function setFixtureEmission(intensity) {
    fixtureEmission = intensity;
    fixtures.emissiveIntensity = fixtureEmission * preset.emission;
  }
  function updateWash(view) {
    washVisibility.update(view?.frustum, key => {
      if (typeof key === 'boolean') return key || broadWash;
      if (typeof key === 'number') return shopNear?.get(key);
      const {shop,deckLod} = poolSlots.get(key);
      return preset === SURFACES.low && (!deckLod || view?.deckVisible) &&
        (shop === null || shopNear?.get(shop));
    }, false, (key,bounds) => {
      const shop = typeof key === 'number' ? key : poolSlots.get(key)?.shop;
      return shop != null && view?.shopVisibility?.occluded(shop,bounds);
    });
    washMesh.visible = washMesh.count > 0;
  }
  setTier('low');
  return {setTier, setFixtureEmission, updateView: updateWash};
}

const STUDIO_LIGHTING = {
  atrium: {walls:0x766754, panels:0xf7ca96, ceiling:0xe8dcc8, width:7, intensity:.52, ceilingGain:1.35},
  corridor: {walls:0x6e6251, panels:0xf5debf, ceiling:0xd7c4a8, width:5, intensity:.58},
  shop: {walls:0x9e8a72, panels:0xffe5c6, ceiling:0xffe8cc, width:3, intensity:.94}
};

const CLASSIC_STUDIO_LIGHTING = {
  atrium: {walls:0xb6a38c, panels:0xffeed9, ceiling:0xfff5e7, width:8, intensity:1},
  corridor: {walls:0xa99a82, panels:0xffe1bc, ceiling:0xffebd2, width:5, intensity:.9},
  shop: {walls:0x9e876d, panels:0xffd6a8, ceiling:0xffe6c8, width:3, intensity:.8}
};

export function mallEnvironmentZone(position, bays, atrium) {
  const {x,y,z} = position;
  if (Math.abs(y) < 4 && bays.some(bay => insideBay(x,z,bay))) return 'shop';
  return publicEnvironmentZone(position,atrium);
}

function insideBay(x,z,{minX,maxX,minZ,maxZ}) {
  return x > minX && x < maxX && z > minZ && z < maxZ;
}

function publicEnvironmentZone({x,y,z},atrium) {
  if (y >= 6 || (Math.abs(x-atrium.x) < 13 && Math.abs(z-atrium.z) < 14)) return 'atrium';
  return 'corridor';
}

// Local lighting resources. All three PMREMs share the same shader layout.
export function createMallAtmosphere(T, renderer, scene, slots, {
  atrium = {x:0,z:8}, contact, plane, frameTrace, expanded = true
} = {}) {
  const studioLighting = expanded ? STUDIO_LIGHTING : CLASSIC_STUDIO_LIGHTING;
  const classicAccents = [0xb84739,0xd4a159,0x79a992,0x785a68,0x913f35,0x667887,0x9c4937,0x477aac,0x294f7c];
  const interiorWarm = new T.Color(expanded ? 0xffd6b0 : 0xffd5a0);
  const bays = slots.map((slot, index) => {
    const store = interiorStores['S'+slot.number], mood = store?.ambient;
    const x = (slot.minX + slot.maxX) / 2, z = (slot.minZ + slot.maxZ) / 2;
    const [dx,dz] = slot.side === 'west' ? [-1,0] : slot.side === 'east' ? [1,0] : [0,-1];
    const anchor = mood ? worldInteriorBox(store,{center:mood.focus,yaw:0}).center : null;
    const keyPosition = anchor ?? [x-dx*2.1,3.9,z-dz*2.1];
    const accentPosition = anchor
      ? [anchor[0]-dx*2,anchor[1]+.35,anchor[2]-dz*2]
      : [x+dx*1.8,4.3,z+dz*1.8];
    const accent = new T.Color(mood?.accent ?? classicAccents[index]);
    const accentLuminance = .2126*accent.r + .7152*accent.g + .0722*accent.b;
    const environmentIntensity = mood
      ? (expanded ? .91 : .74) + .20*(mood.kelvin-2700)/1300 + .10*accentLuminance
      : studioLighting.shop.intensity;
    const lamp = expanded && SHOP_LAMPS[store?.id] ? new T.Color(shopLampTint(T,store.id)) : null;
    const newMoon = expanded && store?.id === 'S01';
    const gogo = expanded && store?.id === 'S03', lg = expanded && store?.id === 'S14';
    return {slot,x,z,mood,keyPosition,accentPosition,accent,lamp,
      environmentIntensity:environmentIntensity * (gogo ? .92 : lg ? .94 : 1),
      keyGain:gogo ? .91 : lg ? .81 : newMoon ? .92 : 1, doorFill:gogo ? .90 : lg ? 1.38 : 1,
      temperature:mood ? kelvinColour(T,mood.kelvin) : interiorWarm, colors:[new T.Color(),new T.Color()]};
  });
  const lgSlot = expanded && bays.find(bay => bay.slot.number === '14')?.slot;
  const lights = Array.from({length:2}, (_, index) => {
    const light = new T.PointLight(0xffe5c1, 0, 11, 2);
    light.name = `Shop focus accent ${index + 1}`;
    scene.add(light);
    return light;
  });
  scene.traverse(node => { if (node.isLight) node.layers.enable(2); });
  const visitorShadows = contact && plane ? createVisitorShadows(T, scene, plane, contact) : null;
  const hemisphere = expanded && scene.children.find(node => node.isHemisphereLight);
  const avatarMaterials = new Set();
  const portraitMeshes = new WeakSet();
  const avatarFill = new T.Color(0xffe9d5);
  let portraitFill, visitorFill = .18;
  function applyPortraitFill(material) {
    material.emissive.copy(avatarFill);
    material.emissiveIntensity = portraitFill ?? .024;
  }
  function bindPlayerLighting(visual) {
    if (!expanded) return;
    visual?.traverse(node => {
      if (!node.isSkinnedMesh || portraitMeshes.has(node) ||
          node.material?.customProgramCacheKey?.() !== 'gjh-tripo-portrait-v1') return;
      portraitMeshes.add(node);
      avatarMaterials.add(node.material);
      applyPortraitFill(node.material);
      const beforeRender = node.onBeforeRender;
      // The same skin swaps material with its lower-resolution LOD.
      node.onBeforeRender = function(renderer,scene,camera,geometry,material,group) {
        beforeRender.call(this,renderer,scene,camera,geometry,material,group);
        if (avatarMaterials.has(material)) return;
        avatarMaterials.add(material);
        applyPortraitFill(material);
      };
    });
  }
  function setPortraitFill(inside, publicZone) {
    const amount = inside ? .032 : publicZone === 'atrium' ? .024 : .038;
    if (amount === portraitFill) return;
    portraitFill = amount;
    visitorFill = inside ? .22 : publicZone === 'atrium' ? .18 : .27;
    avatarMaterials.forEach(applyPortraitFill);
  }
  let focus = null, strength = 0, previousTime, baseAmbient = hemisphere?.intensity;
  const applyFocusColors = () => lights.forEach((light,index) => light.color.copy(focus.colors[index]));
  function applyTheme(theme) {
    baseAmbient = theme?.lighting?.ambient ?? baseAmbient;
    const key = new T.Color(theme?.lighting?.key ?? 0xffe5c1);
    for (const bay of bays) {
      const [main,accent] = bay.colors;
      main.copy(key).lerp(bay.lamp ?? bay.temperature,bay.lamp ? .86 : bay.mood ? .68 : .25);
      if (!bay.lamp) main.lerp(bay.accent,.08);
      accent.copy(main).lerp(bay.accent,bay.lamp ? .10 : bay.mood ? .30 : 0);
    }
    if (focus) applyFocusColors();
    if (renderer && Number.isFinite(theme?.lighting?.exposure)) renderer.toneMappingExposure = theme.lighting.exposure;
  }
  applyTheme(null);
  // Zero intensity preserves the ground-floor variant. The landing has its
  // own warmed variant, with no point-light evaluation.
  function setLightFloor(position) {
    const ground = Math.abs(position.y) < 6;
    for (const light of lights) light.visible = ground;
    return ground;
  }
  function update(position, now = performance.now(), tier) {
    const {x,y,z} = position;
    const inside = Math.abs(y) < 4 ? bays.find(bay => insideBay(x,z,bay.slot)) : null;
    const publicZone = publicEnvironmentZone(position,atrium);
    if (expanded) setPortraitFill(inside,publicZone);
    let shadowFill = tier === 'low' && publicZone === 'atrium' ? .16 : 0;
    if (lgSlot && Math.abs(y) < 4) {
      // Include the arcade in front of LG, where its navigation shortcut arrives.
      const dx = Math.max(lgSlot.minX-x,x-lgSlot.maxX,0);
      const dz = Math.max(lgSlot.minZ-z,z-lgSlot.maxZ,0);
      shadowFill += .18 * Math.max(0,1-Math.hypot(dx,dz)/7);
    }
    if (inside?.mood) {
      const {minX,maxX,minZ,maxZ} = inside.slot;
      const edge = Math.min(x-minX,maxX-x,z-minZ,maxZ-z);
      const weight = Math.min(1,edge/1.6);
      const outside = studioLighting[publicZone].intensity;
      selectEnvironment('shop',outside + weight*(inside.environmentIntensity-outside));
    } else selectEnvironment(inside ? 'shop' : publicZone);
    if (hemisphere) hemisphere.intensity = baseAmbient + shadowFill;
    const ground = setLightFloor(position);
    let nearest = inside?.mood ? inside : null, best = 24 ** 2;
    if (ground && !nearest) for (const bay of bays) {
      const distance = (bay.x-position.x)**2 + (bay.z-position.z)**2;
      // Keep the current focus across small movements at a bay boundary.
      const score = distance - (bay === focus ? 4 : 0);
      if (distance < 24 ** 2 && score < best) { nearest = bay; best = score; }
    }
    const step = previousTime === undefined ? 1 : Math.min(1, Math.max(0, now-previousTime)/120);
    previousTime = now;
    let fadeIn = step;
    if (nearest !== focus) {
      const fadeOut = ground ? Math.min(strength,step) : strength;
      strength -= fadeOut;
      fadeIn -= fadeOut;
      if (!strength) {
        focus = nearest;
        if (focus) {
          lights[0].position.set(...focus.keyPosition);
          lights[1].position.set(...focus.accentPosition);
          applyFocusColors();
        }
      }
    }
    if (focus && nearest === focus) strength = Math.min(1,strength+fadeIn);
    lights[0].intensity = (focus?.mood && expanded ? 32 : 26) * strength * (focus?.keyGain ?? 1);
    lights[1].intensity = (focus?.mood && expanded ? 20 : 18) * strength * (focus?.doorFill ?? 1);
  }

  const accentSet = new Set(lights);
  function lightVariants(sceneLights) {
    const fixed=sceneLights.filter(light=>{
      if(accentSet.has(light))return false;
      for(let node=light;node;node=node.parent)if(!node.visible)return false;
      return true;
    });
    return [fixed,[...fixed,...lights]];
  }

  let environments = {}, currentZone = 'atrium', currentIntensity = studioLighting.atrium.intensity;
  function selectEnvironment(zone, intensity = studioLighting[zone].intensity) {
    currentZone = zone;
    currentIntensity = intensity;
    const environment = environments[zone];
    if (!environment) return;
    if (scene.environment !== environment.texture) {
      const before = frameTrace?.start();
      scene.environment = environment.texture;
      frameTrace?.end('environment.switch',before,zone,true);
    }
    scene.environmentIntensity = intensity;
  }
  function releaseEnvironment() {
    scene.environment = null;
    Object.values(environments).forEach(target => target.dispose());
    environments = {};
  }
  function* prepareEnvironments() {
    const generator = new T.PMREMGenerator(renderer), studio = new T.Scene();
    const geometry = new T.BoxGeometry(1,1,1);
    const materials = [new T.MeshBasicMaterial({side:T.BackSide}), new T.MeshBasicMaterial(), new T.MeshBasicMaterial()];
    const room = new T.Mesh(geometry,materials[0]); room.scale.set(10,6,10); studio.add(room);
    for (const [x,z,w] of [[-2,-4,3],[2,4,2]]) {
      const panel = new T.Mesh(geometry,materials[1]); panel.position.set(x,2,z); panel.scale.set(w,.2,2); studio.add(panel);
    }
    // Warm vertical returns and softer overhead light share the existing atrium PMREM.
    // On the polished stone their narrow highlights stretch at grazing angles.
    let pierHighlights;
    if (expanded) {
      const strip = geometry.toNonIndexed().scale(.11,3.4,.18);
      const positions = [];
      for (const x of [-3.85,3.85]) for (const z of [-3,0,3]) {
        const vertices = strip.attributes.position;
        for (let i=0;i<vertices.count;i++) {
          positions.push(x+vertices.getX(i),1.1+vertices.getY(i),z+vertices.getZ(i));
        }
      }
      strip.dispose();
      const strips = new T.BufferGeometry();
      strips.setAttribute('position',new T.Float32BufferAttribute(positions,3));
      pierHighlights = new T.Mesh(strips,materials[1]);
      studio.add(pierHighlights);
    }
    const ceiling = new T.Mesh(geometry,materials[2]); ceiling.position.y=2.9; studio.add(ceiling);
    const next = {};
    try {
      for (const [zone, {walls,panels,ceiling:colour,width,ceilingGain = 1.5}] of Object.entries(studioLighting)) {
        if (pierHighlights) pierHighlights.visible = zone === 'atrium';
        materials[0].color.set(walls);
        materials[1].color.set(panels).multiplyScalar(1.3);
        materials[2].color.set(colour).multiplyScalar(ceilingGain);
        ceiling.scale.set(width,.1,width);
        const before = frameTrace?.start();
        next[zone] = generator.fromScene(studio,.04);
        frameTrace?.end('environment.pmrem',before,zone,true);
        yield false;
      }
      releaseEnvironment();
      environments = next;
      selectEnvironment(currentZone,currentIntensity);
    } finally {
      if (environments !== next) Object.values(next).forEach(target => target.dispose());
      generator.dispose();
      geometry.dispose();
      pierHighlights?.geometry.dispose();
      materials.forEach(material=>material.dispose());
    }
  }
  function restoreEnvironment() {
    // Recovery validates the first frame before reopening the mall.
    for (const _ of prepareEnvironments()) { /* Drain under the recovery overlay. */ }
  }

  // A quarter-resolution, selective glow pass: only explicitly tagged light
  // strips and signs are rendered. The composite fills the drawing buffer.
  let base, glow, blurredGlow, blur, composite, blurScene, postScene, postCamera;
  const savedClearColor=new T.Color();
  let postReady = false;
  function initPost() {
    if (base) return;
    base=new T.WebGLRenderTarget(1,1,{samples:Math.min(2,renderer.capabilities?.maxSamples ?? 0)});
    glow=new T.WebGLRenderTarget(1,1);
    blurredGlow=new T.WebGLRenderTarget(1,1,{depthBuffer:false});
    const vertexShader='varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}';
    blur=new T.ShaderMaterial({uniforms:{glow:{value:glow.texture},texel:{value:new T.Vector2(1,1)}},
      vertexShader,
      fragmentShader:`uniform sampler2D glow; uniform vec2 texel; varying vec2 vUv;
        void main(){ vec3 b=vec3(0.0);
          for(int x=-2;x<=2;x++) for(int y=-2;y<=2;y++) {
            vec3 s=texture2D(glow,vUv+vec2(float(x),float(y))*texel).rgb;
            b+=max(s-vec3(0.38),vec3(0.0));
          }
          gl_FragColor=vec4(b/25.0,1.0);
        }`,depthTest:false,depthWrite:false,toneMapped:false});
    composite=new T.ShaderMaterial({uniforms:{base:{value:base.texture},glow:{value:blurredGlow.texture}},
      vertexShader,
      fragmentShader:`uniform sampler2D base; uniform sampler2D glow; varying vec2 vUv;
        void main(){ vec3 c=texture2D(base,vUv).rgb;
          gl_FragColor=vec4(c+texture2D(glow,vUv).rgb*.16,1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,depthTest:false,depthWrite:false});
    postCamera=new T.Camera();
    const plane=new T.PlaneGeometry(2,2);
    blurScene=new T.Scene(); blurScene.name='Mall glow filter';
    postScene=new T.Scene(); postScene.name='Mall glow composite';
    for (const [target,material] of [[blurScene,blur],[postScene,composite]]) {
      const quad=new T.Mesh(plane,material);
      quad.frustumCulled=false;
      target.add(quad);
    }
  }
  function sizePost(width,height) {
    initPost();
    // Match the current scaled drawing buffer, including after a live resize.
    if (base.width === width && base.height === height) return;
    base.setSize(width,height);
    glow.setSize(Math.max(1,Math.floor(width/4)),Math.max(1,Math.floor(height/4)));
    blurredGlow.setSize(glow.width,glow.height);
    blur.uniforms.texel.value.set(1/glow.width,1/glow.height);
  }
  function postPrepared(width,height) {
    return postReady && base.width === width && base.height === height;
  }
  function invalidatePost() { postReady = false; }
  function* preparePost(width,height,screenPixel) {
    if (postPrepared(width,height)) return;
    invalidatePost();
    sizePost(width,height);
    for(const target of [base,glow,blurredGlow]) {
      renderer.initRenderTarget(target);
      yield false;
    }
    const previous=renderer.getRenderTarget();
    const box=renderer.getScissor(new T.Vector4()), test=renderer.getScissorTest();
    for (const [post,material,target] of [[blurScene,blur,blurredGlow],[postScene,composite,previous]]) {
      renderer.setRenderTarget(target);
      try { renderer.compile(post,postCamera); }
      finally { renderer.setRenderTarget(previous); }
      const program=renderer.properties.get(material).currentProgram;
      if(renderer.extensions.has('KHR_parallel_shader_compile'))while(!program.isReady())yield false;
      try {
        renderer.setRenderTarget(target);
        const size=screenPixel();
        // A render target owns its own scissor rectangle.
        if (target) {
          const scissor=target.scissor.clone(), scissorTest=target.scissorTest;
          target.scissor.set(0,0,size,size);target.scissorTest=true;
          try { renderer.setRenderTarget(target);renderer.render(post,postCamera); }
          finally { target.scissor.copy(scissor);target.scissorTest=scissorTest; }
        } else {
          renderer.setScissor(0,0,size,size);renderer.setScissorTest(true);
          renderer.render(post,postCamera);
        }
      } finally {
        renderer.setScissor(box);renderer.setScissorTest(test);
        renderer.setRenderTarget(previous);
      }
      yield false;
    }
    postReady = true;
  }
  const state={bloom:false,nonNpcCalls:0,npcCalls:0,admitted:0,totalCalls:0,submissions:0};
  function renderVisitors(camera,npcs,reservedCalls,budget) {
    state.nonNpcCalls=renderer.info.render.calls+reservedCalls;
    const shadowCall = visitorShadows && npcs?.forEachVisible ? 1 : 0;
    state.admitted=npcs?.admit(state.nonNpcCalls+shadowCall,
      renderer.info.render.triangles+2*(reservedCalls+(shadowCall ? visitorShadows.capacity : 0)),budget)||0;
    if (!state.admitted) return;
    const mask=camera.layers.mask, background=scene.background;
    const autoClear=renderer.autoClear, shadowAutoUpdate=renderer.shadowMap.autoUpdate;
    const ambientIntensity = hemisphere?.intensity;
    const before=renderer.info.render.calls;
    try {
      // Keep the world's color, depth and shadow maps. Only visitors and the
      // same world lights participate; no mall geometry is resubmitted.
      camera.layers.set(2); scene.background=null;
      renderer.autoClear=false; renderer.shadowMap.autoUpdate=false;
      if (hemisphere) hemisphere.intensity += visitorFill;
      if (shadowCall) visitorShadows.update(npcs.forEachVisible);
      renderer.render(scene,camera); state.submissions++;
    } finally {
      if (hemisphere) hemisphere.intensity = ambientIntensity;
      visitorShadows?.hide();
      camera.layers.mask=mask; scene.background=background;
      renderer.autoClear=autoClear; renderer.shadowMap.autoUpdate=shadowAutoUpdate;
    }
    state.npcCalls=renderer.info.render.calls-before;
  }
  function render(camera, enabled, npcs, budget) {
    enabled = Boolean(enabled && postReady);
    state.bloom=enabled;
    state.npcCalls=0; state.submissions=0;
    const autoReset=renderer.info.autoReset, shadowAutoUpdate=renderer.shadowMap.autoUpdate;
    const target=renderer.getRenderTarget(), mask=camera.layers.mask, background=scene.background;
    const clearColor=renderer.getClearColor(savedClearColor), clearAlpha=renderer.getClearAlpha();
    try {
      renderer.info.autoReset=false; renderer.info.reset();
      npcs?.setVisible(false);
      if (!enabled) {
        renderer.render(scene,camera); state.submissions++;
        renderVisitors(camera,npcs,0,budget);
      } else {
        renderer.shadowMap.autoUpdate=false;
        camera.layers.set(1); scene.background=null; renderer.setClearColor(0x000000,0);
        renderer.setRenderTarget(glow); renderer.render(scene,camera); state.submissions++;
        renderer.setRenderTarget(blurredGlow);renderer.render(blurScene,postCamera);state.submissions++;
        // Measure glow first. Keep base bound for both world and visitor draws
        // so multisampled render-to-texture can retain its color and depth.
        camera.layers.mask=mask; scene.background=background;
        renderer.setClearColor(clearColor,clearAlpha);
        renderer.shadowMap.autoUpdate=shadowAutoUpdate;
        renderer.setRenderTarget(base); renderer.render(scene,camera); state.submissions++;
        renderVisitors(camera,npcs,1,budget);
        renderer.shadowMap.autoUpdate=false;
        renderer.setRenderTarget(target); renderer.render(postScene,postCamera); state.submissions++;
      }
      state.totalCalls=renderer.info.render.calls;
    } finally {
      camera.layers.mask=mask; scene.background=background; renderer.setClearColor(clearColor,clearAlpha);
      renderer.setRenderTarget(target); renderer.info.autoReset=autoReset; renderer.shadowMap.autoUpdate=shadowAutoUpdate;
    }
  }
  return {update,bindPlayerLighting,setLightFloor,lightVariants,interiorWarmLights:lights,preparePost,postPrepared,invalidatePost,applyTheme,releaseEnvironment,prepareEnvironments,restoreEnvironment,render,get state(){return state;}};
}

export function createVisitorShadows(T, scene, plane, contact) {
  const capacity = 6; // Maximum Detailed desktop crowd admission.
  const mesh = new T.InstancedMesh(plane,contact,capacity);
  mesh.name = 'Visitor contact shadows';
  mesh.layers.set(2);
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  mesh.visible = false;
  scene.add(mesh);
  const transform = new T.Object3D();
  return {
    capacity,
    hide() { mesh.visible = false; },
    update(forEachVisible) {
      let count = 0;
      forEachVisible((position,yaw,floor) => {
        if (count >= capacity) return;
        transform.position.set(position.x,floor+.026,position.z);
        transform.rotation.set(-Math.PI/2,yaw,0,'YXZ');
        transform.scale.set(1.2,.88,1);
        transform.updateMatrix();
        mesh.setMatrixAt(count++,transform.matrix);
      });
      mesh.count = count;
      mesh.visible = count > 0;
      if (count) mesh.instanceMatrix.needsUpdate = true;
    }
  };
}
