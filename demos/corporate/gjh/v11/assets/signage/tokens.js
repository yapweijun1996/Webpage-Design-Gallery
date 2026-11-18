import manifest from './models/manifest.json' with {type:'json'};

// Display sRGB. Brand colours come from brand-kit.json at config resolution.
export const swatch = Object.freeze({
  green:'#163b30', brass:'#c6a568', cream:'#fff0cf', gold:'#ffd688',
  black:'#171c22', gunmetal:'#373d43', blue:'#77cfff', silver:'#c6cccf',
  walnut:'#513728', leaf:'#718154', ivory:'#eee4d5', charcoal:'#332e32',
  rose:'#653e4f', blush:'#ffced4', burgundy:'#652e30', navy:'#182f50',
  enamel:'#fff9ed', shadow:'#201a16', highlight:'#fff6dc'
});

// The kit records authoring colours in sRGB. Hardware vertex colours and
// glTF metallic-roughness factors are linear.
export const materials = Object.freeze(Object.fromEntries(
  Object.entries(manifest.materialLibrary).map(([name,finish]) => {
    const rgb=finish.color.slice(1).match(/../g).map(pair=>parseInt(pair,16)/255)
      .map(v=>v<=.04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
    return [name,{baseColorFactor:[...rgb,1],metallicFactor:finish.metallic,
      roughnessFactor:finish.roughness,emissiveFactor:rgb.map(v=>v*(finish.emission??0)),
      doubleSided:finish.doubleSided??false}];
  })
));
