import {AVATAR_ANISOTROPY, detectDeviceClass} from './graphics-quality.js';

function avatarDeviceClass() {
  const nav = globalThis.navigator;
  const win = globalThis.window;
  return detectDeviceClass({userAgent:nav?.userAgent, platform:nav?.platform, maxTouchPoints:nav?.maxTouchPoints,
    coarsePointer:win?.matchMedia?.('(pointer: coarse)').matches, width:win?.innerWidth, height:win?.innerHeight});
}

const avatarProgram = () => 'gjh-tripo-portrait-v1';

const crowdProgram = () => 'gjh-crowd-portrait-v1';

function portraitFill(shader) {
  shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `float avatarEdge = 1.0 - saturate(dot(normal, normalize(vViewPosition)));
      outgoingLight += diffuseColor.rgb * 0.065 + (0.014 + 0.028 * diffuseColor.rgb) * avatarEdge * avatarEdge * avatarEdge;
      #include <opaque_fragment>`);
}

function shadeAvatar(shader) {
  shader.uniforms.avatarLift = {value:this.userData?.portraitLift ?? 0};
  // Both authored Tripo atlases cover a single material. Use bind-space coordinates
  // (both rigs are ~1 unit tall) so the zones follow the skin through every pose.
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vAvatarRest;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAvatarRest = position;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vAvatarRest;\nuniform float avatarLift;')
    .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      float headZone = smoothstep(0.51, 0.59, vAvatarRest.y);
      float handZone = smoothstep(0.29, 0.34, abs(vAvatarRest.x));
      float skin = max(headZone, handZone) * smoothstep(0.025, 0.09, diffuseColor.r - diffuseColor.b)
        * smoothstep(0.12, 0.24, diffuseColor.r);
      float hair = headZone * (1.0 - smoothstep(0.06, 0.18, max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b))));
      roughnessFactor = mix(mix(roughnessFactor, 0.62, skin), 0.43, hair);`);
  portraitFill(shader);
  shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `const vec3 avatarLuma = vec3(0.2126, 0.7152, 0.0722);
      float avatarIllumination = dot(outgoingLight, avatarLuma) / max(dot(diffuseColor.rgb, avatarLuma), 0.01);
      outgoingLight += diffuseColor.rgb * avatarLift * headZone * (1.0 - smoothstep(0.35, 1.35, avatarIllumination));
      #include <opaque_fragment>`);
}

function configureAvatar(material, deviceClass, compile, key) {
  if (material.map && material.map.anisotropy !== AVATAR_ANISOTROPY[deviceClass]) {
    // The standard map chunk retains implicit derivatives and zero mip bias.
    material.map.anisotropy = AVATAR_ANISOTROPY[deviceClass];
    material.map.needsUpdate = true;
  }
  material.onBeforeCompile = compile;
  material.customProgramCacheKey = key;
  material.needsUpdate = true;
}

export function prepareTripoMaterial(material, deviceClass = avatarDeviceClass()) {
  if (!material?.isMeshStandardMaterial || !material.map || material.customProgramCacheKey === avatarProgram) return;
  configureAvatar(material, deviceClass, shadeAvatar, avatarProgram);
}

export function prepareCrowdMaterial(material, meshName) {
  if (!material?.isMeshStandardMaterial || material.customProgramCacheKey === crowdProgram) return;
  // The fallback crowd merges differently coloured surfaces into a single draw.
  // Its vertex-coloured material retains the authored roughness for that batch.
  if (!material.vertexColors) {
    const name = meshName + ' ' + material.name;
    if (/hair/i.test(name)) material.roughness = Math.min(material.roughness, .43);
    else if (/skin/i.test(name)) material.roughness = .62;
  }
  configureAvatar(material, avatarDeviceClass(), portraitFill, crowdProgram);
}
