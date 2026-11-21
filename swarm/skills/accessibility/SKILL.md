---
name: "accessibility"
description: "Use this skill to make each section understandable and operable with a keyboard and assistive technology. Check structure, focus, text alternatives, target size, motion, and reflow in the assembled page."
version: "1.0.0"
roles: ["component-engineer","runtime-engineer","localization-engineer","standards-lead","nav-chrome-designer","hero-designer","directory-designer","heritage-storyteller","enquiry-ux-designer","footer-compliance-designer","accessibility-reviewer"]
enabled: true
tags: []
---

# Accessibility

## Purpose

Make each section understandable and operable with a keyboard and assistive technology.
Check structure, focus, text alternatives, target size, motion, and reflow in the assembled page.

## Rules

1. Use native landmarks in their intended page positions. Keep one page `main`, one page header, and one `.sds-footer` as the page footer. Use `.sds-nav` on a `nav` and give each navigation landmark a distinct accessible name if several exist. This supports WCAG 2.2 SC 1.3.1.
2. Use one page `h1` and nest subsequent headings by section depth. Use `var(--sds-text-2xl)` or another SDS type token when the visual size needs to differ from the heading level. Verify `html[lang]` follows the selected language (SC 3.1.1).
3. Keep focus order aligned with reading order (SC 2.4.3). Use native links and buttons, keep positive `tabindex` values out, and check the `var(--sds-color-focus)` ring on `.sds-btn` and other controls (SC 2.4.7). Tab in both directions and check that `.sds-nav` and `.sds-actionbar` leave the focused control visible.
4. Use `.sds-field` with a visible `label` bound to its input. Connect help and error text using `aria-describedby`. Apply `aria-invalid="true"` when validation fails. Use `.sds-visually-hidden` for supplemental text that must remain available to assistive technology.
5. Give informative `.sds-chapter__media` images concise alt text that describes what matters in context. Use `alt=""` for decorative images and images whose information is already conveyed by nearby text. For an image-only control, give its accessible name the action or destination. Localize meaningful alt text (SC 1.1.1).
6. Use native `details` and `summary` with `.sds-disclosure` for FAQs and `.sds-nav__menu` for a collapsed menu. Verify that Enter and Space toggle the summary and closed content stays out of the tab order (SC 2.1.1).
7. Make `.sds-rail` focusable with `tabindex="0"` and provide an accessible name. Tab to it, scroll with the keyboard, then reach the links in each `.sds-rail__item` and tab out. Check focus and scrolling with no pointer (SC 2.1.1).
8. Use `data-reveal` when a reveal is needed and rely on SDS motion tokens such as `var(--sds-dur-reveal)`. With `prefers-reduced-motion: reduce`, verify content stays visible and the reveal stops moving.
9. Use `var(--sds-tap)` (44 px) for the minimum width and height of SDS controls. Check adjacent controls individually, including `.sds-nav__menu` summaries. WCAG 2.2 SC 2.5.8 has a 24 by 24 CSS px minimum with exceptions.
10. Check reflow at 320 CSS px with `.sds-container` (SC 1.4.10). Keep intentional horizontal scrolling within `.sds-rail` and ensure each item fits within its visible width. The owner's PWA shell zoom lock is a trade-off that fails WCAG 2.2 SC 1.4.4.

## Do / Don't

**Do** describe the image's relevant information. **Don't** use a generic label for an informative image.

```html
<!-- Do -->
<img class="sds-chapter__media" src="entrance.jpg" alt="Ramp beside the courtyard steps"
     data-i18n-attr="alt:chapter.entrance-alt">
<!-- Don't -->
<img class="sds-chapter__media" src="entrance.jpg" alt="Photo"
     data-i18n-attr="alt:chapter.generic-alt">
```

**Do** use a native button for a control. **Don't** give a generic element button styling and expect keyboard activation.

```html
<!-- Do -->
<button class="sds-btn sds-btn--primary" type="submit" data-i18n="enquiry.send">Send enquiry</button>
<!-- Don't -->
<div class="sds-btn sds-btn--primary" data-i18n="enquiry.send">Send enquiry</div>
```

## Patterns

### Navigation with native disclosure

```html
<nav class="sds-nav" aria-label="Main navigation" data-i18n-attr="aria-label:nav.label">
  <details class="sds-nav__menu">
    <summary data-i18n="nav.menu">Menu</summary>
    <a href="#directory" data-i18n="nav.directory">Venue directory</a>
  </details>
</nav>
```

### FAQ disclosure

```html
<details class="sds-disclosure">
  <summary data-i18n="faq.question">How do I ask about a layout?</summary>
  <p data-i18n="faq.answer">Include the layout name in your enquiry.</p>
</details>
```

### Focusable rail

```html
<section class="sds-container sds-stack" aria-labelledby="rail-title">
  <h2 id="rail-title" data-i18n="directory.title">Venue layouts</h2>
  <ul class="sds-rail" tabindex="0" aria-labelledby="rail-title">
    <li class="sds-rail__item sds-card">
      <a href="courtyard.html" data-i18n="directory.courtyard">Courtyard layout</a>
    </li>
  </ul>
</section>
```

### Invalid field with a linked error

```html
<div class="sds-field">
  <label for="email" data-i18n="enquiry.email">Email address</label>
  <input id="email" name="email" type="email" autocomplete="email" required
         aria-describedby="email-error" aria-invalid="true">
  <p id="email-error" data-i18n="enquiry.email-error">Enter an email address with a domain.</p>
</div>
```

## Self-check

1. Do landmarks, headings, and the document language identify the page structure correctly?
2. Do all controls have accessible names, required error text, and visible focus in reading order?
3. Do informative and decorative images have the appropriate alt and localization treatment?
4. Can I open and close disclosures, navigate rails, and leave them using only the keyboard?
5. Did I verify 44 px targets, reflow at 320 CSS px, and visible content under reduced motion?

## Tools

- Run `node swarm/tools/check-sections.js <projectDir> --ssot` to check alt presence and section rules. Review whether each alt is appropriate.
- Run `node swarm/tools/i18n-extract.js <projectDir> --check` for translated labels and alternatives.
- Run `node swarm/tools/export-page.js <projectDir>` to check the assembled page. At `/p/dist/index.html`, use Chrome DevTools if available to inspect accessibility, reflow, and reduced motion. Exercise the keyboard flow in the preview. If browser inspection is unavailable, audit the markup and record interactive checks as pending.

## Sources

- Web Content Accessibility Guidelines (WCAG) 2.2
- WAI-ARIA Authoring Practices Guide
- HTML Living Standard
