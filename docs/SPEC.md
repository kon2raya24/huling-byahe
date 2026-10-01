# Huling Byahe (The Last Trip): spec

Approved 2026-09-28.

## Pitch

You drive the last jeepney of the night down a Manila road. Your passengers are ghosts, and each one needs to get somewhere before sunrise. Each ride gives you one piece of their story.

## Loop

- **Road:** a side-scrolling runner with 3 lanes; the jeepney moves right on its own.
- **Controls:**
  - ↑/↓ or swipe: change lanes
  - hold Space or the right half of the screen: brake
  - H or the horn button: horn
- **A night is one route of about 2–3 minutes,** on a clock from 11:00 PM to 5:00 AM.
  - It ends when you reach the terminal (complete), the sun rises (5:00 AM), or the jeepney breaks down (all hits used).
- **Stops:** a glowing *PARA* sign marks the curb (lane 1, the bottom lane).
  - Slow to almost a stop inside the zone while in the curb lane, and the ghost boards or gets off.
  - Passing the zone without stopping misses that stop.
- **Hazards:**
  - tricycle: slower traffic in a lane; the horn makes it pull over
  - manhole: a fixed hit
  - flood: slows you to 45% while inside; not a hit
  - stray dog: crosses the lanes
  - checkpoint: across all lanes; passing it faster than 120 is a hit
- **A hit** grants 1.5 s of invulnerability.
- **Coins:** a fare for every delivery, a bonus for a ride with no hits, and a bonus for finishing the night.
- **Garage upgrades** (2 levels each):
  - brakes: stronger deceleration
  - bumper: +1 hit allowance
  - horn: shorter cooldown

## Story

- **7 nights and 5 ghosts.** Every fragment is original and gentle; none depicts real events or gore.
  - **Lola Caring:** carries *pasalubong* for grandchildren who have grown up.
  - **Mika:** a nursing student going home after duty.
  - **Kuya Ben:** a jeepney barker who called passengers for years but never rode.
  - **Totoy:** a child looking for his dog, Bantay. The stray dog on the road *is* Bantay. On night 6 you stop for the dog instead of dodging it.
  - **The Silent Passenger:** rides every night and never speaks. On night 7 he speaks: he is Tatay Ernesto, your father, who died at the wheel on this route. The last trip is his, finished by his child.
- **Logbook (Talaan):** every fragment earned (at boarding and at drop-off) is kept. Missing ones show as "…", and replaying a night can fill them in.

## Presentation

- **Canvas:** 960×540 logical, scaled to fit and aware of device pixel ratio.
- **Art:** neon-noir Manila, drawn entirely in code; no image assets.
- **Dialogue:** an HTML subtitle bar with `aria-live`, so it stays legible and screen readers announce it.
- **Sound:** Web Audio, synthesized; muteable, and starts on the first input.
- **Reduced motion:** no screen shake and no flashes.
- **Language:** English with Tagalog phrases.
- **Saves:** localStorage, with every access guarded.

## Engineering

- **Stack:** a static site with no build step, using native ES modules.
- **Pure, tested modules:**
  - `world.mjs`: simulation step and events
  - `route.mjs`: seeded, fair hazard layout
  - `story.mjs`: nights, ghosts, logbook
  - `save.mjs`: persistence
- **Rendering and audio** only read state.
- **Tests:** `node --test test/*.test.mjs`.
- **Deploy:** Vercel and GitHub Pages; added to the portfolio as a trophy.

## Out of scope for v1

Leaderboards, daily seeds, more routes, and a Tagalog-only mode.


## v1.1 arcade layer (2026-09-28)

Added after playtesting that v1 felt plain: the only verb was dodging.

- **Gas:** hold → (D, or the GAS button) to raise the target speed to 1.4 × cruise. Floods still slow you, and braking wins over gas.
- **Barya:** coin trails in lanes clear of hazards (±250 px) and away from stops, from a separate random stream so hazards never move. 1 coin each, times the combo multiplier.
- **Lusot (near miss):** a hazard that was under 200 px ahead in your lane, then passed untouched, adds 1 to the combo and pays 1 × multiplier. Multiplier = min(5, 1 + ⌊combo / 2⌋). The combo fades after 6 s without another near miss, and a hit resets it.
- **Sakto:** a stop that triggers with the front bumper within 30 px of the sign pays +₱3. The target is painted on the road, and a bumper guide shows when a stop is near.
- **Horn:** dogs within horn range bolt across 2.5 × faster.
- **Stars:** one for reaching the terminal, one for making every stop, one for no bumps. The best per night is saved.
- **Economy:** upgrade costs doubled (brakes 60/120, bumper 80/160, horn 50/100) to absorb the barya income.
- **Juice:** particles (sparks, exhaust, spray, wisps, glints), popups, shake, passenger bubbles, speed gauge, combo badge, next-stop arrow, checkpoint warning, music loop.


## v2 AAA 3D presentation (2026-10-01)

The same game (world.mjs is untouched; 46 tests) with a real-time 3D view in three.js.
- **World:** the barangay at night along an endless street. Frontages sit in 7 m slots, posts every 26 m, and the LRT and city lie behind. Each night has a mood: sky, fog density, rain, mist, wetness, lamp colour, a street mix and a grade. Dawn rises ahead in the last 45 minutes.
- **Camera:** a three-quarter view from the curb side. It looks further ahead on the gas and eases in near a stop. On a tall phone it is higher and steeper. There are cinematic shots for the intro, title, results, garage and ending, plus shake, a punch on LUSOT and SAKTO, and a swing while a ghost boards. Calm mode turns off shake, flashes, swings and the letterbox bars.
- **Characters:** a procedural hero jeepney and fresnel ghosts with identities, plus procedural dogs, tricycles and a tanod.
- **Readability:** the speed gauge marks the stop speed (45), the checkpoint speed (120) and cruise. Near a stop it shows the bumper's distance to the sakto line, to a tenth of a metre, with a hint. The sakto band and line are painted on the road, with a light wall at the line.
- **Feel:** a hit freezes the sim for 90 ms (hit-stop). This changes no rules.
- **Settings** (saved in `settings`; older saves migrate): graphics, music, effects, sound and calm.
- **Fallback:** the 2D renderer if WebGL fails. No service worker: the game had none before, and none was added.
