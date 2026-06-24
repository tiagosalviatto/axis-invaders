(function () {
  const ns = (window.AxisInvaders = window.AxisInvaders || {});

  // Pixel-art shapes. '.' / ' ' = transparent, digits 1-9 = palette index.

  const PLAYER = [
    ".....2.....",
    "....222....",
    "...22222...",
    "..1111111..",
    ".111212111.",
    "11111111111",
    "1.1.1.1.1.1"
  ];

  // -- Ship variants (provisional pixel-art until PixeLab assets land) ----
  // BS reuses PLAYER. PC is a slim interceptor; ARTY is a wide gun platform.
  const SHIP_PC = [
    ".....1.....",
    ".....1.....",
    "....111....",
    "....212....",
    "...11111...",
    "..11.2.11..",
    ".11.....11.",
    "..1.....1.."
  ];
  const SHIP_ARTY = [
    "..1.....1..",
    "..1.....1..",
    ".111...111.",
    ".111222111.",
    "11122222111",
    "11111111111",
    "1.1111111.1",
    "1.1.....1.1"
  ];
  const SHIP_GRIDS = { BS: PLAYER, PC: SHIP_PC, ARTY: SHIP_ARTY };

  // Neutral palette so all ships read consistently on the selection screen.
  const SHIP_PREVIEW_PAL = [null, '#CFD6E6', '#8FA0C0', '#FFFFFF'];

  const PLAYER_BULLET = [
    ".2.",
    "121",
    "121",
    "121",
    ".2."
  ];

  const ENEMY_BULLET = [
    "3.3",
    ".3.",
    "333",
    ".3.",
    "3.3"
  ];

  // Big enemy bullet for the Cage boss — roughly 3x the regular footprint.
  const BIG_ENEMY_BULLET = [
    "..333..",
    ".33333.",
    "3333333",
    "3.333.3",
    "3333333",
    "3.333.3",
    "3333333",
    ".33333.",
    "..333.."
  ];

  // STAGE 1 - Cage Rage: dramatic faces and a swarming bee
  const CAGE_A = [
    "..1111111..",
    ".111111111.",
    "11111111111",
    "11313313111",
    "11111111111",
    "11122122111",
    ".111111111.",
    "..1.1.1.1.."
  ];
  const CAGE_B = [
    "1.1.1.1.1.1",
    ".111111111.",
    "11122122111",
    "11111111111",
    "11313313111",
    "11111111111",
    ".111111111.",
    "..1.1.1.1.."
  ];
  const CAGE_C = [
    "...22.22...",
    "..2222222..",
    ".222222222.",
    "22233333222",
    "22233333222",
    ".222222222.",
    "..2222222..",
    "...2.2.2..."
  ];

  // STAGE 2 - BYD Velocity: chevron, car, headlight
  const BYD_A = [
    ".....1.....",
    "....111....",
    "...11111...",
    "..1112111..",
    ".111121111.",
    "11111111111",
    ".111121111.",
    "...11.11..."
  ];
  const BYD_B = [
    "...........",
    "....111....",
    "...11111...",
    "..1111111..",
    ".111111111.",
    "11111121111",
    "22222222222",
    ".2..2.2..2."
  ];
  const BYD_C = [
    "...22222...",
    "..2333332..",
    ".233333332.",
    "23333333332",
    "23333133332",
    "23333333332",
    ".233333332.",
    "..2222222.."
  ];

  // STAGE 3 - Samba Storm: maraca, surdo drum, party hat
  const SAMBA_A = [
    ".....2.....",
    ".....2.....",
    "...11111...",
    "..1111111..",
    ".111313111.",
    "11111111111",
    "11131311311",
    ".111111111."
  ];
  const SAMBA_B = [
    ".111111111.",
    "11111111111",
    "12222222221",
    "12333333321",
    "12333333321",
    "12222222221",
    "11111111111",
    ".111111111."
  ];
  const SAMBA_C = [
    ".....1.....",
    "....121....",
    "...12221...",
    "..1222221..",
    ".122222221.",
    "12222222221",
    "33333333333",
    ".333333333."
  ];

  // -- Boss sprite generation -------------------------------------------
  // Bosses are rendered as oversized typographic name-plates: bold block
  // letters with a heavy silhouette stroke, gradient fill, and an inner
  // accent stroke. The text itself becomes the boss's body.

  // Per-boss typographic specs. Each spec defines the marquee text and the
  // color treatment used to render it as a giant block-letter sprite.
  const BOSS_LABELS = {
    cage: {
      text: 'CAGE!',
      fontSize: 96,
      family: '"Impact", "Arial Black", "Helvetica Neue", sans-serif',
      silhouette: '#1a0a04',           // dark outer halo
      gradient: [[0, '#FFE058'], [0.45, '#FF4030'], [1, '#7A0010']],
      innerStroke: '#FFFFFF',
      highlight: 'rgba(255,255,255,0.35)',
      shadow: 'rgba(0,0,0,0.55)',
      glow: 'rgba(255, 60, 30, 0.95)'
    },
    byd: {
      text: 'BYD',
      fontSize: 120,
      family: '"Impact", "Arial Black", "Helvetica Neue", sans-serif',
      silhouette: '#0a0a0c',
      gradient: [[0, '#F8F8FA'], [0.5, '#A0A4AC'], [1, '#3A3D44']],
      innerStroke: '#FF1418',
      highlight: 'rgba(255,255,255,0.65)',
      shadow: 'rgba(0,0,0,0.7)',
      glow: 'rgba(255, 20, 24, 0.55)'
    },
    police: {
      text: '5-0',
      fontSize: 132,
      family: '"Impact", "Arial Black", "Helvetica Neue", sans-serif',
      silhouette: '#04081a',
      gradient: [[0, '#FFFFFF'], [1, '#C8D4FF']],
      innerStroke: '#1818FF',
      highlight: 'rgba(255,255,255,0.85)',
      shadow: 'rgba(0,0,0,0.6)',
      glow: 'rgba(80, 120, 255, 0.85)'
    }
  };

  function buildBossLabel(spec) {
    const probe = document.createElement('canvas').getContext('2d');
    const font = `900 ${spec.fontSize}px ${spec.family}`;
    probe.font = font;
    const tw = probe.measureText(spec.text).width;
    const padX = 28;
    const padY = 26;
    const w = Math.ceil(tw) + padX * 2;
    const h = Math.ceil(spec.fontSize * 1.25) + padY * 2;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';

    const cx = w / 2, cy = h / 2;

    // Soft glow halo (drawn as a stroked silhouette behind everything).
    if (spec.glow) {
      ctx.save();
      ctx.shadowColor = spec.glow;
      ctx.shadowBlur = 28;
      ctx.lineWidth = 18;
      ctx.strokeStyle = spec.silhouette;
      ctx.strokeText(spec.text, cx, cy);
      ctx.restore();
    }

    // Drop shadow.
    ctx.fillStyle = spec.shadow;
    ctx.fillText(spec.text, cx + 4, cy + 5);

    // Heavy outer silhouette stroke — this is the boss's "body" outline.
    ctx.lineWidth = 14;
    ctx.strokeStyle = spec.silhouette;
    ctx.strokeText(spec.text, cx, cy);

    // Gradient fill across the letter body.
    const grad = ctx.createLinearGradient(0, padY, 0, h - padY);
    for (const [stop, color] of spec.gradient) grad.addColorStop(stop, color);
    ctx.fillStyle = grad;
    ctx.fillText(spec.text, cx, cy);

    // Top-half highlight: clip the upper portion and re-paint a brighter pass.
    if (spec.highlight) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, cy - spec.fontSize * 0.05);
      ctx.clip();
      ctx.fillStyle = spec.highlight;
      ctx.fillText(spec.text, cx, cy);
      ctx.restore();
    }

    // Inner accent stroke for a "chrome" outline against the fill.
    if (spec.innerStroke) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = spec.innerStroke;
      ctx.strokeText(spec.text, cx, cy);
    }

    return c;
  }

  function bake(grid, palette, scale) {
    const w = grid[0].length;
    const h = grid.length;
    const c = document.createElement('canvas');
    c.width = w * scale;
    c.height = h * scale;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < h; y++) {
      const row = grid[y];
      for (let x = 0; x < w; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        const idx = parseInt(ch, 10);
        const color = palette[idx];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    return c;
  }

  // Boss artwork (PixeLab pixel art). Keyed by the stage bossKey. If an image
  // is missing or fails to load, buildStageSprites falls back to the
  // typographic label so the game still runs.
  const BOSS_IMAGE_SRC = {
    cage:   'assets/bosses/cage.png',
    byd:    'assets/bosses/byd.png',
    police: 'assets/bosses/viatura.png'
  };
  const bossImages = Object.create(null);

  function loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null); // resolve null -> fall back gracefully
      img.src = src;
    });
  }

  function preloadAssets() {
    const keys = Object.keys(BOSS_IMAGE_SRC);
    return Promise.all(
      keys.map(k => loadImage(BOSS_IMAGE_SRC[k]).then(img => { bossImages[k] = img; }))
    ).then(() => undefined);
  }

  const SCALE = 3;

  // Stage palettes — index 0 unused (transparent), 1..3 in shapes.
  const PALETTES = [
    // Stage 1 - Cage Rage: blood-red, pale-yellow, white
    [null, '#C8102E', '#FFD45A', '#FFFFFF'],
    // Stage 2 - BYD Velocity: silver, gunmetal, BYD-red
    [null, '#D8D8D8', '#7A7A7A', '#FF1418'],
    // Stage 3 - Samba Storm: yellow, green, red
    [null, '#FFD400', '#009C3B', '#FF4D4D']
  ];

  // Tinted enemy-bullet palettes for the police siren shots.
  const RED_BULLET_PAL  = [null, '#FF2030', '#FF8090', '#FFD0D0'];
  const BLUE_BULLET_PAL = [null, '#3050FF', '#8095FF', '#D0DCFF'];

  // Bake a ship sprite on its own (used by the selection screen preview).
  function buildShipPreview(shipId) {
    return bake(SHIP_GRIDS[shipId] || PLAYER, SHIP_PREVIEW_PAL, SCALE);
  }

  function buildStageSprites(stageIdx, shipId) {
    const pal = PALETTES[stageIdx];
    const shipGrid = SHIP_GRIDS[shipId] || PLAYER;
    let enemies, bossKey;
    if (stageIdx === 0)      { enemies = [CAGE_A, CAGE_B, CAGE_C];     bossKey = 'cage'; }
    else if (stageIdx === 1) { enemies = [BYD_A, BYD_B, BYD_C];        bossKey = 'byd'; }
    else                     { enemies = [SAMBA_A, SAMBA_B, SAMBA_C];  bossKey = 'police'; }

    const bossBitmap = bossImages[bossKey] || buildBossLabel(BOSS_LABELS[bossKey]);

    return {
      player: bake(shipGrid, pal, SCALE),
      playerBullet: bake(PLAYER_BULLET, pal, SCALE),
      enemyBullet: bake(ENEMY_BULLET, pal, SCALE),
      enemies: enemies.map(g => bake(g, pal, SCALE)),
      boss: bossBitmap,
      bossKey,
      bigEnemyBullet: bake(BIG_ENEMY_BULLET, pal, SCALE),
      redBullet: bake(ENEMY_BULLET, RED_BULLET_PAL, SCALE),
      blueBullet: bake(ENEMY_BULLET, BLUE_BULLET_PAL, SCALE)
    };
  }

  ns.sprites = {
    SCALE,
    PALETTES,
    buildStageSprites,
    buildShipPreview,
    preloadAssets
  };
})();
