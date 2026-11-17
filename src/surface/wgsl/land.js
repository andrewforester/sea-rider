// Island terrain, rocks and the jet ski (above-water scene objects).
import { FRAME_WGSL, ATMO_CORE_WGSL, ENV_MIPS } from './common.js';
import { SKY_RENDER_FUNCS } from './sky.js';
import { HM_N, HM_SIZE } from '../island.js';

// Heightmap access (rg32float: r = height in metres, g = beachness). Shared with the water shader.
export const HM_WGSL = /* wgsl */ `
const HM_N: i32 = ${HM_N};
const HM_ORG: f32 = ${-HM_SIZE / 2}.0;
const HM_TEXEL: f32 = ${HM_SIZE / HM_N}.0;
// x = terrain height (drawn), y = beachness, z = terrain + rocks (collision, depth, shadows)
fn hmLoad4(i: vec2i) -> vec4f { return textureLoad(hmTex, clamp(i, vec2i(0), vec2i(HM_N - 1)), 0); }
fn hmLoad(i: vec2i) -> vec2f { return hmLoad4(i).zy; }
fn hmSample(xz: vec2f) -> vec2f {
  let f = (xz - vec2f(HM_ORG)) / HM_TEXEL - 0.5;
  if (any(f < vec2f(0.0)) || any(f > vec2f(f32(HM_N) - 1.5))) { return vec2f(-60.0, 0.0); }
  let i = vec2i(floor(f));
  let u = f - floor(f);
  let a = hmLoad(i); let b = hmLoad(i + vec2i(1, 0));
  let c = hmLoad(i + vec2i(0, 1)); let d = hmLoad(i + vec2i(1, 1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// wave height multiplier from water depth (waves shrink over the shallows; ~flat under land)
fn waveDamp(xz: vec2f) -> f32 {
  let depth = -hmSample(xz).x;
  return mix(0.10, 1.0, smoothstep(0.0, 18.0, depth));
}
`;

const BINDINGS = /* wgsl */ `
@group(0) @binding(0) var<uniform> F: Frame;
@group(0) @binding(1) var transLUT: texture_2d<f32>;
@group(0) @binding(2) var skyLUT: texture_2d<f32>;
@group(0) @binding(3) var sampC: sampler;
@group(0) @binding(4) var envCube: texture_cube<f32>;
@group(0) @binding(5) var<storage, read> sunVis: array<f32, 4>;
@group(0) @binding(6) var hmTex: texture_2d<f32>;
`;

