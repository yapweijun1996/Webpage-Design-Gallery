# S17 Gigaset handset models

| Editable mesh | Native W × H × D (mm) | Triangles |
| --- | --- | ---: |
| Gigaset A170 cradle | 89 × 43 × 89, nominal | 204 |
| Gigaset A170 handset | 48 × 159 × 30 | 614 |
| Gigaset COMFORT 550A answering base | 123 × 43 × 99 | 300 |
| Gigaset COMFORT 550A handset | 52 × 161 × 26 | 362 |
| **Combined** | | **1,480** |

Native dimensions use slot axes X (width), Y (height) and Z (depth), in that order, before posing. In Blender mesh coordinates these correspond to X, Z and Y. The base origins are at the centre of their footprints on the existing round island, at slot-local `(-.32, 1.15, -.63)` and `(.32, 1.15, -.63)` metres. Both handsets face local +Z and seat in recessed wells. Their estimated rearward leans are 9° and 7° respectively. The 550A well is on the left of its base, with the controls on the right.

## Geometry and references

- **Black Gigaset A170.** The supplied manufacturer front and three-quarter photos guide the tapered handset, round receiver, blank amber 34 × 22 mm display, paired softkeys, call and navigation row, and separated 12-key dial pad. Gigaset's 2018 French sheet gives the A170 base as 89 × 89 × 43 mm in length × width × height. This supports the short cradle seen in the photos and the existing model. The English catalogue lists the same numbers with a conflicting H × W × D header. The regional base dimensions and exact shell curvature remain open. [Gigaset technical sheet, p. 2](https://www.procie.com/mediaprovider/index/index/media_type/notice/filename/A170NOIR.pdf/#page=2) · [English product gallery and specifications](https://www.gigaset.com/en_en/gigaset-a170/)
- **Black Gigaset COMFORT 550A.** The supplied manufacturer catalogue photo guides the black handset, contrasting trim and black answering base. The activated area of the 35 × 44 mm display is represented by blank, dark glass. The family manual's page 4 guides the softkey, message key, navigation, call and dial-pad groups. Page 5 guides the recessed panel, with two rows of three keys (volume down, volume up and paging above back, forward and delete), then the message-count window on the lower left and play/power key on the lower right. [Gigaset COMFORT 550A product gallery and specifications](https://www.gigaset.com/hq_en/gigaset-comfort-550/) · [Gigaset family manual, pp. 4–5](https://gse.gigaset.com/fileadmin/legacy-assets/CustomerCare/Manuals/COMFORT_5xx_analog/A31008-M3001-L101-1-7619_en_IE-UK.pdf#page=4)
- The source photos and diagrams guide silhouettes and control positions. Local curves, bevels, control sizes, well depths and seated angles are modelled estimates. Colour is vertex pigment. Displays and keys are unmarked.

## Entry points

- [gigaset_models.py](../../scripts/gjh_interiors/gigaset_models.py) exposes `add_gigaset(room)` for the S17 interior. Its faces append to the existing painted `CRAFT` (`Enamel`) batch. The four named entries in `PARTS` provide each native geometry emitter and display transform.
- [generate.py](generate.py) exposes `build()`, which links and returns four individually editable meshes in table order. Objects share one painted material and keep their pose in object transforms so local bounds can be inspected directly.

Both sets share the tabletop island. The large telephone fixture and sofa remain separate exhibits.

[Editable Blender source](gigaset-handsets.blend) · [Installed room GLB](../../demos/corporate/gjh/v11/assets/interiors/s17-telephone-details.glb) · [QA receipt](receipt.json)
