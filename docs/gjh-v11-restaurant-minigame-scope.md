# GJH v11 Restaurant Mini-game - P0 Scope (one page)

Status: scope only, no code. Numbers below are GJH original starting values, not official Diner Dash values.

## Goal
Prove a time-management restaurant loop (queue, seat, order, cook, serve, pay, clean) inside the GJH Virtual Mall demo, as a 4-table mobile "Management Mode" prototype.

## Non-goals (P0)
Third-person walking service, 3D waiter animation, upgrades, VIP/reservations, BGM, multiplayer, any change to the existing mall HUD files while the mobile HUD fix is in progress.

## Constraints
- Vanilla ES modules, no TypeScript, no React, no build step, no CI. New files only, under demos/corporate/gjh/v11/restaurant/.
- Simulation engine has no DOM/Three.js imports; rendering and input are thin adapters.
- Fixed timestep; paused when the page is hidden; resume must not add waiting time.
- Seeded RNG for customer arrivals; deterministic replay.
- Icons: inline SVG from SVG-Icon-Studio only. Brand assets: use only what v11 already ships.

## P0 content
- 4 tables (2 x 2-seat, 2 x 4-seat), 1 kitchen queue, 1 waiter, 3 customer types (Regular, Business, Family).
- Customer states: ARRIVING, WAITING_FOR_TABLE, SEATED, READING_MENU, WAITING_TO_ORDER, WAITING_FOR_FOOD, EATING, WAITING_TO_PAY, LEAVING.
- Table states: CLEAN, OCCUPIED, DINING, PAYMENT, DIRTY, CLEANING. A dirty table cannot be seated; a party never sits at a table that is too small.
- Patience 0-100 drops per second by stage; finishing a stage restores part of it; 0 means the party leaves.
- Chain: same service action in a row raises a multiplier; rules live in a data table, not in UI code.
- Level: fixed shift length and a minimum score; win or lose screen.
- Actions are idempotent (no double payment, no double score).

## Mobile controls
Top-down or 45-degree view; tap a party, tap a table, tap an item. Targets >= 44px. Single-hand play in portrait.

## Acceptance (P0 subset of the 30 proposed tests)
Seeded arrivals; wrong-size table rejected; dirty table rejected; single order submit; no early pickup; no double payment; patience by sim time; abandon flow; chain increments and resets; score never double-counted; pause stops timers; low FPS gives same result; exit restores the mall state.

## Open questions (owner decision)
1. Does the client (Goh Joo Hin) want a game in the demo at all?
2. Which brands appear in the restaurant, if any?
3. Priority versus the mobile HUD fix and BGM.
