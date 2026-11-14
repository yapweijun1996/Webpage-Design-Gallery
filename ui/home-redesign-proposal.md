# Homepage redesign proposal

## Direction

Give the gallery the feel of a small independent design journal: warm paper (`#F4F0E8`), dark ink (`#25231F`), quiet stone rules, and burnt orange (`#A65030`) reserved for links and small accents. Pair a restrained serif headline with a clean sans-serif for navigation, controls, and supporting copy.

## Homepage composition

- Keep the existing compact brand and navigation at the top, with a fine rule and a centered, readable content width.
- Lead with a small uppercase editorial label, the serif headline “One company. Many creative directions.” and one short explanatory line.
- Make Goh Joo Hin the featured editorial card. Give its website preview a generous image area; place the company name, “Corporate · Singapore” metadata, and a concise description beside it on desktop. Treat the card as a company link and keep “Explore designs” as a clear secondary cue.
- Show the real inventory plainly: **1 company** and **8 design concepts**. Keep the search and category controls directly below the featured card; keep “A growing collection, one company at a time.” as the empty-space note. Do not imply more companies or designs exist.
- Close with a quiet footer: a short gallery statement, the unofficial-concepts disclaimer, an “All companies” link, and the existing offline-installation help.

## Responsive behavior

At narrow widths, let the header links wrap cleanly, stack the featured preview above its text, and keep the full company card easy to tap. Put search and category controls on separate full-width rows beneath the card. Stack footer content with comfortable spacing and preserve readable line lengths. Keep the company card and “Explore designs” link keyboard accessible with visible focus states.

## Implementation recommendations

1. Reuse the current company, design-count, search, category, and footer behavior; change presentation and hierarchy only.
2. Introduce a small set of color and spacing tokens, then apply them consistently to the page background, card, rules, fields, and links.
3. Use a reliable system serif stack for the headline and the existing sans-serif stack for interface text. Keep burnt orange to interactive accents so the real company preview stays prominent.
4. Keep the company count and design count tied to the actual collection data, including the singular “company” label.
