// Jet ski + rider meshes (built from simple shapes) and the jet ski physics.
// Model space: +Z forward, +Y up, +X right (the model matrix turns +Z onto the heading).

// vertex: pos xyz, normal xyz, colour rgb + gloss  (10 floats)
export class MeshBuilder {
  constructor() { this.v = []; this.i = []; }
  get count() { return this.v.length / 10; }
  // rotate (yaw about +Y) and move every vertex added since `start`
  place(start, x, y, z, yaw) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (let k = start * 10; k < this.v.length; k += 10) {
      const px = this.v[k], pz = this.v[k + 2], nx = this.v[k + 3], nz = this.v[k + 5];
      this.v[k] = px * c + pz * s + x; this.v[k + 1] += y; this.v[k + 2] = -px * s + pz * c + z;
      this.v[k + 3] = nx * c + nz * s; this.v[k + 5] = -nx * s + nz * c;
    }
  }
  vert(p, n, c) { this.v.push(p[0], p[1], p[2], n[0], n[1], n[2], c[0], c[1], c[2], c[3] ?? 0.5); return this.v.length / 10 - 1; }
  // flat-shaded triangle (normal from winding, flipped outward from `center` when given)
  tri(a, b, c, col, center) {
    const u = sub(b, a), w = sub(c, a);
    let n = norm(cross(u, w));
    if (center) { const m = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3]; if (dot(n, sub(m, center)) < 0) { n = n.map((x) => -x); [b, c] = [c, b]; } }
    const k = this.vert(a, n, col); this.vert(b, n, col); this.vert(c, n, col);
    this.i.push(k, k + 1, k + 2);
  }
  quad(a, b, c, d, col, center) { this.tri(a, b, c, col, center); this.tri(a, c, d, col, center); }
  // smooth ellipsoid
  ellipsoid(c, r, col, seg = 12, rot = null) {
    const base = this.v.length / 10;
    for (let j = 0; j <= seg; j++) {
      const th = (j / seg) * Math.PI, st = Math.sin(th), ct = Math.cos(th);
      for (let i = 0; i <= seg * 2; i++) {
        const ph = (i / (seg * 2)) * Math.PI * 2;
        let d = [st * Math.cos(ph), ct, st * Math.sin(ph)];
        let p = [d[0] * r[0], d[1] * r[1], d[2] * r[2]];
        let n = norm([d[0] / r[0], d[1] / r[1], d[2] / r[2]]);
        if (rot) { p = rot(p); n = rot(n); }
        this.vert(add(c, p), n, col);
      }
    }
    const w = seg * 2 + 1;
    for (let j = 0; j < seg; j++) for (let i = 0; i < seg * 2; i++) {
      const a = base + j * w + i;
      this.i.push(a, a + w, a + 1, a + 1, a + w, a + w + 1);
    }
  }
  // capsule-ish limb between two points
  limb(p0, p1, r0, r1, col, seg = 10) {
    const ax = sub(p1, p0), len = Math.hypot(...ax), z = norm(ax);
    const t = Math.abs(z[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const x = norm(cross(t, z)), y = cross(z, x);
    const base = this.v.length / 10;
    for (let j = 0; j <= 1; j++) {
      const r = j ? r1 : r0, c = j ? p1 : p0;
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2, d = add(scale(x, Math.cos(a)), scale(y, Math.sin(a)));
        this.vert(add(c, scale(d, r)), d, col);
      }
    }
    for (let i = 0; i < seg; i++) { const a = base + i, b = a + seg + 1; this.i.push(a, b, a + 1, a + 1, b, b + 1); }
    this.ellipsoid(p0, [r0, r0, r0], col, 6);
    this.ellipsoid(p1, [r1, r1, r1], col, 6);
    void len;
  }
  box(c, h, col, rotX = 0) {
    const R = (p) => { const cs = Math.cos(rotX), sn = Math.sin(rotX); return [p[0], p[1] * cs - p[2] * sn, p[1] * sn + p[2] * cs]; };
    const P = [];
    for (let k = 0; k < 8; k++) P.push(add(c, R([(k & 1 ? 1 : -1) * h[0], (k & 2 ? 1 : -1) * h[1], (k & 4 ? 1 : -1) * h[2]])));
    const F = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]];
    for (const f of F) this.quad(P[f[0]], P[f[1]], P[f[2]], P[f[3]], col, c);
  }
  build() { return { vb: new Float32Array(this.v), ib: new Uint32Array(this.i) }; }
}
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// linear-space colours, alpha = gloss
const WHITE = [0.80, 0.82, 0.84, 0.9];
const RED = [0.62, 0.04, 0.03, 0.9];
const YELLOW = [0.85, 0.55, 0.02, 0.9];
const DARK = [0.025, 0.027, 0.03, 0.5];
const GREY = [0.12, 0.13, 0.14, 0.4];
const SEAT = [0.02, 0.02, 0.025, 0.25];

