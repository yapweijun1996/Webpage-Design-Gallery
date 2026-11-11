# GJH V8 — Independent Brand, B2B and SEO Review

Reviewed 11 November 2026 after the V8 candidate was implemented in `demos/corporate/gjh/v8/`. This is an evidence-based review of an independent gallery concept, not a GJH approval or user research result.

## Scope and evidence

- Candidate page: `demos/corporate/gjh/v8/index.html`, `style.css`, `script.js` and `metadata.json`.
- Visual evidence: `demos/corporate/gjh/v8/screenshots/1440.png`, `768.png` and `390.png`.
- Content evidence: `docs/gjh-v8-facts.md`, `demos/corporate/gjh/v8/assets/sources.json`, and the official GJH pages linked there.
- Asset evidence: local SHA-256 checks for all adopted V8 assets; source provenance for official images is inherited from `assets/companies/gjh/official/manifest.json`.
- External-link check: PowerShell `HEAD` requests with up to five redirects, run 11 November 2026. All eight V8 official destinations returned HTTP 200 and remained on the requested host/path.

| Destination | Status | Check result |
| --- | ---: | --- |
| `https://www.gjh.com.sg/about-us/` | 200 | Reached requested URL |
| `https://www.gjh.com.sg/newmoon/` | 200 | Reached requested URL |
| `https://www.gjh.com.sg/mili/` | 200 | Reached requested URL |
| `https://www.gjh.com.sg/gogo/` | 200 | Reached requested URL |
| `https://www.gjh.com.sg/explore-our-brand/` | 200 | Reached requested URL |
| `https://www.gjh.com.sg/sony/` | 200 | Reached requested URL |
| `https://www.gjh.com.sg/borsch-med/` | 200 | Reached requested URL |
| `https://www.gjh.com.sg/contact-us/` | 200 | Reached requested URL |

The HTTP check proves reachability at review time only. It does not prove content correctness, form submission, browser rendering, current brand approval or commercial availability.

## Corporate Brand Director

**Status: PASS WITH WARNINGS**

### Strengths

- The page keeps GJH as the parent identity and gives New Moon, MILI and GOGO distinct brand objects, links and labels (`index.html:41–44`).
- The section sequence mirrors the reference concept: cinematic origin, heritage, portfolio brands, business pillars, journey, network and a business CTA (`index.html:26`, `34`, `41`, `48`, `53`, `60`, `62`).
- The official GJH logo is used as a small raster and the footer calls the work an “Independent, unofficial design concept” (`index.html:20`, `64`).
- The historical visual is explicitly captioned as an official-site composite rather than an original archival photograph (`index.html:35`). The timeline also separates brand origin from GJH ownership (`index.html:55–58`).
- The hero and footer identify the family image as an AI-created concept illustration. The asset manifest records no official source or formal brand approval.

### Findings

1. **[Medium] The visual system can still be mistaken for approved GJH campaign artwork.** The reference-like palette, actual logo, premium hero composition and “Generations of Goodness” headline make the concept feel close to a launchable corporate page. The disclosure exists but is small in the hero and footer.
   - **Recommendation:** Keep the disclaimer, and make the hero disclosure more legible at desktop and mobile. Keep the metadata title and footer language that identifies the page as an independent concept.
   - **Verification:** Recheck the 1440px and 390px screenshots at normal viewing scale; the AI/concept label should be readable without zooming.

2. **[Medium] The Electronics card uses a Sony logo tile while its alt text calls it a “consumer electronics photograph.”** The source file is a 319×170 logo tile, not a product photograph. This is a semantic and brand-fidelity mismatch even though the destination is a valid GJH page (`index.html:49`, `assets/sources.json` `sony-brand-tile`).
   - **Recommendation:** Change the description and alt text to “Official Sony brand tile” or use an approved, clearly attributable electronics photograph. Do not imply that the concept has a GJH/Sony product shoot.
   - **Verification:** Compare the rendered card label, alt text and manifest kind; all three should classify the asset as a logo tile.

3. **[Low] The proposed green/gold/ivory palette is visually coherent but not verified official brand guidance.** The page labels the palette as proposed in the footer, which reduces the risk.
   - **Recommendation:** Preserve the proposed-palette disclosure until an approved brand manual or larger master assets are available.
   - **Verification:** Confirm that no page copy calls the palette official.

## B2B Conversion Specialist

**Status: PASS WITH WARNINGS**

### Strengths

- “Business Enquiries” is the primary CTA in the final section and links to the official contact page (`index.html:62`).
- The flow gives a prospective partner enough orientation to understand the parent company, product portfolio, business pillars and named markets before the CTA (`index.html:48–60`).
- The network section avoids fabricated totals and states that selected markets do not imply availability of every brand or product (`index.html:60`).
- The official contact page was reachable with HTTP 200 during the review.

