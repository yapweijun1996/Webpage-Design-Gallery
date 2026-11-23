# GJH v11 interior interaction backlog

The [interior programme](gjh-v11-interior-program.json) defines item IDs, actions and standing positions. All 17 expanded shops now have scripted actions. New Moon, MILI and GOGO were the first three pilot rooms.

| Pilot | Playable actions |
|---|---|
| GOGO | Ring the cart bell to serve a potong, pour a drink, water the fern or sit at a counter stool. |
| MILI | Press the island button to serve the tasting plate, or water the herb planter. |
| New Moon | Pour tea at the island or from either tasting stool. Cycle from the original shelf action to its drawer, open it, then pick up the corresponding can. Use the existing Add to bag or Return to shelf controls. |

Use **F** or the context card to activate the selected action. The closest standing position sets the first prompt. Shared positions offer native actions first, and a cabinet drawer follows its shelf. Use **[**, **]** or the card's **Next** button to cycle through nearby shop actions, stories and seats in either camera view. Use **Escape** or **Cancel** to stop a running action, then **Retry** to restart it. Both tasting stools keep their separate **Stand** button. Remaining pilot props show their exhibit label, and benches retain their original seat actions.

One procedural prop renders at a time, with no shadows or auxiliary lights. It shows the current action and its completed result while that target is selected. The ticker sleeps between actions and the state lives outside the graphics tiers. Leaving the room cancels an unfinished action.

The layout sweep checks each action from its standing position across all 17 shops. Standing positions less than 0.45 m apart must offer both actions through the same Next cycle. Node regression tests replay the three pilot rooms and cover the animation lifecycle and the four-product pickup, return and bag controls.

## Installed shop interactions

