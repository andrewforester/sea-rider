// Treasures to find: golden stars, little chests and star buoys. Placed on the beaches, in the
// village, on hill tops and floating on the sea (the underwater world places its own and reports
// finds through window.UW). Collecting one plays a chime and bursts into golden sparkles.
import { MeshBuilder } from './jetski.js';
import { BAYS, rnd } from './island.js';

const rr = (a, b) => a + (b - a) * rnd();
// gloss channel >= 2 marks emissive gold (strength = gloss - 2) in the model shader
const GOLD = [1.0, 0.62, 0.12, 3.2];
const GOLD_DIM = [0.9, 0.55, 0.1, 2.6];
const WOOD = [0.30, 0.15, 0.06, 0.15];
const BUOY_R = [0.75, 0.06, 0.03, 0.6];
const BUOY_W = [0.85, 0.85, 0.85, 0.6];

function star(mb, c, R, depth, col) {
  // extruded rounded 5-point star in the XY plane (faces +-Z), centred on c
  const pts = [];
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + Math.PI / 2, r = k % 2 ? R * 0.45 : R;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const front = [c[0], c[1], c[2] + depth * 1.8], back = [c[0], c[1], c[2] - depth * 1.8];
  for (let k = 0; k < 10; k++) {
    const p = pts[k], q = pts[(k + 1) % 10];
    const P = (v, z) => [c[0] + v[0], c[1] + v[1], c[2] + z];
    mb.tri(front, P(p, depth), P(q, depth), col, c);       // puffy front
    mb.tri(back, P(q, -depth), P(p, -depth), col, c);
    mb.quad(P(p, depth), P(p, -depth), P(q, -depth), P(q, depth), col, c);
  }
}

export function treasureMeshes() {
  const mb = new MeshBuilder();
  const kinds = {};
  let i0 = mb.i.length;
  star(mb, [0, 0, 0], 0.55, 0.12, GOLD);
  kinds.star = { i0, n: mb.i.length - i0 };
  // chest: wooden box, domed lid, gold bands and a glowing heap of coins inside
  i0 = mb.i.length;
  mb.box([0, 0.22, 0], [0.42, 0.22, 0.28], WOOD);
  mb.box([0, 0.46, -0.24], [0.42, 0.04, 0.05], WOOD);
  mb.box([0, 0.62, -0.32], [0.42, 0.2, 0.04], WOOD, 0.35);        // open lid
  for (const x of [-0.3, 0.3]) mb.box([x, 0.22, 0], [0.04, 0.23, 0.29], GOLD_DIM);
  mb.ellipsoid([0, 0.44, 0.02], [0.36, 0.1, 0.22], GOLD, 10);
  kinds.chest = { i0, n: mb.i.length - i0 };
  // buoy: red/white float with a star on a short pole
  i0 = mb.i.length;
  mb.ellipsoid([0, 0.05, 0], [0.45, 0.35, 0.45], BUOY_R, 12);
  mb.limb([0, 0.15, 0], [0, 0.42, 0], 0.35, 0.18, BUOY_W, 12);
  mb.limb([0, 0.4, 0], [0, 1.15, 0], 0.03, 0.03, BUOY_W, 6);
  star(mb, [0, 1.45, 0], 0.4, 0.09, GOLD);
  kinds.buoy = { i0, n: mb.i.length - i0 };
  return { ...mb.build(), kinds };
}

// ---------------------------------------------------------------- placement on / around the island
export function placeSurface(terrainH, village) {
  const T = [];
  const add = (kind, x, z, y, where) => T.push({ id: 's' + T.length, kind, x, z, y, where, got: false, t: 0, phase: rnd() * 10 });
  const ground = (x, z) => terrainH(x, z);
  // one on every beach: walk from the cove centre towards the island until dry sand
  const IC = { x: 0, z: -470 };
  for (const B of BAYS) {
    let dx = IC.x - B.x, dz = IC.z - B.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    let x = B.x, z = B.z, k = 0;
    while (k++ < 400 && ground(x, z) < 1.2) { x += dx * 2; z += dz * 2; }
    x += dx * 5 + rr(-6, 6); z += dz * 5;
    if (ground(x, z) > 1 && ground(x, z) < 12) add(T.length % 2 ? 'star' : 'chest', x, z, ground(x, z), 'beach');
  }
  // the village and the chapel
  if (village.houses.length > 3) {
    for (let n = 0, tries = 0; n < 3 && tries < 400; tries++) {
      const h = village.houses[(rnd() * village.houses.length) | 0];
      const a = rr(0, 6.28), x = h[0] + Math.cos(a) * (h[2] + 2.5), z = h[1] + Math.sin(a) * (h[2] + 2.5);
      if (village.houses.some((o) => Math.hypot(o[0] - x, o[1] - z) < o[2] + 1.2)) continue;
      if (T.some((t) => Math.hypot(t.x - x, t.z - z) < 30)) continue;
      add('star', x, z, ground(x, z), 'village'); n++;
    }
  }
  if (village.chapel) { const [cx, cz] = village.chapel; add('chest', cx + 2, cz + 7.5, ground(cx + 2, cz + 7.5), 'chapel'); }
  // hill tops
  const peaks = [];
  for (let j = 0; j < 60; j++) for (let i = 0; i < 60; i++) {
    const x = -450 + i * 15, z = -800 + j * 12, h = ground(x, z);
    if (h > 40) peaks.push([h, x, z]);
  }
  peaks.sort((a, b) => b[0] - a[0]);
  let np = 0;
  for (const [h, x, z] of peaks) {
    if (np >= 3) break;
    if (T.some((t) => Math.hypot(t.x - x, t.z - z) < 160)) continue;
    add('star', x, z, h, 'peak'); np++;
  }
  // floating buoys around the island: near coves, rocks and further out
  for (let tries = 0; tries < 4000 && T.filter((t) => t.kind === 'buoy').length < 12; tries++) {
    const a = rr(0, 6.28), r = rr(380, 700);
    const x = Math.sin(a) * r, z = -470 + Math.cos(a) * r * 0.85;
    const d = -ground(x, z);
    if (d < 4) continue;
    if (T.some((t) => Math.hypot(t.x - x, t.z - z) < 110)) continue;
    add('buoy', x, z, 0, 'sea');
  }
  return T;
}

