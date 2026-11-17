# GJH v11 interaction engine

The registry in `assets/interaction-registry.js` adapts the world's existing interaction list. Each normalized entry has `id`, `kind` (`sit`, `inspect`, `open`, `pickup`, or `travel`), `anchor` (`x`, `y`, `z`), `radius`, `floor`, `availability(context, item)`, `prompt`, and `handler`. IDs remain stable. `nearest` filters by floor, availability, travel state, radius and seat approach; `dispatch` checks availability again before invoking the handler. The list remains mutable so the asynchronously loaded upper brand plaques are included. UI records supply labels and handlers for existing content; the physical product control dispatches its pickup handler through the same registry.

## Adding a seat

Add a placement to `assets/seat-placements.js` with its floor, position, facing and name. The world uses the placement to create the model and collider and derives the seat and exit anchors. The player checks the capsule path to the anchor and the exit before allowing a sit or stand. Verify both approaches against actual surrounding colliders and the floor; a nominal anchor alone does not prove accessibility. Existing ground-floor seats and all three upper-deck benches share this path.

The third upper-deck bench is at `(-3, 6)`, facing its exit at `(-3, 7.2)` between the bench and the lift's south guard. This moves it off the shaft and registers it as a seat. The placement tests check the slab and guard clearance; the browser test exercises the sit/stand route against the actual colliders.

## Adding a door

Create the two existing-style kinematic sliding leaves and their bodies, add a door record to `world.doors`, and add a ground-floor `open` interaction with a stable ID, radius and door reference. The HUD derives Open/Close and the handler toggles the target; the fixed-step loop moves both meshes and bodies. Expanded-mode doors close after the visitor leaves. Classic-mode automatic opening is unchanged. Verify clearance on both sides and test opening, passage and closing.

Opaque furniture and trim primitives are merged by placement group before instancing, retaining surface colors and PBR values. Each movable glass leaf shares a merged frame geometry; product shelf meshes are batched by their original materials. The browser suite checks the 200-call limit with each expanded-layout door open at desktop resolution.

## Static geometry

Walls, ordinary lights and decorations remain static; the fourteen planned storefront doors remain decorative and physically closed. No additional network assets are required. The existing viewport zoom lock and mobile interaction control remain in place.
