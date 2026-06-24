(function () {
  const ns = window.AxisInvaders;
  const canvas = document.getElementById('game');

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
