import {createInstanceVisibility} from './packed-draw.js';

const SURFACES = {
  low:{roughness:1, emission:1, washOpacity:0},
  balanced:{roughness:.82, emission:1.2, washOpacity:.32},
  detailed:{roughness:.68, emission:1.38, washOpacity:.48}
};

export function createMallSurfaceAtmosphere(T, scene, {plane, poolMaterial, washes, floors, fixtures, vault}) {
  // One main-pass batch shares the existing gradient texture. The opaque
  // surfaces keep their original shader programs and use the mall's PMREM.
  const washMaterial = poolMaterial.clone();
  const washMesh = new T.InstancedMesh(plane, washMaterial, washes.length);
  const transform = new T.Object3D();
  washes.forEach(([x, y, z, width, depth, yaw, pitch], index) => {
    transform.position.set(x,y,z);
    transform.rotation.set(pitch,yaw,0,'YXZ');
    transform.scale.set(width,depth,1);
    transform.updateMatrix();
    washMesh.setMatrixAt(index,transform.matrix);
  });
  washMesh.name = 'Mall cove and storefront light wash';
  washMesh.computeBoundingSphere();
  scene.add(washMesh);
  const washVisibility = createInstanceVisibility(T, washMesh);

  const floorRoughness = floors.map(floor => floor.roughness);
  const vaultEmission = vault.emissiveIntensity;
  let fixtureEmission = fixtures.emissiveIntensity;
  let preset;
  function setTier(tier) {
    const next = Object.hasOwn(SURFACES,tier) ? SURFACES[tier] : SURFACES.low;
    if (next === preset) return false;
    preset = next;
    floors.forEach((floor,index) => { floor.roughness = floorRoughness[index] * preset.roughness; });
    vault.emissiveIntensity = vaultEmission * preset.emission;
    fixtures.emissiveIntensity = fixtureEmission * preset.emission;
    washMaterial.opacity = preset.washOpacity;
    washMesh.visible = preset.washOpacity > 0;
    return true;
  }
  function setFixtureEmission(intensity) {
    fixtureEmission = intensity;
    fixtures.emissiveIntensity = fixtureEmission * preset.emission;
  }
  setTier('low');
  return {setTier, setFixtureEmission, updateView(view) {
    if (washMesh.visible) washVisibility.update(view.frustum);
  }};
}

