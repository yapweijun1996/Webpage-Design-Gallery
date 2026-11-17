# GJH v11 interaction engine

The registry in `assets/interaction-registry.js` adapts the world's existing interaction list. Each normalized entry has `id`, `kind` (`sit`, `inspect`, `open`, `pickup`, or `travel`), `anchor` (`x`, `y`, `z`), `radius`, `floor`, `availability(context, item)`, `prompt`, and `handler`. IDs remain stable. `nearest` filters by floor, availability, travel state, radius and seat approach; `dispatch` checks availability again before invoking the handler. The list remains mutable so the asynchronously loaded upper brand plaques are included. UI records supply labels and handlers for existing content; the physical product control dispatches its pickup handler through the same registry.

## Adding a seat

Add a placement to `assets/seat-placements.js` with its floor, position, facing and name. The world uses the placement to create the model and collider and derives the seat and exit anchors. The player checks the capsule path to the anchor and the exit before allowing a sit or stand. Verify both approaches against actual surrounding colliders and the floor; a nominal anchor alone does not prove accessibility. Existing ground-floor seats and the two accessible upper-deck benches share this path.

The third upper-deck bench at `(-3, 11.7)` is not registered: it overlaps the lift shaft and its front exit is behind the guard, over the shaft opening. Registering it safely requires changing the geometry or placement, which conflicts with the no-visual-change constraint. No other seat-like models were identified in the scene modules.

## Adding a door

Create the two existing-style kinematic sliding leaves and their bodies, add a door record to `world.doors`, and add a ground-floor `open` interaction with a stable ID, radius and door reference. The HUD derives Open/Close and the handler toggles the target; the fixed-step loop moves both meshes and bodies. Expanded-mode doors close after the visitor leaves. Classic-mode automatic opening is unchanged. Verify clearance on both sides and test opening, passage and closing.

The 200-draw-call budget is not met in every sampled state: a 1440 × 900 Metal smoke test measured 235 calls at the open MILI door. The 390 × 844 door-toggle smoke measured 90, 142 and 101 calls for New Moon, MILI and GOGO respectively.

## Static geometry

Walls, ordinary lights and decorations remain static; the fourteen planned storefront doors remain decorative and physically closed. No additional network assets are required. The existing viewport zoom lock and mobile interaction control remain in place.
