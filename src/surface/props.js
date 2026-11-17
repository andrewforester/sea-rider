// Village on the hill above the cove, and boats that cruise around the island or lie at anchor.
// All meshes are vertex-coloured (same format and shader as the jet ski).
import { MeshBuilder, skiMatrix } from './jetski.js';
import { rnd } from './island.js';

const rr = (a, b) => a + (b - a) * rnd();
// linear colours, alpha = gloss
const WASH = [0.80, 0.80, 0.77, 0.08];      // whitewash
const WASH2 = [0.74, 0.72, 0.66, 0.08];
const BLUE = [0.01, 0.10, 0.42, 0.35];      // Aegean blue doors / shutters / domes
const BLUE2 = [0.02, 0.22, 0.45, 0.35];
const OCHRE = [0.60, 0.35, 0.12, 0.1];
const TERRA = [0.45, 0.14, 0.06, 0.1];
const GLASS = [0.02, 0.025, 0.03, 0.9];
const WHITE = [0.80, 0.81, 0.82, 0.8];
const TEAK = [0.32, 0.18, 0.08, 0.3];
const ANTIF = [0.30, 0.03, 0.03, 0.2];      // antifouling
const NAVY = [0.01, 0.02, 0.06, 0.8];
const CANVAS = [0.85, 0.84, 0.80, 0.05];
const STEEL = [0.5, 0.5, 0.52, 0.9];

