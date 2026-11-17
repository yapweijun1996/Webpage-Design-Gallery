# GJH v11 interaction engine

The registry in `assets/interaction-registry.js` adapts the world's existing interaction list. Each normalized entry has `id`, `kind` (`sit`, `inspect`, `open`, `pickup`, or `travel`), `anchor` (`x`, `y`, `z`), `radius`, `floor`, `availability(context, item)`, `prompt`, and `handler`. IDs remain stable. `nearest` filters by floor, availability, travel state, radius and seat approach; `dispatch` checks availability again before invoking the handler. The list remains mutable so the asynchronously loaded upper brand plaques are included. UI records supply labels and handlers for existing content. The kiosk and lift use registry prompts and handlers for keyboard and touch; the lift prompt reflects call and docking state. Map destination travel and the separate physical-product pickup/return control also dispatch through the registry. Pickup availability checks the shelf approach, held product and visitor state; the physical item remains separate from the demo bag.

Auxiliary actions use `register(entry)` and `get(kind, id)` so a shelf's pickup action can coexist with its proximity-selected inspect entry. Pickup registrations carry the shelf approach anchor, ground floor and reach radius; they do not compete in `nearest`. Map destinations are likewise registered once by store ID. Callers look up the registered action and dispatch it, rather than constructing a new handler on each activation.

## Adding a seat

Add a placement to `assets/seat-placements.js` with its floor, position, facing and name. The world uses the placement to create the model and collider and derives the seat and exit anchors. The player checks the capsule path to the anchor and the exit before allowing a sit or stand. Verify both approaches against actual surrounding colliders and the floor; a nominal anchor alone does not prove accessibility. Existing ground-floor seats and all three upper-deck benches share this path.

The third upper-deck bench is at `(-3, 6)`, facing its exit at `(-3, 7.2)` between the bench and the lift's south guard. This moves it off the shaft and registers it as a seat. The placement tests check the slab and guard clearance; the browser test exercises the sit/stand route against the actual colliders.

## Adding a door

Create both sliding leaves and their kinematic bodies, and register the door in `world.doors` under its stable store ID. The fixed-step loop checks the visitor’s position, opens the passage on approach from either side and closes it after departure. Move the visual leaves and their colliders together. Use `tests/browser_gjh_auto_doors.py` to verify proximity and clearance, and `tests/browser_gjh_shop_walkthrough.py` to verify entry and exit throughout the expanded mall.

Opaque furniture and trim primitives are merged by placement group before instancing, retaining surface colors and PBR values. Each movable glass leaf shares a merged frame geometry; product shelf meshes are batched by their original materials. The browser suite checks the 200-call limit with each expanded-layout door open at desktop resolution.

## Static geometry

Walls, ordinary lights and decorations remain static. The seventeen expanded storefronts and the three classic storefronts have working automatic doors.
