// Local metres from bay centre; +Z faces the arcade. Countertop props start
// at the actual cap height of the corresponding window-studios.js fixture.
const fixture = (name, x, y, z, yaw = 0, scale = 1) => ({
  file: `gallery-assets/${name}.glb`, position: [x, y, z], yaw, scale
});

export const westShopPlacements = {
  4: [fixture('mosquito-patch-pack', -1.57, 1.2875, 1.62)],
  5: [fixture('medicine-health-box-set', -2.21, .081, 4.84, .12)],
  6: [fixture('instant-noodle-pack-display', -2.43, .081, 4.57, .035)],
  7: [fixture('stacked-can-pyramid', -1.18, .081, 3.62, -.07, .88)],
  8: [fixture('peanut-butter-jar-stand', -2.52, .081, 4.57, .015)],
  9: [fixture('shelf-food-aisle', -2.49, .081, 4.57, .015)],
  10: [fixture('abalone-gift-box-display', -.55, 1.09, 1.75)],
  11: [fixture('food-display-cabinet', -1.18, .081, 3.28, -.12)]
};
