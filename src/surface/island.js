// Procedural Greek-style island: limestone cliffs, a sandy cove, sea stacks and boulders.
// Everything is generated on the CPU once at start-up:
//   - a heightmap (metres, water level = 0) used by the terrain mesh, the water shader
//     (shallow-water colour, wave damping, shore foam) and the jet ski collision
//   - rock instances (sea stacks + boulders), also stamped into the heightmap
//   - rock meshes (noisy icospheres)

export const HM_N = 1024;          // heightmap texels per side
export const HM_SIZE = 2048;       // metres covered
export const HM_ORG = -HM_SIZE / 2; // world x/z of texel 0
export const HM_TEXEL = HM_SIZE / HM_N;

// ---------------------------------------------------------------- noise
let seed = 1234567;
export function rnd() {
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rr = (a, b) => a + (b - a) * rnd();
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

function hash2(ix, iy) {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return mix(mix(a, b, ux), mix(c, d, ux), uy) * 2 - 1;
}
export function fbm(x, y, oct = 5) {
  let s = 0, a = 0.5;
  for (let o = 0; o < oct; o++) { s += a * vnoise(x, y); x = x * 2.03 + 17.1; y = y * 2.03 - 9.7; a *= 0.5; }
  return s;
}
function hash3(ix, iy, iz) { return hash2(ix + Math.imul(iz, 1442695041), iy - Math.imul(iz, 2654435761)); }
function vnoise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const l = (dz) => mix(mix(hash3(ix, iy, iz + dz), hash3(ix + 1, iy, iz + dz), ux), mix(hash3(ix, iy + 1, iz + dz), hash3(ix + 1, iy + 1, iz + dz), ux), uy);
  return mix(l(0), l(1), uz) * 2 - 1;
}
function fbm3(x, y, z, oct = 4) {
  let s = 0, a = 0.5;
  for (let o = 0; o < oct; o++) { s += a * vnoise3(x, y, z); x = x * 2.1 + 3.3; y = y * 2.1 - 1.7; z = z * 2.1 + 7.1; a *= 0.5; }
  return s;
}

// ---------------------------------------------------------------- layout
// The player starts at (0, 0, 260) looking north (-Z). The island lies ahead with a sandy
// cove facing the start, rocky headlands either side, and cliffs all around the rest.
export const SPAWN = { x: 0, z: 240, yaw: 0 };
const ISLAND = { x: 0, z: -470, rx: 420, rz: 300 };
// coves: the big one facing the start, and smaller beaches all around the island.
// Smaller coves are placed on the actual coast line (found by marching outwards at their angle).
export const BAYS = [{ x: 30, z: -205, r: 150, sy: 1.25 }];
const COVE_ANGLES = [[-1.2, 62], [-1.95, 55], [-2.7, 60], [2.75, 66], [2.0, 52], [1.25, 58], [-0.62, 44]]; // angle from +Z, radius
const SMALL_ISLES = [                      // x, z, radius, height
  [-330, -120, 55, 26], [360, -170, 40, 22], [250, 90, 26, 14], [-210, 160, 18, 9],
];