// ---------------------------------------------------------------- jet ski hull: lofted cross-sections
export function jetSkiMesh() {
  const mb = new MeshBuilder();
  const NS = 22;
  const sec = [];
  for (let s = 0; s <= NS; s++) {
    const t = s / NS;                     // 0 stern .. 1 bow
    const z = -1.55 + t * 3.15;
    const taper = Math.max(0, (t - 0.42) / 0.58);
    const w = 0.56 * (1 - Math.pow(taper, 1.7)) * (t < 0.06 ? 0.92 + t : 1) + 0.03;
    const keel = -0.22 + 0.55 * Math.pow(taper, 2.2);
    const chine = keel + 0.10 + 0.05 * taper;
    const deck = 0.30 + 0.12 * Math.pow(t, 2) + 0.05 * taper;
    const top = deck + 0.07;
    sec.push([
      [0, keel, z], [w * 0.82, chine, z], [w, chine + 0.06, z], [w * 1.02, deck - 0.08, z], [w * 0.97, deck, z], [w * 0.75, top, z], [0, top + 0.02, z],
    ]);
  }
  const C = [0, 0.1, 0];
  const bandCol = [WHITE, WHITE, WHITE, RED, WHITE, WHITE];
  for (let s = 0; s < NS; s++) {
    const a = sec[s], b = sec[s + 1];
    for (let k = 0; k < 6; k++) {
      const col = s > NS - 6 && k >= 4 ? YELLOW : bandCol[k];
      for (const sx of [1, -1]) {
        const m = (p) => [p[0] * sx, p[1], p[2]];
        mb.quad(m(a[k]), m(b[k]), m(b[k + 1]), m(a[k + 1]), col, [0, C[1], (a[k][2] + b[k][2]) / 2]);
      }
    }
  }
  // transom (stern plate) + bow cap
  for (const [S, cz] of [[sec[0], -2], [sec[NS], 3]]) {
    for (let k = 0; k < 6; k++) for (const sx of [1, -1]) {
      const m = (p) => [p[0] * sx, p[1], p[2]];
      mb.tri([0, 0.1, S[0][2]], m(S[k]), m(S[k + 1]), k === 3 ? RED : WHITE, [0, 0.1, cz]);
    }
  }
  // seat, footwells (dark rails), hood, handlebars, mirrors
  mb.box([0, 0.47, -0.55], [0.2, 0.09, 0.62], SEAT);
  mb.ellipsoid([0, 0.55, -0.55], [0.2, 0.06, 0.6], SEAT, 10);
  mb.box([0.46, 0.39, -0.35], [0.1, 0.02, 0.75], DARK);
  mb.box([-0.46, 0.39, -0.35], [0.1, 0.02, 0.75], DARK);
  mb.ellipsoid([0, 0.55, 0.45], [0.36, 0.2, 0.55], RED, 12);
  mb.ellipsoid([0, 0.62, 0.62], [0.24, 0.13, 0.28], YELLOW, 10);
  mb.box([0, 0.78, 0.22], [0.13, 0.12, 0.07], DARK, -0.4);
  mb.limb([-0.38, 0.92, 0.2], [0.38, 0.92, 0.2], 0.022, 0.022, GREY, 6);
  mb.limb([-0.38, 0.92, 0.2], [-0.47, 0.92, 0.16], 0.035, 0.035, DARK, 6);
  mb.limb([0.38, 0.92, 0.2], [0.47, 0.92, 0.16], 0.035, 0.035, DARK, 6);
  // stern grab handle + jet nozzle
  mb.limb([-0.15, 0.62, -1.15], [0.15, 0.62, -1.15], 0.025, 0.025, DARK, 6);
  mb.limb([0, -0.05, -1.45], [0, -0.05, -1.62], 0.09, 0.08, GREY, 8);
  return mb.build();
}