// ---------------------------------------------------------------- village
export function villageMesh(terrainH) {
  const mb = new MeshBuilder();
  const houses = [];
  const ok = (x, z, r) => {
    const hs = [terrainH(x - r, z - r), terrainH(x + r, z - r), terrainH(x - r, z + r), terrainH(x + r, z + r), terrainH(x, z)];
    const lo = Math.min(...hs), hi = Math.max(...hs);
    return { lo, hi, good: lo > 6 && hi - lo < r * 1.1 && hi < 60 };
  };
  // the hillside behind the cove (the bay is centred near (30, -205), the beach to its north)
  for (let tries = 0; tries < 6000 && houses.length < 70; tries++) {
    const x = rr(-140, 200), z = rr(-470, -300);
    const w = rr(3, 5.5), d = rr(3, 5);
    const r = Math.max(w, d) * 0.75;
    const g = ok(x, z, r);
    if (!g.good) continue;
    if (houses.some((h) => Math.hypot(h[0] - x, h[1] - z) < (h[2] + r) * 1.15)) continue;
    // clustered: more likely near other houses
    if (houses.length > 4 && !houses.some((h) => Math.hypot(h[0] - x, h[1] - z) < 26) && rnd() < 0.85) continue;
    houses.push([x, z, r]);
    const start = mb.count;
    const floors = rnd() < 0.35 ? 2 : 1;
    const H = floors * 3.0;
    const base = g.lo - 1.5, top = g.hi + H;
    const hh = (top - base) / 2;
    const wall = rnd() < 0.8 ? WASH : WASH2;
    mb.box([0, base + hh, 0], [w / 2, hh, d / 2], wall);
    // flat roof with a parapet lip
    mb.box([0, top + 0.12, 0], [w / 2 + 0.12, 0.12, d / 2 + 0.12], WASH);
    // doors and shutters (towards -Z, then rotated)
    const col = rnd() < 0.75 ? BLUE : rnd() < 0.5 ? BLUE2 : OCHRE;
    mb.box([rr(-w / 4, w / 4), g.hi + 1.05, d / 2 + 0.03], [0.45, 1.05, 0.04], col);
    for (let f = 0; f < floors; f++) {
      const y = g.hi + 1.6 + f * 3;
      if (rnd() < 0.8) mb.box([-w / 2 + 0.9, y, d / 2 + 0.03], [0.35, 0.45, 0.04], col);
      if (rnd() < 0.8) mb.box([w / 2 - 0.9, y, d / 2 + 0.03], [0.35, 0.45, 0.04], col);
      if (rnd() < 0.6) mb.box([w / 2 + 0.03, y, 0], [0.04, 0.45, 0.35], col);
      if (rnd() < 0.6) mb.box([-w / 2 - 0.03, y, 0], [0.04, 0.45, 0.35], col);
    }
    // a few: pergola / blue dome / terracotta roof
    const k = rnd();
    if (k < 0.12) mb.ellipsoid([0, top + 0.2, 0], [w * 0.3, w * 0.32, w * 0.3], BLUE, 10);
    else if (k < 0.3) {
      // pitched terracotta roof
      const R = [w / 2 + 0.3, d / 2 + 0.3];
      mb.quad([-R[0], top, -R[1]], [R[0], top, -R[1]], [R[0], top + 1.2, 0], [-R[0], top + 1.2, 0], TERRA, [0, top - 1, 0]);
      mb.quad([-R[0], top, R[1]], [-R[0], top + 1.2, 0], [R[0], top + 1.2, 0], [R[0], top, R[1]], TERRA, [0, top - 1, 0]);
    }
    // face roughly towards the sea (south, +Z) with some jitter
    mb.place(start, x, 0, z, rr(-0.5, 0.5));
  }
  // chapel with blue dome and a little bell gable, on a spur above the village
  let chapel = null;
  for (let tries = 0; tries < 3000; tries++) {
    const x = rr(-160, 220), z = rr(-520, -330);
    const g = ok(x, z, 4.5);
    if (!g.good || g.lo < 18) continue;
    if (houses.some((h) => Math.hypot(h[0] - x, h[1] - z) < 12)) continue;
    const start = mb.count;
    const base = g.lo - 1.5, top = g.hi + 4.5, hh = (top - base) / 2;
    mb.box([0, base + hh, 0], [3, hh, 4.5], WASH);
    mb.box([0, top + 1.2, 0], [1.9, 1.2, 1.9], WASH);
    mb.ellipsoid([0, top + 2.4, 0], [1.9, 2.3, 1.9], BLUE, 14);
    mb.limb([0, top + 4.6, 0], [0, top + 5.6, 0], 0.06, 0.06, STEEL, 6);
    mb.limb([-0.35, top + 5.25, 0], [0.35, top + 5.25, 0], 0.05, 0.05, STEEL, 6);
    mb.box([0, top + 1.6, 4.6], [1.0, 1.6, 0.3], WASH);       // bell gable
    mb.box([0, top + 2.0, 4.65], [0.45, 0.6, 0.32], BLUE);
    mb.box([0, g.hi + 1.3, 4.53], [0.7, 1.3, 0.05], BLUE);    // door
    mb.place(start, x, 0, z, rr(-0.3, 0.3));
    chapel = [x, z];
    houses.push([x, z, 5.5]);
    break;
  }
  return { ...mb.build(), houses, chapel };
}

