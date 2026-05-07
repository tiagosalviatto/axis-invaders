(function () {
  const ns = (window.AxisInvaders = window.AxisInvaders || {});

  ns.stages = [
    {
      name: 'CAGE RAGE',
      subtitle: 'Stage 1 — dramatic mayhem',
      bgColor: '#0a0303',
      rows: 5,
      cols: 8,
      marchMs: 700,
      fireMs: 1400,
      bulletSpeedMul: 1.0,
      pointsPerKill: 10,
      bgDraw: 'cage',
      boss: {
        behaviorKey: 'cage',
        name: 'NICOLAS CAGE',
        hp: 20,
        vx: 90,
        fireMs: 1400,
        bulletSpeed: 220
      }
    },
    {
      name: 'R8 VELOCITY',
      subtitle: 'Stage 2 — Audi pursuit',
      bgColor: '#02060a',
      rows: 5,
      cols: 9,
      marchMs: 550,
      fireMs: 1000,
      bulletSpeedMul: 1.3,
      pointsPerKill: 15,
      bgDraw: 'r8',
      boss: {
        behaviorKey: 'r8',
        name: 'AUDI R8',
        hp: 20,
        vx: 180,
        beamWarnMs: 600,
        beamFireMs: 400,
        beamCooldownMs: 1500
      }
    },
    {
      name: 'SAMBA STORM',
      subtitle: 'Stage 3 — enSAI de quinta',
      bgColor: '#040a04',
      rows: 6,
      cols: 10,
      marchMs: 420,
      fireMs: 750,
      bulletSpeedMul: 1.6,
      pointsPerKill: 20,
      bgDraw: 'samba',
      boss: {
        behaviorKey: 'police',
        name: 'POLICIA',
        hp: 20,
        vx: 130,
        fireMs: 900,
        bulletSpeed: 300
      }
    }
    {
  name: 'PESSOAS & CULTURA',
  subtitle: 'Stage 4 — vibes corporativas',
  bgColor: '#ff69b4', // rosa
  rows: 6,
  cols: 10,
  marchMs: 380,
  fireMs: 700,
  bulletSpeedMul: 1.4,
  pointsPerKill: 25,
  bgDraw: 'people',
  boss: {
    behaviorKey: 'people',
    name: 'Brubru',
    hp: 25,
    vx: 110,
    fireMs: 800,
    bulletSpeed: 260
  }
}
  ];

  // Lightweight per-stage backdrops. Receive shared `state` to persist particles.
  ns.bgDrawers = {
    cage(ctx, t, w, h /*, state */) {
      const a = (Math.sin(t * 0.003) * 0.5 + 0.5) * 0.05 + 0.02;
      ctx.fillStyle = `rgba(200, 16, 46, ${a})`;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
    },

    r8(ctx, t, w, h /*, state */) {
      ctx.fillStyle = '#15151c';
      ctx.fillRect(w / 2 - 5, 0, 10, h);
      ctx.fillStyle = '#FFD600';
      const dashH = 30;
      const gap = 30;
      const offset = (t * 0.3) % (dashH + gap);
      for (let y = -offset; y < h; y += dashH + gap) {
        ctx.fillRect(w / 2 - 1, y, 2, dashH);
      }
    },

    samba(ctx, t, w, h, state) {
      if (!state.confetti) {
        state.confetti = [];
        const colors = ['#FFD400', '#009C3B', '#FF4D4D', '#1E70C1', '#FFFFFF'];
        for (let i = 0; i < 50; i++) {
          state.confetti.push({
            x: Math.random() * w,
            y: Math.random() * h,
            vy: 25 + Math.random() * 45,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: 2 + Math.floor(Math.random() * 3)
          });
        }
        people(ctx, t, w, h /*, state */) {
  ctx.fillStyle = '#ff69b4'; // rosa chapado
  ctx.fillRect(0, 0, w, h);
}
      }
      const dt = state.lastT ? (t - state.lastT) / 1000 : 0;
      state.lastT = t;
      for (const p of state.confetti) {
        p.y += p.vy * dt;
        p.x += Math.sin((t + p.y) * 0.005) * 0.4;
        if (p.y > h) { p.y = -5; p.x = Math.random() * w; }
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
    }
  };
})();
