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
