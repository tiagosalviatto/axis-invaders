(function () {
  const ns = (window.AxisInvaders = window.AxisInvaders || {});

  const STATES = { MENU: 'menu', SELECT: 'select', STORY: 'story', INTRO: 'intro', PLAY: 'play', OVER: 'over', WIN: 'win' };

  const STORY_CPS = 38;            // typewriter speed (characters per second)
  const STORY_AUTO_ADVANCE = 6;    // seconds after the text completes before auto-advancing

  class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.ctx.imageSmoothingEnabled = false;
      this.w = canvas.width;
      this.h = canvas.height;

      this.state = STATES.MENU;
      this.stageIdx = 0;
      this.score = 0;
      this.lives = 3;
      this.shipId = ns.ships.DEFAULT;
      this.selIdx = 0;
      this.shipPreviews = null; // baked lazily on first selection screen
      this.bullets = [];
      this.particles = [];
      this.player = null;
      this.grid = null;
      this.bosses = [];          // active bosses (usually 1; 2 in the police phase 2)
      this.policePhase2 = false; // viatura already split into officers?
      this.reinforcements = 0;   // "REFORÇOS!" banner timer
      this.sprites = null;
      this.introTime = 0;
      this.flash = 0;
      this.paused = false;
      this.bgState = {};

      // Narrative transition (STORY state)
      this.storyT = 0;       // seconds elapsed in the current story screen
      this.storyAutoT = 0;   // auto-advance timer once the text is fully revealed

      // Scoring / high-score table
      this.stageTime = 0;      // seconds elapsed in the current stage (PLAY only)
      this.stageTimes = [];    // recorded clear time per completed stage
      this.scores = [];        // snapshot of the table on the end screen
      this.awaitingName = false;
      this.boardLoading = false;
      this.boardOffline = false;
      this.submitting = false;
      this.myEntryKey = null;  // highlights the player's own row
      this.nameEl = document.getElementById('nameEntry');
      this.nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('nameSave');
      if (saveBtn) saveBtn.addEventListener('click', () => this.submitName());
      if (this.nameInput) {
        this.nameInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); this.submitName(); }
        });
      }
    }

    startStage(idx) {
      this.stageIdx = idx;
      const stage = ns.stages[idx];
      this.sprites = ns.sprites.buildStageSprites(idx, this.shipId);
      this.player = new ns.entities.Player(
        this.w, this.h, this.sprites.player, ns.ships.defs[this.shipId]
      );
      this.grid = new ns.entities.EnemyGrid(stage, this.sprites, this.w);
      this.bosses.length = 0;
      this.policePhase2 = false;
      this.reinforcements = 0;
      this.bullets.length = 0;
      this.particles.length = 0;
      this.bgState = {};
      this.paused = false;
      this.stageTime = 0;
      // Open with the narrative transition; gameplay board is built and waiting behind it.
      this.state = STATES.STORY;
      this.storyT = 0;
      this.storyAutoT = 0;
      ns.audio.playStageMotif(idx);
    }

    // Short "get ready" beat after the story screen: the name flashes over the
    // live board before enemies start acting.
    beginIntro() {
      this.state = STATES.INTRO;
      this.introTime = 1.2;
    }

    startGame() {
      this.score = 0;
      this.lives = 3;
      this.stageTimes = [];
      this.awaitingName = false;
      this.hideNameEntry();
      this.startStage(0);
    }

    // Award completion + speed bonuses for the stage just cleared and record
    // its clear time. Called at each point where we leave a stage (advance or win).
    finishStage() {
      const stage = ns.stages[this.stageIdx];
      this.score += stage.completionBonus || 500;
      const par = stage.parTime || 40;
      const speedBonus = Math.max(0, Math.round((par - this.stageTime) * 20));
      this.score += speedBonus;
      this.stageTimes.push(Math.round(this.stageTime * 10) / 10);
    }

    // Explosion palette for a boss death/hit, keyed by behavior.
    bossPalette(boss) {
      if (boss.behaviorKey === 'cage') return ['#FFD45A', '#C8102E', '#FFFFFF'];
      if (boss.behaviorKey === 'byd')  return ['#D8D8D8', '#FF1418', '#FFFFFF'];
      return ['#3050FF', '#FF2030', '#FFFFFF']; // police + officers
    }

    // Called when a boss reaches 0 HP. Awards the kill and, for the viatura,
    // triggers phase 2: it splits into two hovering police officers.
    onBossDefeated(boss) {
      ns.entities.spawnBigExplosion(
        this.particles,
        boss.x + boss.w / 2, boss.y + boss.h / 2,
        ['#FFD400', '#FF3030', '#FFFFFF', '#FFA040']
      );
      this.score += 200;
      this.flash = 0.25;
      if (boss.behaviorKey === 'police' && !this.policePhase2) {
        this.policePhase2 = true;
        this.spawnPoliceOfficers();
        this.flash = 0.45;
        this.reinforcements = 1.8;
        ns.audio.playHit();
      }
    }

    // Spawn the two phase-2 officers: a left "aim" officer that tracks the
    // player and a right "spread" officer. Each hovers around its home spot.
    spawnPoliceOfficers() {
      const make = (role, centerX, phase, fireMs, speed) => {
        const o = new ns.entities.Boss({
          behaviorKey: 'officer',
          role,
          name: 'POLICIAL',
          hp: 12,
          vx: 0,
          fireMs,
          bulletSpeed: speed,
          bitmap: this.sprites.officer,
          aimSprite: this.sprites.officerBulletRed,
          spreadSprite: this.sprites.officerBulletBlue
        }, this.w);
        o.role = role;
        o.homeX = centerX - o.w / 2;
        o.homeY = 72;
        o.x = o.homeX;
        o.y = o.homeY;
        o.phase = phase;
        o.target = this.player;
        return o;
      };
      this.bosses.push(make('aim', this.w * 0.30, 0, 1100, 320));
      this.bosses.push(make('spread', this.w * 0.70, Math.PI, 1300, 280));
    }

    // Transition into an end screen. Only finishers (WIN) are recorded — they
    // get the name prompt; OVER just shows the global ranking read-only.
    endGame(state) {
      this.state = state;
      this.scores = [];
      this.boardLoading = true;
      this.boardOffline = false;
      this.submitting = false;
      this.myEntryKey = null;
      this.awaitingName = (state === STATES.WIN);
      if (this.awaitingName) this.showNameEntry();
      ns.scoreboard.fetchTop().then(list => {
        this.scores = list;
        this.boardLoading = false;
      });
    }

    showNameEntry() {
      if (!this.nameEl) return;
      this.nameEl.classList.remove('hidden');
      if (this.nameInput) { this.nameInput.value = ''; this.nameInput.focus(); }
    }

    hideNameEntry() {
      if (this.nameEl) this.nameEl.classList.add('hidden');
    }

    submitName() {
      if (!this.awaitingName || this.submitting) return;
      const name = ((this.nameInput && this.nameInput.value) || '').trim().slice(0, 16) || 'ANON';
      const total = Math.round(this.stageTimes.reduce((a, b) => a + b, 0) * 10) / 10;
      const entry = {
        name,
        score: this.score,
        total_time: total,
        ship: this.shipId,
        stage_times: this.stageTimes.slice()
      };
      this.myEntryKey = name + '|' + this.score + '|' + this.shipId;
      this.submitting = true;
      this.boardLoading = true;
      this.awaitingName = false;
      this.hideNameEntry();
      ns.scoreboard.submit(entry).then(res => {
        this.scores = res.list;
        this.boardOffline = !!res.offline;
        this.boardLoading = false;
        this.submitting = false;
      });
    }

    update(dt) {
      const stage = ns.stages[this.stageIdx];

      if (this.state === STATES.MENU) {
        if (ns.input.consumeAnyPress()) {
          ns.audio.enable();
          this.selIdx = ns.ships.order.indexOf(this.shipId);
          if (this.selIdx < 0) this.selIdx = 0;
          this.state = STATES.SELECT;
        }
        return;
      }

      if (this.state === STATES.SELECT) {
        const n = ns.ships.order.length;
        if (ns.input.consumePress('ArrowLeft') || ns.input.consumePress('KeyA')) {
          this.selIdx = (this.selIdx - 1 + n) % n;
          ns.audio.playShoot();
        }
        if (ns.input.consumePress('ArrowRight') || ns.input.consumePress('KeyD')) {
          this.selIdx = (this.selIdx + 1) % n;
          ns.audio.playShoot();
        }
        if (ns.input.consumePress('Space') || ns.input.consumePress('Enter')) {
          this.shipId = ns.ships.order[this.selIdx];
          this.startGame();
        }
        return;
      }

      if (this.state === STATES.STORY) {
        this.storyT += dt;
        const text = stage.story || '';
        const full = this.storyT * STORY_CPS >= text.length;
        if (ns.input.consumeAnyPress()) {
          if (!full) this.storyT = text.length / STORY_CPS + 0.01; // 1st key: reveal all text
          else this.beginIntro();                                  // 2nd key: start the stage
        }
        if (full) {
          this.storyAutoT += dt;
          if (this.storyAutoT > STORY_AUTO_ADVANCE) this.beginIntro();
        }
        return;
      }

      if (this.state === STATES.OVER || this.state === STATES.WIN) {
        if (this.awaitingName) return; // block menu until the name is submitted
        if (ns.input.consumeAnyPress()) this.state = STATES.MENU;
        return;
      }

      if (this.state === STATES.INTRO) {
        this.introTime -= dt;
        if (this.introTime <= 0) this.state = STATES.PLAY;
        return;
      }

      // PLAY
      if (ns.input.consumePress('KeyP')) this.paused = !this.paused;
      if (this.paused) return;

      this.stageTime += dt;

      this.player.update(dt, ns.input);

      if (ns.input.isDown('Space') && this.player.canFire()) {
        this.bullets.push(new ns.entities.Bullet(
          this.player.x + this.player.w / 2,
          this.player.y - 4,
          -540 * stage.bulletSpeedMul * ns.ships.defs[this.shipId].bulletSpeedMul,
          'player',
          this.sprites.playerBullet
        ));
        this.player.fire();
        ns.audio.playShoot();
      }

      const shoot = this.grid.update(dt);
      if (shoot) {
        this.bullets.push(new ns.entities.Bullet(
          shoot.x, shoot.y,
          260 * stage.bulletSpeedMul,
          'enemy',
          this.sprites.enemyBullet
        ));
      }

      // Boss update + attack events. Behaviors may return a single shot
      // event or an array of shots (e.g. Cage's fan, officers' spread).
      for (const boss of this.bosses) {
        if (!boss.alive) continue;
        const ev = boss.update(dt);
        if (ev) {
          const shots = Array.isArray(ev) ? ev : [ev];
          for (const s of shots) {
            if (s && s.kind === 'shot') {
              this.bullets.push(new ns.entities.Bullet(
                s.x, s.y, s.vy, 'enemy', s.sprite, s.vx || 0
              ));
            }
          }
        }
      }

      for (const b of this.bullets) b.update(dt, this.h, this.w);

      // Collisions
      for (const b of this.bullets) {
        if (!b.alive) continue;
        if (b.owner === 'player') {
          let hit = false;
          for (const e of this.grid.enemies) {
            if (!e.alive) continue;
            if (ns.entities.aabb(b, e)) {
              e.alive = false;
              b.alive = false;
              this.score += stage.pointsPerKill;
              ns.entities.spawnExplosion(
                this.particles,
                e.x + e.w / 2, e.y + e.h / 2,
                ns.sprites.PALETTES[this.stageIdx]
              );
              ns.audio.playExplode();
              hit = true;
              break;
            }
          }
          if (!hit) {
            for (const boss of this.bosses) {
              if (!boss.alive) continue;
              if (!ns.entities.aabb(b, boss)) continue;
              b.alive = false;
              boss.hit(b.x + b.w / 2, b.y);
              this.score += 50;
              ns.entities.spawnExplosion(this.particles, b.x + b.w / 2, b.y, this.bossPalette(boss));
              ns.audio.playExplode();
              if (!boss.alive) this.onBossDefeated(boss);
              break;
            }
          }
        } else if (ns.entities.aabb(b, this.player)) {
          b.alive = false;
          this.lives -= 1;
          this.flash = 0.35;
          ns.audio.playHit();
          ns.entities.spawnExplosion(
            this.particles,
            this.player.x + this.player.w / 2,
            this.player.y + this.player.h / 2,
            ns.sprites.PALETTES[this.stageIdx]
          );
          if (this.lives <= 0) this.endGame(STATES.OVER);
        }
      }

      // Beam vs player (BYD boss). Only one hit per firing window.
      for (const boss of this.bosses) {
        if (!boss.alive) continue;
        const beamRect = boss.beamRect(this.h);
        if (beamRect && !boss.beam.damaged && ns.entities.aabb(beamRect, this.player)) {
          boss.beam.damaged = true;
          this.lives -= 1;
          this.flash = 0.45;
          ns.audio.playHit();
          ns.entities.spawnExplosion(
            this.particles,
            this.player.x + this.player.w / 2,
            this.player.y + this.player.h / 2,
            ['#FF1418', '#FFFFFF', '#FFA040']
          );
          if (this.lives <= 0) this.endGame(STATES.OVER);
        }
      }

      this.bullets = this.bullets.filter(b => b.alive);

      for (const p of this.particles) p.update(dt);
      this.particles = this.particles.filter(p => p.alive);

      // Lose if enemies cross player line
      if (this.grid.bottomY() >= this.player.y) this.endGame(STATES.OVER);

      // Stage progression: clear wave -> spawn boss -> kill all bosses -> next stage
      if (this.grid.aliveCount() === 0 && this.state === STATES.PLAY) {
        if (this.bosses.length === 0) {
          const bossCfg = stage.boss;
          if (bossCfg) {
            this.bosses.push(new ns.entities.Boss({
              ...bossCfg,
              bitmap: this.sprites.boss,
              bulletSprite: this.sprites.enemyBullet,
              bigBulletSprite: this.sprites.bigEnemyBullet,
              redBulletSprite: this.sprites.redBullet,
              blueBulletSprite: this.sprites.blueBullet
            }, this.w));
          } else {
            this.advanceStage();
          }
        } else if (this.bosses.every(b => !b.alive)) {
          // The viatura spawns its officers the same frame it dies, so this is
          // only true once every boss (officers included) is down.
          this.advanceStage();
        }
      }

      if (this.flash > 0) this.flash -= dt;
      if (this.reinforcements > 0) this.reinforcements -= dt;
    }

    // Award the stage bonus and move on (next stage or final win).
    advanceStage() {
      this.finishStage();
      if (this.stageIdx < ns.stages.length - 1) this.startStage(this.stageIdx + 1);
      else this.endGame(STATES.WIN);
    }

    draw(t) {
      const ctx = this.ctx;
      const stage = ns.stages[this.stageIdx];

      ctx.fillStyle = stage.bgColor;
      ctx.fillRect(0, 0, this.w, this.h);

      const bgFn = ns.bgDrawers[stage.bgDraw];
      if (bgFn) bgFn(ctx, t, this.w, this.h, this.bgState);

      if (this.state === STATES.MENU) {
        this.drawMenu();
        return;
      }

      if (this.state === STATES.SELECT) {
        this.drawSelect();
        return;
      }

      if (this.state === STATES.STORY) {
        this.drawStory(stage);
        return;
      }

      if (this.state === STATES.PLAY || this.state === STATES.INTRO) {
        this.player.draw(ctx);
        this.grid.draw(ctx);
        for (const boss of this.bosses) {
          if (!boss.alive) continue;
          boss.draw(ctx);
          boss.drawBeam(ctx, this.h);
        }
        for (const b of this.bullets) b.draw(ctx);
        for (const p of this.particles) p.draw(ctx);
        this.drawHUD();
        if (this.reinforcements > 0) {
          this.text('REFORÇOS!', this.w / 2, this.h * 0.42, 46, '#FF3030');
          this.text('a viatura chamou apoio!', this.w / 2, this.h * 0.42 + 38, 16, '#FFD45A');
        }
        if (this.state === STATES.INTRO) this.drawIntro(stage);
        if (this.flash > 0) {
          ctx.fillStyle = `rgba(255,80,80,${Math.min(1, this.flash * 1.6) * 0.55})`;
          ctx.fillRect(0, 0, this.w, this.h);
        }
        if (this.paused) {
          ctx.fillStyle = 'rgba(0,0,0,0.65)';
          ctx.fillRect(0, 0, this.w, this.h);
          this.text('PAUSED', this.w / 2, this.h / 2, 56, '#fff');
          this.text('press P to resume', this.w / 2, this.h / 2 + 50, 16, '#aaa');
        }
        return;
      }

      if (this.state === STATES.OVER) {
        this.drawEndScreen('GAME OVER', '#FF3030');
      }

      if (this.state === STATES.WIN) {
        this.drawEndScreen('YOU WIN!', '#FFD400');
      }
    }

    drawEndScreen(title, color) {
      const cx = this.w / 2;
      this.text(title, cx, 80, 52, color);
      this.text(`YOUR SCORE  ${String(this.score).padStart(6, '0')}`, cx, 128, 22, '#fff');

      if (this.awaitingName) {
        this.text('VOCÊ CHEGOU AO FIM!', cx, 200, 28, '#FFD400');
        this.text('registre seu nome no ranking — digite e tecle Enter', cx, 240, 13, '#aaa');
        return; // the DOM input overlay is shown over the canvas center
      }

      this.text('RANKING GLOBAL', cx, 152, 18, '#FFD400');

      if (this.boardLoading) {
        this.text('carregando…', cx, 210, 16, '#aaa');
      } else {
        const list = this.scores || [];
        if (!list.length) {
          this.text('(sem pontuações ainda)', cx, 210, 15, '#888');
        } else {
          const top = 182;
          this.text('#',     cx - 250, top, 12, '#777', 'left');
          this.text('NOME',  cx - 215, top, 12, '#777', 'left');
          this.text('NAVE',  cx + 35,  top, 12, '#777', 'left');
          this.text('TEMPO', cx + 130, top, 12, '#777', 'left');
          this.text('SCORE', cx + 250, top, 12, '#777', 'right');
          let y = top + 24;
          for (let i = 0; i < list.length && y < this.h - 70; i++) {
            const e = list[i];
            const key = e.name + '|' + e.score + '|' + e.ship;
            const rowColor = (this.myEntryKey && key === this.myEntryKey) ? '#FFD400' : '#ddd';
            this.text(String(i + 1).padStart(2, ' '), cx - 250, y, 15, rowColor, 'left');
            this.text(e.name, cx - 215, y, 15, rowColor, 'left');
            this.text(e.ship || '-', cx + 35, y, 15, rowColor, 'left');
            this.text(this.fmtTime(e.total_time), cx + 130, y, 15, rowColor, 'left');
            this.text(String(e.score).padStart(6, '0'), cx + 250, y, 15, rowColor, 'right');
            y += 24;
          }
        }
      }

      if (this.boardOffline) this.text('offline — salvo localmente', cx, this.h - 62, 12, '#d99');
      this.text('Press any key for menu', cx, this.h - 38, 16, '#aaa');
    }

    fmtTime(s) {
      s = Math.max(0, Math.round(s || 0));
      return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    }

    drawMenu() {
      const ctx = this.ctx;
      this.text('AXIS INVADERS', this.w / 2, this.h / 2 - 90, 60, '#fff');
      this.text('Beware of the dangers lurking about', this.w / 2, this.h / 2 - 40, 16, '#888');
      this.text('Nicholas Cage  -  BYD no trânsito  -  Samba Agregado', this.w / 2, this.h / 2 + 0, 16, '#aaa');
      const blink = (Math.floor(performance.now() / 500) % 2) === 0;
      if (blink) this.text('PRESS ANY BUTTON TO START', this.w / 2, this.h / 2 + 80, 26, '#FFD400');
      this.text('arrows / WASD = move    Space = fire    P = pause', this.w / 2, this.h - 40, 13, '#666');
    }

    drawSelect() {
      const ctx = this.ctx;
      if (!this.shipPreviews) {
        this.shipPreviews = {};
        for (const id of ns.ships.order) {
          this.shipPreviews[id] = ns.sprites.buildShipPreview(id);
        }
      }
      const bars = ns.ships.statBars();

      this.text('SELECT YOUR SHIP', this.w / 2, 70, 40, '#fff');
      this.text('← →  escolher    Space / Enter  confirmar', this.w / 2, 110, 15, '#888');

      const n = ns.ships.order.length;
      const slotW = this.w / n;
      for (let i = 0; i < n; i++) {
        const id = ns.ships.order[i];
        const def = ns.ships.defs[id];
        const cx = slotW * i + slotW / 2;
        const selected = i === this.selIdx;

        // Card backdrop + highlight for the active selection.
        const cardW = slotW - 36;
        const cardX = cx - cardW / 2;
        const cardY = 150;
        const cardH = 300;
        ctx.fillStyle = selected ? 'rgba(255,212,0,0.10)' : 'rgba(255,255,255,0.04)';
        ctx.fillRect(cardX, cardY, cardW, cardH);
        ctx.strokeStyle = selected ? '#FFD400' : 'rgba(255,255,255,0.15)';
        ctx.lineWidth = selected ? 3 : 1;
        ctx.strokeRect(cardX, cardY, cardW, cardH);

        // Ship sprite, centered near the top of the card.
        const spr = this.shipPreviews[id];
        ctx.drawImage(spr, cx - spr.width / 2, cardY + 40 - spr.height / 2);

        this.text(def.name, cx, cardY + 110, 30, selected ? '#FFD400' : '#fff');
        this.text(def.desc, cx, cardY + 140, 13, '#aaa');

        // Stat bars.
        this.drawStatBar('SPEED', cardX + 20, cardY + 175, cardW - 40, bars[id].speed);
        this.drawStatBar('FIRE',  cardX + 20, cardY + 215, cardW - 40, bars[id].fireRate);
      }

      const blink = (Math.floor(performance.now() / 500) % 2) === 0;
      if (blink) {
        this.text('PRESS SPACE TO LAUNCH', this.w / 2, this.h - 60, 22, '#FFD400');
      }
    }

    drawStatBar(label, x, y, w, ratio) {
      const ctx = this.ctx;
      this.text(label, x, y, 12, '#888', 'left');
      const barX = x;
      const barY = y + 10;
      const barW = w;
      const barH = 8;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = '#3eff70';
      ctx.fillRect(barX, barY, Math.max(4, barW * ratio), barH);
    }

    drawStory(stage) {
      const ctx = this.ctx;
      const cx = this.w / 2;
      const pal = ns.sprites.PALETTES[this.stageIdx] || [null, '#fff', '#ccc', '#fff'];
      const accent = pal[3] || pal[1] || '#FFD400';
      const t = this.storyT;

      // Dark panel over the animated themed background.
      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      ctx.fillRect(0, 0, this.w, this.h);

      // Boss looming at the top: fade-in + slide-down + gentle bob.
      if (this.sprites && this.sprites.boss) {
        const boss = this.sprites.boss;
        const appear = Math.min(1, t / 0.6);
        const scale = Math.min(1, 320 / boss.width, 200 / boss.height);
        const bw = boss.width * scale, bh = boss.height * scale;
        const by = 64 - (1 - appear) * 40 + Math.sin(t * 2) * 6;
        ctx.save();
        ctx.globalAlpha = appear;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(boss, cx - bw / 2, by, bw, bh);
        ctx.restore();
      }

      // Level badge + stage name + accent divider.
      this.text(`NÍVEL ${this.stageIdx + 1}`, cx, 300, 18, accent);
      this.text(stage.name, cx, 332, 34, '#fff');
      ctx.fillStyle = accent;
      ctx.fillRect(cx - 120, 350, 240, 2);

      // Narrative text with typewriter reveal + blinking cursor while typing.
      const text = stage.story || '';
      const shown = Math.min(text.length, Math.floor(t * STORY_CPS));
      const full = shown >= text.length;
      const lines = this.wrapLines(text.slice(0, shown), this.w - 160, 19);
      const cursor = (!full && (Math.floor(performance.now() / 250) % 2 === 0)) ? '▌' : '';
      if (cursor) {
        if (lines.length) lines[lines.length - 1] += cursor;
        else lines.push(cursor);
      }
      let ty = 386;
      for (const ln of lines) { this.text(ln, cx, ty, 19, '#eaeaea'); ty += 28; }

      // Player ship sliding up from the bottom.
      if (this.sprites && this.sprites.player) {
        const ship = this.sprites.player;
        const appear = Math.min(1, t / 0.8);
        const sy = (this.h - 70) + (1 - appear) * 50;
        ctx.save();
        ctx.globalAlpha = appear;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(ship, cx - ship.width / 2, sy);
        ctx.restore();
      }

      // Prompt once the text is fully revealed.
      if (full && (Math.floor(performance.now() / 450) % 2 === 0)) {
        this.text('press any key  ▸', cx, this.h - 24, 15, accent);
      }
    }

    // Greedy word-wrap measured against the current monospace font.
    wrapLines(str, maxWidth, size) {
      const ctx = this.ctx;
      ctx.font = `bold ${size}px "Courier New", Consolas, monospace`;
      const lines = [];
      let cur = '';
      for (const word of str.split(' ')) {
        const test = cur ? cur + ' ' + word : word;
        if (cur && ctx.measureText(test).width > maxWidth) { lines.push(cur); cur = word; }
        else cur = test;
      }
      if (cur) lines.push(cur);
      return lines;
    }

    drawIntro(stage) {
      const ctx = this.ctx;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, this.h / 2 - 70, this.w, 140);
      this.text(stage.name, this.w / 2, this.h / 2 - 18, 48, '#fff');
      this.text(stage.subtitle, this.w / 2, this.h / 2 + 26, 15, '#bbb');
    }

    drawHUD() {
      const ctx = this.ctx;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, this.w, 32);
      this.text(`SCORE ${String(this.score).padStart(5, '0')}`, 16, 16, 16, '#fff', 'left');
      this.text(`STAGE ${this.stageIdx + 1}/3`, this.w / 2, 16, 16, '#fff');
      const lives = '♥'.repeat(Math.max(0, this.lives)) +
                    '·'.repeat(Math.max(0, 3 - this.lives));
      this.text(`LIVES ${lives}`, this.w - 16, 16, 16, '#fff', 'right');
    }

    text(str, x, y, size, color, align) {
      const ctx = this.ctx;
      ctx.fillStyle = color;
      ctx.font = `bold ${size}px "Courier New", Consolas, monospace`;
      ctx.textAlign = align || 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(str, x, y);
    }
  }

  ns.Game = Game;
  ns.STATES = STATES;
})();
