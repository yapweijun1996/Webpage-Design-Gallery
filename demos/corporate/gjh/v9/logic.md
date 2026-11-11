# GJH V9 — Scene and Interaction Contract

## Scene architecture

The lobby and three store rooms are semantic HTML composed with CSS depth layers. The project is 2.5D, not WebGL or full 3D. Entrance and product hotspots remain real buttons; the floor plan uses room buttons and announces the active room. The New Moon room has two product shelves, and each hotspot corresponds to one source-verified SKU/pack size. Its linked detail panel retains the exact SKU and all available original views. MILI and GOGO show only an official brand cover and a cautious brand-story panel because no verified product packshots were found.

The store/product list is the no-script baseline and the reduced-motion default. JavaScript enhances it with scene navigation and a Visual/List toggle. Product detail content is native `details`, so it remains operable without JavaScript. The mini-map's positions follow the requested conceptual plan: New Moon left, MILI above, GOGO right, Lobby centre.

## State and keyboard

`script.js` owns only current room, selected view, reduced-motion response and bounded pointer look. The lobby is the initial room. Room controls synchronize visible scene and `aria-current` floor-plan state. Arrow keys move through Lobby/New Moon/MILI/GOGO; Enter activates focused native buttons; Escape from a brand room returns to Lobby. A hotspot opens its matching native detail panel and moves focus to its summary. Reduced motion disables pointer look and transitions and selects list view.

No canvas or external request is required. If JavaScript fails, the visual shell stays hidden, product summaries remain native disclosures, and the complete list remains usable by keyboard or touch. All controls target at least 44 CSS pixels and the responsive layout constrains content at 390px.

## Provenance boundaries

The official asset library records page-context and hashes. Local originals are copied byte-for-byte. Packshot editions are listed on the captured official shop pages but are not confirmed as currently brand-approved. The official eShop home URL comes from the library's manifest receipt. This unofficial concept is not endorsed by Goh Joo Hin Pte Ltd. No product prices, stock, promotions, certifications or unsupported claims are presented.
