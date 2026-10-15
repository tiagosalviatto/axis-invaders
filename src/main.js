(function () {
  const ns = window.AxisInvaders;
  const canvas = document.getElementById('game');

  // Layout, decided once at load:
  //  - phone/tablet (coarse pointer): touch layout (full-screen game, no scroll/zoom);
  //    held upright it also gets a portrait play area that fills the screen.
  //  - "?portrait" in the URL forces the phone layout on desktop, for testing.
  const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  const forcePortrait = new URLSearchParams(location.search).has('portrait');
  const touchLayout = coarse || forcePortrait;
  const portrait = forcePortrait || (coarse && window.innerHeight > window.innerWidth);
  if (touchLayout) document.documentElement.classList.add('touch');
  if (coarse) ns.input.setMode('touch'); // show touch wording from the first screen

  // Logical play area (game coordinates) + backing resolution. On phones the
  // canvas gets real device pixels (capped at 2x for performance) so text and
  // sprites are sharp; desktop stays at 1x so its sizing is unchanged.
  // Portrait: 600 wide and as tall as the screen's shape, so the game fills the
  // whole screen down to the bottom edge (clamped to keep the field sane).
  const W = portrait ? 600 : 800;
  const H = portrait
    ? Math.round(Math.min(1400, Math.max(900, 600 * window.innerHeight / window.innerWidth)))
    : 600;
  const dpr = touchLayout ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ns.view = { w: W, h: H, dpr };
  document.documentElement.style.setProperty('--game-aspect', String(W / H));

  ns.ui.attach(canvas);
  ns.touch.attach(canvas);

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
