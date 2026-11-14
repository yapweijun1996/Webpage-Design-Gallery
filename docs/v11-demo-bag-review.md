# V11 demo bag — first shopping slice

Release 1.1.20, based on d8824fa. Owner requested virtual shopping and later character carrying/cart behavior. This release implements only the selection bag; it does not claim hand pickup animation, a carried bag or a pushable cart.

## Contract
Four existing New Moon SKU records only. Add in product detail, combine quantities, increase/decrease (maximum 9 per SKU), remove and clear. Header count is total units. Session storage is scoped to this tab; unavailable/invalid storage falls back to memory. No price, order, stock reservation, checkout, account or payment. No network writes. Official eShop remains a separate external link, not a checkout for this bag.

The state store has no Three.js dependency. It remains usable in the accessible directory with 3D unavailable. Native bag dialog pauses movement, restores focus to its header trigger and does not nest with the product viewer. Product add feedback is polite and stays in the product detail. A startup guide is not shown over an already open bag.

## Evidence
Before screenshot/source review with the UI advisor selected an inline product CTA below the description, separate native bag dialog and compact header entry. After screenshot/source review inspected product details at 320/390 and bag at 320/390/844; no blocking visual or code issue was identified. Screenshots are in [evidence](evidence/v11-demo-bag/).

`tests/browser_gjh_bag.py`: Chromium simulated 320x680, 390x680, 844x390 passed four-SKU add, quantity, remove, clear, session reload, modal pause/focus, minimum button heights and no horizontal page overflow. Blocked sessionStorage plus failed 3D module still allowed adding and viewing the bag. Targeted JS store checks passed allowed-ID filtering, invalid saved quantities, 9-unit limit, remove/clear and failed storage writes. No unrelated suite rerun.

Real iOS/Safari, physical touch ergonomics and screen-reader/device performance remain unverified. The narrow header omits its location text to keep brand, Bag and List/3D actions legible; the map and navigation announcements remain available.

## Rollback
Baseline d8824fa. Reverse-patch applicability checked before release. Revert release commit and rebuild generated files to roll back; the optional session key can remain ignored. No data or server migration.