// ---------------------------------------------------------------- rider (wetsuit, life vest, helmet-free head)
export function riderMesh() {
  const mb = new MeshBuilder();
  const SUIT = [0.03, 0.035, 0.05, 0.3], VEST = [0.85, 0.22, 0.02, 0.5], SKIN = [0.45, 0.28, 0.18, 0.2], HAIR = [0.05, 0.035, 0.02, 0.2];
  const SHORTS = [0.03, 0.12, 0.35, 0.3];
  // legs: hips -> knees -> feet on the footwells
  for (const s of [1, -1]) {
    const hip = [0.13 * s, 0.68, -0.5], knee = [0.3 * s, 0.86, -0.08], foot = [0.42 * s, 0.45, -0.28];
    mb.limb(hip, knee, 0.085, 0.065, SHORTS);
    mb.limb(knee, foot, 0.06, 0.045, SKIN);
    mb.ellipsoid(add(foot, [0, -0.02, 0.06]), [0.05, 0.035, 0.12], SKIN, 6);
  }
  mb.ellipsoid([0, 0.72, -0.5], [0.19, 0.1, 0.14], SHORTS, 8);
  // torso leaning forward
  const pelvis = [0, 0.74, -0.48], chest = [0, 1.2, -0.25];
  mb.limb(pelvis, chest, 0.15, 0.17, VEST, 12);
  mb.ellipsoid([0, 1.05, -0.36], [0.2, 0.26, 0.15], VEST, 10, (p) => { const a = -0.45, c = Math.cos(a), s = Math.sin(a); return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]; });
  // arms to the handlebars
  for (const s of [1, -1]) {
    const sh = [0.2 * s, 1.28, -0.22], el = [0.3 * s, 1.05, 0.0], hand = [0.38 * s, 0.93, 0.19];
    mb.limb(sh, el, 0.055, 0.045, SKIN);
    mb.limb(el, hand, 0.045, 0.04, SKIN);
    mb.ellipsoid(hand, [0.04, 0.035, 0.05], SKIN, 6);
  }
  // neck + head
  mb.limb([0, 1.3, -0.2], [0, 1.4, -0.14], 0.05, 0.05, SKIN);
  mb.ellipsoid([0, 1.5, -0.1], [0.095, 0.115, 0.105], SKIN, 10);
  mb.ellipsoid([0, 1.54, -0.13], [0.1, 0.09, 0.1], HAIR, 10);
  // sunglasses
  mb.box([0, 1.51, -0.01], [0.07, 0.018, 0.012], DARK);
  return mb.build();
}

// ---------------------------------------------------------------- physics
// Probe points (water height is read back from the GPU): 0 front, 1 back, 2 left, 3 right
export const HULL_PTS = [[0, 1.1], [0, -1.15], [-0.5, -0.1], [0.5, -0.1]]; // [x right, z forward]

export function makeSki(x, z, yaw) {
  return { x, y: 0.1, z, yaw, pitch: 0, roll: 0, vx: 0, vy: 0, vz: 0, yawRate: 0, pitchVel: 0, rollVel: 0,
    throttle: 0, airborne: false, speed: 0, wh: [0, 0, 0, 0] };
}

// hull point in world space
export function hullPoint(s, px, pz) {
  const cy = Math.cos(s.yaw), sy = Math.sin(s.yaw);
  // forward = (sin yaw, 0, -cos yaw), right = (cos yaw, 0, sin yaw)
  const x = s.x + sy * pz + cy * px;
  const z = s.z - cy * pz + sy * px;
  const y = s.y + Math.sin(s.pitch) * pz - Math.sin(s.roll) * px;
  return [x, y, z];
}

