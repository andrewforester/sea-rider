# Sea Rider

Ride a jet ski around a Greek-style island, go ashore, swim, dive into an underwater world and hunt for treasure.
WebGPU, no engine. The in-game interface is in Russian.

**Play:** https://andrewforester.github.io/sea-rider/ (needs a browser with WebGPU: Chrome / Edge 113+, Safari 26+).

## Controls

- **WASD / arrows** — throttle and steering / walking / swimming; **mouse** — look around (click to capture the cursor)
- **Shift** — faster, **Space** — jump
- **F** — get on the nearest jet ski, or jump off it
- Diving and surfacing are automatic: look down and swim forward to dive; swim up to surface. **Q** dives manually.

Collect all the ⭐ — on the beaches, in the village, on the hill tops, on buoys at sea and in the underwater world.

## Development

```bash
npm install
npm run build   # builds game.html
npm start       # http://localhost:8090
```

Pushes to `main` are built and deployed to GitHub Pages by `.github/workflows/pages.yml`.

## Credits

Built on two projects by Maksymilian Dendura (MIT):
- [web-ocean](https://github.com/Noniv/web-ocean) — FFT ocean (`LICENSE-web-ocean`)
- [abyssal-garden](https://github.com/Noniv/abyssal-garden) — underwater world (`LICENSE-abyssal-garden`)
