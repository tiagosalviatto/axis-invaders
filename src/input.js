(function () {
  const ns = (window.AxisInvaders = window.AxisInvaders || {});

  const keys = Object.create(null);
  const pressed = Object.create(null);

  window.addEventListener('keydown', (e) => {
    if (!keys[e.code]) pressed[e.code] = true;
    keys[e.code] = true;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', (e) => {
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
    }
  };
})();