// ---------------------------------------------------------------- boats
// lofted hull: L long, B beam, D draft below water, F freeboard; colours by height band
function hull(mb, L, B, D, F, opt = {}) {
  const NS = 24, sec = [];
  const sternW = opt.sternW ?? 0.85, bowRise = opt.bowRise ?? 0.6;
  for (let s = 0; s <= NS; s++) {
    const t = s / NS, z = -L / 2 + t * L;
    const taper = Math.max(0, (t - 0.45) / 0.55);
    const w = (B / 2) * (1 - Math.pow(taper, 1.8)) * (t < 0.1 ? sternW + (1 - sternW) * t * 10 : 1) + 0.02;
    const keel = -D + (D + bowRise * 0.5) * Math.pow(taper, 2.4) + (t < 0.15 ? (0.15 - t) * D * 1.6 : 0);
    const sheer = F + bowRise * Math.pow(t, 3);
    sec.push([[0, keel, z], [w * 0.7, keel * 0.45, z], [w * 0.97, -0.05, z], [w, 0.2, z], [w * 1.01, sheer, z], [w * 0.93, sheer + 0.04, z], [0, sheer + 0.08, z]]);
  }
  const band = [opt.bottom ?? ANTIF, opt.bottom ?? ANTIF, opt.stripe ?? NAVY, opt.hull ?? WHITE, opt.rail ?? (opt.hull ?? WHITE), opt.deck ?? TEAK];
  for (let s = 0; s < NS; s++) {
    for (let k = 0; k < 6; k++) for (const sx of [1, -1]) {
      const m = (p) => [p[0] * sx, p[1], p[2]];
      const a = sec[s], b = sec[s + 1];
      mb.quad(m(a[k]), m(b[k]), m(b[k + 1]), m(a[k + 1]), band[k], [0, 0, (a[k][2] + b[k][2]) / 2]);
    }
  }
  for (const [S, cz] of [[sec[0], -L], [sec[NS], L]]) {
    for (let k = 0; k < 6; k++) for (const sx of [1, -1]) {
      const m = (p) => [p[0] * sx, p[1], p[2]];
      mb.tri([0, 0, S[0][2]], m(S[k]), m(S[k + 1]), k < 2 ? band[0] : opt.hull ?? WHITE, [0, 0, cz]);
    }
  }
}
function sail(mb, pts, col) {
  // two-sided: one triangle per side
  mb.tri(pts[0], pts[1], pts[2], col, [1, pts[0][1], pts[0][2]]);
  mb.tri(pts[0], pts[2], pts[1], col, [-1, pts[0][1], pts[0][2]]);
}

function sailYacht(mb) {
  const L = 12, B = 3.8;
  hull(mb, L, B, 1.0, 1.1, { stripe: NAVY, sternW: 0.9, bowRise: 0.3 });
  mb.box([0, 1.55, -0.8], [1.1, 0.35, 2.6], WHITE);           // coachroof
  mb.box([0, 1.6, 0.6], [1.0, 0.18, 1.0], GLASS, -0.25);
  mb.limb([0, 1.2, 1.2], [0, 16.5, 1.2], 0.09, 0.06, STEEL, 8); // mast
  mb.limb([0, 2.6, 1.2], [0, 2.6, -4.2], 0.07, 0.07, STEEL, 6); // boom
  sail(mb, [[0, 2.7, 1.1], [0, 16.2, 1.15], [0, 2.75, -4.1]], CANVAS);
  sail(mb, [[0, 1.4, 5.7], [0, 14.8, 1.35], [0, 1.6, 1.7]], CANVAS);
  return { L, B, sails: true };
}
function motorYacht(mb) {
  const L = 19, B = 5.2;
  hull(mb, L, B, 1.3, 1.9, { stripe: NAVY, sternW: 0.95, bowRise: 0.9, deck: TEAK });
  mb.box([0, 2.9, -1.0], [2.2, 0.95, 5.2], WHITE);             // main deck saloon
  mb.box([0, 2.95, -1.0], [2.23, 0.45, 5.0], GLASS);           // window band
  mb.box([0, 4.25, -2.0], [1.8, 0.45, 3.4], WHITE);            // flybridge
  mb.box([0, 4.3, 1.3], [1.6, 0.35, 0.3], GLASS, -0.5);
  mb.box([0, 4.95, -2.8], [1.7, 0.06, 2.0], WHITE);            // hardtop
  mb.limb([0, 5.0, -1.8], [0, 6.6, -2.3], 0.07, 0.05, STEEL, 6);
  return { L, B };
}
function caique(mb) {
  const L = 9, B = 3.0;
  const hullC = [0.78, 0.78, 0.75, 0.2];
  hull(mb, L, B, 0.9, 1.0, { hull: hullC, stripe: [0.02, 0.18, 0.5, 0.2], rail: [0.55, 0.08, 0.04, 0.2], bottom: [0.03, 0.15, 0.4, 0.2], bowRise: 0.9, sternW: 0.4 });
  mb.box([0, 1.85, -1.6], [0.95, 0.85, 1.1], [0.62, 0.42, 0.22, 0.2]);   // wooden wheelhouse
  mb.box([0, 2.75, -1.6], [1.1, 0.07, 1.25], [0.02, 0.18, 0.5, 0.3]);
  mb.box([0, 1.95, -0.48], [0.6, 0.3, 0.03], GLASS);
  mb.limb([0, 1.1, 1.4], [0, 6.0, 1.4], 0.07, 0.05, [0.4, 0.25, 0.12, 0.2], 6);
  mb.box([0, 1.25, 2.2], [0.7, 0.15, 0.8], [0.7, 0.5, 0.15, 0.1]);    // nets / crates
  return { L, B };
}
function speedboat(mb) {
  const L = 6.5, B = 2.4;
  hull(mb, L, B, 0.5, 0.75, { stripe: [0.6, 0.03, 0.02, 0.8], deck: WHITE, bowRise: 0.4 });
  mb.box([0, 1.15, 0.6], [0.95, 0.28, 0.05], GLASS, -0.6);
  mb.box([0, 0.95, -0.9], [0.8, 0.2, 0.9], [0.05, 0.05, 0.06, 0.3]);  // seats
  mb.box([0, 0.55, -3.3], [0.3, 0.45, 0.25], [0.05, 0.05, 0.06, 0.6]); // outboard
  return { L, B };
}

