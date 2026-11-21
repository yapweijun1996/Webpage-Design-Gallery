---
name: "components-engineering"
description: "Use this skill to build accessible sections by composing the shared SDS components. Keep fragments independent so they survive replacement in the live preview."
version: "1.0.0"
roles: ["component-engineer","quality-gate-engineer","nav-chrome-designer","brand-chapter-designer","directory-designer","enquiry-ux-designer"]
enabled: true
tags: []
---

# Component Engineering

<!-- Keep SDS base rules out of section styles, including section-scoped base selectors. -->

## Purpose

Build accessible sections by composing the shared SDS components.\
Keep fragments independent so they survive replacement in the live preview.

## Rules

1. Compose `.sds-container`, `.sds-stack`, and `.sds-cluster` with components such as `.sds-card` and `.sds-btn`. Put section-specific layout on the wrapper.
2. Use the documented BEM-style class names. Keep the block class on the component, pair `.sds-btn` with modifiers such as `.sds-btn--primary`, and use elements such as `.sds-nav__links` and `.sds-rail__item` inside their blocks.
3. Scope every section CSS selector to that section's `.s-NN`. Leave base styles and states in `components.css`. Keep local styles on section-owned wrappers and check `unscoped-selector` and `redefine-sds-base`.
4. Preserve native semantics. Use buttons for actions, anchors with destinations for navigation, and `.sds-radio-chip` with a native radio and associated label. Keep the `--sds-color-focus` ring visible and preserve disabled behavior.
5. Use `<details class="sds-disclosure">` with a first-child `<summary>` for an FAQ. Use the `.sds-nav__menu` details/summary pattern for a collapsed navigation list.
6. Tab to each summary, toggle it with Enter and Space, then tab through its visible controls in document order. Check that a closed disclosure keeps its hidden controls out of the tab order.
7. Make `.sds-rail` keyboard-focusable and give it a descriptive accessible name. Verify that the rail can scroll from the keyboard, items snap, and focus moves out with Tab and Shift+Tab.
8. Keep fragments script-free. Leave the page shell, global state, and event handling to shared SDS code. Keep IDs unique in the combined page and keep label and fragment references resolvable after replacement.
9. Reinsert a fragment after choosing another language and verify that late-added `data-i18n` nodes translate. Use `data-reveal` for opt-in reveal and verify the visible fallback after replacement.

## Do / Don't

Pair the base and modifier classes. Avoid using a modifier alone.

```html
<!-- Do -->
<button class="sds-btn sds-btn--primary" type="submit" data-i18n="enquiry.send">Send enquiry</button>
<!-- Don't -->
<button class="sds-btn--primary" type="submit" data-i18n="enquiry.send">Send enquiry</button>
```

Put section layout around a component. Avoid styling the shared base in a fragment.

```html
<!-- Do -->
<div class="sds-cluster">
  <a class="sds-btn" href="#directory" data-i18n="nav.directory">Find a location</a>
</div>
<!-- Don't -->
<style>.sds-btn { margin: var(--sds-space-4); }</style>
```

## Patterns

### Disclosure with a localized summary

```html
<details class="sds-disclosure">
  <summary data-i18n="enquiry.faq.hours">What are your opening hours?</summary>
  <p data-i18n="enquiry.faq.hours-answer">Check the directory for location hours.</p>
</details>
```

### Collapsed navigation links

Keep navigation links in the native disclosure's tab order when it is open.

```html
<nav class="sds-nav" aria-label="Main navigation" data-i18n-attr="aria-label:nav.main">
  <details class="sds-nav__menu">
    <summary data-i18n="nav.menu">Menu</summary>
    <a href="#directory" data-i18n="nav.directory">Find a location</a>
  </details>
</nav>
```

### Keyboard-focusable rail

```html
<div class="sds-rail" role="region" tabindex="0"
     aria-label="Locations" data-i18n-attr="aria-label:directory.rail">
  <article class="sds-rail__item sds-card">
    <h2 data-i18n="directory.central.title">Central location</h2>
  </article>
</div>
```

### Fragment with declarative hooks

Replace the placeholder scope with the numbered section's class. Preserve the root ID when replacing the section.

```html
<section class="s-NN" id="heritage">
  <div class="sds-container sds-stack" data-reveal="fade">
    <h2 data-i18n="heritage.title">Our heritage</h2>
  </div>
</section>
```

## Self-check

1. Are all component blocks, elements, and modifiers documented SDS names?
2. Are all local selectors scoped to the section while shared component rules remain centralized?
3. Can a keyboard user operate summaries and scroll and leave the rail?
4. Does the fragment stay functional when replaced without reinserting the shell?
5. Do keyboard focus and localization still work in the replaced fragment?

## Tools

- Run `node swarm/tools/check-sections.js "$projectDir" --baseline` for CSS scope, base redefinition, and related section findings.
- Run `node swarm/tools/i18n-extract.js "$projectDir" --check` for fragment copy and attribute coverage.
- Run `node --test swarm/test/*.test.js` to exercise shared components and runtime contracts.
- Use Chrome DevTools at `/p/dist/index.html` to use the keyboard and inspect semantics. Also replace a fragment in the live preview to test hot-swap. Record unavailable browser checks as UNVERIFIED.

## Sources

- WCAG 2.2
- HTML Living Standard
- WAI-ARIA Authoring Practices Guide
