# Architecture

One game, two renderers, one page. The **surface** renderer (`src/surface/`, from
[web-ocean](https://github.com/Noniv/web-ocean)) draws the FFT ocean, the island, the
boats and the jet ski, and runs the game: riding, swimming, walking and the treasure
hunt. The **underwater** renderer (`src/underwater/`, from
[abyssal-garden](https://github.com/Noniv/abyssal-garden)) is a separate world you dive
into. Each has its own `GPUDevice` and its own canvas; `body[data-mode]` decides which
one is visible, and the `window.UW` object is the only bridge between them. There is
no engine and no runtime dependency: WebGPU, WGSL and Web Audio only.

## Repository layout

| Path                         | Owns                                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| `template.html`              | The page: canvases, HUD, loading screen, touch controls, CSS, the loading controller   |
| `build.mjs`                  | Bundles both renderers into `template.html` and writes `game.html`                     |
| `src/i18n.js`                | Interface language (Russian, Ukrainian): `tr()`, the switch, `data-i18n` labels; Russian text is the key |
| `server.mjs`                 | Dev server on port 8090: serves `game.html` at `/`, takes `/__log` and `/__shot`       |
| `src/surface/main.js`        | Device, pipelines, textures, uniforms, input, HUD, the frame loop                      |
| `src/surface/game.js`        | Game state: modes, jet skis, the player body, cameras, dives, treasure pickup, hints   |
| `src/surface/island.js`      | The island: coastline, coves, heights, rocks, rock meshes, the baked shadow heights    |
| `src/surface/jetski.js`      | `MeshBuilder`, jet ski and rider meshes, jet ski physics (`stepSki`) and its matrix    |
| `src/surface/props.js`       | The village with its chapel, the boats and yachts with their paths, wakes and collision |
| `src/surface/treasures.js`   | Treasure meshes, their placement above water, animation and the gold glow sprites      |
| `src/surface/audio.js`       | Above-water sound, synthesised live: sea, surf, wind, engine, steps, gulls, the chime  |
| `src/surface/touch.js`       | Phone controls: floating stick, look by dragging, context buttons                      |
| `src/surface/wgsl/common.js` | Shared constants (FFT size, cascades, LUT sizes) and the `Frame` uniform struct         |
| `src/surface/wgsl/sim.js`    | Ocean simulation: spectrum, evolve, FFT rows and columns, foam clipmaps and wakes        |
| `src/surface/wgsl/ocean.js`  | Ocean surface, sky background and the height probe                                     |
| `src/surface/wgsl/sky.js`    | Atmosphere LUTs, sky view, sun visibility, environment cube, clouds                    |
| `src/surface/wgsl/land.js`   | Heightmap access, lighting, terrain, rocks, models and glow sprites                    |
| `src/surface/wgsl/post.js`   | Bloom chain and the final composite with tonemapping                                   |
| `src/underwater/*.js`        | The abyssal-garden renderer: quality, math, shaders, world generation, main, audio     |
| `src/underwater/.integrated` | Flag file: the build includes the underwater world only when it exists                  |
| `.github/workflows/pages.yml`| Build and deploy to GitHub Pages on every push to `main`                               |
| `ref/`                       | Local clones of both original projects, git-ignored, for reading upstream code         |

Generated, never committed: `game.html`, `node_modules/`, `shots/` (screenshots taken
through `/__shot`).

## Build

`build.mjs` bundles `src/surface/main.js` with esbuild into one ES module
(`--min` minifies it). The underwater files are plain scripts that share one scope;
they are concatenated in the order `quality, math, shaders, world, main, audio` and
wrapped in one async function, so their top-level `await` works and a failure shows
in the loading text instead of breaking the page (`--no-uw` leaves them out). Both
go into `template.html` at the `<!--SURFACE-->` and `<!--UNDERWATER-->` markers. The
result is a single self-contained `game.html` of about 360 KB with no external
requests.

The Pages workflow runs `npm ci`, `npm run build`, copies `game.html` to
`_site/index.html` and deploys it. The live game is at
https://andrewforester.github.io/sea-rider/.

## Loading

The loading controller is the inline script in `template.html`. It exposes
`loadProgress(part, value, message, ms)` and `loadSkip()`. The island is the first
40% of the bar, the underwater world the remaining 60%.

1. The surface creates its device and compute pipelines, builds the island on the
   CPU (about one second), bakes the shadow heights and creates the render pipelines,
   reporting each step. `breathe()` yields to the browser before long synchronous
   steps so the screen can update.
2. On its third rendered frame the surface sets `window.SURFACE_READY` and reports
   the island done. From now on the game shows through a CSS blur on `#game` that
   clears as the rest loads, and a key or a tap (`loadSkip`) starts the game early
   and shrinks the loader into a small bar at the top.
3. The underwater script waits for `SURFACE_READY` before it asks for a GPU device.
   Loading both at once made them compete for the GPU and delayed the island by
   several seconds. Its stages report through the same controller.
4. When the underwater world is ready, `UW.ready` becomes true and the loader fades
   out. Diving before that only shows a message.

## Frame

One `requestAnimationFrame` loop in `src/surface/main.js`. `resize()` returns
false while the canvas has no layout size, and the frame is skipped: a first frame
drawn at 1×1 would make the bloom texture invalid, the whole command buffer would be
dropped, and with it the one-time spectrum and sky LUT passes. The render target is
at least 256 px and at most about 2.3 MP (1.1 MP on touch devices); the browser
scales it to the window.

Per frame, in this order:

1. `game.update(dt)`: input, the active mode, the cameras, treasure pickup, sound,
   and the wake segment behind the jet ski. In `under` mode only the timers run and
   the frame returns early, so the surface does no GPU work while you dive.
2. `boats.update` moves the boats along their paths, `boats.collide` bumps the jet ski.
3. Uniforms: `Frame`, the simulation block, the foam block with up to 16 wake segments
   (the jet ski and the boats), the model matrices, the glow instances.
4. Compute pass: spectrum (first frame only), evolve and FFT for every cascade, foam
   update and mips, transmittance and multiple scattering LUTs (when the sun or haze
   changes), the height probe, sky view, sun visibility, environment cube and its mips.
5. Main render pass (MSAA, reverse-Z, camera-relative): terrain, rocks, models
   (jet skis, rider, village, boats, treasures), the ocean, the sky, then the glow
   sprites with additive blending.
6. Bloom down and up chain, then the composite into the canvas.
7. The probe output is copied into a free buffer of a ring of four and mapped; the
   result lands in `game.probe` a frame or two later.

## Contracts

### Heightmap

`island.js` owns a 1024×1024 grid over 2048 m (`HM_ORG = -1024`, 2 m per texel),
centred on the origin; the island centre is near `(0, -470)`. It is uploaded once as
an `rgba32float` texture:

| Channel | Meaning                                                                          |
| ------- | -------------------------------------------------------------------------------- |
| `x`     | Terrain height as drawn (`H0`, before rocks are stamped in)                     |
| `y`     | Beachness, 0 to 1 (sand, gentle slopes, swash foam)                              |
| `z`     | Terrain plus rocks (`H`): collision, water depth, shore foam, wave damping       |
| `w`     | Baked sun shadow height (`shadowHeights`), compared with a point's height        |

The CPU side reads the same data through `terrainH(x, z)` (bilinear over `H`).
Negative heights are under water; the sea surface is at 0. Waves are damped toward
the shore by `waveDamp(depth)`. Changing the sun direction requires baking the shadow
heights again.

### Height probe

`HEIGHT_PROBE` has 8 slots; `game.probePoints` fills 7 of them: the camera (0), the
four hull points of the jet ski (1 to 4), the player (5) and the jet ski centre (6). Each result is `vec4(waterHeight, slopeX, slopeZ, terrainHeight)`.
The readback is two to three frames late, so the points are predicted ahead by the
current velocity.

### Model slots

`modelUBO` holds 64 `mat4x4f`. Slot 0 is the active jet ski, 1 the rider (drawn only
while riding), 2 the village (identity), from 3 the boats, then the parked jet skis
(`game.fillModels` returns the slots it used), then the treasures
(`game.fillTreasures`). All model meshes share one vertex buffer; `mdlRange` holds
each mesh's index range. Vertices are position, normal and RGBA, where alpha is gloss;
gloss of 2 or more marks emissive gold.

### The UW bridge

`window.UW` is created by the underwater script:

| Member              | Direction           | Meaning                                                        |
| ------------------- | ------------------- | -------------------------------------------------------------- |
| `ready`             | underwater → game   | The world is generated and can be entered                      |
| `active`            | underwater          | It is the visible world; its frames, keys and touch run only then |
| `enter(x, y, z, yaw, pitch)` | game → underwater | Start a dive at this pose, in underwater coordinates         |
| `leave()`           | game → underwater   | Stop and release input                                          |
| `onSurface(pose)`   | underwater → game   | The diver came up; the game places the swimmer and switches back |
| `onCollect()`       | underwater → game   | A treasure was found underwater                                 |
| `treasureTotal`     | underwater → game   | How many treasures the underwater world holds                   |

The underwater world takes the treasure mesh and glow helpers from
`window.TREASURE_LIB`, which the surface publishes, so both worlds show the same gold.
Its coordinates are its own: a dive always starts at `UW_START` and the horizontal
offset you swim is added back to the dive point when you surface.

## Game

`createGame` in `game.js` keeps one mode at a time:

| Mode    | Camera                    | Moves by                     | Leaves to                                       |
| ------- | ------------------------- | ---------------------------- | ----------------------------------------------- |
| `ski`   | Chase, follows the turn   | `stepSki` physics            | `swim` or `walk` (Space, F): by water depth     |
| `swim`  | First person, at the surface | W/S, A/D turn             | `walk` in shallow water, `under` when swimming forward while looking down over deep water, `ski` near a jet ski |
| `walk`  | First person, eyes 1.8 m  | W/S, A/D turn, Space jumps   | `swim` in water deeper than 1.2 m, `ski` near a jet ski |
| `under` | The underwater renderer   | its own controls             | `swim` when the diver comes up                  |

A jet ski waits in the shallows of every cove; the one you leave stays where you left
it, and the HUD marker points at it while you swim or walk. Treasures are collected
by distance in every mode. The HUD reads `game.hud()` every frame: a hint, a message
and the counter.

Input is the `keys` map filled by `main.js` plus the analog stick values `joyF` and
`joyR` from `touch.js`. Mouse and touch look both go through `game.mouse(dx, dy)`.

## Touch and phones

`setupTouch` runs on a coarse pointer, or anywhere with `?touch`. It adds
`body.touch`, which shows `#touch` and the shorter hints. Held upright, the CSS turns
the whole page on its side, so the game is always landscape; pointer positions are
mapped into the rotated page by `pt()`, and anything that positions HUD elements uses
the page size (`document.body.clientWidth`), not `innerWidth`. On the first touch the
page asks for full screen and a landscape lock where the browser allows it.

## Sound

`audio.js` builds one Web Audio graph on the first key, click or touch. All loops go
through an ambient bus that fades out while you dive; one-shots (splash, bump, chime)
go straight to the output. `update(state)` is called every frame and only moves
parameters; nothing is allocated per frame except one-shot voices.

## Dev URL parameters

| Parameter                       | Effect                                                           |
| ------------------------------- | ---------------------------------------------------------------- |
| `ski=x,z,yawDeg,orbitYaw,orbitPitch` | Start the jet ski at a place and heading                    |
| `cam=x,y,z,yawDeg,pitchDeg`     | Initial camera                                                    |
| `fov=deg`                       | Vertical field of view                                            |
| `w=…&h=…`                       | Fixed render size                                                 |
| `t=seconds`                     | Ocean simulation time                                             |
| `touch`                         | Force the touch controls on a desktop                             |
| `ui=0`                          | Hide the stats and the sea panel                                  |
| `dbg=n`                         | Shader debug view                                                 |
| `shot=name&frames=n&seq=k&keep=1` | Render n frames and post a PNG to `/__shot` (dev server only)   |

`H` toggles the sea settings panel. Logs go to `/__log` only on localhost.

## Conventions

Plain JavaScript ES modules, no framework, no TypeScript, no runtime dependencies;
esbuild is the only dev dependency. WGSL lives in template strings in `wgsl/*.js` and
shares constants with JavaScript through `${}`. Comments explain why, not what. Hot
paths allocate nothing per frame: reuse typed arrays. Names that cross files (the
`Frame` layout, heightmap channels, model slots, the `UW` bridge) are documented here
and changed here first.
