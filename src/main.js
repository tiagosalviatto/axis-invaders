(function () {
  const ns = window.AxisInvaders;
  const canvas = document.getElementById('game');

  // Layout, decided once at load:
  //  - phone/tablet (coarse pointer): touch layout (game + control strip, no scroll/zoom);
  //    held upright it also gets a portrait play area (600x900) so the game fills the screen.
  //  - "?portrait" in the URL forces the phone layout on desktop, for testing.
  const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  const forcePortrait = new URLSearchParams(location.search).has('portrait');
  const touchLayout = coarse || forcePortrait;
  const portrait = forcePortrait || (coarse && window.innerHeight > window.innerWidth);
  if (touchLayout) document.documentElement.classList.add('touch');
  if (portrait) { canvas.width = 600; canvas.height = 900; }
  if (coarse) ns.input.setMode('touch'); // show touch wording from the first screen

  ns.ui.attach(canvas);
  ns.touch.attach(canvas, document.getElementById('touchpad'));

  ns.sprites.preloadAssets().then(() => {
    const game = new ns.Game(canvas);
    ns.game = game; // exposed for debugging / preview inspection
    let lastT = performance.now();

    function frame(t) {
      let dt = (t - lastT) / 1000;
      if (dt > 0.033) dt = 0.033; // clamp big hitches (tab switch, GC pauses)
      if (dt < 0) dt = 0;
      lastT = t;
      game.update(dt);
      game.draw(t);
      requestAnimationFrame(frame);
    }

    requestAnimationFrame((t) => { lastT = t; frame(t); });
  });
})();
