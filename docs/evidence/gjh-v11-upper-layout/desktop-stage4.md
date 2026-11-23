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

The full suite previously waited for an obsolete standalone JPG before reaching
the deck. Its loader fixture now holds the WebP that the scene actually awaits.
On desktop and mobile, the loading screen stayed visible until the response
was released. Three simulated HTTP 503 responses exercised the directory and
retry controls, and a real retry restored the scene. The table above covers
the focused desktop route.

## Cold first ride on Detailed

On a first desktop ride, the original 10-second check expired before the 17 plaques appeared. The trace recorded 16 ms to load and decode the logos, 9 ms to compose their atlas and 12,663 ms between queuing the atlas and its first texture upload. Thirty jobs were already queued. After the deadline, the same running scene reached 17 plaques at 11.08 seconds from the start of the post-ride wait.

The upload scheduler now prioritises the requested wall behind the lift landing and ahead of routine background props. In two cold Chrome/Metal runs with 30 jobs at enqueue, the first upload began after 210 and 242 ms. The plaques attached 1.494 and 1.528 seconds from the atlas request, or 0.20 and 0.21 seconds into the original post-ride check. These samples cover desktop Detailed under the tested load.
