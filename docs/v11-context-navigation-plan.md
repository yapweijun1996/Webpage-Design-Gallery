# V11 contextual navigation contract

Status: selected implementation scope, 2026-11-15. Base: `6a1f31c`, application
1.1.37. This completes only the Phase 7 contextual-navigation item after verified
implementation; it does not authorize future commerce, accounts or other features.

## Behavior and ownership

Use one V11-owned component and one physical navigation landmark with five equal
text-button columns: Home, Shops, Events, Rewards, Profile. Its visibility consumes
the canonical mode: visible only in Menu or Shop, hidden and untabbable in Explore,
Inspect, Seated and Cart. Wide nonmodal Map/Help do not independently reveal it.
The mode manager remains the sole pause/lifecycle owner.

The current destination comes from the existing view owner: Home when showing
the 3D mall, Shops when showing the directory. Exactly that supported destination
has aria-current and a filled treatment; the other enabled destination is secondary.
Destination changes participate in component memoization even when mode/host
remain unchanged.

Home returns to the existing 3D mall at the current position. It preserves valid
Seated/Cart posture, camera and selection; it performs no teleport or implicit
stand/stow. It closes only the blocking surface through its existing owner. Home
is disabled when 3D is unavailable, with a visible explanation and an activation
guard. If its focused control becomes unavailable, focus stays on a visible,
usable control. Main-context loss must refresh this state even when the directory
is already open and the view-transition function returns early.

Shops opens the existing accessible store directory and focuses its visible
heading. The established directory transition deliberately stands/stows when
needed. Activating Shops while already in the directory returns its heading into
view. Bag selections remain unchanged. Native Guide/Bag close handlers own their
handoffs and return focus; navigation must not add competing generic restoration.

Events, Rewards and Profile are disabled native buttons with visible plain-language
copy identifying them as unavailable in this demo. They have no fabricated pages,
account state, rewards balances, prices, orders or payment. Labels alone do not
establish those features.

## Placement and layout

Move the same navigation node into the eligible native Guide or Bag footer host;
otherwise use one viewport-bottom host for directory and compact Map/Help Menu.
It is never an inert bar outside an open native modal. Product and Original tin
inspection hide it, including inspection over the directory.

Guide/Bag reserve a footer row and give their existing content an independently
scrollable region with a sticky Close header. Preserve all content, controls,
accessible names and native semantics. Update Guide's last-focusable boundary to
include enabled navigation controls. Keep the Bag header measurement owned by its
component and apply its scroll offset to the actual content scroller.

Reserve the measured navigation height in directory bottom/scroll padding and
compact panel bounds. Keep Map/Help controls and the scene disclosure unobstructed.
Hidden navigation reserves no empty strip. Resizing or moving between hosts must
not create duplicate landmarks or lose focus. Only navigation's own disappearing
or disabled control may trigger its scoped focus recovery. Native modal owners
retain opener focus ownership. After its global footer layout/show/resize or
focusin, navigation may reveal the currently focused, rendered directory element
with immediate scrolling; it never focuses or stores an inspection opener.

Use the existing V11 palette, semantic typography/spacing/layer tokens and Python
SSOT workflow. Five text columns need no new icon source. Independent demo scope,
existing URLs, zoom behavior and PWA policy remain unchanged. The local `ds.md`
contract governs adaptation of advisory KB component/theming skills; its native
semantics and SVG-Icon-Studio provenance remain authoritative.

## Verification

Real Chrome at 320x568, 390x844, 667x375, 768x1024 and 1440x900, plus affected
650/651 breakpoint sides and 359x740, 361x740, 844x560 and 844x561 media-boundary
profiles. Verify one landmark, mode visibility, enabled targets
at least 44px, text/focus contrast, no horizontal overflow and no footer/header
obstruction. Look at actual Guide, Bag, compact Map/Help and directory frames.

Exercise Home/Shops via pointer and keyboard, nested Bag over Map/Help, Guide
handoffs, retained Seated/Cart, directory-to-same-directory scrolling, Inspect
exclusion, live frame pause/resume and native Close/Escape focus. Exercise actual
main WebGL loss under directory+Bag with focused Home: Home becomes unavailable,
selection and Bag remain usable, stale activation does nothing and focus remains
visible. Preserve the context-loss Cart repair from 1.1.37.

Existing Guide endpoint/Bag-scroll fixtures may follow the new actual focus or
scroll owner while retaining their target, contrast, pause and visibility
assertions. Run focused navigation, mode, accessibility, Bag/Guide and relevant
repository/PWA regressions. Physical devices, real insets and screen readers
remain unverified until tested directly. Software inset stress profiles use
667x375 with top/bottom/left/right 20/24/30/30 and 390x844 with 44/34/0/0.
Every keyboard-reached Map/Help target and its full focus ring must fit its
scrollport unconditionally, with complete Map labels and 44px minimum targets.
Exercise all three real Map destination journeys under both software profiles.