const LIGHT_WGSL = HM_WGSL + /* wgsl */ `
const ENV_MAXMIP: f32 = ${ENV_MIPS - 1}.0;
fn fbm2(p: vec2f, oct: i32) -> f32 {
  var s = 0.0; var a = 0.5; var q = p;
  for (var o = 0; o < oct; o++) { s += a * gnoise(q); q = q * 2.03 + vec2f(17.1, -9.7); a *= 0.5; }
  return s;
}
// soft shadow from the heightmap (terrain + stamped rocks)
// baked shadow height (alpha channel): lit above it
fn hmShadow(p: vec3f) -> f32 {
  if (F.sunDir.y <= 0.0) { return 0.0; }
  let f = (p.xz - vec2f(HM_ORG)) / HM_TEXEL - 0.5;
  if (any(f < vec2f(0.0)) || any(f > vec2f(f32(HM_N) - 1.5))) { return 1.0; }
  let i = vec2i(floor(f));
  let u = f - floor(f);
  let hs = mix(mix(hmLoad4(i).w, hmLoad4(i + vec2i(1, 0)).w, u.x), mix(hmLoad4(i + vec2i(0, 1)).w, hmLoad4(i + vec2i(1, 1)).w, u.x), u.y);
  return smoothstep(-0.5, 0.5, p.y - hs);
}
struct Lit { sunE: vec3f, sky: vec3f, sh: f32 };
fn lighting(p: vec3f, n: vec3f) -> Lit {
  var o: Lit;
  o.sunE = sunIlluminance() * sunVis[0];
  let sk = textureSampleLevel(envCube, sampC, normalize(n + vec3f(0.0, 0.35, 0.0)), ENV_MAXMIP - 1.0).rgb;
  o.sky = mix(sk, vec3f(dot(sk, vec3f(0.2126, 0.7152, 0.0722))), 0.45);
  o.sh = hmShadow(p + n * 0.25);
  return o;
}
fn diffuse(alb: vec3f, n: vec3f, l: Lit, ao: f32) -> vec3f {
  let ndl = max(dot(n, F.sunDir.xyz), 0.0);
  // sky + warm bounce from the sunlit ground / sea
  let bounce = l.sunE * max(F.sunDir.y, 0.0) * 0.035 * (0.5 - 0.5 * n.y);
  return alb * (l.sunE * ndl * l.sh / PI * 1.25 + (l.sky * 0.95 + bounce) * ao);
}
fn aerial(col: vec3f, rel: vec3f) -> vec3f {
  let dist = length(rel);
  let V = -rel / dist;
  let T = exp(-max(F.fogExt.rgb, vec3f(F.fogExt.w)) * dist);
  let hz = normalize(vec3f(-V.x, 0.002, -V.z));
  return col * T + skyAtmo(hz) * (1.0 - T);
}
fn hash1(i: f32) -> f32 { return f32(pcgHash(u32(i32(i) + 100000))) / 4294967296.0; }
// Limestone cliff face in face-aligned coordinates (u along the face, v = height).
// Returns relief height (for the normal) in .w and albedo in .rgb.
fn cliffFace(u: f32, v: f32, tint: f32) -> vec4f {
  let lv = v * 0.28 + fbm2(vec2f(u * 0.006, 3.1), 2) * 0.8 + gnoise(vec2f(u * 0.04, v * 0.05)) * 0.12;
  let li = floor(lv);
  let lf = lv - li;
  let tone = hash1(li);
  // layers stick out or are eroded back; soft recess between them
  let recess = smoothstep(0.0, 0.1, lf) * smoothstep(1.0, 0.9, lf);
  // vertical joints, offset per layer: blocky look
  let ju = u * (0.18 + 0.12 * hash1(li + 7.0)) + li * 3.7 + gnoise(vec2f(v * 0.2, li)) * 0.6;
  let joint = smoothstep(0.03, 0.0, abs(fract(ju) - 0.5) - 0.47) * step(0.35, hash1(li + 3.0));
  let rough = fbm2(vec2f(u, v) * 0.7, 4);
  let h = recess * 0.3 + rough * 0.8 - joint * 0.5;
  var c = mix(vec3f(0.55, 0.49, 0.41), vec3f(0.47, 0.43, 0.38), tone * 0.6);
  // big blotches: warm buff, grey weathered, orange iron-rich patches
  let big = fbm2(vec2f(u * 0.012, v * 0.02), 3);
  c = mix(c, vec3f(0.40, 0.39, 0.37), smoothstep(0.05, 0.35, big) * 0.6);
  c = mix(c, vec3f(0.62, 0.43, 0.27), smoothstep(-0.1, -0.35, big) * 0.6);
  // rust / ochre streaks running down the face, dark water streaks
  let st = gnoise(vec2f(u * 0.11, v * 0.012 + 0.3));
  c = mix(c, vec3f(0.60, 0.40, 0.24), smoothstep(0.2, 0.55, st + tint * 0.4) * 0.55);
  let dk = gnoise(vec2f(u * 0.07 + 4.0, v * 0.01));
  c *= 1.0 - 0.35 * smoothstep(0.25, 0.6, dk);
  c *= 0.82 + 0.18 * recess;
  c *= 1.0 - joint * 0.5;
  c *= 0.78 + 0.4 * rough;
  // grey lichen crust patches
  c = mix(c, vec3f(0.30, 0.30, 0.29), smoothstep(0.1, 0.4, gnoise(vec2f(u, v) * 0.35 + 9.0)) * 0.45);
  return vec4f(c * 0.82, h);
}
// face material + perturbed normal for steep rock
struct Rock { alb: vec3f, n: vec3f };
fn rockMat(p: vec3f, n0: vec3f, tint: f32, fade: f32) -> Rock {
  var t = vec2f(-n0.z, n0.x);
  let tl = length(t);
  t = select(vec2f(1.0, 0.0), t / max(tl, 1e-4), tl > 1e-3);
  let u = dot(p.xz, t);
  let v = p.y;
  let e = 0.12;
  let a = cliffFace(u, v, tint);
  var o: Rock;
  o.alb = a.rgb;
  o.n = n0;
  if (fade > 0.0) {
    let hu = cliffFace(u + e, v, tint).w - a.w;
    let hv = cliffFace(u, v + e, tint).w - a.w;
    let T = vec3f(t.x, 0.0, t.y);
    o.n = normalize(n0 - (T * hu + vec3f(0.0, 1.0, 0.0) * hv) / e * 0.3 * fade);
  }
  // waterline: dark wet band and algae
  // spray zone: dark grey-black crust a couple of metres above the sea, wet and darker right at it
  let spray = 1.0 - smoothstep(1.2, 3.2 + 1.2 * gnoise(p.xz * 0.2), p.y);
  o.alb = mix(o.alb, vec3f(0.17, 0.17, 0.16) * (0.8 + 0.4 * gnoise(p.xz * 1.3 + p.y)), spray * 0.8);
  let wet = 1.0 - smoothstep(0.2, 0.9, p.y);
  o.alb = mix(o.alb, o.alb * 0.6, wet);
  let algae = 1.0 - smoothstep(-0.6, 0.3, p.y);
  o.alb = mix(o.alb, vec3f(0.10, 0.14, 0.07), algae * 0.75);
  return o;
}
`;

