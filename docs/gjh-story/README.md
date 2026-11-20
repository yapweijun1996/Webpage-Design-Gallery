# GJH story research and manga source of truth

Research run on 20 November 2026 (Singapore) for the [GJH Story Manga](../../demos/corporate/gjh/v25/index.html) concept. Five parallel research passes read the existing [company profile](../../demos/corporate/gjh/research/company-profile.md) and the [brand register](../gjh-multibrand-directory.md), then extended them with live sources. Every claim carries an evidence label.

| Label | Meaning |
| --- | --- |
| CONFIRMED | An official source, or two independent sources, support the claim as phrased. An attributed company milestone confirms what the company says. |
| REPORTED | One non-official source supports it. |
| UNVERIFIED | The sources leave it open. Do not dramatise it. |

## Research files

| File | Scope |
| --- | --- |
| [01-origins.md](01-origins.md) | Rochor Road provision store, the two founding accounts, family succession, 1993 incorporation, Singapore shop context |
| [02-house-brands.md](02-house-brands.md) | New Moon (1959), MILI (1981), GOGO, Flying Wheel, Borsch Med, trademark records |
| [03-diversification.md](03-diversification.md) | Borsch Med (2004) and the electronics timeline, with each partner's real role |
| [04-regional-operations.md](04-regional-operations.md) | 1982 export milestone, markets, warehousing, Gul Avenue and Senai, 17-market trademark claim, sales channels |
| [05-community-heritage.md](05-community-heritage.md) | New Moon Big Walk 2010, awards, SG60 feature, leadership |

## Story spine used by the manga

| Chapter | Beat | Evidence | Key caveat |
| --- | --- | --- | --- |
| 1 · 1940s | Goh brothers' provision store on Rochor Road | CONFIRMED (GJH's account) | A 2024 *Lianhe Zaobao* interview says the chairman's father took over an existing shop and added the family surname. The two accounts are not reconciled. GJH also prints "Since 1940". |
| 2 · 1959 | New Moon, abalone first | CONFIRMED (brand history; IPOS T5924841J filed 23 Apr 1959, registered 8 Mar 1960) | GJH's own SG60 feature places New Moon's entry into its portfolio in the mid-1980s, and a sponsored interview reports a 1980s acquisition. 1959 is the brand's date. |
| 3 · 1981 | MILI, second house brand | CONFIRMED (timeline; IPOS T8101608Z filed 9 Apr 1981) | Do not show a founding scene. |
| 4 · 1982 | Export milestone | CONFIRMED as GJH's timeline | GOGO's page says 1986 and Flying Wheel's says 2004. First shipment date, route and buyer are unknown. The 17 markets are a trademark claim, not 17 export routes. |
| 5 · 2004+ | Borsch Med, then electronics partners | CONFIRMED (timeline) | Borsch Med Pte. Ltd. was incorporated 10 Aug 2000. 2004 is the brand registration. Partner roles differ: distributor, direct seller or retailer. |
| 6 · Today | Gul Avenue and Senai offices; 2010 Big Walk | CONFIRMED | The Big Walk drew about 5,000 walkers and rice valued at S$85,000. The S$200,000 seniors fund is a separate item. |

## Rules for any future story or comic work

1. Credit the source in narration or the fact drawer, never in a character's mouth.
2. Invent no named real person, quote, handshake, signing or private motive. The "Do not dramatise" lists in each file are binding.
3. Label dialogue and scenes as dramatised. Anonymous characters only.
4. Keep brand years separate from GJH's own dates, and keep partner roles as the sources state them.
5. Generated illustrations must avoid anachronisms (the first draft of chapter 3 showed Marina Bay Sands in the 1980s and was redrawn).

## Open questions

- Which founding account is complete: Goh brothers' store, or the takeover of the shop called Yu Xing?
- When did New Moon join GJH's portfolio, and who owned it earlier?
- The first export shipment: date, destination, buyer.
- Which legal entity occupies the Senai office.

## v25 implementation notes

- Source: `demos/corporate/gjh/v25/` (`index.html`, `style.css`, `script.js`, `i18n.js`, six AI-generated panels). Generated: `assets/theme.css`, manifest, `sw.js`.
- Dialogue and sound effects play by themselves while a chapter is at least 55% in view, one line every 1.1 seconds, and pause when it leaves. Reduced-motion users and `?lines=all` get every line at once. There is no tap-to-reveal control.
- Languages: English is the HTML source. `i18n.js` holds Mandarin (zh-Hans) and Malay (ms) by element id. Choose with the EN / 中文 / BM switch, `?lang=zh|ms|en`, or the browser language. The choice is remembered in `localStorage` when available.
- The chapter rail previously called `scrollIntoView` on every highlight change, which pulled the page backwards while scrolling. It now moves only the rail's own `scrollLeft`.
- The rail is six equal full-width cells. Below 640 px it drops the sub-labels and puts the language switch on its own row.
- Chapter 3 was redrawn because the first image showed Marina Bay Sands in a 1980s scene.
- Verified in the in-app browser (desktop and 460 px), plus gallery build and check, design-system check, SSOT check and the gallery and design-system unit tests. Playwright browser suites were not run because Playwright is not installed here. The `test_lighting_score` and `test_mall_probes` modules need Pillow and NumPy and also fail to import for that reason.
