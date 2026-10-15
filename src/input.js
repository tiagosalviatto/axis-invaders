(function () {
  const ns = (window.AxisInvaders = window.AxisInvaders || {});

  // The game asks for *actions* (confirm, back, fire...) instead of raw keys,
  // so keyboard, mouse and touch can all drive it. The keyboard is one source;
  // UI buttons and touch controls feed "virtual" presses/holds into the same API.
  const BINDINGS = {
    confirm: ['Space', 'Enter'],
    back:    ['Escape', 'Backspace'],
    ranking: ['KeyR'],
    pause:   ['KeyP'],
    left:    ['ArrowLeft', 'KeyA'],
    right:   ['ArrowRight', 'KeyD'],
    up:      ['ArrowUp', 'KeyW'],
    down:    ['ArrowDown', 'KeyS'],
    fire:    ['Space']
  };

  const keys = Object.create(null);     // physical key currently down
  const pressed = Object.create(null);  // physical key-press edge, until consumed
  const vpressed = Object.create(null); // action -> payload of a virtual press
  const vheld = Object.create(null);    // action -> held by a virtual control

  // Last input method used — drives on-screen hints ("Space" vs "toque").
  let mode = 'keyboard';

  // Don't capture/preventDefault while typing in a form field (e.g. the
  // player name input) — otherwise Space and arrows wouldn't type.
  function isTextField(e) {
    const tag = e.target && e.target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA';
  }

  window.addEventListener('keydown', (e) => {
    if (isTextField(e)) return;
    mode = 'keyboard';
    if (!keys[e.code]) pressed[e.code] = true;
    keys[e.code] = true;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (isTextField(e)) return;
    keys[e.code] = false;
  });

  // Avoid stuck keys when window loses focus
  window.addEventListener('blur', () => {
    for (const k in keys) keys[k] = false;
  });

  ns.input = {
    // Is the action currently held (key down or virtual hold)?
    held(action) {
      if (vheld[action]) return true;
      const codes = BINDINGS[action] || [];
      for (const c of codes) if (keys[c]) return true;
      return false;
    },

    // Consume a pending press of the action (virtual or keyboard).
    pressed(action) {
      if (vpressed[action] !== undefined) { delete vpressed[action]; return true; }
      const codes = BINDINGS[action] || [];
      for (const c of codes) {
        if (pressed[c]) { pressed[c] = false; return true; }
      }
      return false;
    },

    // Consume a virtual press and return its payload (e.g. the index of a
    // tapped card), or null if there was none.
    take(action) {
      if (vpressed[action] === undefined) return null;
      const v = vpressed[action];
      delete vpressed[action];
      return v;
    },

    // Consume any pending press — any key, or any tap/click.
    anyPressed() {
      for (const k in pressed) {
        if (pressed[k]) { pressed[k] = false; return true; }
      }
      for (const a in vpressed) { delete vpressed[a]; return true; }
      return false;
    },

    // Virtual inputs fed by UI buttons and touch controls.
    trigger(action, payload) { vpressed[action] = payload === undefined ? true : payload; },
    setHeld(action, on) { vheld[action] = !!on; },

    // Flush pending presses. Call when entering a "press to continue" screen
    // so a key held during gameplay (e.g. Space while firing) doesn't skip it.
    clear() {
      for (const k in pressed) pressed[k] = false;
      for (const a in vpressed) delete vpressed[a];
    },

    get mode() { return mode; },
    setMode(m) { mode = m; }
  };
})();