const HEAD = FRAME_WGSL + ATMO_CORE_WGSL + BINDINGS + SKY_RENDER_FUNCS + LIGHT_WGSL;

// ---------------------------------------------------------------- terrain: one triangle strip per heightmap row
export const TERRAIN = HEAD + /* wgsl */ `
struct VO {
  @builtin(position) pos: vec4f,
  @location(0) wp: vec3f,
  @location(1) nrm: vec3f,
  @location(2) beach: f32,
};
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) row: u32) -> VO {
  let g = vec2i(i32(vi >> 1u), i32(row) + i32(vi & 1u));
  let hb = hmLoad4(g).xy;
  let hx = hmLoad4(g + vec2i(1, 0)).x - hmLoad4(g - vec2i(1, 0)).x;
  let hz = hmLoad4(g + vec2i(0, 1)).x - hmLoad4(g - vec2i(0, 1)).x;
  var o: VO;
  o.wp = vec3f(HM_ORG + (f32(g.x) + 0.5) * HM_TEXEL, hb.x, HM_ORG + (f32(g.y) + 0.5) * HM_TEXEL);
  o.nrm = normalize(vec3f(-hx, 2.0 * HM_TEXEL, -hz));
  o.beach = hb.y;
  // anything deep below the sea is never visible: fold it away
  if (hb.x < -40.0) { o.wp.y = -40.0; }
  o.pos = F.viewProj * vec4f(o.wp - F.camPos.xyz, 1.0);
  return o;
}
@fragment fn fs(in: VO) -> @location(0) vec4f {
  let p = in.wp;
  // detail normal: break up the 2 m grid with small noise bumps on rock
  var n = normalize(in.nrm);
  let slope = 1.0 - n.y;
  let e = 0.35;
  let dn = vec2f(gnoise(p.xz * 0.45 + p.y * 0.2) - gnoise(p.xz * 0.45 + vec2f(e, 0.0) + p.y * 0.2),
                 gnoise(p.xz * 0.45 + p.y * 0.2) - gnoise(p.xz * 0.45 + vec2f(0.0, e) + p.y * 0.2));
  let fadeD = 1.0 - smoothstep(60.0, 400.0, distance(p, F.camPos.xyz));
  n = normalize(n + vec3f(dn.x, 0.0, dn.y) * (0.25 + 0.6 * slope) * fadeD);
  // wind ripples on the sand
  let rip = sin(dot(p.xz, vec2f(0.8, 1.9)) + gnoise(p.xz * 0.3) * 4.0);
  n = normalize(n + vec3f(0.8, 0.0, 1.9) * rip * 0.035 * smoothstep(0.3, 0.7, in.beach) * (1.0 - smoothstep(5.0, 40.0, distance(p, F.camPos.xyz))));

  let b = smoothstep(0.3, 0.7, in.beach);
  // materials
  let n0 = normalize(in.nrm);
  let rk = rockMat(p, n0, 0.0, fadeD);
  let sandN = fbm2(p.xz * 0.15, 3);
  var sand = vec3f(0.60, 0.50, 0.35) * (0.9 + 0.15 * sandN);
  let grain = gnoise(p.xz * 9.0) * 0.5 + gnoise(p.xz * 23.0) * 0.5;
  sand *= 1.0 + grain * 0.12 * fadeD;
  // pebbles and shell bits
  sand = mix(sand, vec3f(0.42, 0.40, 0.37), smoothstep(0.55, 0.7, gnoise(p.xz * 4.0)) * 0.6 * fadeD);
  sand = mix(sand, sand * vec3f(0.62, 0.6, 0.58), 1.0 - smoothstep(0.15, 0.9, p.y + 0.15 * sin(F.camPos.w * 0.9 + p.x * 0.05)));
  // dry golden grass / bare earth and dark evergreen maquis (lentisk, kermes oak) in clumps
  let dry = mix(vec3f(0.46, 0.37, 0.20), vec3f(0.38, 0.30, 0.19), 0.5 + 0.5 * fbm2(p.xz * 0.02, 3)) * (0.8 + 0.35 * fbm2(p.xz * 0.09, 3));
  let maquis = mix(vec3f(0.035, 0.06, 0.02), vec3f(0.08, 0.10, 0.035), 0.5 + 0.5 * fbm2(p.xz * 0.05, 2)) * (0.7 + 0.6 * fbm2(p.xz * 0.35, 3));
  let vegMask = smoothstep(-0.3, 0.05, fbm2(p.xz * 0.012, 4) + 0.2) * smoothstep(0.55, 0.3, slope) * smoothstep(4.0, 10.0, p.y);
  let bushes = mix(smoothstep(-0.05, 0.15, fbm2(p.xz * 0.25, 3)), 0.55, 1.0 - fadeD);
  var ground = mix(dry, maquis, vegMask * bushes);
  ground = mix(ground, sand, b * (1.0 - smoothstep(4.0, 9.0, p.y)));
  // bare rock: steep ground, outcrops in the hills, and the spray zone of cliff coasts
  let outcrop = smoothstep(0.25, 0.45, fbm2(p.xz * 0.02 + 7.0, 3)) * smoothstep(0.12, 0.3, slope);
  let rockW = max(max(smoothstep(0.3, 0.5, slope), outcrop), (1.0 - b) * (1.0 - smoothstep(1.5, 5.0, p.y)) * smoothstep(0.08, 0.2, slope));
  let alb = mix(ground, rk.alb, rockW);
  n = normalize(mix(n, rk.n, rockW));
  // bushes are lumpy: darker gaps between them
  let bushAO = mix(1.0, 0.55 + 0.45 * smoothstep(-0.1, 0.3, fbm2(p.xz * 0.5, 2)), vegMask * bushes * (1.0 - rockW) * fadeD);
  let ao = mix(0.75, 1.0, n.y) * bushAO;
  let l = lighting(p, n);
  var col = diffuse(alb, n, l, ao);
  // wet sand sheen
  let wetS = b * (1.0 - smoothstep(0.1, 0.8, p.y));
  let V = normalize(F.camPos.xyz - p);
  let Hh = normalize(V + F.sunDir.xyz);
  col += l.sunE * l.sh * wetS * 0.04 * pow(max(dot(n, Hh), 0.0), 60.0);
  return vec4f(aerial(col, p - F.camPos.xyz), 1.0);
}
`;