The expanded mall has 19 native shop seats when the Casio recital grand is installed, 60 scripted targets, 19 catalogue Story stops and four distinct physical product pickups. The [initial inventory](https://github.com/yapweijun1996/Webpage-Design-Gallery/commit/29ba490e219d68f764843d3f480760bd671e43ab) recorded ten seats. Five seats use their room-kit colliders, the LG studio sofa and Casio keyboard bench use their studio footprints, and the Gigaset bench shares its composite model’s collider. The central recital piano exposes its own bench only while the installed model supplies the cushion and instrument body.

The [65-action walkthrough](verify_interactions.py) covers the 60 scripted targets and five stools. Run `python tests/browser_gjh_showroom_seats.py` to exercise the eight additional SKIPPY, Sony, LG and Casio seats at phone and desktop sizes. Add `--width 390 768 1440` for the tablet routes. The [Gigaset walkthrough](../tests/browser_gjh_gigaset_seat.py) checks both native seats with the loaded model and with `--truncate-sofa`.

| Room | Native seats | Scripted targets | Stories | Installed exhibits and visitor actions |
| --- | ---: | ---: | ---: | --- |
| [S01 New Moon](goh-joo-hin/01-new-moon/README.md) | 2 | 13 | 2 | Two tasting stools. Four country-specific abalone cans support inspection, rotation, pickup, return and Add to bag. Each drawer leads to its matching can. |
| [S02 MILI](goh-joo-hin/02-mili/README.md) | 2 | 10 | 1 | Two lounge benches. The Story identifies the two oyster sauces and the mock duck tin. The tasting counter serves a sample. |
| [S03 GOGO](goh-joo-hin/03-gogo/README.md) | 5 | 7 | 1 | Two benches and three counter stools. Visitors can ring the potong cart bell and pour a drink. The Story covers the two historical potong varieties. |
| [S04 Borsch Med](goh-joo-hin/04-borsch-med/README.md) | 0 | 2 | 2 | Separate Stories cover the repellent patches and Lingzhi pack. The folio turns and the orchid can be watered. |
| [S05 Pien Tze Huang](goh-joo-hin/05-pien-tze-huang/README.md) | 0 | 2 | 1 | The single-unit and larger cartons share a Story. The specimen drawer and display case open. |
| [S06 Flying Wheel](goh-joo-hin/06-flying-wheel/README.md) | 0 | 2 | 1 | Ban Mee and Shanghai LaMian share a Story. Visitors can turn the wheel and serve a sample. |
| [S07 Gu Long](goh-joo-hin/07-gu-long/README.md) | 0 | 2 | 1 | Two pork tins share a Story. The tower and serving station offer sample demonstrations. |
| [S08 Skippy](goh-joo-hin/08-skippy/README.md) | 1 | 2 | 1 | Creamy and Chunky jars share a Story. Visitors can lift the jar lid and spread peanut butter. The breakfast chair offers Sit from the aisle. |
| [S09 SPAM](goh-joo-hin/09-spam/README.md) | 0 | 2 | 1 | Classic, Lite and Less Sodium tins share a Story. The conveyor and scanner can be activated. |
| [S10 California Mexico](goh-joo-hin/10-california-mexico/README.md) | 0 | 2 | 1 | Red and Black abalone exhibits share a Story. The shell opens to reveal the pearl. |
| [S11 Hormel](goh-joo-hin/11-hormel/README.md) | 0 | 2 | 1 | The two chili tins share a Story. Visitors can unpack and weigh the demonstration parcel. |
| [S12 Zeria](goh-joo-hin/12-zeria/README.md) | 0 | 2 | 1 | Lively & Healthy and Chondro Max share a Story. Visitors can match an herb print and water the orchid. |
| [S13 Sony](goh-joo-hin/13-sony/README.md) | 1 | 3 | 1 | The WH-1000XM6 and NW-A306 share a Story and the listening displays offer sound demos. Visitors can sit in the felt listening chair behind the console. |
| [S14 LG](goh-joo-hin/14-lg/README.md) | 3 | 2 | 1 | The OLED55C5PSA has a Story. Visitors can change the display channel and open the refrigerator. The alcove sofa, window ottoman and studio sofa each have a Sit action. |
| [S15 Casio](goh-joo-hin/15-casio/README.md) | 3 | 3 | 1 | The CT-S1BK and GP-510BP share a Story. Both instrument demos can play a phrase. Visitors can sit in the audience chair, at the CT-S1 or on the installed central grand’s bench. Both piano benches face their own keys. |
| [S16 GP Batteries](goh-joo-hin/16-gp-batteries/README.md) | 0 | 2 | 1 | The AA cells, eTag tracker and CR2032 cell share a Story. Visitors can switch the torch and test the cells. |
| [S17 Gigaset](goh-joo-hin/17-gigaset/README.md) | 2 | 2 | 1 | The sofa and backless bench support Sit and Stand with the model or its fallback. The A170 and COMFORT 550A share a Story. The receiver and dial have separate demo actions. |

Casio also displays a second black grand by the storefront. Its dark bench is a separate full-size cushion within that model’s collision box, and still needs its own approach and Sit action. The two Sony studio sofa declarations keep collision volumes after their mesh is replaced. Repeated shelf facings, alternate levels of detail and serving props reuse the underlying product or demonstration. [Seat registration](../demos/corporate/gjh/v11/assets/world.js) · [Shop action installer](../demos/corporate/gjh/v11/assets/interiors/shop-interactions.js) · [Seat and pickup controls](gjh-v11-engine-interactions.md)

## Original interaction proposals

The following design targets describe the intended feedback. The inventory above records what each room currently offers.

| Shop | Future interaction | Player feedback |
|---|---|---|
| New Moon | Find the moon figurine | A collection stamp |
| MILI | Choose a specific sample from the tasting plate | A sample card |
| GOGO | Choose a historical potong flavour | A matching sample |
| Borsch Med | Browse the colour-coded bottle display | Open a botanical illustration card |
| Pien Tze Huang | Slide open a specimen drawer | Reveal a decorative collectible |
| Flying Wheel | Pull a drying strand or turn the ship wheel | The noodle bundle sways |
| Gu Long | Choose a tin on the banquet stand | A can and a short chime |
| Skippy | Spread peanut butter on toast | A painted swirl follows the gesture |
| SPAM | Open a display tin | A lid animation and a tasting stamp |
| California Mexico | Open the shell | Reveal the glowing pearl |
| Hormel | Unpack a deli parcel | A folded wrapper opens around a keepsake |
| Zeria | Match herbs to their illustrations | A garden stamp, with no medical assessment |
| Sony | Select a listening station | Opt-in audio and a synchronised waveform |
| LG | Open a demonstration washer | A brief bubble animation |
| Casio | Play a short phrase on the keys | Notes and individual key highlights |
| GP Batteries | Fit cells into the test stand | The meter fills in steps |
| Gigaset | Lift the receiver | A ring and a short dialogue bubble |
