# GJH v11 interior interaction backlog

The [interior programme](gjh-v11-interior-program.json) defines item IDs, actions and standing positions. The runtime builds targets for all 17 layouts and enables the three pilot rooms in the expanded mall.

| Pilot | Playable actions |
|---|---|
| GOGO | Ring the cart bell to serve a potong, pour a drink, water the fern or sit at a counter stool. |
| MILI | Press the island button to serve the tasting plate, or water the herb planter. |
| New Moon | Pour tea at the island or from either tasting stool. Cycle from the original shelf action to its drawer, open it, then pick up the corresponding can. Use the existing Add to bag or Return to shelf controls. |

Use **F** or the context card to activate the selected action. **[** and **]** cycle nearby actions in either camera view. The card's **Next** button cycles on touch. Use **Escape** or **Cancel** to stop a running action, then **Retry** to restart it. Both tasting stools keep their separate **Stand** button. Remaining pilot props show their exhibit label, and benches retain their original seat actions.

One procedural prop renders at a time, with no shadows or auxiliary lights. It shows the current action and its completed result while that target is selected. The ticker sleeps between actions and the state lives outside the graphics tiers. Leaving the room cancels an unfinished action.

Node coverage checks the 17 target sets, pilot standing routes, the animation lifecycle and the original four-product pickup, return and bag controls. Headed Chrome remains unverified. Inspect the 44 px touch controls, both camera views, tier changes during an action, the GOGO stool sit/stand routes and the four New Moon shelves. Compare cold early entry and the [lap and shop video probes](gjh-v11-probes.md) with the prior build.

## Future interactions

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
