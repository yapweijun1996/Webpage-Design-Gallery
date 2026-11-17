// A conceptual, unbranded selection; no depicted object represents a real SKU.
export const FEATURE_KIOSK_ID = 'gjh-feature-kiosk';
export const FEATURE_KIOSK_RECORD = Object.freeze({
  name: 'GJH Premium Selection',
  brand: 'GJH',
  tagline: 'Premium Selection',
  story: 'Explore the GJH Premium Selection, a conceptual feature display for this virtual mall. The gift boxes and tins shown here are illustrative, not actual products.',
  image: 'assets/gjh-logo.png',
  alt: 'GJH logo',
  kind: 'Feature display · independent virtual mall concept',
  action: 'brand-story',
});

// Uses the world's existing primitive batches and finishes. The one sign uses
// its existing text helper; no individual product mesh or texture is loaded.
// The ground-floor display stays outside the garden and event reservation.
export function addFeatureKiosk({x, z, box, cylinder, sign}) {
  box('dark', x, .48, z, 1.75, .96, 1.35);
  box('brass', x, .08, z, 1.78, .06, 1.38);
  box('glow', x, .87, z + .69, 1.65, .035, .025);
  box('brass', x, .96, z, 1.8, .06, 1.4);
  box('ivory', x, 1.01, z, 1.72, .06, 1.32);

  // Stacked gift boxes and tins sit within the plinth, without extra colliders.
  box('jade', x - .23, 1.17, z, .31, .26, .28);
  box('brass', x - .23, 1.305, z, .32, .018, .29);
  box('cream', x + .19, 1.14, z + .05, .26, .2, .25);
  box('brass', x + .19, 1.245, z + .05, .27, .018, .26);
  cylinder('jadeAlt', x + .18, 1.38, z - .19, .12, .34);
  cylinder('brass', x + .18, 1.555, z - .19, .125, .025);
  cylinder('ivory', x - .1, 1.41, z - .23, .1, .27);
  cylinder('brass', x - .1, 1.55, z - .23, .105, .02);

  box('dark', x, 1.85, z - .48, 1.55, .65, .08);
  box('brass', x, 2.19, z - .48, 1.6, .025, .1);
  box('glow', x, 1.54, z - .42, 1.42, .025, .025);
  sign('GJH', x, 1.98, z - .425, 1.35, .2, false, 105);
  sign('PREMIUM SELECTION', x, 1.73, z - .425, 1.35, .17, false, 55);

  return {id: FEATURE_KIOSK_ID, x, z, floor: 0, radius: 1.8};
}
