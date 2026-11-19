import {galleryFixture} from './interiors/config.js';

// Local metres from bay centre; +Z faces the arcade. Countertop props start
// at the actual cap height of the corresponding window-studios.js fixture.
const fixture = (name, x, y, z, yaw = 0, scale = 1) => ({
  file: `gallery-assets/${name}.glb`, position: [x, y, z], yaw, scale
});

export const westShopPlacements = {
  4: [galleryFixture('S04','leftrear','mosquito-patch-pack',.7,true)],
  5: [fixture('medicine-health-box-set', -2.21, .081, 4.84, .12)],
  6: [fixture('instant-noodle-pack-display', -2.43, .081, 4.57, .035)],
  7: [fixture('stacked-can-pyramid', -1.56, .081, 2.65, -.07, .88)],
  8: [galleryFixture('S08','leftfront','peanut-butter-jar-stand')],
  9: [fixture('shelf-food-aisle', -2.49, .081, 4.57, .015)],
  10: [galleryFixture('S10','leftrear','abalone-gift-box-display',.6,true)],
  11: [fixture('food-display-cabinet', -1.61, .081, 2.74, -.12)]
};