// ---------------------------------------------------------------- rocks (instanced displaced icospheres)
export const ROCKS = HEAD + /* wgsl */ `
struct VO {
  @builtin(position) pos: vec4f,
  @location(0) wp: vec3f,
  @location(1) nrm: vec3f,
  @location(2) lp: vec3f,
  @location(3) tint: f32,
};
fn rotY(a: f32) -> mat3x3f { let c = cos(a); let s = sin(a); return mat3x3f(vec3f(c, 0.0, -s), vec3f(0.0, 1.0, 0.0), vec3f(s, 0.0, c)); }
fn rotX(a: f32) -> mat3x3f { let c = cos(a); let s = sin(a); return mat3x3f(vec3f(1.0, 0.0, 0.0), vec3f(0.0, c, s), vec3f(0.0, -s, c)); }
fn rotZ(a: f32) -> mat3x3f { let c = cos(a); let s = sin(a); return mat3x3f(vec3f(c, s, 0.0), vec3f(-s, c, 0.0), vec3f(0.0, 0.0, 1.0)); }
@vertex fn vs(@location(0) vp: vec3f, @location(1) vn: vec3f,
              @location(2) a: vec4f, @location(3) b: vec4f, @location(4) c: vec4f) -> VO {
  let R = rotY(b.w) * rotX(c.x) * rotZ(c.y);
  var o: VO;
  o.wp = a.xyz + R * (vp * b.xyz);
  o.nrm = normalize(R * (vn / b.xyz));
  o.lp = vp * 3.0 + vec3f(a.x * 0.37, 0.0, a.z * 0.37);
  o.tint = c.z;
  o.pos = F.viewProj * vec4f(o.wp - F.camPos.xyz, 1.0);
  return o;
}
@fragment fn fs(in: VO) -> @location(0) vec4f {
  let p = in.wp;
  // mostly faceted: broken-stone look
  let fn0 = normalize(cross(dpdx(p), dpdy(p)));
  let sn = normalize(in.nrm);
  var n = normalize(mix(sn, fn0 * sign(dot(fn0, sn)), 0.7));
  let e = 0.08;
  let q = in.lp;
  let g0 = gnoise(q.xy * 2.1 + q.z);
  let dn = vec2f(g0 - gnoise((q.xy + vec2f(e, 0.0)) * 2.1 + q.z), g0 - gnoise((q.xy + vec2f(0.0, e)) * 2.1 + q.z));
  n = normalize(n + vec3f(dn.x, dn.y, -dn.x) * 0.9);
  let rk = rockMat(p + vec3f(in.lp.x, 0.0, in.lp.z) * 0.3, n, in.tint, 1.0 - smoothstep(40.0, 200.0, distance(p, F.camPos.xyz)));
  let alb = rk.alb * 0.85;
  // undersides and the ground contact darker
  let under = smoothstep(0.2, -0.6, n.y);
  n = rk.n;
  let l = lighting(p, n);
  // rocks in the stamped heightmap shadow themselves a little too much from inside: soften
  var l2 = l;
  l2.sh = mix(l.sh, 1.0, 0.25);
  let ao = mix(0.45, 1.0, smoothstep(-0.6, 0.6, n.y)) * (1.0 - 0.3 * under);
  let col = diffuse(alb, n, l2, ao);
  return vec4f(aerial(col, p - F.camPos.xyz), 1.0);
}
`;

