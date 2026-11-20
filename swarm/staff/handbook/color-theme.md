# Colour and Theme

## Purpose

Use SDS semantic colours so a section follows the selected theme and brand.
Verify that text, controls, status indicators, and image overlays remain readable in every mode.

## Rules

1. Choose colours by role. Pair `var(--sds-color-text)` with `var(--sds-color-bg)`, `var(--sds-color-surface)`, or `var(--sds-color-surface-2)`. Pair `var(--sds-color-text-muted)` with the page background or `var(--sds-color-surface)`.
2. Use `.sds-btn--primary` for the main action. `var(--sds-color-on-action)` must retain a contrast ratio of at least 4.5:1 on `var(--sds-color-action)`, `var(--sds-color-action-hover)`, and `var(--sds-color-action-active)`.
3. Leave `data-theme` and `data-brand` to the shell and runtime. Check `light` and `dark` with no brand, `forest-gold`, and `gjh-classic`. In `auto`, check that `var(--sds-color-bg)` matches the corresponding explicit mode under each system setting.
4. Require at least 4.5:1 for normal text and 3:1 for large text. Large text is at least 24 CSS px regular or about 18.67 CSS px bold. SDS text, action, and status pairs, such as `var(--sds-color-info)` on `var(--sds-color-info-bg)`, use a 4.5:1 minimum at all sizes.
5. Require at least 3:1 against adjacent colours for visual cues needed to identify controls, states, and meaningful graphics. Verify `var(--sds-color-focus)` against the page background and surface, and `var(--sds-color-border-strong)` against the page background. Measure additional pairings in context.
6. Place `.sds-chapter__scrim` over image-backed content using `var(--sds-color-scrim)` or `var(--sds-color-scrim-strong)`. Check contrast at the weakest point behind the text or control at each crop. If needed, use a solid `var(--sds-color-surface-inverse)` panel with `var(--sds-color-text-inverse)`.
7. Pair status text and background roles, such as `var(--sds-color-danger)` and `var(--sds-color-danger-bg)`. Make the status explicit in text and keep links identifiable with an underline or another visible cue.
8. If existing roles cannot describe a use, ask the token engineer for a new semantic role. Cite the closest role, such as `var(--sds-color-accent)`, plus the use, adjacent colours, affected states, and contrast needs for both themes and all brands. Use approved roles while the change to `tokens.json` and its contrast checks is reviewed.

## Do / Don't

**Do** put body text on a supported surface. **Don't** substitute the accent role for body text.

```html
<!-- Do -->
<p style="color: var(--sds-color-text); background-color: var(--sds-color-surface)"
   data-i18n="directory.intro">Browse venue layouts.</p>
<!-- Don't -->
<p style="color: var(--sds-color-accent); background-color: var(--sds-color-surface)"
   data-i18n="directory.intro">Browse venue layouts.</p>
```

**Do** say what a status means. **Don't** rely on a coloured badge alone.

```html
<!-- Do -->
<span class="sds-badge" style="color: var(--sds-color-warning); background-color: var(--sds-color-warning-bg)"
      data-i18n="directory.status">Availability unconfirmed</span>
<!-- Don't -->
<span class="sds-badge" style="background-color: var(--sds-color-warning-bg)"></span>
```

## Patterns

### Primary and secondary actions

```html
<div class="sds-cluster">
  <a class="sds-btn sds-btn--primary" href="#enquiry" data-i18n="hero.enquire">Ask about a space</a>
  <a class="sds-btn sds-btn--secondary" href="#directory" data-i18n="hero.browse">Browse layouts</a>
</div>
```

### Error with a next step

Use this alert for a failed send when the form can be retried.

```html
<div class="sds-card" role="alert"
     style="color: var(--sds-color-danger); background-color: var(--sds-color-danger-bg)">
  <p data-i18n="enquiry.error">The enquiry could not be sent. Try again.</p>
</div>
```

### Chapter with a solid caption panel

```html
<section class="sds-chapter" aria-labelledby="color-chapter-title">
  <img class="sds-chapter__media" src="lobby-concept.jpg" alt="">
  <div class="sds-chapter__scrim" style="background: var(--sds-color-scrim-strong)" aria-hidden="true"></div>
  <div class="sds-chapter__body">
    <div class="sds-card" style="background: var(--sds-color-surface-inverse)">
      <h2 class="sds-chapter__title" id="color-chapter-title" style="color: var(--sds-color-text-inverse)"
          data-i18n="chapter.title">Lobby layout concept</h2>
      <p class="sds-chapter__caption" style="color: var(--sds-color-text-inverse)"
         data-i18n="chapter.caption">AI-generated concept image</p>
    </div>
  </div>
</section>
```

## Self-check

1. Does each colour use an approved semantic role with the intended adjacent colour?
2. Did I check light and dark with both brands and without a brand, and auto with both system settings?
3. Do text, control boundaries, states, and focus indicators meet their contrast targets?
4. Does image-backed content pass at its weakest contrast across viewport crops?
5. Can a visitor understand every status and identify links from cues besides colour?

## Tools

- Run `node swarm/design-system/build.js --check` to verify generated tokens and themes, and `node swarm/tools/check-sections.js <projectDir> --ssot` to catch raw colours and token drift.
- Run `node --test swarm/test/*.test.js` for the SDS contrast tests. Use `node swarm/tools/contrast.js <fg> <bg>` on resolved hex pairs when checking additional combinations.
- Inspect `/p/dist/index.html` with Chrome DevTools when available to review combinations, states, and image crops. Otherwise review token pairings and record rendered contrast as pending.

## Sources

- Web Content Accessibility Guidelines (WCAG) 2.2
- Material Design 3
- Apple Human Interface Guidelines