### Findings

1. **[Medium] The CTA is reachable but not qualified for different B2B intents.** A brand owner, distributor, investor or career applicant all arrive at the same external form. The concept does not claim a hidden API or invent an enquiry endpoint, which is correct, but the conversion path remains generic.
   - **Recommendation:** Use intent labels only where the official contact form supports them, for example “Distribution enquiry,” “Brand partnership” and “Investment opportunity.” Otherwise keep one CTA and link directly to the official form.
   - **Verification:** Confirm each label maps to a real option on the official contact page; do not add an unverified route or query parameter.

2. **[Low] The page provides narrative trust but little B2B proof.** There are no verified partner case studies, audited market totals or response-time commitments. The absence of invented metrics is a strength for accuracy but leaves a partner with limited evidence to act on.
   - **Recommendation:** Add only official, linkable capability evidence (warehousing, distribution, named brands or the official company profile). Keep the current “availability varies” caveat.
   - **Verification:** Every new claim should have a row in `docs/gjh-v8-facts.md` or a direct official source link.

3. **[Low] External links open a new tab from almost every card.** This preserves the concept page but increases context switching.
   - **Recommendation:** Keep new tabs for official sites if that is the gallery convention, but use action text that makes the destination clear and ensure keyboard focus remains visible.
   - **Verification:** Exercise keyboard activation and confirm `rel="noopener noreferrer"` remains present.

## SEO Specialist

**Status: PASS WITH WARNINGS**

### Strengths

- The page has a unique title, a concise description, one H1 and a coherent H2 hierarchy (`index.html:4–8`, `26`, `34`, `41`, `48`, `53`, `60`, `62`).
- The HTML is static and crawlable without requiring a gallery API or runtime data fetch.
- Image dimensions are declared for the major visual assets, and the hero is a local WebP with a mobile `<source>` (`index.html:26`).
- Navigation and section IDs create stable internal anchors; official external destinations are explicit.

### Findings

1. **[Medium] No canonical URL or social preview image metadata is present.** The document includes `og:title`, `og:description` and `og:type`, but no `link[rel=canonical]`, `og:image`, `og:image:alt` or Twitter card image. Social sharing and duplicate-path canonicalization are therefore incomplete.
   - **Recommendation:** Add canonical and social image metadata only after the public path is known. Use a reviewed V8 thumbnail and label it as a concept preview, not official GJH artwork.
   - **Verification:** Inspect the deployed HTML under the GitHub Pages prefix and verify the canonical URL resolves to the V8 route.

2. **[Medium] The Electronics image alt text mismatches the actual asset.** Search engines and assistive technologies receive “consumer electronics photograph” for a Sony logo tile (`index.html:49`).
   - **Recommendation:** Correct the alt text and visible context to describe the actual tile, or replace it with an accurately sourced photograph.
   - **Verification:** Compare the alt string with the `kind` and `useNote` in `assets/sources.json`.

3. **[Low] No Organization/WebSite structured data is included.** This is acceptable for an independent static concept, but it limits machine-readable identity if the route is ever promoted.
   - **Recommendation:** Add JSON-LD only if the gallery decides to publish organization metadata, and keep the entity explicitly labelled as a concept page rather than implying a GJH-controlled site.
   - **Verification:** Validate JSON-LD against the final public URL and the gallery’s concept disclaimer.

## Release assessment

- **Critical/high issues:** None found in these three reviews.
- **Medium issues:** AI disclosure prominence, Sony asset semantics, generic B2B CTA qualification, missing canonical/social metadata.
- **Low issues:** Proposed palette approval boundary, limited verified B2B proof, absent optional structured data.
- **Decision:** **PASS WITH WARNINGS — owner review candidate.** The page is visually coherent and fact-conscious, but it should not be presented as official GJH artwork or a production corporate site until the medium findings are addressed or explicitly accepted.

## Post-review corrections

The main author corrected the Sony alternative text to “Original Sony brand tile published on GJH’s official website”; it now agrees with the manifest and rendered artwork. The hero’s mobile AI disclosure is 10px, and mobile asset/footer notes are enlarged. Original brand photographs are no longer masked by rounded arch shapes that clipped embedded marks. The visible New Moon description identifies New Zealand abalone, 425g. Final mobile and desktop Lighthouse checks report Accessibility, Best Practices and SEO 100 with zero failing audits; these scores do not imply full manual accessibility or brand approval. Sony semantics is therefore resolved. Photography consistency, B2B intent research, final-public-URL metadata and formal approval remain the documented limitations.
