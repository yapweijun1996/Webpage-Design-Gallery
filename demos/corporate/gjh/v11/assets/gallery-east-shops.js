import {galleryFixture} from './interiors/config.js';

// Bay-local metres, floor-centred origins. The storefront faces local +Z.
export const eastShopPlacements = {
  12: [{file:'gallery-assets/medicine-health-box-set.glb', position:[-2.24, 0.081, 2.92], yaw:0.11, scale:1.14}],
  13: [galleryFixture('S13','leftfront','headphone-display-stand',1.2)],
  14: [{file:'gallery-assets/refrigerator.glb', position:[-2.48, 0.081, 2.58], yaw:0.08, scale:1.03}],
  15: [{file:'gallery-assets/grand-piano.glb', position:[-2.3, 0.081, 2.47], yaw:0.22, scale:0.93}],
  16: [{file:'gallery-assets/shelf-electronics-display.glb', position:[-2.13, 0.081, 2.81], yaw:0.12, scale:0.96}],
  17: [galleryFixture('S17','leftfront','lounge-sofa-bench',.86)],
};
