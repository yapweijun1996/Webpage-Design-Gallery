import {swatch as s} from './tokens.js';

function preset(fascia, trim, letter, glow, finish, backlight, typography, width, height) {
  return {palette:{fascia,trim,letter,glow,accent:trim}, finish, backlight, typography,
    limits:{width, height, depth:[.012,.06]}};
}

// Working metre ranges interpret the reference sheet against the built 8/10 m bays.
export const presets = Object.freeze({
  't1-classic':preset(s.green,s.brass,s.cream,s.gold,'lacquer','halo','heritage',[4,8],[1,1.5]),
  't2-fashion':preset(s.charcoal,s.silver,s.cream,s.cream,'matte','underglow','editorial',[4,8],[1,1.5]),
  't3-cafe':preset(s.walnut,s.brass,s.cream,s.gold,'timber-slat','halo','heritage',[3,8],[1.3,1.5]),
  't4-tech':preset(s.black,s.gunmetal,s.enamel,s.blue,'glass','neon-line','modern',[3,8],[1,1.5]),
  't5-book':preset(s.green,s.brass,s.cream,s.gold,'matte','underglow','heritage',[3,8],[1.2,1.5]),
  't6-beauty':preset(s.rose,s.brass,s.enamel,s.blush,'lacquer','halo','editorial',[3,8],[1.2,1.5]),
  't7-home':preset(s.walnut,s.brass,s.cream,s.gold,'stone','underglow','heritage',[3,8],[1.1,1.5]),
  't8-kids':preset(s.ivory,s.brass,s.charcoal,s.blush,'lacquer','underglow','modern',[3,8],[1.1,1.5]),
  'heritage-red':preset(s.burgundy,s.brass,s.cream,s.gold,'lacquer','halo','heritage',[4,8],[1,1.5]),
  'midnight':preset(s.navy,s.silver,s.enamel,s.blue,'matte','neon-line','modern',[3,8],[1,1.5])
});
