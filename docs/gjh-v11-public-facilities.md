# Expanded V11 public facilities

## Upper landing circulation

**Status:** The public lift round trip and a short upper exit were verified on build `9945fcd8ff0f5e5e`. The upper-floor correction passed local Chrome and focused collision checks on build `c2c28330cf5864ee`.

The upper slab spans world X −9 to 3 and Z 4 to 16 at Y 7.2. In the public baseline, the oak bench sat close to the west-facing lift threshold. The west planters left about 0.51 m to the rail, below the moving visitor’s 0.60 m capsule width with its controller margin. The south directory also left about 0.07 m to the story wall.

The oak bench, matching collider and exit moved south of the landing. Four planters moved inboard. The directory rotated to face the inner aisle and moved away from the story wall. The lift cabin, safety gates, guarded opening and floor remained under their existing controller.

On the local candidate, Chrome held Shift continuously and used real WASD through all four corners, returned to the lift and descended. The route stayed at 7.2 m and both transit doors were closed with thresholds disabled. A 390 × 844 touch-emulated run used the joystick to exit and return to the lift and tapped Ride in both directions after a keyboard approach on the ground floor. The desktop Detailed route sampled 301 scene-frame intervals at 16.7 ms p95, with zero at or above 50 ms. This is a short headless Chrome sample. [Before and after with recorded route](gjh-v11-references/upper-perimeter-runtime.webp) · [Lift geometry](gjh-v11-stage7-lift-facilities.md)

## Ground-floor restroom cluster

**Status:** Planned. The released site still treats the eastern location as a closed reservation.

The eastern facilities parcel spans X 21–29 and Z 6–14. It fronts the east public route, with a 6 m arcade before the east storefront line at X 35. The design reuses this parcel for three separately enterable rooms, keeping the two northern service reserves closed. Each entrance will face the public arcade. A private offset sightline will keep the toilet area out of the arcade’s direct view. The all-user Accessible restroom has the widest door, basin approach and manoeuvring area, with grab rails and reachable controls. Clearance dimensions are targets for the virtual visitor. [BCA Universal Design Guide for Public Places, sanitary facilities](https://www1.bca.gov.sg/docs/default-source/universaldesign/udguide2016.pdf) · [BCA Guide to the Universal Design Index, accessible sanitary facilities](https://www1.bca.gov.sg/docs/default-source/universaldesign/guide-to-udi.pdf)

| Room | Planned parcel range | Player interactions |
| --- | --- | --- |
| Men | X 21–29, Z 6–8.5 | Enter and leave. Start and stop the basin tap. Activate a short flush. |
| Women | X 21–29, Z 8.5–11 | Enter and leave. Start and stop the basin tap. Activate a short flush. |
| Accessible restroom | X 21–29, Z 11–14 | Use the step-free entrance. Reach the basin and flush controls from the clear side. |

Wayfinding links the public arcade, map and directory to the shared approach. English, Simplified Chinese and Malay identify each room. Mirrors use a static material above the basins. Water and flush responses are cosmetic and occur only after deliberate keyboard or touch activation. Reuse or simplify original library geometry based on provenance and measured scene cost.

Acceptance covers physical approach and exit for all three doors, faucet on/off, observable flush feedback, both input modes, the directory and map route, translated labels, collision and mounted mirrors. Frame timing is sampled with recording disabled. The delivery will add screenshots, placement evidence and the verified published build.