// input: { throttle -1..1, steer -1..1, boost bool, riding bool }
export function stepSki(s, inp, dt, terrainH) {
  const G = 9.81;
  const cy = Math.cos(s.yaw), sy = Math.sin(s.yaw);
  const fx = sy, fz = -cy, rx = cy, rz = sy;
  // buoyancy at the four hull points
  let sub = [0, 0, 0, 0], subSum = 0;
  for (let k = 0; k < 4; k++) {
    const [, y] = hullPoint(s, HULL_PTS[k][0], HULL_PTS[k][1]);
    sub[k] = Math.max(0, Math.min(0.7, s.wh[k] - (y - 0.05)));
    subSum += sub[k];
  }
  const inWater = subSum > 0.02;
  s.airborne = !inWater;
  // vertical: gravity + buoyancy + water damping
  let ay = -G + subSum * 15.5;
  ay -= s.vy * (inWater ? 3.2 : 0.05);
  s.vy += ay * dt;
  // pitch / roll from buoyancy differences
  const spd = Math.hypot(s.vx, s.vz);
  const fwdSpd = s.vx * fx + s.vz * fz;
  const planing = Math.min(1, Math.max(0, fwdSpd / 12));
  let pAcc = (sub[0] - sub[1]) * 26 + (inWater ? (0.07 * planing + 0.03 - s.pitch) * 6 : 0);
  // bow rises while accelerating, settles when planing
  pAcc += inWater ? inp.throttle * (1 - planing) * 1.6 : 0;
  pAcc -= s.pitchVel * (inWater ? 4.5 : 0.4);
  if (!inWater) pAcc -= 0.6 * s.pitch; // gently level out in the air
  s.pitchVel += pAcc * dt;
  const leanTarget = inp.steer * 0.42 * Math.min(1, spd / 9) * (inp.riding ? 1 : 0);
  let rAcc = (sub[2] - sub[3]) * 22 + (leanTarget - s.roll) * (inWater ? 14 : 2) - s.rollVel * (inWater ? 5 : 0.8);
  s.rollVel += rAcc * dt;
  s.pitch = Math.max(-0.6, Math.min(0.75, s.pitch + s.pitchVel * dt));
  s.roll = Math.max(-0.8, Math.min(0.8, s.roll + s.rollVel * dt));

  // thrust from the jet (only with the nozzle in the water)
  const jetIn = sub[1] > 0.0 || s.wh[1] > hullPoint(s, 0, -1.15)[1] - 0.25;
  if (inp.riding && jetIn) {
    const th = inp.throttle > 0 ? inp.throttle * (inp.boost ? 15 : 10) : inp.throttle * 5;
    s.vx += fx * th * dt; s.vz += fz * th * dt;
  }
  // drag: forward (quadratic) + strong sideways grip of the hull in the water
  const latSpd = s.vx * rx + s.vz * rz;
  const wet = inWater ? 1 : 0;
  const fd = (0.024 * Math.abs(fwdSpd) + 0.25) * fwdSpd * (wet ? 1 : 0.15);
  const ld = latSpd * (wet ? 3.2 : 0.2);
  s.vx -= (fx * fd + rx * ld) * dt;
  s.vz -= (fz * fd + rz * ld) * dt;
  // steering: needs speed (the jet steers the boat)
  const steerK = inp.riding ? inp.steer * 1.7 * Math.min(1, 0.25 + Math.abs(fwdSpd) / 7) / (1 + Math.abs(fwdSpd) * 0.02) : 0;
  const yrTarget = inWater ? steerK * Math.sign(fwdSpd || 1) : s.yawRate;
  s.yawRate += (yrTarget - s.yawRate) * Math.min(1, dt * (inWater ? 5 : 0.5));
  s.yaw += s.yawRate * dt;

  s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;

  // terrain / rocks: walls push out and bounce, gentle ground slides
  let hit = 0;
  const pts = [[0, 1.45], [0, -1.4], [-0.55, 0.2], [0.55, 0.2], [-0.5, -1.0], [0.5, -1.0], [0, 0]];
  for (const [px, pz] of pts) {
    const [x, y, z] = hullPoint(s, px, pz);
    const h = terrainH(x, z);
    const pen = h - (y - 0.15);
    if (pen <= 0) continue;
    const e = 0.6;
    const gx = (terrainH(x + e, z) - terrainH(x - e, z)) / (2 * e), gz = (terrainH(x, z + e) - terrainH(x, z - e)) / (2 * e);
    const gl = Math.hypot(gx, gz);
    if (gl > 0.65) {
      // wall: push away from the uphill direction
      const nx = -gx / gl, nz = -gz / gl;
      const push = Math.min(pen / gl, 0.6);
      s.x += nx * push; s.z += nz * push;
      const vn = s.vx * nx + s.vz * nz;
      if (vn < 0) { s.vx -= nx * vn * 1.6; s.vz -= nz * vn * 1.6; hit = Math.max(hit, -vn); }
      s.yawRate *= 0.5;
    } else {
      s.y += pen * 0.5;
      if (s.vy < 0) s.vy = 0;
      const k = Math.exp(-dt * 2.5);
      s.vx *= k; s.vz *= k;
      hit = Math.max(hit, 0.01);
    }
  }
  s.speed = Math.hypot(s.vx, s.vz);
  return hit;
}

// column-major model matrix: translate * rotY(yaw) * rotX(pitch) * rotZ(roll) (model +Z = forward)
export function skiMatrix(out, s, off = 0) {
  // basis vectors in world space
  const cy = Math.cos(s.yaw), sy = Math.sin(s.yaw), cp = Math.cos(s.pitch), sp = Math.sin(s.pitch), cr = Math.cos(s.roll), sr = Math.sin(s.roll);
  // forward f, right r, up u (pitch: nose up positive, roll: positive = lean right side down)
  const f0 = [sy * cp, sp, -cy * cp];
  const r0 = [cy, 0, sy];
  const u0 = cross(r0, f0); // up = right x forward
  const r = add(scale(r0, cr), scale(u0, -sr));
  const u = add(scale(u0, cr), scale(r0, sr));
  const f = f0;
  out.set([r[0], r[1], r[2], 0, u[0], u[1], u[2], 0, f[0], f[1], f[2], 0, s.x, s.y, s.z, 1], off);
}
