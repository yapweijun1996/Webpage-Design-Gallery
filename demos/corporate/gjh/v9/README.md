# GJH V9 — Evening Street

An independent, unofficial concept for exploring New Moon, MILI and GOGO along a layered evening shopping street. It is not affiliated with or endorsed by Goh Joo Hin Pte Ltd.

## Open locally

From the repository root, run `python3 -m http.server 8088 --bind 127.0.0.1` and open `http://localhost:8088/demos/corporate/gjh/v9/index.html`. The page is static, uses no runtime packages or external requests, and self-hosts the Manrope font. Links to the official eShop navigate there only when selected.

## Explore the street

- Select a storefront or a store-map button to enter a brand room. The street camera moves toward the selected facade before revealing its room.
- Use Back to street or Escape to return. The camera reverses and focus returns to that store's entrance. Selecting another brand on the map travels via the street.
- On the street, arrow keys move focus among storefronts without opening them; Enter or Space activates the focused native button. Arrow keys from the map, or within a brand room, move focus among map buttons. Keyboard shortcuts are scoped to the experience.
- New Moon has four product hotspots. Each opens a native modal dialog with the matching SKU, pack size and available original product images. Close or Escape dismisses the dialog and restores focus to its hotspot; Tab stays within the open dialog.
- The List view button is a stable-label toggle: pressed means the store, product and story list is active. List product links open their matching native disclosures. Page links into this baseline switch to list view automatically.

Reduced motion keeps the visual street available but makes room changes immediate and disables pointer look and ambient motion. It does not force list view. Pointer look is small, desktop-only and reset when the pointer leaves. Without JavaScript, the visual enhancement is hidden and the complete list and native product disclosures remain available.

## Content and assets

New Moon shows four official eShop packshots with their individual sizes and matching front/back/nutrition views where available. MILI and GOGO are artwork-only brand rooms and stories: no verified product packshots were available, so no products are invented or listed. Current packaging editions are not confirmed as brand-approved. The concept adds no prices, stock claims or certifications.

Asset origins, local copies and icon catalog references are recorded in `assets/sources.json`. Official logos are separate from brand-cover artwork; original covers and packshots remain unchanged. The scene uses semantic HTML and layered CSS, not WebGL, a canvas or a 3D dependency.

The street signs share warm-ivory plates with thin gold borders. CSS frames the original logo marks at roughly 70% of each plate's width without modifying the verified files. All facades share a floor baseline; decorative door numbers are omitted. The headline, lantern and fully visible moon occupy separate safe zones at desktop, tablet and mobile widths.

A single quiet disclaimer sits directly below the artwork. The floor plan occupies a separate navigation bar, never the scene: Street, New Moon, MILI and GOGO form one four-button row, with the live current location above it on mobile. The footer retains only the official eShop link.

## Verification — 2026-11-11

Local Chrome / Python Playwright smoke passed at 1440×1000, 768×1024 and 390×844. The three refreshed street captures were visually reviewed. Checks covered keyboard-only entry into every store, the intermediate camera dolly, Back/Escape, all four product dialogs and focus restoration, mini-map state, rapid-navigation cancellation, list switching, image loading, no console errors or external requests, no horizontal overflow and visible controls at least 44×44 CSS pixels. Reduced-motion emulation retained the static depth layers with no running animations; touch emulation exercised CSS drift and its reduced-motion shutdown. The no-JavaScript list and native product disclosure also passed.

The polish smoke additionally checked navigation below the scene, moon containment, headline/lantern separation, aligned facade baselines, one disclaimer in both visual and list modes, and page captures ending at the footer. Final captures at 1440, 768 and 390 were reviewed after refinement; page heights are 1151, 1175 and 946 CSS pixels respectively. The original V9 smoke also exited 0. No asset originals, external links or functional SVG icons changed.

`scripts/build_gallery.py`, `scripts/build_gallery.py --check`, the eight `test_gallery.py` unit tests and `tests/browser_gallery.py` exited 0. Browser suites ran against an identical temporary copy because the legacy runners overwrite unrelated demo captures.

Additional repository checks did not pass: `tests/browser_gjh_demos.py` stopped on the existing V6 `new-moon-logo.svg` receipt/hash mismatch; `tests/browser_pwa.py` failed its offline `#connection-notice` visibility assertion. Those paths are outside this V9 redesign and were not modified. Physical devices, Safari and manual screen-reader testing remain unverified.

The local `assets/.gitattributes` preserves the official New Moon SVG's original CRLF bytes, keeping its manifest receipt valid after checkout. No missing catalog icons were required.
