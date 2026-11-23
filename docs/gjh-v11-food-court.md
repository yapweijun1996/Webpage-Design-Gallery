# Visiting the Singapore food court

In the expanded mall, leave through the south doors and follow the pavement past the row of shophouses. When the food-court direction appears, turn into the covered space beside the final shop. The two counters face a common aisle. Walk slightly to one side to see the kettle on the white counter or the hanging poultry in the neighbouring display. Approach any of the four chairs, choose **Sit**, then choose **Stand** to leave the table. The mall Map can take you back to a shop. [Walking directions and counter views](evidence/gjh-v11-food-court/walk-to-the-stalls.webp)

## What loads on approach

The court requests its own two stalls, table-and-chair set and kettle, totalling 1,216,208 bytes. Opening the original street from the mall requires none of those four models. On approach the court checks each file against its manifest and waits until the visitor clears the furniture before mounting. The court registers 19 colliders, 22 camera bounds and four seat anchors. Walking away releases them. For a physical phone on a local network, serve the site over HTTPS so the browser can verify the model hashes. A failed court download keeps the street walkable. Move away from the parcel and approach again to retry. [Model origins and reuse terms](../demos/corporate/gjh/v11/assets/districts/food-court/sources.json)

The models are original studies from the owner's Blender gallery. The site adds a shelter and an open counter apron. Visitors can look at the cooking and serving details and use the chairs. [Browser route and resource measurements](evidence/gjh-v11-food-court/route.json)

## Browser verification

In Chrome, a visitor walked from the south doors to both stalls, sat in and stood up from each chair, then walked back to the mall. Each route passed 33 camera-ray checks against the actual street and court surfaces. The first phone-width run exposed a display case that hid the visitor after standing up. The corrected camera now keeps the face and back visible from that same chair. A nearby interaction prompt can overlap the lower legs in a close portrait. [South-chair comparison](evidence/gjh-v11-food-court/south-chair.webp) · [Tablet and desktop seating](evidence/gjh-v11-food-court/seating.webp)

| Viewport | Input | Frames observed | Peak draw calls |
| --- | --- | ---: | ---: |
| 390 × 844 | Touch joystick | 4,389 | 95 |
| 768 × 1024 | Touch joystick | 5,557 | 113 |
| 1440 × 900 | Keyboard | 10,582 | 137 |

These three walks used build `e67a1f3923af52ed`. The release widened the approach direction from 7 m to 9 m so someone continuing straight down the pavement can discover the court. A fourth 390 px walk on build `6faa46c7887eb155` read that message from the pavement, visited the counter aprons and left through the Map while a fresh model request was held for 7.2 seconds. The request was cancelled, the visitor arrived at Sony and the late response attached no court objects. The same scene, camera, Bag and locale survived the return.

The measurements cover desktop Chrome with emulated viewport sizes using Metal on macOS. Physical phone frame timing, heat and input latency remain open.
