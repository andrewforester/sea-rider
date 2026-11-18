# Working in this repository

- Read `ARCHITECTURE.md` before touching the frame loop, the uniform layouts, the heightmap or the bridge between the two renderers; it is the contract.
- `npm run build` writes `game.html`; `npm start` serves it at http://localhost:8090. Rebuild after every source change: the page never loads `src/` directly. `game.html` is generated and git-ignored.
- Every change that shows on screen is checked in the browser before it is called done: console free of GPU errors, a screenshot of the result, and the phone layout (`?touch`, or a 375×812 viewport) when the HUD or the controls change.
- A hidden browser tab throttles `requestAnimationFrame` and timers to about once a second; a test that waits for frames takes a screenshot first to wake the tab, and no timing is measured in a hidden tab.
- Uniform buffers are written from `Float32Array` offsets in `src/surface/main.js` and read by WGSL structs in `src/surface/wgsl/`. Change both sides together, and keep the 16 byte alignment rules.
- One-time GPU work (wave spectrum, sky LUT, environment cube) runs on the first frames behind flags. Any frame that can submit an invalid command buffer loses it for good, so new render targets are created at a valid size before the first frame.
- `src/underwater/` is the abyssal-garden source, kept close to the original so upstream fixes can be ported. Changes there go through the `UW` bridge, not into the surface code.
- The in-game interface is Russian. Code, comments, docs, commit messages and the README are English.
- Text in the game is written for a child: short, friendly, no jargon. No all-caps words.
- Gameplay numbers (speeds, radii, depths) live as named constants or in one place in `game.js`; tune them there, not in several modes.
- Both original projects are MIT licensed by their author; keep `LICENSE-web-ocean`, `LICENSE-abyssal-garden` and the credits in the README.
- Git: atomic commits with a message that says what changed and why; commit and push only when asked. Every push to `main` deploys to GitHub Pages, so `main` must always build and run.