// ---------------------------------------------------------------- sparkles (shared by both worlds)
// glow instances: [x, y, z, size, r, g, b, intensity]
export function glowFor(items, t, out, max, eye) {
  let n = 0;
  const push = (x, y, z, s, r, g, b, a) => { if (n >= max) return; out.set([x, y, z, s, r, g, b, a], n * 8); n++; };
  for (const it of items) {
    if (it.got && it.t > 1.6) continue;
    const p = itemPos(it, t);
    p[1] += it.kind === 'buoy' ? 1.45 : it.kind === 'chest' ? 0.55 : 0;
    const d = eye ? Math.hypot(p[0] - eye[0], p[2] - eye[2]) : 0;
    const far = Math.min(1, d / 300);
    if (!it.got) {
      const pulse = 0.75 + 0.25 * Math.sin(t * 3 + it.phase);
      // halo grows with distance so treasures can be spotted from afar
      push(p[0], p[1], p[2], (1.6 + far * 7) * pulse, 1.0, 0.72, 0.25, (1.2 + far * 2.5) * pulse);
      for (let k = 0; k < 3; k++) {
        const a = t * 1.3 + k * 2.09 + it.phase, r = 0.8 + 0.2 * Math.sin(t * 2 + k);
        push(p[0] + Math.cos(a) * r, p[1] + 0.3 * Math.sin(t * 2.3 + k * 1.7), p[2] + Math.sin(a) * r, 0.22, 1.0, 0.9, 0.5, 3.0);
      }
    } else {
      // burst: a bright flash and 24 sparkles thrown out and up, fading
      const u = it.t;
      push(p[0], p[1], p[2], 1 + u * 4, 1.0, 0.65, 0.15, 2.2 * Math.max(0, 1 - u / 0.5));
      for (let k = 0; k < 24; k++) {
        const a = k * 2.399 + it.phase, e = 0.3 + ((k * 7) % 10) / 12, sp = 3 + (k % 5);
        const x = p[0] + Math.cos(a) * Math.cos(e) * sp * u, y = p[1] + Math.sin(e) * sp * u - 2.5 * u * u, z = p[2] + Math.sin(a) * Math.cos(e) * sp * u;
        push(x, y, z, 0.25 * (1 - u / 1.6), 1.0, 0.75, 0.25, 3 * Math.max(0, 1 - u / 1.6));
      }
    }
  }
  return n;
}

// animated position of a treasure (floating / bobbing), used for drawing, glow and pickup
export function itemPos(it, t) {
  let y = it.y;
  if (it.kind === 'buoy') y = 0.25 * Math.sin(t * 1.1 + it.phase) - 0.05;
  else if (it.kind === 'star') y = it.y + 1.0 + 0.15 * Math.sin(t * 2 + it.phase);
  else y = it.y - 0.05;
  if (it.got) y += it.t * 1.5;
  return [it.x, y, it.z];
}
// column-major model matrix for a treasure (spinning stars, rocking buoys)
export function itemMatrix(out, off, it, t) {
  const [x, y, z] = itemPos(it, t);
  let s = 1, yaw = it.phase;
  if (it.kind === 'star') { s = 1.3; yaw = t * 2 + it.phase; }
  if (it.got) { yaw += it.t * 12; s *= Math.max(0, 1 + it.t * 0.8 - (it.t > 0.5 ? (it.t - 0.5) * 4 : 0)); }
  const c = Math.cos(yaw) * s, si = Math.sin(yaw) * s;
  const tilt = it.kind === 'buoy' ? 0.08 * Math.sin(t * 1.3 + it.phase) : 0;
  out.set([c, 0, -si, 0, si * tilt, s, c * tilt, 0, si, 0, c, 0, x, y, z, 1], off);
}
