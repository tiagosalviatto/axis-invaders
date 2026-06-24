(function () {
  const ns = (window.AxisInvaders = window.AxisInvaders || {});

  ns.stages = [
    {
      name: 'CAGE RAGE',
      subtitle: 'Stage 1 — dramatic mayhem',
      story: 'Você deixou seu PC desbloqueado! Nicholas Cage quer possuir tua máquina!',
      bgColor: '#0a0303',
      rows: 5,
      cols: 8,
      marchMs: 700,
      fireMs: 1400,
      bulletSpeedMul: 1.0,
      pointsPerKill: 10,
      parTime: 45,           // seconds; clearing faster awards a speed bonus
      completionBonus: 500,
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
      name: 'BYD VELOCITY',
      subtitle: 'Stage 2 — BYD pursuit',
      story: 'Você veio de carro para o escritório! Encare o trânsito!',
      bgColor: '#02060a',
      rows: 5,
      cols: 9,
      marchMs: 550,
      fireMs: 1000,
      bulletSpeedMul: 1.3,
      pointsPerKill: 15,
      parTime: 40,
      completionBonus: 600,
      bgDraw: 'byd',
      boss: {
        behaviorKey: 'byd',
        name: 'BYD',
        hp: 20,
        vx: 180,
        beamWarnMs: 600,
        beamFireMs: 400,
        beamCooldownMs: 1500
      }
    },
    {
      name: 'SAMBA AGREGADO INFORMAL',
      subtitle: 'Stage 3 — enSAI de quinta',
      story: 'Happy hour com o time! O samba rola até o rapa aparecer.',
      bgColor: '#040a04',
      rows: 6,
      cols: 10,
      marchMs: 420,
      fireMs: 750,
      bulletSpeedMul: 1.6,
      pointsPerKill: 20,
      parTime: 38,
      completionBonus: 700,
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

    byd(ctx, t, w, h /*, state */) {
      ctx.fillStyle = '#15151c';
      ctx.fillRect(w / 2 - 5, 0, 10, h);
      ctx.fillStyle = '#FFD600';
      // Perspective lane: each dash is born tiny at the horizon (top) and
      // accelerates + grows as it rushes toward the player at the bottom.
      // The quadratic easing on depth is what unambiguously reads as
      // "driving forward" instead of an ambiguous flat scroll.
      const N = 9;            // dashes in flight
      const speed = 0.00019;  // depth cycles per ms
      const cx = w / 2;
      for (let i = 0; i < N; i++) {
        const p = (((t * speed) + i / N) % 1 + 1) % 1; // depth 0 (far) -> 1 (near)
        const ease = p * p;                            // accelerate toward viewer
        const y = ease * h;
        const dashH = 6 + ease * 42;                   // longer when closer
        const dashW = 1 + ease * 4;                    // wider when closer
        ctx.fillRect(cx - dashW / 2, y, dashW, dashH);
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