// ---------------------------------------------------------------- jet ski / rider: vertex-coloured meshes
// model matrices in a small uniform array, chosen by instance index
export const MODEL = HEAD + /* wgsl */ `
struct Models { m: array<mat4x4f, 64> };
@group(0) @binding(7) var<uniform> M: Models;
struct VO {
  @builtin(position) pos: vec4f,
  @location(0) wp: vec3f,
  @location(1) nrm: vec3f,
  @location(2) col: vec3f,
  @location(3) gloss: f32,
};
@vertex fn vs(@location(0) vp: vec3f, @location(1) vn: vec3f, @location(2) vc: vec4f,
              @builtin(instance_index) ii: u32) -> VO {
  let m = M.m[ii];
  var o: VO;
  o.wp = (m * vec4f(vp, 1.0)).xyz;
  o.nrm = normalize((m * vec4f(vn, 0.0)).xyz);
  o.col = vc.rgb;
  o.gloss = vc.a;
  o.pos = F.viewProj * vec4f(o.wp - F.camPos.xyz, 1.0);
  return o;
}
fn fresnelS(c: f32) -> f32 { let x = 1.0 - clamp(c, 0.0, 1.0); let x2 = x * x; return 0.04 + 0.96 * x2 * x2 * x; }
@fragment fn fs(in: VO) -> @location(0) vec4f {
  let p = in.wp;
  let n = normalize(in.nrm);
  let l = lighting(p, n);
  var col = diffuse(in.col, n, l, 1.0);
  if (in.gloss >= 2.0) {
    // glowing gold (treasures): polished metal + self-illumination
    let k = in.gloss - 2.0;
    let V = normalize(F.camPos.xyz - p);
    let R = reflect(-V, n);
    let env = textureSampleLevel(envCube, sampC, R, 2.0).rgb;
    let Hh = normalize(V + F.sunDir.xyz);
    let rim = pow(1.0 - max(dot(n, V), 0.0), 2.0);
    var g = col * 0.8 + env * in.col * 2.0 + l.sunE * in.col * (0.12 * k + 1.2 * pow(max(dot(n, Hh), 0.0), 30.0));
    g += in.col * l.sunE * 0.15 * rim * k;
    return vec4f(aerial(g, p - F.camPos.xyz), 1.0);
  }
  // glossy plastic / gelcoat: env reflection + sun highlight
  let V = normalize(F.camPos.xyz - p);
  let R = reflect(-V, n);
  let fr = fresnelS(dot(n, V)) * in.gloss;
  let env = textureSampleLevel(envCube, sampC, R, 3.0).rgb;
  let Hh = normalize(V + F.sunDir.xyz);
  let spec = l.sunE * l.sh * pow(max(dot(n, Hh), 0.0), 120.0) * 2.0 * in.gloss;
  col = col * (1.0 - fr) + env * fr + spec;
  // a wet look on the hull below the waterline band
  return vec4f(aerial(col, p - F.camPos.xyz), 1.0);
}
`;

