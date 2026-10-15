(function () {
  const ns = (window.AxisInvaders = window.AxisInvaders || {});

  // Touch steering. Drag anywhere on the game (relative, like a trackpad) to
  // steer; the ship fires automatically while a finger is down. The ship chases
  // the drag target at its own top speed (see Player.update), so each ship keeps
  // its speed identity. On phones the ship rests above a thumb area at the
  // bottom of the screen, so the finger doesn't cover it.
  const SENSITIVITY = 2.1; // ship travel per finger travel, in screen space

  let canvas = null;
  let active = null; // the steering pointer: { id, x, y }

  function playing() {
    const g = ns.game;
    return !!g && g.state === 'play' && !g.paused;
  }

  // In the phone layout any pointer steers (so the mouse works when testing
  // with ?portrait); on the desktop layout the mouse doesn't steer.
  function canSteer(e) {
    return e.pointerType !== 'mouse' || document.documentElement.classList.contains('touch');
  }

  function start(e) {
    active = { id: e.pointerId, x: e.clientX, y: e.clientY };
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* not supported */ }
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
    const logicalW = ns.view ? ns.view.w : canvas.width;
    const k = (logicalW / canvas.getBoundingClientRect().width) * SENSITIVITY;
    ns.input.addDrag(dx * k, dy * k);
  }

  function end(e) {
    if (!active || (e && e.pointerId !== active.id)) return;
    active = null;
    ns.input.setHeld('fire', false);
  }

  function attach(cv) {
    canvas = cv;
    // During play, a press anywhere on the game (except on a button) starts steering.
    cv.addEventListener('pointerdown', (e) => {
      if (active || !playing() || !canSteer(e)) return;
      if (ns.ui.buttonAt(e)) return;
      start(e);
    });
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('contextmenu', (ev) => ev.preventDefault());
    window.addEventListener('blur', () => end());
  }

  ns.touch = { attach, release: () => end() };
})();
