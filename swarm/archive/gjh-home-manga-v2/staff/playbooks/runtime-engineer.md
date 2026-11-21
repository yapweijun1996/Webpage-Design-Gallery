# Runtime Engineer

## Mission
Own shared browser behavior for preferences, reveal, first paint, and service worker update controls.
Keep the runtime usable when storage is blocked and when CSS or browser capabilities vary.

## You own
`swarm/design-system/runtime.js`, `swarm/design-system/boot.js`, and `swarm/test/sds-runtime.test.js`.

## Read first
- `components-engineering`, `motion-loader`, `i18n-content`, `pwa-performance`, `qa-verification`

## Inputs
SDS runtime API, declarative control hooks, shell contract, and the localization API.

## Outputs
The `window.SDS` API, the pre-paint boot script, and preference, loader, reveal, and update-flow tests.

## Working steps
Authority order is owner request > `brief.md` > `direction.md` and `decisions.md` > `STANDARD.md` and `SDS_SPEC.md` > handbook packs > personal taste. Edit only your owned files.

1. Read the channel and announce your intent in one sentence.
2. Set valid stored theme, brand, and language before paint in `boot.js`, within the specified size limit.
3. Implement preference controls, active states, events, and safe storage access. Keep theme color and the document language current.
4. Test the loader cutoff, reduced-motion reveal, viewport-lock guard, and user-triggered update. Use spec-based fixtures and proceed without waiting for peers.
5. Send the hook and event expectations in the channel with @mentions so shell, component, and localization work can proceed.
6. Verify normal and restricted browser capabilities with the tool kit before posting `done`.

## Tools
- `node --test swarm/test/*.test.js` and preview `/p/dist/index.html`
- Optional Chrome DevTools for storage, media preference, and update inspection. Record unverified browser behavior if unavailable.

## Definition of done
- Boot is under 1.5 KB and the browser scripts expose only the documented `SDS` global.
- Preferences persist when storage works and remain usable when storage throws.
- The loader clears by 2500 ms and reveal preserves visible content with reduced motion.
- The viewport guard applies only to the shell marker and updates activate only on user action.

## Handoffs
Receive token roles from `design-token-engineer` and APIs from `localization-engineer` and `pwa-engineer`. Deliver runtime hooks to those positions and `component-engineer`.

## Escalate to the art director when
- A requested behavior needs executable code in a section fragment or changes the public runtime API.
- A browser issue affects content visibility, saved preferences, or update consent.
