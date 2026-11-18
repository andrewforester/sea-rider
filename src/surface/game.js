// Game state: riding the jet ski, swimming at the surface, walking on the island, or diving
// (the underwater world is a separate renderer, window.UW, on its own canvas). Treasures are
// collected in every mode.
import { makeSki, stepSki, skiMatrix, hullPoint, HULL_PTS } from './jetski.js';
import { SPAWN, BAYS } from './island.js';
import { itemPos, itemMatrix } from './treasures.js';

// where a dive starts in the underwater world's own coordinates (open water above its canyon)
const UW_START = { x: 0, y: -2.5, z: 0 };
const EYE = 1.8;           // eye height above the ground when walking
const STAND_DEPTH = 1.0;   // water shallower than this: you stand up and walk

export function createGame({ cam, terrainH, keys, ui, sfx, treasures, obstacles }) {
  let ski = makeSki(SPAWN.x, SPAWN.z, SPAWN.yaw);   // the active jet ski (ridden, or the last one ridden)
  // a parked jet ski waiting in the shallows of every cove, nose to the sea
  const skis = [ski];
  for (const B of BAYS) {
    let dx = 0 - B.x, dz = -470 - B.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    let x = B.x, z = B.z, k = 0;
    while (k++ < 300 && -terrainH(x, z) > 1.7) { x += dx * 2; z += dz * 2; }
    x += dz * 6; z -= dx * 6; // a little to the side of the beach treasure
    if (-terrainH(x, z) < 0.6) continue;
    const s = makeSki(x, z, Math.atan2(-dx, dz));
    s.parked = true; s.phase = k * 0.37;
    skis.push(s);
  }
  let autoDiveT = 0;
  const me = { x: 0, y: 0, z: 0, yaw: 0, pitch: -0.1, vy: 0, onGround: true, speed: 0, turn: 0, gy: 0 }; // first-person body
  let mode = 'ski';
  let busy = false; // during a fade
  const orbit = { yaw: 0, pitch: -0.2, idle: 0 };
  let camYaw = ski.yaw;
  let dive = { x: 0, z: 0 };
  let message = '', messageT = 0;
  // probe results: per point [water height, slope x, slope z, terrain height]
  const probe = new Float32Array(32);
  let lastWake = null;
  let time = 0;
  let foundSurface = 0, foundUnder = 0;
  let shore = 0, shoreT = 0;
  let lastCam = [cam.x, cam.y, cam.z];

  const say = (m, t = 2.5) => { message = m; messageT = t; };
  const water = () => -terrainH(me.x, me.z);

  function mouse(dx, dy) {
    if (mode === 'ski') {
      orbit.yaw += dx * 0.0028; orbit.pitch = Math.max(-1.1, Math.min(0.45, orbit.pitch - dy * 0.0028));
      orbit.idle = 0;
    } else if (mode === 'swim' || mode === 'walk') {
      me.yaw += dx * 0.0022; me.pitch = Math.max(-1.45, Math.min(1.45, me.pitch - dy * 0.0022));
    }
  }

  function keyDown(code) {
    sfx.start();
    if (busy) return;
    // F or Space: get on / off the jet ski (Space jumps when no jet ski is near)
    if (code === 'KeyF' || code === 'Space') {
      if (mode === 'ski') { jumpOff(); return; }
      const s = (mode === 'swim' || mode === 'walk') && nearestSki();
      if (s) { mount(s); return; }
      if (code === 'KeyF') say('Гидроцикл далеко — плыви к стрелке');
    }
    if (mode === 'swim' && (code === 'KeyQ' || code === 'KeyC' || code === 'ControlLeft')) startDive();
    if (mode === 'walk' && code === 'Space' && me.onGround) { me.vy = 7; me.onGround = false; }
  }

  function jumpOff() {
    // land beside the ski, looking the way it points; on a beach you are already standing
    const [x, , z] = hullPoint(ski, -1.4, 0.2);
    me.x = x; me.z = z; me.yaw = ski.yaw - 0.5; me.pitch = -0.1; me.vy = 0; me.speed = 0; me.turn = 0;
    if (water() < STAND_DEPTH) { mode = 'walk'; me.gy = terrainH(x, z); me.y = me.gy + EYE; me.onGround = true; say('Ты на берегу! Ищи сокровища ✨', 2.5); }
    else { mode = 'swim'; me.y = 0; sfx.splash(1); say('Посмотри вниз и плыви — нырнёшь. Плыви к берегу — выйдешь на сушу'); }
  }
  function nearestSki() {
    let best = null, bd = 6;
    for (const s of skis) { const d = Math.hypot(me.x - s.x, me.z - s.z); if (d < bd) { bd = d; best = s; } }
    return best;
  }
  function mount(s) {
    if (s !== ski) { ski.parked = true; ski.phase = time; s.parked = false; s.vx = s.vz = s.vy = 0; s.y = 0.1; ski = s; }
    mode = 'ski';
    ski.vx *= 0.3; ski.vz *= 0.3; ski.pitchVel = 0; ski.rollVel = 0;
    orbit.yaw = 0; orbit.pitch = -0.2; camYaw = ski.yaw;
    say('Поехали!', 1.2);
  }
  function fade(cb) {
    busy = true;
    ui.fade.classList.add('on');
    setTimeout(() => { cb(); setTimeout(() => { ui.fade.classList.remove('on'); busy = false; }, 120); }, 320);
  }
  function startDive() {
    const UW = window.UW;
    if (!UW || !UW.ready) { say('Подводный мир ещё загружается…'); return; }
    if (water() < 2.5) { say('Здесь слишком мелко, чтобы нырнуть'); return; }
    dive = { x: me.x, z: me.z };
    UW.onSurface = surface;
    sfx.splash(1.4);
    fade(() => {
      mode = 'under';
      ui.setMode('under');
      sfx.ambient(false);
      UW.enter(UW_START.x, UW_START.y, UW_START.z, me.yaw, Math.min(me.pitch, -0.35));
    });
  }
  // called by the underwater world when the diver comes up (E at the surface)
  function surface(pose) {
    if (mode !== 'under' || busy) return;
    fade(() => {
      window.UW.leave();
      let x = dive.x + (pose.x - UW_START.x), z = dive.z + (pose.z - UW_START.z);
      if (terrainH(x, z) > -STAND_DEPTH - 0.5) { x = dive.x; z = dive.z; }
      me.x = x; me.z = z; me.yaw = pose.yaw; me.pitch = 0.05; me.speed = 0; me.turn = 0;
      autoDiveT = 2;
      mode = 'swim';
      ui.setMode('surface');
      sfx.ambient(true);
      sfx.splash(0.8);
      say('Вынырнул!', 2);
    });
  }
  // the underwater world reports finds here
  function foundUnderwater() {
    foundUnder++;
    sfx.chime(foundAll());
    say(foundAll() ? 'Все сокровища найдены! Ура! 🎉' : 'Сокровище! ⭐', 2);
  }
  const total = () => treasures.length + (window.UW?.treasureTotal || 0);
  const found = () => foundSurface + foundUnder;
  const foundAll = () => window.UW?.treasureTotal && found() >= total();

  // fills the probe input points (xz pairs in vec4 slots) with a little prediction for the
  // readback latency
  function probePoints(out, lead) {
    out.fill(0);
    out[0] = cam.x; out[1] = cam.z;
    const sx = ski.x, sz = ski.z;
    ski.x += ski.vx * lead; ski.z += ski.vz * lead;
    for (let k = 0; k < 4; k++) {
      const [x, , z] = hullPoint(ski, HULL_PTS[k][0], HULL_PTS[k][1]);
      out[4 + k * 4] = x; out[5 + k * 4] = z;
    }
    ski.x = sx; ski.z = sz;
    out[20] = me.x; out[21] = me.z;
    out[24] = ski.x; out[25] = ski.z;
  }

  // houses and the chapel are solid
  function pushOut(p, r) {
    for (const [x, z, R] of obstacles) {
      const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz), m = R + r;
      if (d < m && d > 1e-3) { p.x = x + dx / d * m; p.z = z + dz / d * m; }
    }
  }

  function update(dt) {
    time += dt;
    if (autoDiveT > 0) autoDiveT -= dt;
    // parked jet skis rock gently in the shallows
    for (const s of skis) if (s.parked && s !== ski) {
      s.y = 0.06 + 0.1 * Math.sin(time * 1.1 + s.phase); s.pitch = 0.04 * Math.sin(time * 0.9 + s.phase * 2); s.roll = 0.05 * Math.sin(time * 0.7 + s.phase);
    }
    if (messageT > 0) messageT -= dt;
    for (const it of treasures) if (it.got) it.t += dt;
    if (mode === 'under') return;
    for (let k = 0; k < 4; k++) ski.wh[k] = probe[4 + k * 4];
    const riding = mode === 'ski';
    const inp = {
      throttle: riding ? (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) : 0,
      steer: riding ? (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) : 0,
      boost: !!(keys.ShiftLeft || keys.ShiftRight),
      riding,
    };
    // two substeps for stable buoyancy springs
    let hit = 0;
    for (let i = 0; i < 2; i++) hit = Math.max(hit, stepSki(ski, inp, dt / 2, terrainH));
    if (hit > 4 && riding) { say('Бум! Осторожно, камни', 1.2); sfx.bump(Math.min(1, hit / 10)); }

    const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    const r = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    const fast = keys.ShiftLeft || keys.ShiftRight;
    // on foot and swimming A/D turn the view like steering the jet ski (eased turn rate)
    if (mode === 'swim' || mode === 'walk') {
      const rate = mode === 'walk' ? 2.3 : 1.7;
      me.turn += (r * rate - me.turn) * Math.min(1, dt * 9);
      me.yaw += me.turn * dt;
    }
    const cy = Math.cos(me.yaw), sy = Math.sin(me.yaw);
    if (mode === 'ski') {
      // chase camera
      orbit.idle += dt;
      if (orbit.idle > 1.5 && inp.throttle > 0) { orbit.yaw *= Math.exp(-dt * 2.5); orbit.pitch += (-0.2 - orbit.pitch) * Math.min(1, dt * 1.5); }
      let dy = ski.yaw - camYaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      camYaw += dy * Math.min(1, dt * 5);
      const yaw = camYaw + orbit.yaw, cp = Math.cos(orbit.pitch);
      const dist = 6.2 + Math.min(ski.speed, 25) * 0.08;
      const tx = ski.x, ty = ski.y + 1.1, tz = ski.z;
      cam.x = tx - Math.sin(yaw) * cp * dist;
      cam.z = tz + Math.cos(yaw) * cp * dist;
      cam.y = ty - Math.sin(orbit.pitch) * dist + 0.6;
      const floor = Math.max(probe[0] + 0.7, terrainH(cam.x, cam.z) + 1.0);
      if (cam.y < floor) cam.y = floor;
      const ddx = tx - cam.x, ddy = ty - cam.y, ddz = tz - cam.z;
      cam.yaw = Math.atan2(ddx, -ddz);
      cam.pitch = Math.atan2(ddy, Math.hypot(ddx, ddz));
    } else if (mode === 'swim') {
      const target = (fast ? 3.2 : 1.9) * f * (f < 0 ? 0.5 : 1);
      me.speed += (target - me.speed) * Math.min(1, dt * 4);
      const sp = me.speed * dt;
      me.x += sy * sp; me.z += -cy * sp;
      // rocks sticking out of the water are not swimmable: slide around them
      if (terrainH(me.x, me.z) > 0.3) { me.x -= sy * sp; me.z -= -cy * sp; me.speed = 0; }
      const wy = probe[20];
      me.y += (wy + 0.18 - me.y) * Math.min(1, dt * 8);
      if (f > 0 && me.pitch < -0.4 && autoDiveT <= 0 && water() > 2.5 && window.UW?.ready && !busy) startDive();
      // reached the shallows: stand up
      if (water() < STAND_DEPTH * 0.8 && terrainH(me.x, me.z) > -STAND_DEPTH) {
        mode = 'walk'; me.vy = 0; me.onGround = true; me.gy = me.y - EYE; me.speed = Math.max(me.speed, 0);
        say('Ты вышел на берег! Ищи сокровища ✨', 3);
      }
      cam.x = me.x; cam.y = me.y; cam.z = me.z; cam.yaw = me.yaw; cam.pitch = me.pitch;
    } else if (mode === 'walk') {
      const g0 = terrainH(me.x, me.z);
      const wet = Math.max(0, -g0);                        // wading slows you down a little
      const target = (fast ? 12 : 7) * (1 - Math.min(wet, 1) * 0.25) * f * (f < 0 ? 0.6 : 1);
      me.speed += (target - me.speed) * Math.min(1, dt * 12); // quick, light acceleration
      const mx = sy * me.speed * dt, mz = -cy * me.speed * dt;
      const nx = me.x + mx, nz = me.z + mz;
      const step = Math.hypot(mx, mz);
      // too steep uphill (cliffs, tall rocks): blocked; try sliding along each axis
      const climb = (h) => h - g0 <= Math.max(0.6, step * 1.4) || h <= g0;
      const feet = me.y - EYE;
      if (climb(terrainH(nx, nz)) || feet > terrainH(nx, nz) + 0.05) { me.x = nx; me.z = nz; }
      else if (climb(terrainH(me.x + mx, me.z))) me.x += mx;
      else if (climb(terrainH(me.x, me.z + mz))) me.z += mz;
      else me.speed *= 0.5;
      pushOut(me, 0.4);
      const g = terrainH(me.x, me.z);
      if (me.onGround && me.vy <= 0 && g > me.gy - 1.2) {
        // on the ground: glide along it (smoothed, so pebbles and steps do not shake the view)
        me.gy += (g - me.gy) * Math.min(1, dt * 12);
        me.y = me.gy + EYE;
      } else {
        // jump or fall: a short, snappy arc
        me.onGround = false;
        me.vy -= 22 * dt;
        me.y += me.vy * dt;
        if (me.y - EYE <= g) { me.y = g + EYE; me.gy = g; me.vy = 0; me.onGround = true; }
      }
      // light head bob with the stride
      me.stride = (me.stride || 0) + dt * Math.abs(me.speed) * 1.25;
      const bob = me.onGround ? Math.sin(me.stride) * 0.04 * Math.min(Math.abs(me.speed) / 7, 1) : 0;
      // deep water again: swim
      if (-g > STAND_DEPTH * 1.2) { mode = 'swim'; me.speed *= 0.3; sfx.splash(0.5); say('Плывёшь', 1); }
      cam.x = me.x; cam.y = me.y + bob; cam.z = me.z; cam.yaw = me.yaw; cam.pitch = me.pitch;
    }

    // treasures: pick up when close (bigger radius on the jet ski)
    const px = mode === 'ski' ? ski.x : me.x, pz = mode === 'ski' ? ski.z : me.z;
    const py = mode === 'ski' ? ski.y + 0.8 : mode === 'walk' ? me.y - 0.8 : me.y;
    const rad = mode === 'ski' ? 3.2 : 2.0;
    for (const it of treasures) {
      if (it.got) continue;
      const [x, y, z] = itemPos(it, time);
      if (Math.hypot(x - px, z - pz) < rad && Math.abs(y - py) < 2.5) {
        it.got = true; it.t = 0; foundSurface++;
        sfx.chime(foundAll());
        say(foundAll() ? 'Все сокровища найдены! Ура! 🎉' : (it.kind === 'chest' ? 'Сундучок с золотом! 💰' : 'Звёздочка! ⭐'), 2);
      }
    }

    // sound: how close is the surf (sampled around the listener a few times per second)
    shoreT -= dt;
    if (shoreT <= 0) {
      shoreT = 0.3;
      let best = 0;
      for (let k = 0; k < 12; k++) {
        const a = k * Math.PI / 6;
        for (const d of [10, 30, 60, 100]) {
          const h = terrainH(cam.x + Math.sin(a) * d, cam.z + Math.cos(a) * d);
          if (h > -0.5) { best = Math.max(best, 1 - d / 120); break; }
        }
      }
      shore = best;
    }
    const moved = Math.hypot(cam.x - lastCam[0], cam.y - lastCam[1], cam.z - lastCam[2]) / Math.max(dt, 1e-3);
    lastCam = [cam.x, cam.y, cam.z];
    sfx.update({
      engineOn: riding, throttle: riding ? Math.max(inp.throttle, 0) : 0, speed: ski.speed, inAir: ski.airborne,
      engDist: Math.hypot(cam.x - ski.x, cam.y - ski.y, cam.z - ski.z) * (riding ? 0.4 : 1),
      shore, moving: Math.min(moved, 40), walking: mode === 'walk', swimming: mode === 'swim',
      onSand: terrainH(me.x, me.z) < 8,
    });

    // jet ski wake: inject foam behind the stern while moving in the water
    const [wx, , wz] = hullPoint(ski, 0, -1.5);
    const wakeOn = !ski.airborne && ski.speed > 2.5;
    const wake = { x: wx, z: wz, px: lastWake ? lastWake[0] : wx, pz: lastWake ? lastWake[1] : wz,
      w: 0.6 + Math.min(ski.speed, 20) * 0.03, k: wakeOn ? Math.min(1, (ski.speed - 2.5) / 6) * 0.9 : 0 };
    lastWake = [wx, wz];
    return wake;
  }

  // slot 0: active jet ski, 1: rider; parked skis from `slot`. Returns { rider, parked: [slots] }
  function fillModels(out, slot) {
    skiMatrix(out, ski, 0);
    skiMatrix(out, ski, 16);
    const parked = [];
    for (const s of skis) if (s !== ski) { skiMatrix(out, s, slot * 16); parked.push(slot++); }
    return { rider: mode === 'ski', parked, next: slot };
  }
  // treasure matrices from `slot`; returns [slot, kind] pairs to draw
  function fillTreasures(out, slot, maxSlot) {
    const list = [];
    for (const it of treasures) {
      if (it.got && it.t > 1.0) continue;
      if (slot >= maxSlot) break;
      itemMatrix(out, slot * 16, it, time);
      list.push([slot++, it.kind]);
    }
    return list;
  }

  function hud() {
    let h;
    if (mode === 'ski') h = `<b>${(ski.speed * 3.6).toFixed(0)}</b> км/ч &nbsp;·&nbsp; W газ · S тормоз · A/D руль · Shift турбо · мышь — камера · Пробел — спрыгнуть`;
    else if (mode === 'swim') h = nearestSki() ? '<b>Пробел</b> — сесть на гидроцикл' : 'W — плыть · A/D — поворот · посмотри вниз и плыви — нырнёшь · к берегу — выйдешь на сушу';
    else if (mode === 'walk') h = nearestSki() ? '<b>Пробел</b> — сесть на гидроцикл' : 'W — идти · A/D — поворот · Shift — бежать · Пробел — прыжок · заходи в воду — поплывёшь';
    else h = 'WASD — плыть · мышь — куда плыть · Shift быстрее · плыви вверх к свету — вынырнешь';
    return { hint: h, message: messageT > 0 ? message : '', count: `⭐ ${found()} / ${total()}` };
  }

  return {
    bump: () => { if (mode === 'ski') { say('Бум! Осторожно, лодка', 1.2); sfx.bump(0.8); } },
    get mode() { return mode; }, get time() { return time; }, get ski() { return ski; }, skis, me, probe, mouse, keyDown, probePoints, update,
    fillModels, fillTreasures, hud, surface, foundUnderwater,
  };
}
