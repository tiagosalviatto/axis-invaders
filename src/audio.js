(function () {
  const ns = (window.AxisInvaders = window.AxisInvaders || {});

  let ctx = null;
  let masterGain = null;

  function ensure() {
    if (!ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.25;
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freqStart, freqEnd, dur, type, gain) {
    const a = ensure();
    if (!a) return;
    const t0 = a.currentTime;
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(masterGain);
    osc.start(t0);
    osc.stop(t0 + dur);
  }

  function noise(dur, gain, lpf) {
    const a = ensure();
    if (!a) return;
    const t0 = a.currentTime;
    const buffer = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * dur)), a.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource();
    src.buffer = buffer;
    const g = a.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    let node = src;
    if (lpf) {
      const filt = a.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = lpf;
      node.connect(filt);
      node = filt;
    }
    node.connect(g).connect(masterGain);
    src.start(t0);
    src.stop(t0 + dur);
  }

  function thump(t0, freq, dur, gain) {
    const a = ensure();
    if (!a) return;
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.5, t0);
    osc.frequency.exponentialRampToValueAtTime(freq, t0 + dur * 0.4);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(masterGain);
    osc.start(t0);
    osc.stop(t0 + dur);
  }

  ns.audio = {
    enable: ensure,
    playShoot: () => tone(820, 200, 0.06, 'square', 0.25),
    playHit: () => noise(0.08, 0.3),
    playExplode: () => noise(0.25, 0.35, 800),
    playStageMotif: (stageIdx) => {
      const a = ensure();
      if (!a) return;
      const t0 = a.currentTime;
      if (stageIdx === 0) {
        // Cage drama: low minor chord stab (A2, C3, E3)
        [110.0, 130.81, 164.81].forEach(f => {
          const osc = a.createOscillator();
          const g = a.createGain();
          osc.type = 'sawtooth';
          osc.frequency.value = f;
          g.gain.setValueAtTime(0.0, t0);
          g.gain.linearRampToValueAtTime(0.15, t0 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, t0 + 1.0);
          osc.connect(g).connect(masterGain);
          osc.start(t0);
          osc.stop(t0 + 1.05);
        });
      } else if (stageIdx === 1) {
        // BYD motor rev: rising sweep
        const osc = a.createOscillator();
        const g = a.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, t0);
        osc.frequency.exponentialRampToValueAtTime(420, t0 + 0.55);
        g.gain.setValueAtTime(0.0, t0);
        g.gain.linearRampToValueAtTime(0.22, t0 + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.7);
        osc.connect(g).connect(masterGain);
        osc.start(t0);
        osc.stop(t0 + 0.75);
      } else {
        // Samba: 4 surdo beats with agogo on offbeats
        for (let i = 0; i < 4; i++) {
          thump(t0 + i * 0.22, 60, 0.18, 0.4);
          if (i === 1 || i === 3) {
            const f = i === 1 ? 880 : 660;
            tone(f, f, 0.08, 'square', 0.12);
          }
        }
      }
    }
  };
})();
