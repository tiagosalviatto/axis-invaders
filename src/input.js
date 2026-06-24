(function () {
  const ns = (window.AxisInvaders = window.AxisInvaders || {});

  const keys = Object.create(null);
  const pressed = Object.create(null);

  // Don't capture/preventDefault while typing in a form field (e.g. the
  // high-score name input) — otherwise Space and arrows wouldn't type.
  function isTextField(e) {
    const tag = e.target && e.target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA';
  }

  window.addEventListener('keydown', (e) => {
    if (isTextField(e)) return;
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
    isDown: (code) => !!keys[code],
    consumePress: (code) => {
      if (pressed[code]) { pressed[code] = false; return true; }
      return false;
    },
    consumeAnyPress: () => {
      for (const k in pressed) {
        if (pressed[k]) { pressed[k] = false; return k; }
      }
      return null;
    },
    // Flush latched key-press edges. Call when entering a "press to continue"
    // screen so a key still held from gameplay (e.g. Space while firing) isn't
    // consumed instantly and skips the screen.
    clear: () => { for (const k in pressed) pressed[k] = false; }
  };
})();