// ---------------------------------------------------------------- glow sprites (treasure halos and sparkles), additive
export const GLOW = HEAD + /* wgsl */ `
struct VO { @builtin(position) pos: vec4f, @location(0) uv: vec2f, @location(1) col: vec4f };
@vertex fn vs(@builtin(vertex_index) vi: u32, @location(0) a: vec4f, @location(1) c: vec4f) -> VO {
  let q = vec2f(f32(vi & 1u), f32(vi >> 1u)) * 2.0 - 1.0;
  let r = normalize(F.camRight.xyz);
  let u = normalize(F.camUp.xyz);
  let rel = a.xyz - F.camPos.xyz + (r * q.x + u * q.y) * a.w;
  var o: VO;
  o.pos = F.viewProj * vec4f(rel, 1.0);
  // pull towards the camera a little so halos are not cut by the object or the water
  o.pos.z = o.pos.z + 0.4 * a.w * F.viewProj[2][3] / max(o.pos.w, 0.1) * 0.0;
  o.uv = q;
  o.col = c;
  return o;
}
@fragment fn fs(in: VO) -> @location(0) vec4f {
  let d = length(in.uv);
  if (d > 1.0) { discard; }
  let core = exp(-d * d * 9.0);
  let halo = pow(1.0 - d, 2.5);
  // star-shaped glints on the small sparkles
  let ray = pow(max(1.0 - abs(in.uv.x * in.uv.y) * 40.0, 0.0), 3.0) * (1.0 - d);
  let k = (core * 1.2 + halo * 0.5 + ray * 0.6) * in.col.a;
  let sunE = sunIlluminance() * sunVis[0];
  let scale = max(dot(sunE, vec3f(0.33)), 0.5) * 0.4;
  return vec4f(in.col.rgb * k * scale, 0.0);
}
`;