// signed distance-ish to the coast (metres, < 0 on land)
function coastSdf(x, z) {
  const wx = x + fbm(x * 0.004, z * 0.004, 3) * 70, wz = z + fbm(x * 0.004 + 5.2, z * 0.004 - 1.3, 3) * 70;
  const ex = (wx - ISLAND.x) / ISLAND.rx, ez = (wz - ISLAND.z) / ISLAND.rz;
  let d = (Math.hypot(ex, ez) - 1) * Math.min(ISLAND.rx, ISLAND.rz);
  d += fbm(x * 0.012, z * 0.012, 4) * 28;
  // small-scale jaggedness: buttresses, gullies and little coves along rocky coasts
  const jag = fbm(x * 0.05, z * 0.05, 3), ridge = 1 - Math.abs(fbm(x * 0.11 + 3, z * 0.11, 2)) * 2;
  d += (jag * 9 + ridge * 2.5) * (1 - beachness(x, z));
  // the coves: subtract discs
  for (const B of BAYS) {
    const bay = Math.hypot(x - B.x, (z - B.z) * B.sy) - B.r + fbm(x * 0.02, z * 0.02, 2) * 14 * (B.r / 150);
    d = Math.max(d, -bay);
  }
  for (const [ix, iz, r] of SMALL_ISLES) d = Math.min(d, Math.hypot(x - ix, z - iz) - r + fbm(x * 0.03, z * 0.03, 3) * r * 0.5);
  return d;
}
// 1 inside / around the cove (sandy beach), 0 on cliff coasts
function beachness(x, z) {
  let m = 0;
  for (const B of BAYS) {
    const d = Math.hypot(x - B.x, (z - B.z) * B.sy);
    m = Math.max(m, sstep(B.r * 1.47, B.r * 1.07, d));
  }
  return m * sstep(-0.25, 0.1, fbm(x * 0.01 + 3, z * 0.01, 2) + 0.2);
}
// 1 around coves (wider than the sand): the land rises gently there instead of a cliff wall
function gentleness(x, z) {
  let m = 0;
  for (const B of BAYS) m = Math.max(m, sstep(B.r * 2.7, B.r * 1.15, Math.hypot(x - B.x, (z - B.z) * B.sy)));
  return m;
}
// coast without coves, for placing them
function coastBase(x, z) {
  const wx = x + fbm(x * 0.004, z * 0.004, 3) * 70, wz = z + fbm(x * 0.004 + 5.2, z * 0.004 - 1.3, 3) * 70;
  const ex = (wx - ISLAND.x) / ISLAND.rx, ez = (wz - ISLAND.z) / ISLAND.rz;
  return (Math.hypot(ex, ez) - 1) * Math.min(ISLAND.rx, ISLAND.rz) + fbm(x * 0.012, z * 0.012, 4) * 28;
}
for (const [a, r] of COVE_ANGLES) {
  const dx = Math.sin(a), dz = Math.cos(a);
  let t = 50;
  while (t < 900 && coastBase(ISLAND.x + dx * t, ISLAND.z + dz * t) < 0) t += 4;
  // centre a bit offshore of the coast so the disc bites a round cove into it
  BAYS.push({ x: ISLAND.x + dx * (t - r * 0.55), z: ISLAND.z + dz * (t - r * 0.55), r, sy: 1 });
}

function heightAt(x, z) {
  const d = coastSdf(x, z);            // < 0 on land
  const b = beachness(x, z), gb = Math.max(b, gentleness(x, z));
  const inland = -d;
  // small islands: their own peak height
  let isleTop = 0;
  for (const [ix, iz, r, h] of SMALL_ISLES) isleTop = Math.max(isleTop, h * sstep(r * 1.6, r * 0.2, Math.hypot(x - ix, z - iz)));
  if (inland > 0) {
    // cliff coast: a near-vertical limestone wall, then rolling maquis hills
    const cliffTop = 14 + 26 * sstep(-0.3, 0.5, fbm(x * 0.006 + 9, z * 0.006, 3));
    // stepped cliff: a sea wall, a ledge, then the upper wall, with a ragged rim
    const rim = 4 * fbm(x * 0.05, z * 0.05, 3);
    const lj = 6 * fbm(x * 0.03 + 11, z * 0.03, 2);
    let cliff = (cliffTop * 0.6 + rim) * sstep(0, 5, inland) + cliffTop * 0.4 * sstep(12 + lj, 17 + lj, inland) + 2.5 * sstep(0, 1.5, inland);
    // gullies cut down through the rim
    cliff -= 6 * Math.max(0, fbm(x * 0.04 - 5, z * 0.04, 2) - 0.15) * sstep(0, 8, inland);
    cliff += 130 * sstep(20, 420, inland) * (0.6 + 0.6 * fbm(x * 0.004 - 2, z * 0.004 + 4, 4));
    cliff += 6 * fbm(x * 0.03, z * 0.03, 3) * sstep(5, 30, inland);
    // beach: gentle sand rising to a low dune, then the hills
    let beach = 0.5 + inland * 0.04 + 2.5 * sstep(40, 90, inland);
    beach += 130 * sstep(50, 520, inland) * (0.6 + 0.6 * fbm(x * 0.004 - 2, z * 0.004 + 4, 4));
    beach += 2 * fbm(x * 0.03, z * 0.03, 2) * sstep(20, 60, inland);
    let h = mix(cliff, beach, gb);
    if (isleTop > 0) h = Math.min(h, isleTop + 6 * fbm(x * 0.05, z * 0.05, 3) + 3);
    return h;
  }
  // under water: steep drop off the cliffs, a long sandy shelf in the cove
  const o = -inland;
  const cliffDepth = 3 + o * 0.45 + 18 * sstep(10, 60, o);
  const beachDepth = 0.3 + o * 0.055 + 10 * sstep(140, 380, o);
  let depth = mix(cliffDepth, beachDepth, gb);
  depth = Math.min(depth, 48 + fbm(x * 0.002, z * 0.002, 2) * 10);
  // ripples / reef rubble
  depth += fbm(x * 0.05, z * 0.05, 3) * 1.2 * sstep(0, 8, o);
  return -depth;
}

