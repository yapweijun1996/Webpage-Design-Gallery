# 1 · Tuning Bench
Turn one dial from what you want to do to the brand page that helps you do it.

## 2 · Visitor and job-to-be-done

A shopper on the train knows they want a keyboard but may associate Casio with watches [assumption]. Their task is to spot **Play**, recognise piano keys and open the music catalogue with one thumb. The four activities are editorial routes. Evidence for the associations includes Sony portable speakers, LG televisions, Casio musical instruments and Gigaset cordless phones [verified: docs/gjh-story/03-diversification.md].

## 3 · External benchmarks

- Teenage Engineering explains radio rewind through the OB–4 tape dial. Borrow the visible connection between a turn and its effect. Avoid continuous scrubbing across four discrete choices. [OB–4 guide](https://teenage.engineering/guides/ob-4)
- Nothing gives Roller, Paddle and Button their own product-page passages. Borrow the tight material study of a single control. Avoid asking a shopper to learn secondary gestures. [Headphone (1)](https://us.nothing.tech/products/headphone-1)
- Bang & Olufsen puts favourite stations directly on the A5’s top panel. Borrow direct access to any stop. Avoid unlabeled presets that require remembering the order. [Beosound A5 controls](https://support.bang-olufsen.com/hc/en-us/articles/14124506871185-How-can-I-interact-with-Beosound-A5)
- Apple pairs a close-up of the Digital Crown with a plain account of what turning it does. Borrow that explanatory crop. Avoid the colour picker and multi-product opening shot. [AirPods Max](https://www.apple.com/sg/airpods-max/)

## 4 · Mobile storyboard · 393 × 844

One stage, five states. The object occupies the middle half of the portrait. Set the headline in the shadow above it. Keep the four-stop selector and destination link above the bottom safe area. Each activity row inherits the evidence in §2.

| State | Headline | Single dominant still | Actions |
|---|---|---|---|
| Entry | What will you tune into? | An oversized silver dial, amber index at rest | Select activity |
| Listen | Listen up close | A speaker grille on a cobalt-edged plinth, weave catching the light | Select activity · [Explore Sony](https://www.gjh.com.sg/sony/) |
| Watch | Watch the room go dark | A television in profile, a bright sliver of screen reflected in the bench | Select activity · [Explore LG televisions](https://www.gjheshop.com/brand/lg/) |
| Play | Play the first note | Three piano keys in deep perspective, one ivory bevel lit | Select activity · [Explore Casio Music](https://casiomusic.sg/) |
| Connect | Connect across the room | A cordless handset leaning into its cradle, lit along the receiver seam | Select activity · [Explore Gigaset](https://www.gjhglobal.com/gigaset/) |

## 5 · Signature interaction

Four native radio inputs share one group. Tap any printed activity label to select it directly. An optional horizontal drag on the bench dial moves its index one detent per 28 px. Preview only the index during drag. Release commits the nearest stop, cancel restores the last selection. Preserve vertical scrolling. Once selected, swap the headline, still and link together and retain selector focus. A small CSS dial beside the labels carries the index into every activity state.

Arrow keys change stops. Reduced motion cuts directly between stills and index positions. Base HTML presents an entry anchor and four stacked, named sections with ordinary brand links. Enable the dial only after setup succeeds. An unavailable image leaves the heading and destination usable on graphite.

## 6 · Palette and type

Graphite **#101219** under warm white **#F4F1E9**. Reserve phosphor amber **#FFC46A** for the selected notch and cobalt **#718BFF** for rim light and keyboard focus. Space Grotesk Medium, 42 px, for headlines. IBM Plex Mono, 14 px, for controls. Both use SIL OFL 1.1. Bundle licence texts with self-hosted subsets.

## 7 · Asset plan

Generate the dial and an empty master plinth. For the four activity stills, photograph one unbranded detail per scene using the master’s lighting. A rights-cleared, source-matched GJH product photograph may supply the detail instead. Reuse source records in `assets/companies/gjh/official/manifest.json` and `demos/corporate/gjh/v22/assets/sources.json` to check provenance. Export each completed scene as one portrait WebP. Caption every generated or mixed scene “AI concept illustration.” Preload only the dial.

## 8 · IMAGE ANCHORS

**A · First screen**

Portrait 2:3 industrial studio photograph of one oversized brushed aluminium rotary dial on a graphite instrument panel. Frame the knob straight on, centred halfway down, with concentric machining lines readable across its face. Four short unnumbered amber index cuts follow the top arc. A narrow cobalt reflection catches the right edge. Keep the upper quarter and bottom strip quiet and dark for interface overlays. No text, logos, packaging, faces, numerals or extra controls.

**B · Listen selected, before the speaker photograph is placed**

Portrait 2:3 photograph of one low charcoal studio plinth on the same graphite bench, viewed just above tabletop height. A fine cobalt rim defines the back edge and a grazing amber reflection reveals the front corner. Leave the central top surface empty for a separately photographed speaker detail. Retain a dark upper quarter and black lower third. Use soft haze behind the pedestal, crisp foreground grain, no text, logos, packaging, faces or devices.

## 9 · Risks, effort and acceptance

**M.** Matching photographic perspective and light is the largest cost. Reject composites that appear to float. On a 393 × 844 iPhone, ask a shopper to find a musical keyboard from entry. Pass if Play and the Casio link suffice on the first attempt. Check every destination, rapid selection, interrupted drags and native Back. Require 44 px targets, 4.5:1 text contrast, visible focus, usable no-JS links, instantaneous reduced-motion changes and one dominant image in every settled state.

## 10 · Self score

Taste **9/10** for restraint and material detail. Distinctness **9/10** because turning the instrument performs the navigation. Feasibility **8/10** because static HTML, CSS and vanilla JS suffice, while four credible photographic crops still need art direction.
