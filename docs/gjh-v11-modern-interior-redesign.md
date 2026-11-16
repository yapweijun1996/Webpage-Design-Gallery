# GJH V11 modern mall interior redesign

Updated: 15 November 2026 (Asia/Singapore)  
Status: **design direction selected; implementation and acceptance pending**.

## Design brief

Redesign the existing V11 interior as a believable, warm modern boutique mall. The current scene reads as a collection of separate 3D objects rather than a coherent place to shop: the elevator looks experimental, seating lacks a useful arrangement, the central sculpture dominates the view, and the storefronts look too similar. The goal is a coherent, human-scale space that remains easy to navigate and can later change appearance for seasonal events.

The owner selected the [modern premium concept](references/gjh-mall-modern-premium-concept.png) as the visual direction. It is an AI-generated illustration based on the existing layout, **not** a screenshot, approved construction drawing, asset source or evidence of implemented behavior. The existing demo has three stores in left-to-right order: New Moon, MILI, GOGO. The owner later requested expansion with independent candidate brand storefronts; the [expanded 17-store plan](gjh-v11-expanded-mall-layout.md) supersedes the previous three-store-only design constraint while preserving these existing stores and their relative order. The image's surfaces, greenery, furniture, glass and warm light are references to interpret within the real scene and its performance budget, not geometry to copy blindly.

**Owner decision: remove the upright central gold ring completely.** The intended everyday focal point is a low, natural planted arrangement inspired by the selected image, with clear views and walking space around it. Assess whether any existing plinth, water feature, inlay, collision or interaction remains appropriate; do not remove invisible collision without keeping collision aligned with the final visible geometry. Do not replace the ring with another oversized ring. The [seasonal concept board](references/gjh-mall-seasonal-concepts.png) is an AI-generated illustration of mood and interchangeable decorations only: its ring, storefront details, product depictions and labels are not approved as factual references and the ring must not be retained in any theme.

## Spatial and visual direction

| Area | Intended result | Implementation considerations |
| --- | --- | --- |
| Atrium and circulation | A clear, legible route from entry to the existing stores and proposed additional storefronts; a low planted focal point with restrained accents. Remove the gold ring and visual clutter. | Review scene geometry, camera, sightlines and physics together. Keep a usable route for the visitor and demo cart; test from both directions and around the focal point. |
| Seating and planting | Realistic, comfortable groupings with appropriate furniture scale, proportions, orientation and relationship to tables and plants. | Preserve or deliberately migrate existing seat actions, anchors, exit positions and collisions. Compare existing assets before proposing new ones. |
| Materials and lighting | Everyday palette of forest green, warm ivory/stone, natural wood and restrained brushed gold. Use convincing glass and warm, layered light rather than uniform dark surfaces. | Existing texture-free asset loader has explicit restrictions; material, texture and lighting changes need compatibility, resource and fallback review. Do not promise photorealism or performance until measured. |
| Storefronts and interiors | Individually composed storefronts with coherent entrances, windows, signage and visible interior depth. Preserve the existing three stores and their journeys while planning additional candidate stores under the expanded-layout brief. | Preserve the four verified New Moon products, correct details and disclosures. MILI and GOGO have no verified product packshots in the current concept: do not invent merchandise, prices, stock or official endorsements. |
| Elevator and upper level | A visually credible elevator integrated with the wall and floor: understandable doorway, cabin, controls and level relationship. | The current V2 lift is an experimental two-level mechanism. Preserve safe travel, rider/cabin alignment, camera, collision and interruption recovery; review both floors and v1/v2 differences before changing it. A conceptual rendering does not prove working doors or code compliance. |
| Camera and wayfinding | The visitor can see the route, the store names and key destinations without scenery obscuring the character or interaction prompts. | Inspect walking and approach views as well as static entry shots, on desktop and mobile. Preserve map, accessible directory and keyboard/touch alternatives. |

Dimensions and exact placements must be established from the running scene, existing collision bounds and current model sizes during each implementation slice. Existing pilot assets and their provenance remain documented in the [interior asset plan](gjh-v11-interior-asset-plan.md) and [pilot review](gjh-v11-interior-pilot-review.md); reuse or adapt them only where they fit this direction.

## Theme and decoration system: planned

The owner wants a configurable mall setup that can switch colors and coordinated decorations together while retaining the same mall and store layout. Themes below are visual directions, not implemented features or promises of specific assets:

| Theme | Palette and example interchangeable decoration |
| --- | --- |
| Premium everyday | Forest green, ivory and brushed gold; natural planting. |
| Lunar New Year | Red and gold; lanterns and seasonal blossom. |
| Christmas | Evergreen, warm lights and burgundy; a Christmas tree and wrapped gift props. |
| Diwali | Rich jewel tones and warm gold; festive lights and decorative rangoli-inspired patterns. |

Implement the everyday interior first. Subsequently define a single authoritative theme configuration for appearance roles, scene lighting and seasonal decoration sets, with a clear boundary between the fixed mall shell and removable decorations. A selection should apply a coherent theme rather than independent hard-coded changes in several systems; switching must remove old decorations and their associated resources and collision safely. Seasonal props must not obscure destinations, block paths or imply that decorative objects are real products. The final themes, setup interface, persistence scope, access model, scheduling and actual asset choices require a focused design against the existing application; no automatic calendar changes, shared admin service or new authentication is assumed by this brief.

The setup should be understandable with keyboard and touch, identify the selected theme without relying on color alone, and recover safely from missing or unavailable decoration assets. Selecting or changing a theme must preserve the visitor's position where safe, existing store and product interactions, demo bag state, and the accessible directory. Define the exact loading, error and recovery behavior as part of the theme-system slice before implementation. Any new asset needs documented source, rights, size, scale and fallback; no runtime dependency on unreviewed external services is assumed.

## Delivery sequence and acceptance

Track the ordered slices in [task.md](../task.md#expanded-17-store-upgrade--2026-11-15) and use the [upgrade master plan](gjh-v11-mall-upgrade-master-plan.md) for dependencies and acceptance. Start each slice by inspecting the current working tree, affected interactions, baseline screenshots and overlapping work; make the smallest coherent change and verify it before moving to the next. Keep earlier completed evidence as historical evidence, not proof of a redesigned scene.

For each visible slice, review actual running views at desktop, tablet and mobile sizes, including the entrance, approach, walking, relevant close-up and dismissal/interaction states. Capture evidence without overwriting existing uncommitted screenshots. Check viewport and camera occlusion, collision and cart clearance, keyboard/touch interactions, performance/resource changes, and applicable graphics-loss/directory fallbacks. Run the repository-required generator and tests in a safe isolated copy if concurrent work or screenshot-writing suites could overwrite other changes. Keep source and generated outputs consistent when integrating the completed work.

Acceptance is incremental: a slice is complete only after its real result matches its documented intent and the affected existing behavior has been verified. A concept image is not acceptance evidence. Physical phone, Safari and assistive-technology coverage must be reported separately from emulation. Preserve the V11 demo's unofficial status, verified content and existing commerce boundary.

## Current state

This document records the selected direction and a proposed execution order. No interior redesign, theme switching, new decoration assets or user setup has been implemented by this documentation update.