// ---------------------------------------------------------------- rocks
// instance layout (12 floats): pos xyz, mesh id, scale xyz, yaw, tilt x, tilt z, tint, -
export function buildIsland() {
  seed = 20261116;
  const t0 = performance.now();
  const H = new Float32Array(HM_N * HM_N);
  const B = new Float32Array(HM_N * HM_N); // beachness, for the shaders' material choice
  for (let j = 0; j < HM_N; j++) {
    const z = HM_ORG + (j + 0.5) * HM_TEXEL;
    for (let i = 0; i < HM_N; i++) {
      const x = HM_ORG + (i + 0.5) * HM_TEXEL;
      H[j * HM_N + i] = heightAt(x, z);
      B[j * HM_N + i] = beachness(x, z);
    }
  }
  const sample = (x, z) => sampleH(H, x, z);

  const rocks = [];
  const add = (x, y, z, mesh, sx, sy, sz, tint = 0) => rocks.push([x, y, z, mesh, sx, sy, sz, rr(0, Math.PI * 2), rr(-0.15, 0.15), rr(-0.15, 0.15), tint, 0]);

  // sea stacks off the cliff headlands: tall, narrow, leaning a little
  let stacks = 0;
  for (let tries = 0; tries < 6000 && stacks < 16; tries++) {
    const x = rr(-650, 650), z = rr(-850, 200);
    const d = coastSdf(x, z);
    if (d < 25 || d > 110 || beachness(x, z) > 0.1) continue;
    if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 120) continue;
    if (rocks.some((r) => Math.hypot(r[0] - x, r[2] - z) < 60)) continue;
    const s = rr(9, 20), h = rr(16, 42);
    add(x, sample(x, z) - 2, z, stacks % 4, s, h + 20, s * rr(0.7, 1.2), 0.2);
    stacks++;
  }
  // talus: big blocks fallen from the cliffs, piled at their foot and half-embedded in the wall
  for (let tries = 0; tries < 80000 && rocks.length < 1100; tries++) {
    const x = rr(-900, 900), z = rr(-1000, 400);
    const d = coastSdf(x, z);
    if (d < -5 || d > 6 || beachness(x, z) > 0.3) continue;
    if (rnd() > 0.5) continue;
    const s = rr(3, 9);
    const y = Math.min(sample(x, z), 2);
    add(x, y - s * 0.3, z, (rnd() * 4) | 0, s * rr(1.0, 1.6), s * rr(0.7, 1.3), s * rr(1.0, 1.5), rnd() * 0.5);
  }
  // boulders along the cliff coasts, in the surf line and scattered in the shallows
  for (let tries = 0; tries < 60000 && rocks.length < 1900; tries++) {
    const x = rr(-900, 900), z = rr(-1000, 400);
    const d = coastSdf(x, z);
    const b = beachness(x, z);
    if (d < -6 || d > 70) continue;
    const near = Math.exp(-Math.max(d, 0) / 18);
    let p = near * (1 - b * 0.85);
    if (b > 0.5 && d < 25 && d > -2) p = Math.max(p, 0.04); // a few rocks in the cove
    if (rnd() > p) continue;
    if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 40) continue;
    const s = rnd() < 0.55 ? rr(1.0, 2.5) : rr(2, 7.5) * (1 - 0.5 * b);
    const y = sample(x, z);
    if (y > 6) continue;
    // clusters: a big one often has small ones around it
    add(x, y - s * 0.25, z, (rnd() * 4) | 0, s * rr(0.9, 1.4), s * rr(0.6, 1.1), s * rr(0.9, 1.4), rnd() * 0.3);
    if (s > 4) {
      for (let k = 0, n = (rnd() * 4) | 0; k < n; k++) {
        const a = rr(0, 6.283), r = s * rr(1.0, 1.8), xx = x + Math.cos(a) * r, zz = z + Math.sin(a) * r, ss = rr(0.8, 2.2);
        add(xx, sample(xx, zz) - ss * 0.2, zz, (rnd() * 4) | 0, ss * 1.2, ss, ss * 1.1, rnd() * 0.3);
      }
    }
  }

  const H0 = H.slice(); // terrain without rocks, for drawing
  // stamp the rocks into the heightmap (an ellipsoid cap a bit smaller than the mesh)
  for (const r of rocks) {
    const [x, y, z, , sx, sy, sz] = r;
    const rad = Math.min(sx, sz) * 0.8, top = y + sy * 0.85;
    const i0 = Math.floor((x - rad - HM_ORG) / HM_TEXEL), i1 = Math.ceil((x + rad - HM_ORG) / HM_TEXEL);
    const j0 = Math.floor((z - rad - HM_ORG) / HM_TEXEL), j1 = Math.ceil((z + rad - HM_ORG) / HM_TEXEL);
    for (let j = Math.max(0, j0); j <= Math.min(HM_N - 1, j1); j++) {
      for (let i = Math.max(0, i0); i <= Math.min(HM_N - 1, i1); i++) {
        const px = HM_ORG + (i + 0.5) * HM_TEXEL - x, pz = HM_ORG + (j + 0.5) * HM_TEXEL - z;
        const q = 1 - (px * px + pz * pz) / (rad * rad);
        if (q <= 0) continue;
        const h = y + (top - y) * Math.sqrt(q);
        const k = j * HM_N + i;
        if (h > H[k]) { H[k] = h; B[k] = 0; }
      }
    }
  }

  const inst = new Float32Array(rocks.length * 12);
  rocks.forEach((r, i) => inst.set(r, i * 12));
  console.log(`island: ${rocks.length} rocks (${stacks} stacks), ${(performance.now() - t0).toFixed(0)} ms`);
  return { H, H0, B, rocks: inst, nRocks: rocks.length, meshes: [0, 1, 2, 3].map(rockMesh), sample };
}

