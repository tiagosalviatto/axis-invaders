(function () {
  const ns = (window.AxisInvaders = window.AxisInvaders || {});

  // Touch steering. Drag (relative, like a trackpad) on the control strip below
  // the game — or on the game itself during play — to steer; the ship fires
  // automatically while a finger is down. The ship chases the drag target at
  // its own top speed (see Player.update), so each ship keeps its speed identity.
  const SENSITIVITY = 1.4; // ship travel per finger travel, in screen space

  let canvas = null;
  let active = null; // the steering pointer: { id, x, y }

  function playing() {
    const g = ns.game;
    return !!g && g.state === 'play' && !g.paused;
  }

  function start(e, el) {
    active = { id: e.pointerId, x: e.clientX, y: e.clientY };
    try { el.setPointerCapture(e.pointerId); } catch (_) { /* not supported */ }
    ns.input.setHeld('fire', true);
  }

  function move(e) {
    if (!active || e.pointerId !== active.id) return;
    const dx = e.clientX - active.x;
    const dy = e.clientY - active.y;
    active.x = e.clientX;
    active.y = e.clientY;
    if (!playing()) return;
    // Screen px -> logical canvas px (the canvas is CSS-scaled).
    const k = (canvas.width / canvas.getBoundingClientRect().width) * SENSITIVITY;
    ns.input.addDrag(dx * k, dy * k);
  }

  function end(e) {
    if (!active || (e && e.pointerId !== active.id)) return;
    active = null;
    ns.input.setHeld('fire', false);
  }

  function attach(cv, pad) {
    canvas = cv;

    // On the game itself: touch/pen only, during play, and not on a button.
    cv.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || active || !playing()) return;
      if (ns.ui.buttonAt(e)) return;
      start(e, cv);
    });

    if (pad) {
      pad.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (e.pointerType !== 'mouse') ns.input.setMode('touch');
        if (ns.audio) ns.audio.enable(); // unlock audio inside the gesture (iOS)
        if (playing()) { if (!active) start(e, pad); }
        else ns.input.trigger('tap'); // outside play the strip works like tapping the screen
      });
    }

    [cv, pad].forEach((el) => {
      if (!el) return;
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      el.addEventListener('contextmenu', (ev) => ev.preventDefault());
    });

    window.addEventListener('blur', () => end());
  }

  ns.touch = { attach, release: () => end() };
})();
