// Display sRGB. Brand colours come from brand-kit.json at config resolution.
export const swatch = Object.freeze({
  green:'#163b30', brass:'#c6a568', cream:'#fff0cf', gold:'#ffd688',
  black:'#171c22', gunmetal:'#373d43', blue:'#77cfff', silver:'#c6cccf',
  walnut:'#513728', leaf:'#718154', ivory:'#eee4d5', charcoal:'#332e32',
  rose:'#653e4f', blush:'#ffced4', burgundy:'#652e30', navy:'#182f50',
  enamel:'#fff9ed', shadow:'#201a16', highlight:'#fff6dc'
});

// Shared linear glTF 2.0 factors. Use these names/values in authoring tools.
const pbr = (baseColorFactor, metallicFactor, roughnessFactor, emissiveFactor = [0,0,0]) =>
  ({baseColorFactor:[...baseColorFactor,1], metallicFactor, roughnessFactor, emissiveFactor});
export const materials = Object.freeze({
  brass_trim:pbr([.56,.38,.14],.78,.30),
  lacquer_fascia:pbr([.025,.075,.05],.22,.26),
  timber_slat:pbr([.20,.105,.058],0,.64),
  emissive_letter:pbr([.96,.84,.60],.22,.32,[.36,.25,.12]),
  glass_panel:pbr([.47,.57,.53],.12,.16),
  brushed_black:pbr([.028,.031,.035],.69,.47),
  gunmetal:pbr([.09,.10,.11],.72,.38),
  gold_disc:pbr([.77,.48,.12],.84,.25),
  silver_ring:pbr([.55,.58,.60],.86,.24)
});