export function sampleH(H, x, z) {
  const fx = (x - HM_ORG) / HM_TEXEL - 0.5, fz = (z - HM_ORG) / HM_TEXEL - 0.5;
  if (fx < 0 || fz < 0 || fx >= HM_N - 1 || fz >= HM_N - 1) return -60;
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * HM_N + i;
  return mix(mix(H[k], H[k + 1], u), mix(H[k + HM_N], H[k + HM_N + 1], u), v);
}

// ---------------------------------------------------------------- rock mesh: displaced icosphere
// vertex: position xyz (unit-ish), normal xyz  -> 6 floats
function rockMesh(variant) {
  const t = (1 + Math.sqrt(5)) / 2;
  let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]]
    .map((v) => { const l = Math.hypot(...v); return v.map((c) => c / l); });
  let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let s = 0; s < 3; s++) {
    const cache = new Map(), NF = [];
    const mid = (a, b) => {
      const k = a < b ? a * 65536 + b : b * 65536 + a;
      let m = cache.get(k);
      if (m === undefined) {
        const p = V[a].map((c, i) => c + V[b][i]), l = Math.hypot(...p);
        m = V.push(p.map((c) => c / l)) - 1; cache.set(k, m);
      }
      return m;
    };
    for (const [a, b, c] of F) { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); NF.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
    F = NF;
  }
  // displacement: big lumps + sharp ridges + horizontal bedding planes (limestone)
  const o = variant * 13.7;
  // cleavage planes: the block is a sphere cut by random half-spaces -> flat broken faces
  const saved = seed; seed = 777 + variant * 101;
  const planes = [];
  for (let k = 0; k < 11; k++) {
    const a = rnd() * Math.PI * 2, c = rnd() * 1.6 - 0.8, sn = Math.sqrt(1 - c * c);
    planes.push([sn * Math.cos(a), c, sn * Math.sin(a), 0.62 + rnd() * 0.3]);
  }
  planes.push([0, 1, 0, 0.55 + rnd() * 0.2]); // flattish top
  seed = saved;
  const P = V.map(([x, y, z]) => {
    let r = 1.15;
    for (const [nx, ny, nz, d] of planes) { const dd = x * nx + y * ny + z * nz; if (dd > 0.05) r = Math.min(r, d / dd); }
    r *= 1 + 0.07 * fbm3(x * 2.3 + o, y * 2.3, z * 2.3, 3);
    r += 0.035 * (1 - Math.abs(fbm3(x * 5.1, y * 5.1 + o, z * 5.1, 2)) * 2);
    // faceted look: quantise along a random-ish plane set
    const strata = Math.sin((y + 0.15 * fbm3(x * 2, o, z * 2, 2)) * 9 + o) * 0.025;
    r += strata;
    let yy = y * r;
    if (yy < -0.55) yy = -0.55 + (yy + 0.55) * 0.3; // flatter base
    return [x * r, yy, z * r];
  });
  const N = P.map(() => [0, 0, 0]);
  for (const [a, b, c] of F) {
    const u = P[b].map((v, i) => v - P[a][i]), w = P[c].map((v, i) => v - P[a][i]);
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    for (const k of [a, b, c]) for (let i = 0; i < 3; i++) N[k][i] += n[i];
  }
  const vb = new Float32Array(P.length * 6);
  P.forEach((p, k) => { const n = N[k], l = Math.hypot(...n) || 1; vb.set([p[0], p[1], p[2], n[0] / l, n[1] / l, n[2] / l], k * 6); });
  const ib = new Uint32Array(F.length * 3);
  F.forEach((f, k) => ib.set(f, k * 3));
  return { vb, ib };
}

