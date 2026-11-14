# V11 compact panel input isolation

## Scope

Built on main `e934ba6`, preserving the concurrent compact header Map button, touch labels, layout and brand-directory documentation. Main already paused the compact Map. This slice adds compact Help pause, clears held movement on panel toggles, and handles Escape before character actions so closing a reading panel does not also stand up or cancel an action. Map and Help remain mutually exclusive. Desktop overview remains live. Paused compact panels explain the state and hide inactive movement/interaction controls. The concurrent main same-value font-token repair is preserved.

## Evidence

`tests/browser_gjh_panel_input.py`: Chromium/SwiftShader, CDP touch at 390×680 and 844×390; desktop 1440×900. PASS: exposed-canvas drags do not move or rotate while reading; fresh gestures work after closing; release stops; Escape restores trigger focus; map destinations resume; Bag Escape does not close the underlying Help. At 390, programmatic opening clears a held pointer and seated transition stays paused; closing panels does not stand the character. Desktop open overview still permits movement. These are browser simulations, not iPhone/Safari or physical-device certification.

The initial baseline reproduction at `4c6c2d8` measured movement through an open Map; a concurrent main change subsequently added Map pause. We did not attribute that independent fix to this slice. Test fixtures were updated for the new header Map trigger and for the actual desktop map state; a hidden desktop summary is not claimed to be operable.

Screenshot advisor reviewed four portrait/landscape after images and the implementation: no blocking issue. Duplicate media-change cleanup call was removed following review.

## Release / rollback

Version 1.1.27. Run gallery generation, generation check, SSOT and diff checks. Preserve the pre-release revision for revert and rebuild generated outputs on rollback. No product assets, packaging claims, transactions or persistent shopping data changed.
