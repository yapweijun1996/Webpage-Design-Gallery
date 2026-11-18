// Local metres from bay centre; +Z faces the arcade. Countertop props start
// at the actual cap height of the corresponding window-studios.js fixture.
const fixture = (name, x, y, z, yaw = 0, scale = 1) => ({
  file: `gallery-assets/${name}.glb`, position: [x, y, z], yaw, scale
});

export const westShopPlacements = {
  4: [fixture('mosquito-patch-pack', -3.97, 1.081, -1.8, 0, .7)],
  5: [fixture('medicine-health-box-set', -2.21, .081, 4.84, .12)],
  6: [fixture('instant-noodle-pack-display', -2.43, .081, 4.57, .035)],
  7: [fixture('stacked-can-pyramid', -1.56, .081, 2.65, -.07, .88)],
  8: [fixture('peanut-butter-jar-stand', -2.52, .081, 4.57, .015)],
  9: [fixture('shelf-food-aisle', -2.49, .081, 4.57, .015)],
  10: [fixture('abalone-gift-box-display', -2.99, 1.081, -1.8, 0, .60)],
  11: [fixture('food-display-cabinet', -1.61, .081, 2.74, -.12)]
};
