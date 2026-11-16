# V11 stage 6 — candidate storefront review

Reviewed 15 November 2026. Status: **neutral storefront and evidence-review slice implemented locally; 14 branded stores remain pending**. The opt-in expanded layout keeps three existing stores and presents S04–S17 as closed planned spaces. This document records research, not tenant commitments, legal advice, trademark ownership determinations or a grant of project rights.

## Evidence and decision

A listing is evidence that a name appeared in a channel, not permission to reuse logos, product images or commercial claims in this independent virtual mall. A historical distribution statement does not establish a current contract, territory, authorized online presentation or consent to a new virtual store. Existing New Moon project authorization recorded in the repository cannot be generalized to the other candidates. The repository review and public sources inspected for this slice did not locate an applicable project-specific authorization for any of the 14 candidates; this means **not verified**, not that permission necessarily does not exist. No additional brand logo, packaging, product image or health claim is added.

Sources reviewed: [GJH eShop brand filter](https://www.gjheshop.com/shop/), [GJH company milestones](https://www.gjh.com.sg/about-us/), [GJH Borsch Med history](https://www.gjh.com.sg/borsch-med-history/), [GJH Flying Wheel page](https://www.gjh.com.sg/flying-wheel/), [GJH corporate brand navigation](https://www.gjhglobal.com/gogo/), [Hormel Foods brands](https://www.hormelfoods.com/ask-and-answer/what-brands-are-owned-by-hormel-foods/), [Zeria company profile](https://www.zeria.co.jp/english/corporate/outline/), [GP Batteries corporate information](https://intls.gpbatteries.com/pages/corporate-information/) and [VTech's Gigaset acquisition announcement](https://www.vtech.com/en/press_release/2024/vtech-completes-acquisition-of-assets-of-gigaset-communications-gmbh/).

| Slot / planning candidate | Public source finding and remaining identity/relationship question | Project permission / decision |
| --- | --- | --- |
| S04 Borsch Med | GJH eShop lists the name; GJH company history calls it its fifth brand. | Not verified; neutral planned space. |
| S05 Pien Tze Huang | GJH navigation lists the name; its Borsch Med history describes a 2004 distributor acquisition. Current scope is unverified. | Not verified; neutral planned space. |
| S06 Flying Wheel | GJH eShop and its brand page list it. The page's 2004 date conflicts with the company's 1982 timeline; no date is selected. | Not verified; neutral planned space. |
| S07 Gu Long | GJH eShop lists GuLong; normalized spelling and current relationship need confirmation. | Not verified; neutral planned space. |
| S08 Skippy | GJH eShop lists it; Hormel Foods identifies SKIPPY in its brand family. Market-specific relationship needs confirmation. | Not verified; neutral planned space. |
| S09 SPAM | GJH eShop lists it; Hormel Foods identifies SPAM in its brand family. Historical GJH distribution does not establish current scope. | Not verified; neutral planned space. |
| S10 California Mexico | GJH eShop lists the name and the company timeline describes a historical distribution relationship. The exact entity, mark and current relationship need confirmation. | Not verified; neutral planned space. |
| S11 Hormel | GJH corporate navigation and history mention Hormel; Hormel Foods lists its own branded products. Historical distribution is not a current agreement. | Not verified; neutral planned space. |
| S12 Zeria | GJH eShop lists Zeria; a Zeria Pharmaceutical company exists, but the precise listed entity and current relationship require confirmation. | Not verified; neutral planned space. |
| S13 Sony | GJH eShop lists Sony and its timeline describes a historical personal-entertainment distribution partnership. Current product/territory scope is unverified. | Not verified; neutral planned space. |
| S14 LG | GJH eShop lists LG and its timeline mentions home entertainment products. Current relationship and intended entity need confirmation. | Not verified; neutral planned space. |
| S15 Casio | GJH eShop lists Casio and its timeline mentions electronic musical instruments. Current relationship and intended entity need confirmation. | Not verified; neutral planned space. |
| S16 GP | GJH eShop lists GP and its timeline names GP Batteries; GP Batteries has a corporate site. Current relationship and exact mark need confirmation. | Not verified; neutral planned space. |
| S17 Gigaset | GJH eShop lists Gigaset and its timeline reports a 2006 distributorship; VTech reports acquiring Gigaset assets in 2024. Current relationship after that transaction needs confirmation. | Not verified; neutral planned space. |

No owner or rights-holder was contacted in this task. For each proposed activation, retain a reviewable approval from an appropriately authorized rights holder or delegate, including the specific name/marks and images, modification rights, intended channels, territory, duration and any conditions; validate current relationship, source content and any applicable product or health claims separately. Then update the shared slot data, 3D content, directory, map and interaction states together and test the individual store. Do not infer permission or activation from this research table.

## Implemented slice

- S04–S17 remain sealed, neutral, non-interactive physical storefronts. Their glazed fronts gain framing and low stone bases; one shared texture atlas renders the matching S-number and “PLANNED SPACE” on each frontage. No candidate names are displayed as tenants.
- The expanded directory exposes a keyboard-operable list of all 14 numbered spaces and their arcade, generated from the same `expandedLayout.slots` used by the shell and map. It offers no unavailable actions. The map describes the planned numbers accessibly and preserves only the three existing destinations.
The JavaScript-disabled directory retains the three existing stores and four products. The expanded mall is now the default; `?layout=classic` explicitly selects the original three-store scene. Brand names in this research record are proposals, not public tenant assignments.

## Verification and limitations

The final candidate passed [gallery generation](evidence/gjh-stage6-20261115/generator.log), [design generation](evidence/gjh-stage6-20261115/design.log), [SSOT](evidence/gjh-stage6-20261115/ssot.log), [49 Python unit tests](evidence/gjh-stage6-20261115/units.log), [spatial Node tests](evidence/gjh-stage6-20261115/layout.log), [gallery browser](evidence/gjh-stage6-20261115/gallery.log), [28 GJH demo browser cases](evidence/gjh-stage6-20261115/demos.log), [gallery PWA](evidence/gjh-stage6-20261115/pwa.log), [expanded PWA](evidence/gjh-stage6-20261115/gjh-pwa.log), [planned-store map/directory and fallbacks](evidence/gjh-stage6-20261115/planned.log), [expanded walking/cart shell](evidence/gjh-stage6-20261115/shell.log), [atrium](evidence/gjh-stage6-20261115/atrium.log), and [three-store detail/bag integration](evidence/gjh-stage6-20261115/stores.log). Chrome 157 emulation covered 320, 390, 768, 844 landscape and 1440 px, plus V1/V2 where the existing suites specify. The demo browser suite did not receive an axe bundle, so its zero axe count is not an accessibility audit.

[Actual S04 frontage](evidence/gjh-stage6-20261115/north-storefront.png), [390 px directory](evidence/gjh-stage6-20261115/directory-390.png) and [1440 px directory](evidence/gjh-stage6-20261115/directory-1440.png) show the implemented scene and list. A [matched local performance sample](evidence/gjh-stage6-20261115/performance.log) recorded expanded idle/cart draw calls of 151/174 at 390 px and 184/207 at 1440 px; a separate loop/cart view reached 214. The desktop cart exceeds the existing 200-call reference for its non-cart laboratory scenario, consistent with the earlier stage 3 limitation; this is not a field performance guarantee.

Browser viewport emulation is not physical-device, Safari or screen-reader certification. Rights and current distributorship remain unverified for every candidate; full branded stores are deliberately pending rather than reported as complete. The preview is an independent unofficial concept, with no checkout or real inventory.
