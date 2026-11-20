# i18n and Content

## Purpose

Make English source copy translatable without changing section markup or intent.\
Keep translated pages readable in English, Simplified Chinese, and Malay.

## Rules

1. Put `data-i18n` on each element whose translatable text can be replaced as a unit. Keep inline English for source and fallback. `SDS.i18n.apply()` writes `textContent`, so place nested controls and meaningful markup outside the element carrying `data-i18n`.
2. Use lowercase, dot-separated `<section>.<element>` keys matching `[a-z0-9.-]+`, such as `hero.title` and `chapter.newmoon.cta`. Reuse a key only for the same source text and meaning.
3. Mark translated accessible names, titles, and alternatives with `data-i18n-attr`. Preserve the corresponding inline English attributes. Keep translatable text out of CSS-generated content and images.
4. Write complete messages. Use `data-i18n-vars` for values that a translator may need to reorder. Give `Intl.PluralRules` a numeric `n` and supply catalog variants such as `.one` and `.other` where the locale uses them. Supply other plural categories when the locale requires them.
5. Format values through `SDS.i18n.format.number()`, `SDS.i18n.format.date()`, and `SDS.i18n.format.currency()`. SDS maps `en`, `zh-Hans`, and `ms` to `en-SG`, `zh-Hans-SG`, and `ms-MY`. Pass the currency code of the source amount when it differs from the default `SGD`.
6. Check `<html lang>` after switching with `SDS.lang.set()`. Give labels and text room to grow by 40 percent. Verify wrapping and keep actions usable without clipping or fixed-height text boxes.
7. Keep Chinese paragraphs free of inline `<br>`. Check the shared `:lang(zh)` rule with `word-break: keep-all` and `line-break: strict`. Inspect mixed CJK and Latin content and punctuation at narrow widths.
8. Use plain Malay suited to the intended audience. Use sentence case in general headings, preserve approved product names, and keep formality consistent between labels and messages. Allow longer phrases to wrap and have a Malay reviewer check idiom and register.
9. Keep `meta.status` equal to `source` in the generated English catalog. Label unreviewed `zh-Hans` and `ms` catalogs `machine-draft` and obtain human review before publication.
10. Publish brand claims only when the brief confirms the fact or a verified source supports it. Preserve dates, locations, product names, and the scope of a claim through translation. Omit unsupported claims from both inline English and catalogs.
11. Exercise a missing key. Check that inline English remains readable and that `SDS.i18n.missing` records the key.

## Do / Don't

Translate the complete action as one message. Avoid splitting it into words that must remain in English order.

```html
<!-- Do -->
<button class="sds-btn" type="button" data-i18n="directory.view-menu">View menu</button>
<!-- Don't -->
<button class="sds-btn" type="button"><span data-i18n="directory.view">View</span> menu</button>
```

Let the text wrap with the active language. Avoid hard line breaks in a translated heading.

```html
<!-- Do -->
<h1 data-i18n="hero.title">Find your next favourite</h1>
<!-- Don't -->
<h1 data-i18n="hero.title">Find your<br>next favourite</h1>
```

## Patterns

### Visible copy and accessible name

```html
<button class="sds-btn" type="submit" data-i18n="enquiry.send"
        aria-label="Send enquiry"
        data-i18n-attr="aria-label:enquiry.send">Send enquiry</button>
```

### Count with locale-selected wording

```html
<p data-i18n="directory.results" data-i18n-vars='{"n":3}'>3 locations</p>
```

The example catalog message map shows an English plural pair. Keep the source catalog under extractor ownership.

```json
{
  "directory.results.one": "{n} location",
  "directory.results.other": "{n} locations"
}
```

### Localized values in shared code

```js
SDS.i18n.format.number(1234);
SDS.i18n.format.date(new Date("2026-01-01T00:00:00Z"), { timeZone: "UTC" });
SDS.i18n.format.currency(12, "SGD");
```

## Self-check

1. Does every visible message or translated attribute have a stable key and inline English?
2. Can translators change word order and use the required plural variants?
3. Do values use the active SDS locale and the source currency?
4. Do 40 percent expansion, CJK wrapping, and Malay labels fit without clipping?
5. Are unreviewed translations labeled and all brand claims traceable to a verified source?

## Tools

- Run `node swarm/tools/i18n-extract.js "$projectDir" --check` to find stale source catalogs, missing keys, conflicting keys, and unmarked text.
- Run `node swarm/tools/check-sections.js "$projectDir" --baseline` to check section findings such as `no-i18n-text` and `missing-alt`.
- Run `node --test swarm/test/*.test.js` to exercise translation, plural selection, and formatting.
- Inspect language switching and wrapping at `/p/dist/index.html` with Chrome DevTools when available. Record browser checks as UNVERIFIED if no browser is available.

## Sources

- Unicode CLDR plural rules
- ECMAScript Internationalization API
- Unicode Line Breaking Algorithm
- WCAG 2.2
