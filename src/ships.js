(function () {
  const ns = (window.AxisInvaders = window.AxisInvaders || {});

  // Selectable ships. Each ship changes the feel of play:
  //  - speed:          horizontal/vertical movement in px/s
  //  - cooldownMax:    seconds between shots (lower = faster fire rate)
  //  - bulletSpeedMul: extra multiplier on player bullet travel speed
  // BS is the balanced baseline (mirrors the original hardcoded values).
  const defs = {
    BS:   { id: 'BS',   name: 'BS',   desc: 'Equilibrada (?)',         speed: 300, cooldownMax: 0.28, bulletSpeedMul: 1.0 },
    PC:   { id: 'PC',   name: 'PC',   desc: 'Agilizada',   speed: 430, cooldownMax: 0.40, bulletSpeedMul: 1.15 },
    ARTY: { id: 'ARTY', name: 'ARTY', desc: 'Potente', speed: 190, cooldownMax: 0.18, bulletSpeedMul: 0.85 }
  };

  const order = ['BS', 'PC', 'ARTY'];

  // Normalized 0..1 stat values for the selection-screen bars, scaled across
  // the roster so the fastest ship fills the "speed" bar, etc.
  function statBars() {
    const speeds = order.map(k => defs[k].speed);
    const rates = order.map(k => 1 / defs[k].cooldownMax);
    const sMin = Math.min(...speeds), sMax = Math.max(...speeds);
    const rMin = Math.min(...rates), rMax = Math.max(...rates);
    const norm = (v, lo, hi) => (hi === lo ? 1 : (v - lo) / (hi - lo));
    const out = {};
    for (const k of order) {
      out[k] = {
        speed: norm(defs[k].speed, sMin, sMax),
        fireRate: norm(1 / defs[k].cooldownMax, rMin, rMax)
      };
    }
    return out;
  }

  ns.ships = { defs, order, statBars, DEFAULT: 'BS' };
})();