// Boats: some cruise around the island on loops in deep water, some lie at anchor in the cove.
export function createBoats(terrainH) {
  const mb = new MeshBuilder();
  const types = [];
  for (const f of [sailYacht, motorYacht, caique, speedboat]) {
    const i0 = mb.i.length;
    const info = f(mb);
    types.push({ ...info, i0, n: mb.i.length - i0 });
  }
  const mesh = mb.build();

  // a loop around the island: push each ray out until the water is deep enough
  const loop = (extra, n = 160) => {
    const pts = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const dx = Math.sin(a), dz = Math.cos(a);
      let r = 200;
      while (r < 1000 && (terrainH(dx * r, -470 + dz * r * 0.8) > -14 || r < 380)) r += 10;
      r += extra;
      pts.push([dx * r, -470 + dz * r * 0.8]);
    }
    // smooth
    for (let it = 0; it < 6; it++) for (let k = 0; k < n; k++) {
      const p = pts[(k + n - 1) % n], q = pts[(k + 1) % n];
      pts[k] = [(p[0] + q[0] + pts[k][0] * 2) / 4, (p[1] + q[1] + pts[k][1] * 2) / 4];
    }
    let len = 0; const cum = [0];
    for (let k = 0; k < n; k++) { const p = pts[k], q = pts[(k + 1) % n]; len += Math.hypot(q[0] - p[0], q[1] - p[1]); cum.push(len); }
    return { pts, cum, len };
  };
  const loops = [loop(30), loop(140), loop(300)];
  const boats = [];
  const spec = [ // type, loop, direction, speed m/s
    [0, 0, 1, 3.2], [0, 1, -1, 3.8], [0, 2, 1, 3.0], [0, 1, 1, 3.5],
    [1, 2, -1, 7.5], [1, 1, 1, 6.0],
    [2, 0, -1, 3.0], [2, 0, 1, 2.6], [2, 1, -1, 3.2],
    [3, 0, 1, 11.0], [3, 2, -1, 13.0],
  ];
  for (const [type, li, dir, speed] of spec) {
    boats.push({ type, loop: loops[li], dir, speed, s: rnd() * loops[li].len, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, phase: rnd() * 10, anchored: false, px: 0, pz: 0 });
  }
  // at anchor in the cove (and off the small isles)
  for (const [type, x, z] of [[0, -20, -255], [0, 75, -235], [2, 20, -290], [3, 55, -275], [1, -120, -150], [0, 230, 60]]) {
    if (terrainH(x, z) > -3) continue;
    boats.push({ type, anchored: true, x, z, y: 0, yaw: rnd() * 6.28, pitch: 0, roll: 0, phase: rnd() * 10, px: x, pz: z });
  }

  const at = (lp, s) => {
    s = ((s % lp.len) + lp.len) % lp.len;
    let k = 0; while (k < lp.pts.length - 1 && lp.cum[k + 1] < s) k++;
    const p = lp.pts[k], q = lp.pts[(k + 1) % lp.pts.length], u = (s - lp.cum[k]) / Math.max(lp.cum[k + 1] - lp.cum[k], 1e-6);
    return [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u];
  };
  function update(dt, t) {
    for (const b of boats) {
      b.px = b.x; b.pz = b.z;
      const T = types[b.type];
      if (!b.anchored) {
        b.s += b.speed * b.dir * dt;
        const [x, z] = at(b.loop, b.s), [x2, z2] = at(b.loop, b.s + b.dir * 6);
        b.x = x; b.z = z;
        b.yaw = Math.atan2(x2 - x, -(z2 - z));
      } else {
        b.yaw += Math.sin(t * 0.05 + b.phase) * 0.02 * dt; // swinging on the anchor
      }
      // gentle swell motion (smaller for big boats)
      const k = 3 / Math.max(T.L, 3);
      b.y = 0.18 * Math.sin(t * 0.9 + b.phase) * k * 3 - (T.L > 15 ? 0.1 : 0);
      b.pitch = 0.035 * Math.sin(t * 0.75 + b.phase * 1.3) * k * 2 + (b.anchored ? 0 : 0.01 * b.speed / 3);
      b.roll = 0.05 * Math.sin(t * 0.6 + b.phase * 0.7) * k * 2 + (T.sails && !b.anchored ? 0.12 : 0);
    }
  }
  function fill(out, slot0) {
    boats.forEach((b, i) => skiMatrix(out, b, (slot0 + i) * 16));
  }
  // jet ski collision: oriented boxes. Returns the hit speed (0 = none)
  function collide(ski) {
    let hit = 0;
    for (const b of boats) {
      const T = types[b.type];
      const cy = Math.cos(b.yaw), sy = Math.sin(b.yaw);
      const dx = ski.x - b.x, dz = ski.z - b.z;
      const lf = dx * sy - dz * cy, lr = dx * cy + dz * sy; // along forward / right
      const hl = T.L / 2 + 0.8, hw = T.B / 2 + 0.6 - 0.35 * Math.max(0, lf / (T.L / 2));
      if (Math.abs(lf) > hl || Math.abs(lr) > hw) continue;
      const pf = hl - Math.abs(lf), pr = hw - Math.abs(lr);
      let nx, nz, pen;
      if (pr < pf) { const sg = Math.sign(lr) || 1; nx = cy * sg; nz = sy * sg; pen = pr; } else { const sg = Math.sign(lf) || 1; nx = sy * sg; nz = -cy * sg; pen = pf; }
      ski.x += nx * pen; ski.z += nz * pen;
      // relative velocity (moving boats carry the ski along)
      const bvx = (b.x - b.px) / Math.max(1e-3, 1 / 60), bvz = (b.z - b.pz) / Math.max(1e-3, 1 / 60);
      const vn = (ski.vx - bvx * 0) * nx + (ski.vz - bvz * 0) * nz;
      if (vn < 0) { ski.vx -= nx * vn * 1.5; ski.vz -= nz * vn * 1.5; hit = Math.max(hit, -vn); }
    }
    return hit;
  }
  // wakes for the moving boats: [stern x, z, prev x, z, half width, strength]
  function wakes() {
    const out = [];
    for (const b of boats) {
      if (b.anchored) continue;
      const T = types[b.type];
      const sx = b.x - Math.sin(b.yaw) * T.L * 0.5, sz = b.z + Math.cos(b.yaw) * T.L * 0.5;
      const psx = b.px - Math.sin(b.yaw) * T.L * 0.5, psz = b.pz + Math.cos(b.yaw) * T.L * 0.5;
      out.push([sx, sz, psx, psz, T.B * 0.35, Math.min(0.8, b.speed / 10)]);
    }
    return out;
  }
  return { mesh, types, boats, update, fill, collide, wakes };
}
