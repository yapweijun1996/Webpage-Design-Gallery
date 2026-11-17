# Thow Kwang Pottery Jungle: visitor study

These fifteen independent concepts explore a single question from different perspectives: how can someone understand the kiln and choose an appropriate visit? They are not booking pages, official programmes or a catalogue of pieces for sale.

## Research and editorial decisions

| Subject | Evidence | Decision in the demos |
| --- | --- | --- |
| Operator and site | [Official contact and directions](https://thowkwang.com.sg/contact-us/) identifies Thow Kwang Industry Pte Ltd and 85 Lorong Tawas, Singapore 639823. | Use the legal name for metadata and the public name for the visitor brand. Link current directions and access enquiries to the operator. |
| Kiln and family | [Official tour information](https://www.potteryjungle.com/dragonkiln-tour) gives 1940 for the kiln and 1965 for the family takeover. [The family's account](https://www.potteryjungle.com/our-story) supplies its business history, craft and education programmes. | Attribute the construction date to the operator; distinguish the kiln's age from the family's business history. |
| Craft practice | The [operator's kiln account](https://thowkwang.com.sg/oldest-dragon-kiln-in-sinapore/) describes a brick wood-fired kiln, the production of domestic wares, ash and glaze interaction, and its present cultural role. The National Heritage Board's [Roots inventory](https://www.roots.gov.sg/ich-landing/ich/making-of-wood-fired-pottery) describes uphill airflow and the chimney at the tail; the [Singapore Chinese Cultural Centre programme booklet (PDF)](https://cdnce.singaporeccc.org.sg/sccc-ce-archival2021/uploads/SODK-Programme-Booklet.pdf) identifies the firebox, main chamber and chimney. | A single sloping firing chamber links the lower firebox and upper chimney in an original interpretive section. Vessel count, brickwork and dimensions are illustrative. |
| Formal recognition | The [family's account](https://www.potteryjungle.com/our-story) identifies its 2020 Stewards of Singapore's Intangible Cultural Heritage Award. The [NHB release (PDF)](https://www.nhb.gov.sg/-/media/nhb/files/media/releases/new-releases/media-release--six-practitioners-recognised-in-nhbs-the-stewards-of-singapores-ich-award.pdf) and [NHB recipient profile](https://www.nhb.gov.sg/what-we-do/our-work/sector-development/the-stewards-of-intangible-cultural-heritage-award/2020-recipients) provide independent heritage references. | Describe the specific award, without implying endorsement of these concepts. |
| Independent and group visits | The [official tour page](https://www.potteryjungle.com/dragonkiln-tour) lists self-guided visits and a minimum group of 15 for guided heritage tours. | Do not apply this threshold to public workshops. Do not imply that the kiln is firing or that all areas are accessible on a particular day. |
| Public and private classes | [Public workshop listings](https://www.potteryjungle.com/pottery-workshop) include wheel and hand-building activities. The [private workshops page](https://www.potteryjungle.com/private-workshops) describes school, family and corporate groups. | Separate public availability from private enquiries. Prices, session times, event dates, access arrangements and bookings remain with the operator. |

Official operator pages checked 17 November 2026. The observation prompts, self-guided itinerary, silhouettes and educational worksheet are original concept material, not official activities. The six generative photo illustrations show generic pottery, fire, clay work and light; none claims to document this company, its site or its products. The local Instrument Serif and Manrope assets include their Open Font License notices.

The [landing design notes](../../../docs/thow-kwang-landing-improvements.md) record the individual first-screen decisions and how to exercise each new feature.

## Pages and primary tasks

| Version | Concept | Main task |
| --- | --- | --- |
| 1 | Inside the Dragon Kiln | Select three labelled parts of a kiln and choose a visitor pathway. |
| 2 | Plan Your Visit | Match party size to the appropriate route and find directions. |
| 3 | The Clay Studio | Compare wheel, hand-building and private class options. |
| 4 | Teachers' Field Notes | Plan a learning journey and mark the preparation checklist. |
| 5 | At the Potter's Wheel | Open each step in a wheel-forming sequence. |
| 6 | Wood & Ember | Follow a firing essay and find the official update channel. |
| 7 | Glaze Library | Identify clay, glaze and ash in a material sample index. |
| 8 | A Family Visit | Choose among three observation games and plan a family visit. |
| 9 | In Good Company | Prepare a group enquiry and compare private workshops with heritage tours. |
| 10 | The Heritage Journal | Follow a three-date chronology with links to heritage evidence. |
| 11 | Kiln Lexicon | Search eight entries by term or definition; browse all without script. |
| 12 | The Vessel Cabinet | Select a silhouette and compare the object-reading notes. |
| 13 | Field Sketchbook | Download a printable, scalable observation sheet. |
| 14 | A Slow Afternoon | Try a self-paced, three-stop itinerary with official practical links. |
| 15 | The Visitor Desk | Find one of six official destinations by task. |

The inspected HTML for each version is the source. Shared presentation and progressive enhancements live in `shared/`; common media and typefaces live in `v1/assets/`. The gallery generator owns the support files for install/offline mode. Keep relative paths working underneath a hosting subpath. Page-specific metadata and actual viewport previews remain with the version.

From the repository root, run `python demos/heritage/thow-kwang/browser_checks.py` after the normal gallery build (Python Playwright and Chrome required). Add `--capture` to refresh the 45 PNG previews and their 15 desktop-derived WebP thumbnails (Pillow required).
