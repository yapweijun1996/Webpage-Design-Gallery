# Viewing deck Stage 4 desktop check

On 2026-11-23, Chrome 158.0.8127.37 with native ANGLE Metal rendered the
1440 × 900 desktop viewport in the default expanded layout. The runtime
revision was `7879fa2ce500fa70deab22d71a9c47785b76a33f`. The HTTP response
for `script.bundle.js` matched the checked-out file at SHA-256
`38f9df401c59a74e935b9e688215d0bee0046f15dedd3ef89bbf873af538bb57`.

| Sample | Draw calls | Limit |
| --- | ---: | ---: |
| Default expanded entrance | 73 | 190 |
| Upper lift landing with 17 plaques loaded | 56 | 190 |
| Upper deck after the bench interactions | 86 | 190 |

The focused check passed the existing +7.2 m lift, 17-plaque, S01 story
inspection and two bench sit/stand assertions. Run it from a checkout with
Playwright and Chrome installed.

```sh
GALLERY_CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
GALLERY_WEBGL_BACKEND=metal python tests/browser_gjh_v11.py --upper-deck
```

The full legacy invocation stopped in its preliminary loader fixture while
waiting for a standalone `mili-brand-cover.jpg` request. This receipt covers
the focused desktop route.
