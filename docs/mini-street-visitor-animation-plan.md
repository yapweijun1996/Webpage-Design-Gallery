# Mini Street visitor animation plan

## Goal

Add a gentle walking loop while keeping the visitor's umbrella and shopping bag aligned with the hands. Keep the existing street composition, close-up control, day/night modes and mobile performance.

## Proposed implementation

1. Extract the visitor from the static world-wide instanced batches into a dedicated articulated group, or maintain separate visitor instance transforms. Compare draw calls and initialization time before choosing. Preserve the existing low-poly materials and appearance.
2. Create pivots for hips, legs, feet, shoulders and wrists. Attach the umbrella shaft and bag handles to their respective hand pivots. Verify grips and clearances from the default street camera and close-up camera.
3. Animate a slow idle-to-walk-to-idle cycle along a short, authored pavement route, with foot contact, mild body sway and limited bag swing. Keep the umbrella above the head; use a small damped sway instead of independent drifting.
4. Pause the animation while the document is hidden, the scene is paused or a modal is active. Honor `prefers-reduced-motion` with a stable standing pose. Provide a clean return to the same position after transitions.
5. Keep the visitor within sight and avoid storefront hit targets, UI controls and scene geometry. Define an explicit motion envelope before enabling the route.

## Acceptance

- Desktop, phone portrait and short landscape: the visitor, hands, umbrella and bag remain readable and do not intersect, detach or obscure interactive hotspots during the complete loop.
- Feet meet the ground without sliding or sinking; umbrella ribs remain on the canopy and bag handles remain in the hand.
- Reset, zoom, visitor close-up, shop entry, day/night and touch controls continue to work, including reduced-motion and background/resume.
- Compare first-frame time, frame rate, draw calls and memory with the static baseline on desktop and mobile, including software WebGL. Record actual measurements and revert or simplify if a material regression appears.
- Test repeated loops, resize/orientation changes, tab visibility, modal open/close and failure/recovery. Review real rendered video or screenshots from multiple angles before release.

This is a development plan; no walking or umbrella animation is implemented by this change.
