(function () {
  const ns = (window.AxisInvaders = window.AxisInvaders || {});

  // Canvas-drawn buttons. Draw code registers each button's rect every frame;
  // a pointer press (mouse, touch or pen) hit-tests the rects from the last
  // drawn frame and fires the button's action into ns.input.
  let buttons = [];
  let canvas = null;

  function begin() { buttons = []; }

  function add(rect, action, payload) {
    buttons.push({ x: rect.x, y: rect.y, w: rect.w, h: rect.h, action, payload });
  }

  // Pointer position in logical canvas coordinates (the canvas is CSS-scaled).
  function toCanvas(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * canvas.width / r.width,
      y: (e.clientY - r.top) * canvas.height / r.height
    };
  }

  function hit(p) {
    for (let i = buttons.length - 1; i >= 0; i--) {
      const b = buttons[i];
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return b;
    }
    return null;
  }

  function attach(cv) {
    canvas = cv;
    cv.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') ns.input.setMode('touch');
      // Unlock WebAudio inside the gesture itself (required by iOS Safari).
      if (ns.audio) ns.audio.enable();
      const b = hit(toCanvas(e));
      if (b) ns.input.trigger(b.action, b.payload);
      else ns.input.trigger('tap');
      e.preventDefault();
    });
  }

  // The button under a pointer event, if any (lets touch steering skip buttons).
  function buttonAt(e) { return canvas ? hit(toCanvas(e)) : null; }

  ns.ui = { begin, add, attach, toCanvas, buttonAt };
})();