// Local, static lighting resources. No environment image or postprocessing asset is fetched.
export function createMallAtmosphere(T, renderer, scene, slots) {
  const accents = [0xb84739,0xd4a159,0x79a992,0x785a68,0x913f35,0x667887,0x9c4937,0x477aac,0x294f7c,0x478c86,0x843e43,0x6f9690,0x777f85,0x665079,0x82756a,0x4b9993,0x62696a];
  const warm = new T.Color(0xffe5c1), interiorWarm = new T.Color(0xffd5a0);
  const bays = slots.map((slot, index) => ({
    x:(slot.minX + slot.maxX) / 2, z:(slot.minZ + slot.maxZ) / 2,
    accent:new T.Color(accents[index]), color:new T.Color(), distance:0
  }));
  const nearest = [];
  const lights = Array.from({length:Math.min(6,bays.length)}, (_, index) => {
    const light = new T.PointLight(0xffe5c1, 0, 11, 2);
    light.name = `Shop ${String(index + 1).padStart(2, '0')} accent light`;
    light.position.y = 4.2;
    scene.add(light);
    return light;
  });
  // World lights and shop accents are already attached, including hidden bays.
  scene.traverse(node => { if (node.isLight) node.layers.enable(2); });
  function applyTheme(theme) {
    warm.set(theme?.lighting?.key ?? 0xffe5c1).lerp(interiorWarm, .25);
    for (const bay of bays) bay.color.copy(warm).lerp(bay.accent, .08);
    for (let i=0; i<Math.min(lights.length,nearest.length); i++) lights[i].color.copy(nearest[i].color);
  }
  applyTheme(null);
  // Keep the ground-floor shader light count stable even outside every bay's
  // range. An unused slot contributes zero light and keeps the same program.
  function update(position) {
    const ground = Math.abs(position.y) < 6;
    nearest.length = 0;
    if (ground) for (const bay of bays) {
      const dx=bay.x-position.x, dz=bay.z-position.z;
      bay.distance=dx*dx+dz*dz;
      if (bay.distance < 24*24) nearest.push(bay);
    }
    nearest.sort((a,b)=>a.distance-b.distance);
    for (let i=0; i<lights.length; i++) {
      const light=lights[i], bay=nearest[i];
      light.visible=ground;
      light.intensity=bay ? 28 : 0;
      if (bay) {
        light.position.set(bay.x,4.2,bay.z);
        light.color.copy(bay.color);
      }
    }
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

  let environment = null;
  function releaseEnvironment() {
    scene.environment=null;
    environment?.dispose();
    environment=null;
  }
  function restoreEnvironment() {
    const generator = new T.PMREMGenerator(renderer), studio = new T.Scene();
    const geometry = new T.BoxGeometry(1,1,1);
    const materials = [new T.MeshBasicMaterial({color:0x6f6050,side:T.BackSide}),
      new T.MeshBasicMaterial({color:0xffe7c5}), new T.MeshBasicMaterial({color:0xfff4dc})];
    const room = new T.Mesh(geometry,materials[0]); room.scale.set(10,6,10); studio.add(room);
    for (const [x,z,w] of [[-2,-4,3],[2,4,2]]) {
      const panel = new T.Mesh(geometry,materials[1]); panel.position.set(x,2,z); panel.scale.set(w,.2,2); studio.add(panel);
    }
    const ceiling = new T.Mesh(geometry,materials[2]); ceiling.position.y=2.9; ceiling.scale.set(7,.1,7); studio.add(ceiling);
    try {
      // At the bundled 256px cubemap size, .04 radians uses 20 blur taps.
      const next=generator.fromScene(studio,.04);
      const previous=environment; environment=next; scene.environment=next.texture;
      if ('environmentIntensity' in scene) scene.environmentIntensity=.4;
      previous?.dispose();
    } catch (error) {
      releaseEnvironment();
      throw error;
    } finally {
      generator.dispose(); geometry.dispose(); materials.forEach(material=>material.dispose());
    }
  }

  // A quarter-resolution, selective glow pass: only explicitly tagged light
  // strips and signs are rendered. Mobile and Low quality use the direct path.
  let base=null, glow=null, composite=null, quad=null, postScene=null, postCamera=null;
  const bufferSize=new T.Vector2(), savedClearColor=new T.Color();
  function initPost() {
    if (base) return;
    base=new T.WebGLRenderTarget(1,1); glow=new T.WebGLRenderTarget(1,1);
    composite=new T.ShaderMaterial({uniforms:{base:{value:base.texture},glow:{value:glow.texture},texel:{value:new T.Vector2(1,1)}},
      vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
      fragmentShader:`uniform sampler2D base; uniform sampler2D glow; uniform vec2 texel; varying vec2 vUv;
        void main(){ vec3 c=texture2D(base,vUv).rgb; vec3 b=vec3(0.0);
          for(int x=-2;x<=2;x++) for(int y=-2;y<=2;y++) {
            vec3 s=texture2D(glow,vUv+vec2(float(x),float(y))*texel).rgb;
            b+=max(s-vec3(0.38),vec3(0.0));
          }
          gl_FragColor=vec4(c+b*(0.16/25.0),1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,depthTest:false,depthWrite:false});
    postScene=new T.Scene(); postScene.name='Mall glow composite'; postCamera=new T.Camera();
    quad=new T.Mesh(new T.PlaneGeometry(2,2),composite); quad.frustumCulled=false; postScene.add(quad);
  }
  function sizePost(width,height) {
    initPost();
    base.setSize(width,height);
    glow.setSize(Math.max(1,Math.floor(width/4)),Math.max(1,Math.floor(height/4)));
    composite.uniforms.texel.value.set(1/glow.width,1/glow.height);
  }
  function* preparePost(width,height,screenPixel) {
    sizePost(width,height);
    for(const target of [base,glow]) {
      renderer.initRenderTarget(target);
      yield;
    }
    renderer.compile(postScene,postCamera);
    const program=renderer.properties.get(composite).currentProgram;
    if(renderer.extensions.has('KHR_parallel_shader_compile'))while(!program.isReady())yield false;
    const box=renderer.getScissor(new T.Vector4()), test=renderer.getScissorTest();
    try {
      const size=screenPixel();
      renderer.setScissor(0,0,size,size);renderer.setScissorTest(true);
      renderer.render(postScene,postCamera);
    } finally {
      renderer.setScissor(box);renderer.setScissorTest(test);
    }
  }
  const state={bloom:false,nonNpcCalls:0,npcCalls:0,admitted:0,totalCalls:0,submissions:0};
  function renderVisitors(camera,npcs,reservedCalls) {
    state.nonNpcCalls=renderer.info.render.calls+reservedCalls;
    state.admitted=npcs?.admit(state.nonNpcCalls)||0;
    if (!state.admitted) return;
    const mask=camera.layers.mask, background=scene.background;
    const autoClear=renderer.autoClear, shadowAutoUpdate=renderer.shadowMap.autoUpdate;
    const before=renderer.info.render.calls;
    try {
      // Keep the world's color, depth and shadow maps. Only visitors and the
      // same world lights participate; no mall geometry is resubmitted.
      camera.layers.set(2); scene.background=null;
      renderer.autoClear=false; renderer.shadowMap.autoUpdate=false;
      renderer.render(scene,camera); state.submissions++;
    } finally {
      camera.layers.mask=mask; scene.background=background;
      renderer.autoClear=autoClear; renderer.shadowMap.autoUpdate=shadowAutoUpdate;
    }
    state.npcCalls=renderer.info.render.calls-before;
  }
  function render(camera, enabled, npcs) {
    state.bloom=Boolean(enabled);
    state.npcCalls=0; state.submissions=0;
    const autoReset=renderer.info.autoReset, shadowAutoUpdate=renderer.shadowMap.autoUpdate;
    const target=renderer.getRenderTarget(), mask=camera.layers.mask, background=scene.background;
    const clearColor=renderer.getClearColor(savedClearColor), clearAlpha=renderer.getClearAlpha();
    try {
      renderer.info.autoReset=false; renderer.info.reset();
      npcs?.setVisible(false);
      if (!enabled) {
        renderer.render(scene,camera); state.submissions++;
        renderVisitors(camera,npcs,0);
      } else {
        const size=renderer.getDrawingBufferSize(bufferSize);
        sizePost(size.x,size.y);
        renderer.setRenderTarget(base); renderer.render(scene,camera); state.submissions++;
        renderer.shadowMap.autoUpdate=false;
        camera.layers.set(1); scene.background=null; renderer.setClearColor(0x000000,0);
        renderer.setRenderTarget(glow); renderer.clear(); renderer.render(scene,camera); state.submissions++;
        // Glow is now measured, not predicted from the previous view. Reserve
        // the single composite draw before admitting visitors into base.
        renderer.setRenderTarget(base);
        camera.layers.mask=mask; scene.background=background;
        renderVisitors(camera,npcs,1);
        renderer.setRenderTarget(target); renderer.render(postScene,postCamera); state.submissions++;
      }
      state.totalCalls=renderer.info.render.calls;
    } finally {
      camera.layers.mask=mask; scene.background=background; renderer.setClearColor(clearColor,clearAlpha);
      renderer.setRenderTarget(target); renderer.info.autoReset=autoReset; renderer.shadowMap.autoUpdate=shadowAutoUpdate;
    }
  }
  return {update,lightVariants,interiorWarmLights:lights,preparePost,applyTheme,releaseEnvironment,restoreEnvironment,render,get state(){return state;}};
}
