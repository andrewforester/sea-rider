// Touch controls for phones and tablets (also forced with ?touch on a desktop):
//  - a floating stick on the left: up/down = throttle, walk or swim; left/right = steer or turn;
//  - drag on the right half to look around;
//  - button A does what fits the moment: get on / jump off the jet ski, jump, dive; B (hold) = turbo / run.
// A phone held upright gets the page turned on its side by CSS, so touch points are mapped into the page's frame.
export function setupTouch({ game, keys, sfx, onAny }) {
  const forced = new URLSearchParams(location.search).has('touch');
  if (!forced && !matchMedia('(pointer:coarse)').matches) return null;
  document.body.classList.add('touch');
  const go = document.querySelector('#load .go');
  if (go) go.textContent = 'Остров готов — коснись экрана, чтобы играть';
  const $ = (id) => document.getElementById(id);
  const rot = matchMedia('(orientation:portrait) and (pointer:coarse)');
  // page coordinates of a pointer (the page lies on its side in portrait: see template.html)
  const pt = (e) => (rot.matches ? [e.clientY, innerWidth - e.clientX] : [e.clientX, e.clientY]);
  const joy = $('joy'), knob = $('knob'), bA = $('bA'), bB = $('bB');
  const R = 55; // stick travel, px

  let first = true;
  const wake = () => {
    sfx.start(); onAny?.();
    if (first) {
      first = false;
      // phones: go fullscreen and ask for landscape; where that is refused the CSS rotation still applies
      document.documentElement.requestFullscreen?.()?.then(() => screen.orientation?.lock?.('landscape')).catch(() => 0);
    }
  };
  addEventListener('pointerup', () => sfx.start());

  // ---- stick
  let sId = null, sx = 0, sy = 0;
  const setAxes = (jx, jy) => {
    const dz = (v) => (Math.abs(v) < 0.12 ? 0 : (v - Math.sign(v) * 0.12) / 0.88);
    keys.joyR = dz(jx); keys.joyF = dz(-jy);
    knob.style.transform = `translate(${(jx * R).toFixed(1)}px, ${(jy * R).toFixed(1)}px)`;
  };
  const zone = $('stickzone');
  zone.addEventListener('pointerdown', (e) => {
    wake(); if (sId !== null) return;
    sId = e.pointerId; try { zone.setPointerCapture(e.pointerId); } catch (_) { /* synthetic pointer */ }
    [sx, sy] = pt(e);
    joy.style.left = sx + 'px'; joy.style.top = sy + 'px'; joy.classList.add('on');
    setAxes(0, 0);
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== sId) return;
    const [x, y] = pt(e);
    let dx = (x - sx) / R, dy = (y - sy) / R;
    const l = Math.hypot(dx, dy);
    if (l > 1) { dx /= l; dy /= l; }
    setAxes(dx, dy);
  });
  const stickUp = (e) => {
    if (e.pointerId !== sId) return;
    sId = null; setAxes(0, 0); joy.classList.remove('on'); joy.style.left = joy.style.top = '';
  };
  zone.addEventListener('pointerup', stickUp); zone.addEventListener('pointercancel', stickUp);

  // ---- look
  const look = $('look');
  let lId = null, lx = 0, ly = 0;
  look.addEventListener('pointerdown', (e) => {
    wake(); if (lId !== null) return;
    lId = e.pointerId; try { look.setPointerCapture(e.pointerId); } catch (_) { /* synthetic pointer */ } [lx, ly] = pt(e);
  });
  look.addEventListener('pointermove', (e) => {
    if (e.pointerId !== lId) return;
    const [x, y] = pt(e), k = 1500 / Math.min(innerWidth, innerHeight); // a swipe across the screen ~ half a turn
    game.mouse((x - lx) * k * 0.5, (y - ly) * k * 0.5);
    lx = x; ly = y;
  });
  const lookUp = (e) => { if (e.pointerId === lId) lId = null; };
  look.addEventListener('pointerup', lookUp); look.addEventListener('pointercancel', lookUp);

  // ---- buttons
  let aCode = 'Space';
  bA.addEventListener('pointerdown', (e) => {
    e.preventDefault(); wake(); bA.classList.add('on');
    game.keyDown(aCode);
  });
  const aUp = () => bA.classList.remove('on');
  bA.addEventListener('pointerup', aUp); bA.addEventListener('pointercancel', aUp); bA.addEventListener('pointerleave', aUp);
  bB.addEventListener('pointerdown', (e) => { e.preventDefault(); wake(); keys.ShiftLeft = true; bB.classList.add("on"); try { bB.setPointerCapture(e.pointerId); } catch (_) { /* synthetic pointer */ } });
  const bUp = () => { keys.ShiftLeft = false; bB.classList.remove('on'); };
  bB.addEventListener('pointerup', bUp); bB.addEventListener('pointercancel', bUp);
  for (const b of [bA, bB]) b.addEventListener('contextmenu', (e) => e.preventDefault());

  // button labels follow the game state (called every frame)
  let lastA = '', lastB = '';
  function update() {
    const m = game.mode, near = game.nearSki;
    let a = '', b = '';
    if (m === 'ski') { a = 'Спрыгнуть'; b = 'Турбо'; aCode = 'Space'; }
    else if (near) { a = 'Сесть'; aCode = 'Space'; }
    else if (m === 'walk') { a = 'Прыжок'; aCode = 'Space'; }
    else if (m === 'swim') { a = 'Нырнуть'; aCode = 'KeyQ'; }
    if (m === 'walk') b = 'Бег'; else if (m === 'swim') b = 'Быстрее';
    if (a !== lastA) bA.textContent = lastA = a;
    if (b !== lastB) bB.textContent = lastB = b;
  }
  return { update };
}
