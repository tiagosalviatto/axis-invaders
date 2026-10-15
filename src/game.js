(function () {
  const ns = (window.AxisInvaders = window.AxisInvaders || {});

  const STATES = {
    MENU: 'menu', SELECT: 'select', NAME: 'name', STORY: 'story', INTRO: 'intro',
    PLAY: 'play', CLEAR: 'clear', OVER: 'over', WIN: 'win', RANKING: 'ranking'
  };

  const STORY_CPS = 38;            // typewriter speed (characters per second)
  const STORY_AUTO_ADVANCE = 6;    // seconds after the text completes before auto-advancing

  // Phone layout: the canvas is shown much smaller than on desktop, so small
  // text and buttons are enlarged to stay readable/tappable. Desktop is 1x.
  const PHONE_TEXT = 1.35;  // multiplier for small text (< 22px)
  const PHONE_UI = 1.3;     // multiplier for button size and button spacing

  const FONT = '"Courier New", Consolas, monospace';
  const font = (size) => `bold ${size}px ${FONT}`;

  // The player's name is remembered on the device and pre-filled next time.
  const NAME_KEY = 'axis-invaders-name';
  function loadName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; } }
  function saveName(n) { try { localStorage.setItem(NAME_KEY, n); } catch (e) { /* ignore */ } }

  // 'mobile' when the device has a coarse pointer (finger) or touch was used.
  function detectDevice() {
    const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    return (coarse || ns.input.mode === 'touch') ? 'mobile' : 'web';
  }

  class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      // Logical size (game coordinates). On phones the canvas is backed by more
      // device pixels (ns.view.dpr) for sharpness; drawing still uses logical units.
      const view = ns.view || { w: canvas.width, h: canvas.height, dpr: 1 };
      this.w = view.w;
      this.h = view.h;
      this.ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      this.ctx.imageSmoothingEnabled = false;
      this.phone = document.documentElement.classList.contains('touch');
      this.S = this.phone ? PHONE_UI : 1;

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
      this.rankingFrom = STATES.MENU; // where the ranking screen returns to
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
      this.scores = [];        // rows of the leaderboard currently on screen
      this.boardLoading = false;
      this.boardOffline = false;
      this.boardReq = 0;       // guards against a slow response overwriting a newer board
      this.myEntryKey = null;  // highlights the player's own row
      this.rankingTab = 0;     // 0 = overall, 1..N = stage N

      // Player identity + per-stage result (for the stage leaderboard)
      this.playerName = loadName();
      this.device = 'web';
      this.stageScoreStart = 0; // score when the current stage began
      this.clearStageScore = 0; // points earned in the stage just cleared
      this.clearStageTime = 0;  // seconds taken by the stage just cleared

      this.nameEl = document.getElementById('nameEntry');
      this.nameInput = document.getElementById('nameInput');
      const saveBtn = document.getElementById('nameSave');
      if (saveBtn) saveBtn.addEventListener('click', () => this.confirmName());
      if (this.nameInput) {
        this.nameInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); this.confirmName(); }
          if (e.key === 'Escape') { e.preventDefault(); this.cancelName(); }
        });
      }

      // Auto-pause when the tab/app goes to the background (call, notification, app switch).
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) return;
        if (this.state === STATES.PLAY) this.paused = true;
        if (ns.touch) ns.touch.release();
      });
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
      this.stageScoreStart = this.score;
      // Open with the narrative transition; gameplay board is built and waiting behind it.
      ns.input.clear(); // avoid a held key from the previous stage skipping the cutscene
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
      this.device = detectDevice();
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

    // Transition into an end screen. A win records the overall score under the
    // name given at the start; game over records nothing more (the stages the
    // player cleared were already saved to their own boards).
    endGame(state) {
      ns.input.clear(); // drop keys held during play so the screen isn't skipped
      this.state = state;
      this.hideNameEntry();
      this.myEntryKey = null;
      if (state === STATES.OVER) this.buzz(220);
      if (state === STATES.WIN) {
        const total = Math.round(this.stageTimes.reduce((a, b) => a + b, 0) * 10) / 10;
        this.saveScore({
          name: this.playerName,
          score: this.score,
          total_time: total,
          ship: this.shipId,
          stage_times: this.stageTimes.slice(),
          device: this.device
        }, null);
      }
    }

    // Save an entry to a board (stageId null = overall) and show that board.
    saveScore(entry, stageId) {
      this.myEntryKey = entry.name + '|' + entry.score + '|' + entry.ship;
      this.loadBoard(() => ns.scoreboard.submit(entry, stageId));
    }

    // Fetch/refresh the board on screen. `request` returns a promise of either a
    // list or { list, offline }. A newer request supersedes older ones.
    loadBoard(request) {
      const req = ++this.boardReq;
      this.scores = [];
      this.boardLoading = true;
      this.boardOffline = false;
      request().then(res => {
        if (req !== this.boardReq) return;
        this.scores = Array.isArray(res) ? res : res.list;
        this.boardOffline = !Array.isArray(res) && !!res.offline;
        this.boardLoading = false;
      });
    }

    // Ranking tabs: 0 = overall, then one per stage (new stages appear by themselves).
    rankingTabs() {
      return [{ label: 'GERAL', stageId: null }].concat(
        ns.stages.map((s, i) => ({ label: 'FASE ' + (i + 1), stageId: s.id, stage: s }))
      );
    }

    // Open the global high-scores screen, remembering where to return to.
    openRanking(fromState) {
      ns.audio.enable();
      ns.input.clear();
      this.rankingFrom = fromState;
      this.state = STATES.RANKING;
      this.setRankingTab(0);
    }

    setRankingTab(i) {
      const tabs = this.rankingTabs();
      this.rankingTab = ((i % tabs.length) + tabs.length) % tabs.length;
      const stageId = tabs[this.rankingTab].stageId;
      this.loadBoard(() => ns.scoreboard.fetchTop(stageId));
    }

    // Name prompt, shown after the ship is chosen and before the game starts.
    openNameEntry() {
      ns.input.clear();
      this.state = STATES.NAME;
      if (!this.nameEl) { this.confirmName(); return; }
      this.nameEl.classList.remove('hidden');
      if (this.nameInput) {
        this.nameInput.value = this.playerName;
        this.nameInput.focus();
        this.nameInput.select();
      }
    }

    hideNameEntry() {
      if (this.nameEl) this.nameEl.classList.add('hidden');
      if (this.nameInput) this.nameInput.blur(); // give the keyboard back to the game
    }

    confirmName() {
      if (this.state !== STATES.NAME) return;
      const typed = ((this.nameInput && this.nameInput.value) || '').trim().slice(0, 16);
      this.playerName = typed || 'ANON';
      saveName(this.playerName);
      this.startGame();
    }

    cancelName() {
      if (this.state !== STATES.NAME) return;
      this.hideNameEntry();
      ns.input.clear();
      this.state = STATES.SELECT;
    }

    // Stage just cleared: save its result to that stage's board and show it.
    enterStageClear() {
      ns.input.clear(); // Space held while firing must not skip this screen
      const stage = ns.stages[this.stageIdx];
      this.clearStageScore = Math.max(0, this.score - this.stageScoreStart);
      this.clearStageTime = Math.max(0.1, this.stageTimes[this.stageTimes.length - 1] || 0);
      this.state = STATES.CLEAR;
      this.saveScore({
        stage: stage.id,
        name: this.playerName,
        score: this.clearStageScore,
        total_time: this.clearStageTime,
        ship: this.shipId,
        device: this.device
      }, stage.id);
    }

    continueAfterClear() {
      if (this.stageIdx < ns.stages.length - 1) this.startStage(this.stageIdx + 1);
      else this.endGame(STATES.WIN);
    }

    update(dt) {
      const stage = ns.stages[this.stageIdx];

      if (this.state === STATES.MENU) {
        if (ns.input.pressed('ranking')) { this.openRanking(STATES.MENU); return; }
        if (ns.input.anyPressed()) {
          ns.audio.enable();
          this.selIdx = ns.ships.order.indexOf(this.shipId);
          if (this.selIdx < 0) this.selIdx = 0;
          ns.input.clear();
          this.state = STATES.SELECT;
        }
        return;
      }

      if (this.state === STATES.RANKING) {
        const tab = ns.input.take('tab'); // tapped/clicked a tab
        if (tab !== null) this.setRankingTab(tab);
        if (ns.input.pressed('left')) this.setRankingTab(this.rankingTab - 1);
        if (ns.input.pressed('right')) this.setRankingTab(this.rankingTab + 1);
        if (ns.input.pressed('back') || ns.input.pressed('confirm') || ns.input.pressed('ranking')) {
          ns.input.clear();
          this.state = this.rankingFrom || STATES.MENU;
        }
        return;
      }

      if (this.state === STATES.NAME) {
        // Typing/Enter are handled by the name form itself; this is the canvas
        // VOLTAR button (or Esc once the field lost focus).
        if (ns.input.pressed('back')) this.cancelName();
        return;
      }

      if (this.state === STATES.CLEAR) {
        if (ns.input.pressed('confirm')) this.continueAfterClear();
        return;
      }

      if (this.state === STATES.SELECT) {
        const n = ns.ships.order.length;
        const pick = ns.input.take('pick'); // tapped/clicked a ship card
        if (pick !== null) {
          if (pick === this.selIdx) ns.input.trigger('confirm'); // second tap launches
          else { this.selIdx = pick; ns.audio.playShoot(); }
        }
        if (ns.input.pressed('left')) {
          this.selIdx = (this.selIdx - 1 + n) % n;
          ns.audio.playShoot();
        }
        if (ns.input.pressed('right')) {
          this.selIdx = (this.selIdx + 1) % n;
          ns.audio.playShoot();
        }
        if (ns.input.pressed('confirm')) {
          this.shipId = ns.ships.order[this.selIdx];
          this.openNameEntry();
        }
        return;
      }

      if (this.state === STATES.STORY) {
        this.storyT += dt;
        const text = stage.story || '';
        const full = this.storyT * STORY_CPS >= text.length;
        if (ns.input.anyPressed()) {
          if (!full) this.storyT = text.length / STORY_CPS + 0.01; // 1st key: reveal all text
          else this.beginIntro();                                  // 2nd key: start the stage
        }
        if (full) {
          this.storyAutoT += dt;
          if (this.storyAutoT > STORY_AUTO_ADVANCE) this.beginIntro();
        }
        return;
      }

      if (this.state === STATES.WIN) {
        if (ns.input.pressed('ranking')) { this.openRanking(STATES.WIN); return; }
        if (ns.input.anyPressed()) { ns.input.clear(); this.state = STATES.MENU; }
        return;
      }

      if (this.state === STATES.OVER) {
        if (ns.input.pressed('ranking')) { this.openRanking(STATES.OVER); return; }
        if (ns.input.pressed('confirm')) { ns.input.clear(); this.state = STATES.MENU; }
        return;
      }

      if (this.state === STATES.INTRO) {
        this.introTime -= dt;
        if (this.introTime <= 0) this.state = STATES.PLAY;
        return;
      }

      // PLAY
      if (ns.input.pressed('pause')) this.paused = !this.paused;
      if (this.paused) return;

      this.stageTime += dt;

      this.player.update(dt, ns.input);

      if (ns.input.held('fire') && this.player.canFire()) {
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
          this.buzz(60);
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
          this.buzz(90);
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

    // Award the stage bonus, save + show the stage leaderboard; the player then
    // continues to the next stage (or the final win screen).
    advanceStage() {
      this.finishStage();
      this.enterStageClear();
    }

    draw(t) {
      const ctx = this.ctx;
      const stage = ns.stages[this.stageIdx];
      ns.ui.begin(); // buttons are re-registered by whatever this frame draws

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

      if (this.state === STATES.NAME) { this.drawName(); return; }
      if (this.state === STATES.CLEAR) { this.drawStageClear(stage); return; }

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
          this.text('PAUSED', this.w / 2, this.h / 2 - 20, 56, '#fff');
          this.button('CONTINUAR' + this.kb('P'), this.w / 2, this.h / 2 + 50, 260, 46, 'pause', { primary: true });
        }
        return;
      }

      if (this.state === STATES.OVER) { this.drawGameOver(); return; }
      if (this.state === STATES.WIN) { this.drawWin(); return; }
      if (this.state === STATES.RANKING) { this.drawRanking(); return; }
    }

    // Game over: a simple themed message, no ranking inline (R opens it).
    drawGameOver() {
      const cx = this.w / 2;
      this.text('GAME OVER', cx, this.h / 2 - 90, 58, '#FF3030');
      this.text('bata o ponto e tente novamente amanhã', cx, this.h / 2 - 28, 19, '#fff');
      this.text(`SCORE  ${String(this.score).padStart(6, '0')}`, cx, this.h / 2 + 12, 18, '#aaa');
      this.button('VOLTAR AO INÍCIO' + this.kb('SPACE'), cx, this.h / 2 + 80 * this.S, 320, 48, 'confirm', { primary: true, size: 20 });
      this.button('RANKING' + this.kb('R'), cx, this.h / 2 + 138 * this.S, 320, 40, 'ranking');
    }

    // Win: the overall score is saved under the player's name; show the overall board.
    drawWin() {
      const cx = this.w / 2;
      const oy = this.oy;
      this.text('YOU WIN!', cx, 70 + oy, 50, '#FFD400');
      this.text(`${this.playerName}  ·  SCORE ${String(this.score).padStart(6, '0')}`, cx, 112 + oy, 20, '#fff');
      this.text('RANKING GERAL', cx, 152 + oy, 18, '#FFD400');
      if (this.phone) {
        // Bigger buttons don't fit side by side on the narrow canvas: stack them.
        this.drawScoreTable(182 + oy, this.h - 170);
        if (this.boardOffline) this.text('offline — salvo localmente', cx, this.h - 152, 12, '#d99');
        this.button('MENU', cx, this.h - 106, 300, 44, 'confirm', { primary: true });
        this.button('RANKING', cx, this.h - 40, 300, 40, 'ranking');
        return;
      }
      this.drawScoreTable(182 + oy);
      if (this.boardOffline) this.text('offline — salvo localmente', cx, this.h - 92, 12, '#d99');
      this.button('MENU' + this.kb('SPACE'), cx - 130, this.h - 40, 230, 40, 'confirm', { primary: true });
      this.button('RANKING' + this.kb('R'), cx + 130, this.h - 40, 230, 40, 'ranking');
    }

    // Global high-scores screen with tabs: overall + one per stage.
    drawRanking() {
      const cx = this.w / 2;
      const tabs = this.rankingTabs();
      const oy = this.oy;
      this.text('RANKING', cx, 48 + oy, 36, '#FFD400');

      // Tab strip (centered); the active tab is highlighted. Tabs shrink to fit
      // the width when more stages are added.
      const gap = 10;
      const tabW = Math.min(this.phone ? 140 : 128, Math.floor((this.w - 40 - gap * (tabs.length - 1)) / tabs.length));
      const totalW = tabs.length * tabW + (tabs.length - 1) * gap;
      let tx = cx - totalW / 2 + tabW / 2;
      tabs.forEach((t, i) => {
        this.button(t.label, tx, 94 + oy, tabW, 34, 'tab',
          { primary: i === this.rankingTab, size: 15, payload: i, fixedW: true });
        tx += tabW + gap;
      });

      const cur = tabs[this.rankingTab];
      const sub = cur.stageId ? cur.stage.name : 'quem bateu o ponto até o fim';
      this.text(sub + (this.touchMode ? '' : '   (← → troca a aba)'), cx, 130 + oy, 13, '#888');

      this.drawScoreTable(160 + oy, this.phone ? this.h - 80 : undefined);
      this.button('VOLTAR' + this.kb('ESC'), cx, this.h - 40, 260, 40, 'back', { primary: true });
    }

    // Name prompt (the text field itself is the DOM overlay in the middle).
    drawName() {
      const cx = this.w / 2;
      this.text('QUEM ESTÁ JOGANDO?', cx, 110, 34, '#fff');
      this.text('seu nome vai para o ranking de cada fase que você concluir', cx, 150, 14, '#aaa');
      this.button('VOLTAR' + this.kb('ESC'), cx, this.h - 40, 220, 38, 'back');
    }

    // Stage cleared: this stage's result + the leaderboard of this stage only.
    drawStageClear(stage) {
      const cx = this.w / 2;
      const oy = this.oy;
      this.text(`FASE ${this.stageIdx + 1} CONCLUÍDA`, cx, 54 + oy, 38, '#FFD400');
      this.text(stage.name, cx, 92 + oy, 18, '#fff');
      this.text(`${this.playerName}  ·  PONTOS ${String(this.clearStageScore).padStart(6, '0')}  ·  TEMPO ${this.fmtTime(this.clearStageTime)}`,
        cx, 124 + oy, 15, '#ddd');
      this.text('RANKING DA FASE', cx, 158 + oy, 16, '#FFD400');
      this.drawScoreTable(186 + oy, this.phone ? this.h - 110 : undefined);
      if (this.boardOffline) this.text('offline — salvo localmente', cx, this.h - 92, 12, '#d99');
      const last = this.stageIdx >= ns.stages.length - 1;
      this.button((last ? 'FINALIZAR' : 'CONTINUAR') + this.kb('SPACE'), cx, this.h - 40, 280, 44, 'confirm',
        { primary: true, size: 20 });
    }

    // Shared high-scores table; `top` is the header baseline. Handles the
    // loading and empty states too.
    // `bottom`: rows stop before this y (defaults to h - 70).
    drawScoreTable(top, bottom) {
      const cx = this.w / 2;
      bottom = bottom || this.h - 70;
      if (this.boardLoading) { this.text('carregando…', cx, top + 30, 16, '#aaa'); return; }
      const list = this.scores || [];
      if (!list.length) { this.text('(sem pontuações ainda)', cx, top + 30, 15, '#888'); return; }
      const DEVICE = { web: 'WEB', mobile: 'MOB' };

      // Column x positions: # NOME NAVE DISP TEMPO SCORE (SCORE right-aligned).
      // Desktop keeps its fixed layout; phones derive a compact one from the
      // (enlarged) character width so the bigger text still fits.
      let X;
      if (this.phone) {
        this.ctx.font = font(this.ts(15));
        const cw = this.ctx.measureText('0').width;
        const chars = [2, 16, 4, 3, 5, 6];
        const left = 14, right = this.w - 14;
        const gap = (right - left - chars.reduce((a, b) => a + b, 0) * cw) / (chars.length - 1);
        X = [];
        let x = left;
        for (const c of chars) { X.push(x); x += c * cw + gap; }
        X[5] = right;
      } else {
        X = [cx - 262, cx - 228, cx + 20, cx + 92, cx + 160, cx + 262];
      }
      const rowH = this.phone ? 30 : 24;

      this.text('#',     X[0], top, 12, '#777', 'left');
      this.text('NOME',  X[1], top, 12, '#777', 'left');
      this.text('NAVE',  X[2], top, 12, '#777', 'left');
      this.text('DISP',  X[3], top, 12, '#777', 'left');
      this.text('TEMPO', X[4], top, 12, '#777', 'left');
      this.text('SCORE', X[5], top, 12, '#777', 'right');
      let y = top + rowH;
      for (let i = 0; i < list.length && y < bottom; i++) {
        const e = list[i];
        const key = e.name + '|' + e.score + '|' + e.ship;
        const rowColor = (this.myEntryKey && key === this.myEntryKey) ? '#FFD400' : '#ddd';
        this.text(String(i + 1).padStart(2, ' '), X[0], y, 15, rowColor, 'left');
        this.text(e.name, X[1], y, 15, rowColor, 'left');
        this.text(e.ship || '-', X[2], y, 15, rowColor, 'left');
        this.text(DEVICE[e.device] || '—', X[3], y, 15, rowColor, 'left');
        this.text(this.fmtTime(e.total_time), X[4], y, 15, rowColor, 'left');
        this.text(String(e.score).padStart(6, '0'), X[5], y, 15, rowColor, 'right');
        y += rowH;
      }
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
      this.button('JOGAR' + this.kb('SPACE'), this.w / 2, this.h / 2 + 70 * this.S, 260, 48, 'confirm', { primary: true, size: 22 });
      this.button('RANKING' + this.kb('R'), this.w / 2, this.h / 2 + 128 * this.S, 260, 40, 'ranking');
      if (!this.touchMode) {
        this.text('arrows / WASD = move    Space = fire    P = pause', this.w / 2, this.h - 40, 13, '#666');
      }
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

      const oy = this.oy;
      this.text('SELECT YOUR SHIP', this.w / 2, 70 + oy, 40, '#fff');
      this.text(this.touchMode ? 'toque numa nave para escolher' : '← →  escolher    Space / Enter  confirmar',
        this.w / 2, 110 + oy, 15, '#888');

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
        const cardY = 150 + oy;
        const cardH = 300;
        ctx.fillStyle = selected ? 'rgba(255,212,0,0.10)' : 'rgba(255,255,255,0.04)';
        ctx.fillRect(cardX, cardY, cardW, cardH);
        ctx.strokeStyle = selected ? '#FFD400' : 'rgba(255,255,255,0.15)';
        ctx.lineWidth = selected ? 3 : 1;
        ctx.strokeRect(cardX, cardY, cardW, cardH);
        ns.ui.add({ x: cardX, y: cardY, w: cardW, h: cardH }, 'pick', i);

        // Ship sprite, centered near the top of the card.
        const spr = this.shipPreviews[id];
        ctx.drawImage(spr, cx - spr.width / 2, cardY + 40 - spr.height / 2);

        this.text(def.name, cx, cardY + 110, 30, selected ? '#FFD400' : '#fff');
        this.text(def.desc, cx, cardY + 140, this.fitSize(def.desc, this.ts(13), cardW - 12), '#aaa', 'center', true);

        // Stat bars.
        this.drawStatBar('SPEED', cardX + 20, cardY + 175, cardW - 40, bars[id].speed);
        this.drawStatBar('FIRE',  cardX + 20, cardY + 215, cardW - 40, bars[id].fireRate);
      }

      this.button('LANÇAR' + this.kb('SPACE'), this.w / 2, 530 + oy, 280, 50, 'confirm', { primary: true, size: 22 });
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
        const by = 64 + this.oy - (1 - appear) * 40 + Math.sin(t * 2) * 6;
        ctx.save();
        ctx.globalAlpha = appear;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(boss, cx - bw / 2, by, bw, bh);
        ctx.restore();
      }

      // Level badge + stage name + accent divider.
      const oy = this.oy;
      this.text(`NÍVEL ${this.stageIdx + 1}`, cx, 300 + oy, 18, accent);
      this.text(stage.name, cx, 332 + oy, this.fitSize(stage.name, 34, this.w - 40), '#fff', 'center', true);
      ctx.fillStyle = accent;
      ctx.fillRect(cx - 120, 350 + oy, 240, 2);

      // Narrative text with typewriter reveal + blinking cursor while typing.
      const text = stage.story || '';
      const shown = Math.min(text.length, Math.floor(t * STORY_CPS));
      const full = shown >= text.length;
      const lines = this.wrapLines(text.slice(0, shown), this.w - (this.phone ? 50 : 160), 19);
      const cursor = (!full && (Math.floor(performance.now() / 250) % 2 === 0)) ? '▌' : '';
      if (cursor) {
        if (lines.length) lines[lines.length - 1] += cursor;
        else lines.push(cursor);
      }
      let ty = 386 + oy;
      for (const ln of lines) { this.text(ln, cx, ty, 19, '#eaeaea'); ty += this.phone ? 36 : 28; }

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
        this.text(this.touchMode ? 'toque para continuar  ▸' : 'press any key  ▸', cx, this.h - 24, 15, accent);
      }
    }

    // Greedy word-wrap. `size` is the nominal size passed to text() (phone
    // enlargement is applied here too, so measuring matches drawing).
    wrapLines(str, maxWidth, size) {
      const ctx = this.ctx;
      ctx.font = font(this.ts(size));
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
      this.text(stage.name, this.w / 2, this.h / 2 - 18, this.fitSize(stage.name, 48, this.w - 40), '#fff', 'center', true);
      this.text(stage.subtitle, this.w / 2, this.h / 2 + 26, 15, '#bbb');
    }

    drawHUD() {
      const ctx = this.ctx;
      const barH = this.phone ? 40 : 32;
      const ty = barH / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, this.w, barH);
      this.text(`SCORE ${String(this.score).padStart(5, '0')}`, 16, ty, 16, '#fff', 'left');
      this.text(`STAGE ${this.stageIdx + 1}/${ns.stages.length}`, this.w / 2, ty, 16, '#fff');
      const lives = '♥'.repeat(Math.max(0, this.lives)) +
                    '·'.repeat(Math.max(0, 3 - this.lives));
      if (!this.touchMode) {
        this.text(`LIVES ${lives}`, this.w - 16, ty, 16, '#fff', 'right');
        return;
      }
      // Touch: pause button in the corner (no P key on a phone). Its tap area is
      // larger than the drawn button so it's easy to hit with a thumb.
      this.text(lives, this.w - 72, ty, 16, '#fff', 'right');
      const bx = this.w - 40, by = ty;
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(bx - 22, by - 13, 44, 26);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx - 21, by - 12, 42, 24);
      ctx.fillStyle = '#fff';
      ctx.fillRect(bx - 7, by - 7, 4, 14);
      ctx.fillRect(bx + 3, by - 7, 4, 14);
      if (this.state === STATES.PLAY) ns.ui.add({ x: this.w - 80, y: 0, w: 80, h: 60 }, 'pause');
    }

    // Canvas button: draws it and registers its rect for mouse/touch hit-testing.
    // On phones it is enlarged (PHONE_UI) unless `fixedW` (e.g. ranking tabs).
    button(label, cx, cy, w, h, action, opts) {
      opts = opts || {};
      const ctx = this.ctx;
      if (this.phone) {
        if (!opts.fixedW) w = Math.min(this.w - 40, Math.round(w * this.S));
        h = Math.round(h * this.S);
      }
      const x = Math.round(cx - w / 2);
      const y = Math.round(cy - h / 2);
      const primary = !!opts.primary;
      ctx.fillStyle = primary ? 'rgba(255,212,0,0.16)' : 'rgba(255,255,255,0.06)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = primary ? '#FFD400' : 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      this.text(label, cx, cy + 1, opts.size || 18, primary ? '#FFD400' : '#ddd');
      ns.ui.add({ x, y, w, h }, action, opts.payload);
    }

    // Key hint suffix shown only when the player is using the keyboard.
    kb(key) {
      return ns.input.mode === 'keyboard' ? `  [${key}]` : '';
    }

    get touchMode() { return ns.input.mode === 'touch'; }

    // Extra vertical offset that re-centers 600px-tall layouts on a taller
    // (portrait) canvas. 0 on desktop, so desktop layouts are unchanged.
    get oy() { return Math.max(0, (this.h - 600) / 2); }

    // Effective font size for a nominal size: small text grows on phones.
    ts(size) { return this.phone && size < 22 ? Math.round(size * PHONE_TEXT) : size; }

    // Largest font size <= `size` at which `str` fits in `maxW`. Returns an
    // *effective* size — draw it with text(..., exact = true).
    fitSize(str, size, maxW) {
      this.ctx.font = font(size);
      const w = this.ctx.measureText(str).width;
      return w > maxW ? Math.floor(size * maxW / w) : size;
    }

    // Draw text. `size` is nominal (enlarged on phones) unless `exact`.
    // Centered text never runs off the canvas: it shrinks to fit the width.
    text(str, x, y, size, color, align, exact) {
      const ctx = this.ctx;
      align = align || 'center';
      let s = exact ? size : this.ts(size);
      ctx.font = font(s);
      if (align === 'center') {
        const maxW = this.w - 24;
        const w = ctx.measureText(str).width;
        if (w > maxW) { s = Math.floor(s * maxW / w); ctx.font = font(s); }
      }
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.textBaseline = 'middle';
      ctx.fillText(str, x, y);
    }

    // Short vibration on phones that support it (Android; iOS browsers don't).
    buzz(pattern) {
      if (this.phone && navigator.vibrate) {
        try { navigator.vibrate(pattern); } catch (e) { /* ignore */ }
      }
    }
  }

  ns.Game = Game;
  ns.STATES = STATES;
})();
