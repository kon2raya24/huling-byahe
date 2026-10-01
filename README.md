# Huling Byahe · The Last Trip

A 3D browser arcade story game. You drive the last jeepney of the night through a Manila barangay, from 11 PM to 5 AM. Your passengers are ghosts, and each one has somewhere to be before sunrise.

**Play:** https://huling-byahe.vercel.app · https://kon2raya24.github.io/huling-byahe/

## How to play

- **↑ / ↓** change lanes (the bottom lane is the curb)
- **Hold →** (or D) for gas: faster, riskier, more barya per second
- **Hold Space** (or ←, Shift) to brake. Stops only count in the curb lane at low speed.
- **H** sounds the horn: dogs bolt across and tricycles pull aside
- **Esc / P** pauses
- **Controller:** D-pad or stick for lanes, R2 or A for gas, L2 or B to brake, X or Y for the horn, Start to pause
- On phones, use the on-screen buttons (portrait or landscape)

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

## The look

The road is a real-time 3D scene in three.js, seen from the curb side in a three-quarter view that looks down the road ahead (on a tall phone, higher and steeper, so the road fills the screen).

- **The route:** the barangay at night. Across the road stand sari-sari stores with lit grilles, houses with capiz windows and parols, a karinderya, a lugawan open 24/7, a botika, a piso net, closed roll-up shutters, a kapilya and vacant lots with trees. Electric posts carry sodium lamps and a tangle of wires. Behind it all are the LRT on its viaduct, with a train now and then, and the city's towers.
- **The jeepney:** built in code, with chrome horses on a stainless hood, a split windshield under a lit route board, airbrushed sides with the owner's name, chase lights round the roof, flags, mirrors and open windows. It has real headlights and tail lights, and its brake lights flare. The body pitches, rolls and bounces on its springs.
- **The ghosts:** translucent and glowing, brightest at their outline and fading below the waist. Each one has something of their own: Lola's bun and bag, Mika's nurse cap, Kuya Ben's towel, small Totoy, and Tatay's faded cap. They wait and wave at the PARA signs, walk into the back of the jeepney, ride on the bench, and walk to their porch light when they get off.
- **The road:** stray dogs (Bantay has one white ear) with eyes that catch the headlights, tricycles with their drivers, open manholes behind a blinking cone, floods, and a tanod's checkpoint with its siren. Barya spin on the road.
- **Each night has its own air:** a clear moonlit first trip, rain on wet asphalt, Cubao neon, green fog for the dog, golden rain, silver fog for Bantay, and the last trip. In the final 45 minutes dawn comes up at the end of the street.
- **Juice:** sparks and hit-stop on a bump, a camera punch and streaks on a LUSOT, a green ring and a bell on a SAKTO stop, horn rings, glints on barya, ghost wisps, spray in floods, steam from the manholes, exhaust, rain rings, and score text that floats where things happen. There are also an establishing crane shot for each night, tracking shots behind the title, an orbit on the results and in the garage, and a sunrise for the ending.
- **The film look** (`post.mjs`): ambient occlusion, bloom, a grade for each night that warms toward dawn, vignette, grain and SMAA. It steps down by itself on slow devices (`?gfx=0|1|2` pins it), and so do shadows and resolution.
- **The front end:** the title over the live scene, a night select, a chapter card for each night, a HUD (clock, the route with every stop, fares and bumps, a speed gauge marking where a stop counts and where a checkpoint lets you through, the distance to the sakto line), toasts, letterbox bars while a passenger speaks, and pause, results and settings screens. The settings cover graphics (auto, high, medium, low), music and effects volume, sound, and **calm** (no shake, flashes, letterbox or camera swings). Calm also turns on with `prefers-reduced-motion`.

If WebGL won't start, the original 2D renderer (`render.mjs`) takes over and the game plays the same (`?webgl=0` forces it).

## Assets

All CC0, all committed (about 6 MB):
- `assets/env/`: Poly Haven scans converted with the Bakbakan tools: asphalt, concrete pavement, corrugated iron and plaster; the `qwantani_night_puresky` sky; and props (a tree, shrubs, monobloc chairs, crates, rubbish bags, roll-up shutters, a utility box, a road barrier and a manhole cover). Without them the painted street stays as it is.
- `assets/sfx/`: Kenney (kenney.nl) Impact Sounds, RPG Audio and Interface Sounds, converted to mono MP3. They cover metal bumps, a manhole clang, a bell for SAKTO, coins, barya clinks and menu clicks. The rest of the sound is still synthesized.
- `src/vendor/`: three.js r186 (MIT) bundles.

## How it's built

- `src/world.mjs` is a pure simulation step: `step(state, input, dt)` returns events, and rendering and audio only read the state.
- `src/route.mjs` builds each night's road from a seed. Fairness rules keep the curb clear around stops and cap floods and checkpoints.
- `src/view3d.mjs` is the 3D view: the camera, the light, each night's mood and the juice. `src/jeepney3d.mjs`, `src/street3d.mjs` (frontages in 7 m slots chosen from the slot number; posts, curbs and lane paint snap along with the camera), `src/cast3d.mjs` (ghosts, dogs, tricycles, manholes, floods, checkpoints, barya, stops, terminal), `src/fx3d.mjs` (particles, rings, rain), `src/envpack.mjs` (the scans), `src/tex.mjs` (procedural canvas textures) and `src/post.mjs` hold the parts.
- `src/hud.mjs` draws the HTML HUD and floating text. `src/render.mjs` is the 2D fallback.
- `src/audio.mjs` mixes the synthesized engine, rain, horn, chimes and music loop with the recorded samples, on separate music and effects volumes.
- `src/story.mjs` holds the nights, ghosts and fragments. `docs/SPEC.md` is the design spec.

Test hooks: `?test=1&night=N&seed=S&go=1&autoplay=1&speed=K`, with `window.__hb` exposed; also `gfx`, `webgl=0` and `env=0`.

The stories are fiction. Made by [Lemmuel Turaya](https://kon2raya.netlify.app).

## License

MIT
