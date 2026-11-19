# Expanded V11 public facilities

## Upper landing circulation

**Status:** The public lift round trip and a short upper exit were verified on build `9945fcd8ff0f5e5e`. The upper-floor correction passed local and published Chrome routes and focused collision checks on build `c2c28330cf5864ee`.

The upper slab spans world X −9 to 3 and Z 4 to 16 at Y 7.2. In the public baseline, the oak bench sat close to the west-facing lift threshold. The west planters left about 0.51 m to the rail, below the moving visitor’s 0.60 m capsule width with its controller margin. The south directory also left about 0.07 m to the story wall.

The oak bench, matching collider and exit moved south of the landing. Four planters moved inboard. The directory rotated to face the inner aisle and moved away from the story wall. The lift cabin, safety gates, guarded opening and floor remained under their existing controller.

On the local candidate and the published build, Chrome held Shift continuously and used real WASD through all four corners, returned to the lift and descended. The route stayed at 7.2 m and both transit doors were closed with thresholds disabled. A 390 × 844 touch-emulated run used the joystick to exit and return to the lift and tapped Ride in both directions after a keyboard approach on the ground floor. The desktop Detailed route sampled 301 scene-frame intervals at 16.7 ms p95, with zero at or above 50 ms. This is a short headless Chrome sample. [Before and after with recorded route](gjh-v11-references/upper-perimeter-runtime.webp) · [Lift geometry](gjh-v11-stage7-lift-facilities.md)

## Ground-floor restroom cluster

The Expanded scene uses the eastern facilities parcel for three independently enterable restrooms. The parcel spans X 21–29 and Z 6–14, with a 6 m arcade before the east storefront line at X 35. Each automatic sliding door faces the arcade. An offset screen blocks the direct view of the toilet from the arcade. The all-user Accessible restroom has a wider doorway, open space below the basin, a wider passing lane and a side grab rail. The BCA references informed the virtual layout. [BCA Universal Design Guide for Public Places](https://www1.bca.gov.sg/docs/default-source/universaldesign/udguide2016.pdf) · [BCA Guide to the Universal Design Index](https://www1.bca.gov.sg/docs/default-source/universaldesign/guide-to-udi.pdf)

| Room | Parcel range | Clear virtual door width |
| --- | --- | --- |
| Men | X 21–29, Z 6–8.5 | 1.27 m |
| Women | X 21–29, Z 8.5–11 | 1.27 m |
| Accessible restroom | X 21–29, Z 11–14 | 1.55 m |

[Restroom floor plan](gjh-v11-references/restroom-plan.webp) · [Chrome fixture and map views](gjh-v11-references/restroom-runtime.webp)

| Asset | Implementation |
| --- | --- |
| Door leaves, privacy partitions, shell and signs | Original geometry and localized signs. Shared doorway occupancy keeps a moving door from closing on a visitor. |
| Handwashing station | Recessed ceramic basin with drain, wall mirror, soap pump and brass tap. The mirror uses a static material. |
| Toilet | Ceramic geometry, visible flush control and a brief animated ripple. The accessible room adds a side grab rail. |
| Tap and flush effects | Reusable low-poly geometry. Tap toggles on and off, and a running tap stops when the visitor leaves its room. |

The map and directory send visitors to the common arcade at X 31.4, Z 10. Each room has its own entrance and a live location label. Wayfinding and the interaction prompts are available in English, Simplified Chinese and Malay. The two northern service reserves stay closed.

Chrome verification followed all three entrances from the arcade, around the privacy screens and back out, with real keyboard input at 1440 × 900 and touch joystick input at 390 × 844 in emulation. Both runs operated all six fixture actions. The desktop run also checked the map, directory and translated destinations. The same routes passed on published build `167f5d38d8727909`. With all capture disabled, the late-route samples measured 16.7 ms p95 across 301 Detailed desktop intervals and 33.4 ms p95 across 151 Low touch-emulated intervals. Neither sample contained an interval of 50 ms or more. A physical phone and assistive technologies were outside these checks. [Pages deployment](https://github.com/yapweijun1996/Webpage-Design-Gallery/actions/runs/44547654104)