// Sun shadows of the terrain + rocks, baked once: for every texel the height below which a point
// is in shadow (the highest "horizon" towards the sun). Any point (ground, rock face, boat, jet
// ski) is lit when its height is above this value.
export function shadowHeights(H, L) {
  const t0 = performance.now();
  const hl = Math.hypot(L[0], L[2]) || 1, dx = L[0] / hl, dz = L[2] / hl, tanE = L[1] / hl;
  const out = new Float32Array(HM_N * HM_N);
  const inv = 1 / HM_TEXEL;
  for (let j = 0; j < HM_N; j++) {
    for (let i = 0; i < HM_N; i++) {
      let hs = -1e4, t = 1.5;
      const x0 = i + 0.5, z0 = j + 0.5;
      while (t < 320) {
        const qi = (x0 + dx * t * inv) | 0, qj = (z0 + dz * t * inv) | 0;
        if (qi < 0 || qj < 0 || qi >= HM_N || qj >= HM_N) break;
        const h = H[qj * HM_N + qi] - t * tanE;
        if (h > hs) hs = h;
        t += 1.5 + t * 0.035;
      }
      out[j * HM_N + i] = hs;
    }
  }
  console.log(`shadow bake ${(performance.now() - t0).toFixed(0)} ms`);
  return out;
}
