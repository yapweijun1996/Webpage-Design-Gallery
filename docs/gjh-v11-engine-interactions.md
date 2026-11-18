# GJH v11 interaction engine

The registry in `assets/interaction-registry.js` adapts the world's existing interaction list. Each normalized entry has `id`, `kind` (`sit`, `inspect`, `open`, `pickup`, or `travel`), `anchor` (`x`, `y`, `z`), `radius`, `floor`, `availability(context, item)`, `prompt`, and `handler`. IDs remain stable. `nearest` filters by floor, availability, travel state, radius and seat approach; `dispatch` checks availability again before invoking the handler. The list remains mutable so the asynchronously loaded upper brand plaques are included. UI records supply labels and handlers for existing content. The kiosk and lift use registry prompts and handlers for keyboard and touch; the lift prompt reflects call and docking state. Map destination travel and the separate physical-product pickup/return control also dispatch through the registry. Pickup availability checks the shelf approach, held product and visitor state; the physical item remains separate from the demo bag.

Auxiliary actions use `register(entry)` and `get(kind, id)` so a shelf's pickup action can coexist with its proximity-selected inspect entry. Pickup registrations carry the shelf approach anchor, ground floor and reach radius; they do not compete in `nearest`. Map destinations are likewise registered once by store ID. Callers look up the registered action and dispatch it, rather than constructing a new handler on each activation.

## Tripo visitor

`assets/character-tripo.js` turns the +Z-facing Mixamo rig to walk along -Z and scales the loaded GLB to 1.7 m. It maps source `idle` and `walk` to the engine's matching states and source `run` to the `sprint` clip used by the engine's `run` state. The adapter fixes horizontal hips translation in place and retains the authored vertical motion. Physics owns travel, so the authored step length can differ from the distance travelled on the floor.

- The Tripo exploration camera raises the spring-arm pivot by 1.65 m, looks 1.7 m ahead of the visitor and uses a 64° vertical field of view on desktop. The spring arm sweeps against the entrance geometry. Seat and product close-ups retain their action camera.
- `window.__mall.emote(name)` accepts `wave`, `nod`, `jump` or `dance`. It returns `true` when an emote starts or enters the single pending slot, and `false` when the request is unavailable or the slot is full. Read `window.__mall.state.character.emote` and `queuedEmote` for the current and pending names. Movement, sitting, cart use, product handling and reduced motion take precedence and cancel pending emotes. Jump is visual and leaves the capsule grounded. The arrival wave starts when exploration becomes visible, turns the visual rig toward the camera and plays once per page.
- Sitting advances frames 0–64 of the LOD0 `sit` clip at 24 fps source sampling. The source begins in a low seated pose and contains no standing transition. The player blends in from idle, holds the last pose and reverses the same segment when standing. A calibrated hips offset and a two-bone boot contact solve fit the existing floor-relative bench anchor. Exports without `sit` use the procedural fallback. Reduced motion applies the end pose immediately.
- Cart use blends the idle or walk clip and solves shoulder and elbow rotation analytically toward each handle grip. The solve preserves bone lengths, bounds the reach and aims the wrists along the grip direction. Fingers use their animated pose, so a hand may hover or overlap the handle during some strides. The engine owns cart clearance, and the existing wheels roll by distance travelled. The same bounded arm solver poses the right hand for the existing shelf pickup and return flow.
- LOD1 contains no clips. It swaps geometry and the smaller texture onto the LOD0 skinned mesh past 11 m and returns to LOD0 inside 9 m. The live LOD0 skeleton and mixer drive both levels. A missing, slow or incompatible LOD1 leaves LOD0 usable. Tripo contributes one visible mesh and one caster when scene shadows are enabled, apart from the same cart and floor-contact props. Teardown releases the mixer and both asset levels. NPCs continue to use the V2 rig under the existing scene draw-call cap.

Use `?visitor=v2` to exercise the original skinned visitor's authored sit/push and its customization controls, including shoe colour. The Tripo adapter keeps the demo bag count and cart indicator with its fixed outfit. Use `?visitor=v1` for the original procedural bag and gesture. [Visitor source and packaging](../demos/corporate/gjh/v11/README.md#default-tripo-visitor)

## Adding a seat

Add a placement to `assets/seat-placements.js` with its floor, position, facing and name. The world uses the placement to create the model and collider and derives the seat and exit anchors. The player checks the capsule path to the anchor and the exit before allowing a sit or stand. Verify both approaches against actual surrounding colliders and the floor; a nominal anchor alone does not prove accessibility. Existing ground-floor seats and all three upper-deck benches share this path.

The third upper-deck bench is at `(-3, 6)`, facing its exit at `(-3, 7.2)` between the bench and the lift's south guard. This moves it off the shaft and registers it as a seat. The placement tests check the slab and guard clearance; the browser test exercises the sit/stand route against the actual colliders.

## Adding a door

Create both sliding leaves and their kinematic bodies, and register the door in `world.doors` under its stable store ID. The fixed-step loop checks the visitor’s position, opens the passage on approach from either side and closes it after departure. Move the visual leaves and their colliders together. Use `tests/browser_gjh_auto_doors.py` to verify proximity and clearance, and `tests/browser_gjh_shop_walkthrough.py` to verify entry and exit throughout the expanded mall.

Opaque furniture and trim primitives are merged by placement group before instancing, retaining surface colors and PBR values. Each movable glass leaf shares a merged frame geometry; product shelf meshes are batched by their original materials. The browser suite checks the 200-call limit with each expanded-layout door open at desktop resolution.

## Static geometry

Walls, ordinary lights and decorations remain static. The seventeen expanded storefronts and the three classic storefronts have working automatic doors.
