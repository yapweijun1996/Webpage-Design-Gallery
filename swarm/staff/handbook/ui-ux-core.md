# UI/UX Core
<!-- Treat one idea per viewport as one primary purpose. Let content grow as it wraps. -->

## Purpose

Give each viewport one clear job and make the next action easy to find.
Design the section at 393 px first, then check smaller screens and wider layouts.

## Rules

1. Lead with the visitor's task. Use `.sds-stack` to order the heading, supporting detail, and action. Reserve the page's single `h1` for the hero when it owns the page title.
2. Give each viewport one primary purpose and at most one `.sds-btn--primary` for that purpose. Keep proof close to the claim. Move competing messages into the next section.
3. At 393 px, put the heading and action in reading order within `.sds-container`. Let the layout wrap and confirm it still fits at 320 px without horizontal page scrolling.
4. Make controls at least `var(--sds-tap)` (44 px) in both dimensions. Keep frequently used actions within comfortable one-handed reach. For a persistent mobile action, use `.sds-actionbar` and check that it clears content and the bottom safe area.
5. Use `.sds-btn` for buttons and styled links. Check hover, active, visible focus, and disabled states as applicable. Use `aria-busy="true"` for an in-progress button and give it a label that names the activity.
6. Show a size-matched `.sds-skeleton` while data loads and expose a text status to assistive technology. Give empty results an explanation and a next step. For recoverable errors, keep context and offer a `.sds-btn--secondary` retry where that operation exists.
7. Use `.sds-field` with a visible label for every enquiry input. Describe invalid values in text linked with `aria-describedby` and preserve answers through validation. Use `.sds-radio-chip` for native radio choices.
8. Verify claims, names, prices, and contact details against approved material. Label samples and AI-generated imagery in visible copy, such as `.sds-chapter__caption`. Localize headings, labels, and status text with `data-i18n`.
9. Put the page promise in the hero, verified evidence in proof, one story in each `.sds-chapter`, related items in a focusable `.sds-rail`, and the enquiry path before `.sds-footer`. Give the footer approved contact or policy links.

## Do / Don't

**Do** name the outcome of the main action. **Don't** make visitors infer it from a generic label.

```html
<!-- Do -->
<a class="sds-btn sds-btn--primary" href="#enquiry" data-i18n="hero.enquire">Ask about a space</a>
<!-- Don't -->
<a class="sds-btn sds-btn--primary" href="#enquiry" data-i18n="hero.more">Click here</a>
```

**Do** label AI-generated imagery next to the image. **Don't** present it as a verified photograph.

```html
<!-- Do -->
<p class="sds-chapter__caption" data-i18n="chapter.caption">AI-generated concept image</p>
<!-- Don't -->
<p class="sds-chapter__caption" data-i18n="chapter.mislabel">Photograph of the finished lobby</p>
```

## Patterns

### Hero and next action

```html
<section class="sds-container sds-stack" aria-labelledby="hero-title">
  <h1 id="hero-title" data-i18n="hero.title">Explore event spaces</h1>
  <p data-i18n="hero.intro">Compare layouts before you enquire.</p>
  <a class="sds-btn sds-btn--primary" href="#enquiry" data-i18n="hero.enquire">Ask about a space</a>
</section>
```

### Image chapter

```html
<section class="sds-chapter" aria-labelledby="chapter-title">
  <img class="sds-chapter__media" src="lobby-concept.jpg" alt="">
  <div class="sds-chapter__scrim" aria-hidden="true"></div>
  <div class="sds-chapter__body sds-stack">
    <h2 class="sds-chapter__title" id="chapter-title" data-i18n="chapter.title">Lobby layout concept</h2>
    <p class="sds-chapter__caption" data-i18n="chapter.caption">AI-generated concept image</p>
  </div>
</section>
```

### Proof rail

Put related evidence in a labelled rail. Use approved material and keep any sample label on its card.

```html
<section class="sds-stack" aria-labelledby="proof-title">
  <h2 id="proof-title" data-i18n="proof.title">Layout documents</h2>
  <ul class="sds-rail" tabindex="0" aria-labelledby="proof-title">
    <li class="sds-rail__item sds-card">
      <a href="sample-floor-plan.pdf" data-i18n="proof.plan">Sample floor plan (PDF)</a>
    </li>
  </ul>
</section>
```

### Enquiry and footer

Place the enquiry section before the page footer. Attach the field to the configured enquiry form.

```html
<section class="sds-container sds-stack" id="enquiry" aria-labelledby="enquiry-title">
  <h2 id="enquiry-title" data-i18n="enquiry.title">Ask about a space</h2>
  <div class="sds-field">
    <label for="enquiry-email" data-i18n="enquiry.email">Email address</label>
    <input id="enquiry-email" name="email" type="email" autocomplete="email" required>
  </div>
</section>
<footer class="sds-footer">
  <a href="privacy.html" data-i18n="footer.privacy">Privacy policy</a>
</footer>
```

## Self-check

1. Does each viewport have a clear purpose and one main action at most?
2. Does the section fit at 393 px and 320 px, with 44 px controls and reachable actions?
3. Did I check interaction states and prepare loading, empty, and error states for data-driven content?
4. Do enquiry controls have visible labels and linked text errors when invalid?
5. Did I verify every claim and label all samples and AI-generated imagery next to their content?

## Tools

- Run `node swarm/tools/check-sections.js <projectDir> --ssot` for section rules and SDS sync.
- Run `node swarm/tools/i18n-extract.js <projectDir> --check` for localizable copy and catalog coverage.
- Run `node swarm/tools/export-page.js <projectDir>` to inspect the assembled page at `/p/dist/index.html`. Use Chrome DevTools if available to exercise states and check width and reach. Otherwise review the markup and record the browser checks as pending.

## Sources

- Nielsen Norman Group's 10 Usability Heuristics for User Interface Design
- Apple Human Interface Guidelines
- Web Content Accessibility Guidelines (WCAG) 2.2
