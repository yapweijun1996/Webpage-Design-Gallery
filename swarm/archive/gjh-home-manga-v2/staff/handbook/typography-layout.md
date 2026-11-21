# Typography and Layout

## Purpose

Use the shared type and spacing scales to make sections easy to read across screen sizes and languages.
Keep headings, content, and media legible when the page reflows.

## Rules

1. Use `var(--sds-font-sans)` and `var(--sds-text-base)` for body copy. Reserve `var(--sds-text-sm)` and `var(--sds-text-xs)` for short secondary labels or metadata. Use `var(--sds-text-lg)` for a lead paragraph.
2. Choose heading levels by document structure. Size them with `var(--sds-text-xl)`, `var(--sds-text-2xl)`, or `var(--sds-text-3xl)` to show hierarchy. Pair `var(--sds-leading-tight)` with headings and `var(--sds-leading-body)` with paragraphs.
3. Use `var(--sds-text-display)` for a leading headline that benefits from display type. The token already uses `clamp(40px, 9vw, 104px)`. Check the longest translation at 393 px and 320 px.
4. Limit long Latin-script prose to about 65 characters per line on wide screens. Use a measure such as `max-inline-size: 65ch` inside `.sds-container`. Let the prose column shrink naturally on phones.
5. Check `en`, `zh-Hans`, and `ms`, and test with copy roughly 40 percent longer than English. Use `.sds-stack` so copy can grow vertically. Keep translatable strings whole and let the SDS Chinese line-breaking rule place wraps.
6. Use the 4 px spacing scale. A typical rhythm uses `var(--sds-space-2)` between related lines, `var(--sds-space-4)` between grouped elements, and `var(--sds-space-8)` between groups. Increase section spacing with `var(--sds-space-12)` or `var(--sds-space-16)` where the layout needs it.
7. Align content to `.sds-container` and its shared `var(--sds-container)` maximum and `var(--sds-gutter)` side spacing. For edge-aligned elements, account for the relevant `var(--sds-safe-left)`, `var(--sds-safe-right)`, `var(--sds-safe-top)`, and `var(--sds-safe-bottom)` insets.
8. Give each screen one dominant image. Use `.sds-chapter__media` for a full-bleed chapter and place supporting images below it or in `.sds-rail`.
9. Reserve image space with intrinsic dimensions or an explicit aspect ratio. For an image in `.sds-card`, choose a consistent crop such as 4:3. Check that the subject survives the crop at both widths. Show plans or diagrams in full when cropping would remove information.

## Do / Don't

**Do** let the display heading wrap. **Don't** apply `white-space: nowrap` to translated headings.

```html
<!-- Do -->
<h1 style="font-size: var(--sds-text-display)" data-i18n="hero.title">Explore event spaces</h1>
<!-- Don't -->
<h1 style="font-size: var(--sds-text-display); white-space: nowrap" data-i18n="hero.title">Explore event spaces</h1>
```

**Do** keep sentences whole. **Don't** force an English line break into translatable text.

```html
<!-- Do -->
<p class="sds-chapter__text" data-i18n="chapter.intro">Explore layouts for your event.</p>
<!-- Don't -->
<p class="sds-chapter__text" data-i18n="chapter.forced-break">Explore layouts<br>for your event.</p>
```

## Patterns

### Display title with readable copy

```html
<section class="sds-container sds-stack" aria-labelledby="hero-title">
  <h1 style="font-size: var(--sds-text-display); line-height: var(--sds-leading-tight)"
      id="hero-title" data-i18n="hero.title">Explore event spaces</h1>
  <p style="font-size: var(--sds-text-lg); line-height: var(--sds-leading-body); max-inline-size: 65ch"
     data-i18n="hero.intro">Compare layouts before you enquire.</p>
</section>
```

### Editorial section with a consistent rhythm

```html
<section class="sds-container" aria-labelledby="heritage-title">
  <div class="sds-stack" style="gap: var(--sds-space-4); padding-block: var(--sds-space-8)">
    <h2 id="heritage-title" style="font-size: var(--sds-text-2xl)" data-i18n="heritage.title">Site history</h2>
    <p style="max-inline-size: 65ch; line-height: var(--sds-leading-body)"
       data-i18n="heritage.intro">Explore the site through its archive.</p>
  </div>
</section>
```

### Full-bleed image with an inset body

Give the image intrinsic dimensions and keep text inside the safe area.

```html
<section class="sds-chapter" aria-labelledby="chapter-title">
  <img class="sds-chapter__media" src="courtyard.jpg" width="1600" height="900" alt="">
  <div class="sds-chapter__scrim" aria-hidden="true"></div>
  <div class="sds-chapter__body"
       style="padding-left: max(var(--sds-gutter), var(--sds-safe-left)); padding-right: max(var(--sds-gutter), var(--sds-safe-right))">
    <h2 class="sds-chapter__title" id="chapter-title" data-i18n="chapter.title">Courtyard layout</h2>
  </div>
</section>
```

## Self-check

1. Do headings follow document order, with type sizes and line heights drawn from SDS tokens?
2. Is long prose readable on wide screens and able to reflow at 393 px and 320 px?
3. Do CJK copy and a 40 percent longer string wrap without clipping or forced breaks?
4. Does spacing follow the 4 px scale, and do the gutters and safe insets keep content clear of the edges?
5. Does each screen have one dominant image, with dimensions reserved and crops checked?

## Tools

- Run `node swarm/tools/check-sections.js <projectDir> --ssot` for token sync, raw type sizes, and spacing warnings.
- Run `node swarm/tools/i18n-extract.js <projectDir> --check` for translation keys. Inspect wrapping with actual text in each language.
- Run `node swarm/tools/export-page.js <projectDir>` and inspect `/p/dist/index.html` with Chrome DevTools when available. Check widths, text expansion, insets, and image crops. Otherwise review the markup and record browser checks as pending.

## Sources

- Web Content Accessibility Guidelines (WCAG) 2.2
- CSS Text Module Level 3
- CSS Values and Units Module Level 4
