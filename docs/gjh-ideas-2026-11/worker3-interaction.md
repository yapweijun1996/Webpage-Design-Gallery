# GJH landing concepts · Interaction, storytelling and technology

Each proposal opens on one dominant visual at **393 × 844**, with the action above the iPhone safe area. Concepts, audience needs and scores are **[assumption]**. Scores run from 1–10 in **taste / distinctness / feasibility** order. The v22 brief [verified: docs/gjh-v22/design-brief.md] and Apple Singapore’s product-led opening set the visual benchmark. [AirPods Pro 3](https://www.apple.com/sg/airpods-pro/)

**Build and acceptance.** Use self-contained, dependency-free HTML/CSS/JS in the Python gallery. Cap the mobile hero at **150 KB transferred** and require lab **p75 LCP ≤2.5 s** across cold loads on a physical midrange Android phone with a fixed 4G profile. Check iPhone Safari at 393 × 844. Put a dimensioned, high-priority WebP/AVIF hero in the initial HTML. Use system fonts and defer secondary media, 3D and caching. Provide 44 px controls, tap and keyboard equivalents, static links without JS and reduced-motion states. [LCP measurement](https://web.dev/articles/lcp) · [LCP optimization](https://web.dev/articles/optimize-lcp)

### 1. Pull the Pantry Shelf

*Pull one shelf forward to see what belongs in tonight’s pantry.*

- **Visitor and job.** Meal planner looking for a brand and its official product range. Start with New Moon and MILI [verified: docs/gjh-multibrand-directory.md].
- **First screen.** One amber-lit pull-out shelf fills the upper two-thirds. A brass handle sits directly above “Open shelf.” Charcoal, warm ivory and a system serif.
- **Signature.** Pull or tap the handle to slide the shelf toward the viewer using CSS perspective. One pack fills the opened stage, with a plain link to its brand.
- **Imagery and risk.** Generate an unbranded cabinet with matching closed/open crops. Use approved real pack photography for product detail. Handle drags can compete with scrolling, so restrict capture to the handle and preserve the button.
- **Effort M · 9 / 9 / 9.** [Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events) · [W3C drag alternatives](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements)

### 2. The Rochor Window

*Scroll past three scenes in a fictional tram window to follow the company story.*

- **Visitor and job.** First-time visitor looking for a quick, sourced account of the company’s origins. Open with GJH’s account of its 1940s Rochor Road provision store [verified: docs/gjh-story/01-origins.md].
- **First screen.** A single tall night-window view of a period streetscape. The headline and “Read the story” sit below the sill. Soot, oxblood and a condensed system sans.
- **Signature.** Native scroll changes the scene behind the same window. Use short, independently reachable stops like the dated chapters in *The Afterlife of Pi*. A feature-detected CSS view timeline moves only the glass reflection. The base story is stills and captions in document order.
- **Imagery and risk.** Generate the fictional opening and use a cleared corporate archive photo in a later stop. Label the tram as a storytelling device and keep dates and captions tied to the story chapters. Avoid invented routes and address numbers.
- **Effort M · 9 / 8 / 8.** [The Afterlife of Pi](https://pudding.cool/2026/11/pi/) · [WebKit scroll-driven guidance](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)

### 3. One Aisle, Three Doors

*Walk three storefronts in a straight line and step into the one you need.*

- **Visitor and job.** Brand browser looking for a food storefront. Reuse the New Moon, MILI and GOGO stops from the v11 demo [verified: demos/corporate/gjh/v11/README.md].
- **First screen.** One portrait render looking down the jade-and-brass aisle. A bottom slider previews the three named stops. Jade-black and warm white with a narrow sans.
- **Signature.** Scrub between fixed camera stops with named tap targets. Follow `<model-viewer>`’s poster-first pattern: start with stills, then load a single baked WebGL corridor after input. Revert to the same stills on context loss or reduced motion.
- **Imagery and risk.** Render three stills from v11, with real approved packshots only on detail pages. No new generated scenery required. Camera motion and GPU load warrant a fixed-still reduced-motion mode and testing on real devices.
- **Effort L · 9 / 9 / 6.** [Poster-first 3D loading](https://modelviewer.dev/examples/loading/index.html)

### 4. First Note

*Press one key to open a short introduction to digital instruments.*

- **Visitor and job.** A novice keyboard shopper looking for a starting point. GJH’s timeline records a Casio electronic-musical-instrument milestone [verified: docs/gjh-multibrand-directory.md].
- **First screen.** One ivory piano key in a black soundstage, with “Play one note” aligned at its lower edge. Warm white, graphite and system sans.
- **Signature.** Press the key button to play a quiet synthesized tone and reveal the instrument link in place. Borrow the explicit listening cue from *lo-pi radio*. The label and link remain readable in silence.
- **Imagery and risk.** Generate an unbranded key macro. Use an approved real photo only for a named model. Label the note as an illustration so shoppers cannot mistake it for a Casio sound sample.
- **Effort S · 8 / 8 / 9.** [The Pudding’s lo-pi radio](https://pudding.cool/projects/lopi/) · [Chrome audio playback guidance](https://developer.chrome.com/blog/autoplay/)

### 5. Reverse Side

*Turn over a single illustration to read the evidence on its reverse.*

- **Visitor and job.** Heritage reader checking what a brand date means. New Moon dates its first product to 1959. GJH’s SG60 account dates the brand’s entry into its portfolio to the mid-1980s [verified: docs/gjh-story/02-house-brands.md].
- **First screen.** Present one tall crop of the v25 shopkeeper holding the tin [verified: demos/corporate/gjh/v25/index.html], with a “Turn over” button below. Ink-black, rice paper and a system serif.
- **Signature.** Turn the whole print over with an optional same-document View Transition. Its reverse pairs two source excerpts in live text, with links. Use a plain disclosure without JS and an immediate swap in reduced motion.
- **Imagery and risk.** Re-encode the existing AI panel. The reverse uses HTML, with no generated archival facsimile or real photo required. Keep the illustration credit on both faces so the pictured tin reads as dramatization.
- **Effort S · 8 / 9 / 9.** [View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using)

### 6. Pocket Trade Receipt

*Save a dated category reference to take into a buyer meeting.*

- **Visitor and job.** Retail buyer who needs a compact reference with a route to GJH corporate sales [verified: docs/gjh-v22/design-brief.md].
- **First screen.** One cream receipt under a spotlight, rendered as live HTML against black. “Save for offline” sits at its foot. Use a compact monospace.
- **Signature.** Tap once to save the receipt. Use the gallery’s generated demo-worker pattern [verified: templates/gallery/demo-sw.js] to cache the self-contained receipt route. Confirm “Saved” only once the active worker can serve it, then test reopening in airplane mode.
- **Imagery and risk.** CSS supplies the hero with no image transfer. Optional real packshots stay outside the offline core. Label the dated snapshot and require connectivity for official sales links. Handle unavailable storage and cache eviction.
- **Effort M · 7 / 9 / 8.** [PWA caching guidance](https://web.dev/learn/pwa/caching)

## Top three

1. **Pull the Pantry Shelf** makes the first frame actionable and gets a shopper to a brand with one inexpensive transition.
2. **Reverse Side** makes the source the payoff and turns a single manga panel into a complete interactive story.
3. **The Rochor Window** has the strongest cinematic pacing. The static reading path limits the cost of the effect and preserves the historical context.
