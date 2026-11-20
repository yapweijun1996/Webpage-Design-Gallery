# Tokens and SSOT

<!-- Provide all semantic roles in each theme and brand variant to satisfy section 2.1. -->

## Purpose

Keep SDS visual values in a single source of truth and make generated output reproducible.\
Give section authors a consistent way to request and consume design values.

## Rules

1. Edit `swarm/design-system/tokens.json` through its owner. Run `build.js` to generate `tokens.css`, `themes.css`, and `TOKENS.md`. Treat the generated files as read-only and repair stale output by regenerating it from the source.
2. Use semantic roles at call sites. Pair `--sds-color-text` with `--sds-color-surface` and `--sds-color-on-action` with `--sds-color-action`. Refer to primitives through data references such as `{color.forest-900}` in `tokens.json`.
3. Propose a token by naming its role, listing the consumers, explaining why the existing scales or roles do not fit, and identifying values or references and affected contrast pairs. Ask the token owner to review the proposal against SDS_SPEC.md before adding it.
4. Provide every semantic color role for `light` and `dark` and for both variants of each brand. Validate role pairs for each fixed theme and `none`, `forest-gold`, and `gjh-classic`.
5. Keep brand maps in `tokens.json`. Generated `[data-brand]` overrides follow `[data-theme]` rules. Check `data-theme="auto"` under both system color schemes, including each brand's dark override.
6. Use scales such as `--sds-space-4`, `--sds-text-base`, `--sds-dur-fast`, `--sds-ease-standard`, and `--sds-z-sticky` in section CSS. Keep section token use to `var(--sds-*)`.
7. Remove hex, RGB, HSL, and named color literals from section CSS and inline styles. The `raw-color` rule allows `transparent`, `currentColor`, and `inherit`. Replace literals flagged by `raw-font-size`, `raw-duration`, `raw-easing`, and `raw-z-index` with tokens. Treat `raw-spacing` as a warning to use the nearest appropriate space token. Remove declarations flagged by `important`.
8. Use `ssot-baseline.json` as a per-project, per-rule ceiling. Run with `--baseline` to detect increases. Use `--update-baseline` through its owner after removing findings. The ratchet accepts lower counts and refuses increases.
9. Run with `--ssot` to verify generated tokens and any existing catalogs. Inspect every generated diff after a source change and verify the semantic roles and contrast with the test suite.

## Do / Don't

Pair text with its semantic surface. Avoid a text role intended for an inverse surface.

```css
/* Do */
color: var(--sds-color-text);
background: var(--sds-color-surface);
/* Don't */
color: var(--sds-color-text-inverse);
background: var(--sds-color-surface);
```

Use a token for its declared purpose. Avoid applying a size from one scale to a different property.

```css
/* Do */
padding: var(--sds-space-4);
/* Don't */
padding: var(--sds-text-base);
```

## Patterns

### Give a section surface and text roles

Replace `.s-NN` with the numbered section's scope.

```css
.s-NN {
  background: var(--sds-color-surface);
  color: var(--sds-color-text);
  padding: var(--sds-space-4);
}
```

### Follow the selected brand through the shared role

```html
<button class="sds-btn sds-btn--primary" data-i18n="enquiry.send" type="submit">
  Send enquiry
</button>
```

### Build and confirm generated output

Run this sequence from the repo root after changing the source data.

```sh
node swarm/design-system/build.js
node swarm/design-system/build.js --check
```

## Self-check

1. Do all section values come from existing semantic roles or appropriate scales?
2. Does every effective theme and brand variant provide the full role list and pass its contrast checks?
3. Did the build produce all generated files and does its check pass?
4. Did all lint counts stay at or below their recorded baselines?
5. Has the token owner reviewed any proposed addition with consumers and contrast identified?

## Tools

- Run `node swarm/design-system/build.js` and `node swarm/design-system/build.js --check` to generate and verify token outputs.
- Run `node swarm/tools/check-sections.js "$projectDir" --baseline` and `node swarm/tools/check-sections.js "$projectDir" --ssot` to check the ratchet and generated sources.
- Run `node --test swarm/test/*.test.js` for the semantic role contrast matrix. Use `node swarm/tools/contrast.js "$fg" "$bg"` for an individual pair of hex colors.

## Sources

- WCAG 2.2
- CSS Custom Properties for Cascading Variables
- CSS Color Adjustment
