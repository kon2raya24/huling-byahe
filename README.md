# Huling Byahe · The Last Trip

A browser arcade story game. You drive the last jeepney of the night through Manila, from 11 PM to 5 AM. Your passengers are ghosts, and each one has somewhere to be before sunrise.

**Play:** https://huling-byahe.vercel.app · https://kon2raya24.github.io/huling-byahe/

## How to play

- **↑ / ↓** change lanes (the bottom lane is the curb)
- **Hold →** (or D) for gas: faster, riskier, more barya per second
- **Hold Space** (or ←, Shift) to brake. Stops only count in the curb lane at low speed.
- **H** sounds the horn: dogs bolt across and tricycles pull aside
- **Esc / P** pauses
- On phones, use the on-screen buttons and hold the phone sideways

Stop at **PARA** signs to pick up a ghost and at **BABA** signs to let one off. Put your front bumper on the green line for a **SAKTO** bonus. Grab the **barya** (coins) on the road, and swerve late past a hazard for a **LUSOT!** near miss: chain them into a combo that multiplies every coin. Mind the tricycles, manholes, floods, stray dogs and checkpoints (pass those under 120).

Each night gives up to three stars: reach the terminal, make every stop, and take no bumps. Fares and barya buy better brakes, a bumper and a louder horn in the garage. Seven nights, five ghosts, 29 story fragments, and one passenger who never says a word.

## Run locally

No build step. Serve the folder with any static server:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

Tests (Node 20+):

```sh
node --test test/*.test.mjs
```

The balance test drives every night with the autopilot across 25 seeds and checks that each night can be finished.

## How it's built

- `src/world.mjs` is a pure simulation step: `step(state, input, dt)` returns events, and rendering and audio only read the state.
- `src/route.mjs` builds each night's road from a seed. Fairness rules keep the curb clear around stops and cap floods and checkpoints.
- `src/render.mjs` draws everything on a 960×540 canvas, no image files: parallax Manila at night, particles, popups, screen shake and passenger reactions.
- `src/audio.mjs` synthesizes the engine, rain, splashes, horn, chimes and a quiet late-night music loop with Web Audio.
- `src/story.mjs` holds the nights, ghosts and fragments. `docs/SPEC.md` is the design spec.

The stories are fiction. Made by [Lemmuel Turaya](https://kon2raya.netlify.app).

## License

MIT
