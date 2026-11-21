---
name: "motion-loader"
description: "Use this skill to give page sections a shared vocabulary for reveal, press, focus, and page-load feedback. Keep content readable and in place while motion or loading feedback runs."
version: "1.0.0"
roles: ["component-engineer","runtime-engineer","pwa-engineer","hero-designer","concept-showcase-designer","motion-performance-reviewer"]
enabled: true
tags: []
---

# Motion and Loader

<!-- Keep the unsupported reveal path visible before JavaScript or observation runs. -->

## Purpose

Give page sections a shared vocabulary for reveal, press, focus, and page-load feedback.\
Keep content readable and in place while motion or loading feedback runs.

## Rules

1. Animate only `transform` and `opacity`. Inspect keyframes and transition property lists for layout, paint, and `all` transitions.
2. Choose `--sds-dur-fast` for press feedback, `--sds-dur-base` or `--sds-dur-slow` for page-load feedback, and `--sds-dur-reveal` for reveal. The maximum authored motion duration is 600 ms.
3. Use `--sds-ease-standard` for routine feedback, `--sds-ease-emphasized` for entry, and `--sds-ease-exit` for exit. Keep keyboard focus visible immediately with `--sds-color-focus`, even during a press transition.
4. Opt in with `data-reveal="fade"`, `data-reveal="rise"`, or `data-reveal="scale"`. Use `data-reveal-delay="1|2|3|4"` only for an intentional stagger. Keep first-screen content and controls immediately available.
5. The shared CSS gates `animation-timeline: view()` with `@supports (animation-timeline: view())`. Keep the fallback fully visible even before `SDS.reveal.init()` adds `data-revealed` through IntersectionObserver.
6. Test `prefers-reduced-motion: reduce`. The shared duration tokens resolve to `0.01ms` and `SDS.reveal.init()` skips observation. Verify that content stays visible and that reveal, press effects, and decorative loading motion are suppressed.
7. Use `.sds-skeleton` for content with a known shape, `.sds-spinner` for a compact indeterminate wait, and `.sds-progress` for measured progress. Derive determinate values from the operation.
8. Keep first-paint feedback in the shell as a CSS-only `.sds-skeleton` or `.sds-spinner`. `SDS.loader.show()` and `SDS.loader.hide()` toggle `data-loading` on `<html>`. The runtime hides it after first paint and above-the-fold fonts and images are ready, or after 2500 ms, whichever comes first.
9. Reserve the final content footprint while the loader is visible. Check geometry before and after `SDS.loader.hide()` and avoid adding a minimum display time.

## Do / Don't

Use a shared reveal preset on a supporting card. Avoid an inline hidden starting state.

```html
<!-- Do -->
<article class="sds-card" data-reveal="rise">
  <h2 data-i18n="heritage.title">Our heritage</h2>
</article>
<!-- Don't -->
<article class="sds-card" style="opacity: 0">
  <h2 data-i18n="heritage.title">Our heritage</h2>
</article>
```

Use an explicit property list and token timing. Avoid transitioning every property.

```css
/* Do */
transition: transform var(--sds-dur-fast) var(--sds-ease-standard);
/* Don't */
transition: all var(--sds-dur-fast) var(--sds-ease-standard);
```

## Patterns

### Reveal supporting content

```html
<article class="sds-card" data-reveal="fade">
  <h2 data-i18n="heritage.title">Our heritage</h2>
</article>
```

### Reserve space for a pending image

Give the placeholder and the loaded content the same footprint inside the card.

```html
<div class="sds-card" aria-busy="true">
  <div class="sds-skeleton" aria-hidden="true"
       style="aspect-ratio: 16 / 9"></div>
</div>
```

### Announce measured progress

Use a measured value and a localized accessible name.

```html
<progress class="sds-progress" value="3" max="5"
          aria-label="Upload progress"
          data-i18n-attr="aria-label:enquiry.upload-progress"></progress>
```

## Self-check

1. Do all animations and transitions affect only `transform` and `opacity`?
2. Are authored durations at most 600 ms, with duration and easing taken from SDS tokens?
3. Does reveal content stay readable without timeline support and under reduced motion?
4. Does the indicator match the operation's loading state and available progress data?
5. Does first-paint feedback clear by the runtime cutoff without moving content?

## Tools

- Run `node swarm/tools/check-sections.js "$projectDir" --baseline` to check section motion literals against the ratchet.
- Run `node --test swarm/test/*.test.js` to exercise shared token, component, and runtime behavior.
- Inspect `/p/dist/index.html` with Chrome DevTools when available. Exercise reduced motion, scroll reveal, and a throttled first load. Record browser checks as UNVERIFIED if no browser is available.

## Sources

- WCAG 2.2
- Material Design motion guidance
- Apple Human Interface Guidelines
