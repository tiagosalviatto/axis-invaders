(function () {
  const ns = (window.AxisInvaders = window.AxisInvaders || {});

  const STATES = { MENU: 'menu', INTRO: 'intro', PLAY: 'play', OVER: 'over', WIN: 'win' };

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
      this.bullets = [];
      this.particles = [];
      this.player = null;
      this.grid = null;
      this.boss = null;
      this.sprites = null;
      this.introTime = 0;
      this.flash = 0;
      this.paused = false;
      this.bgState = {};
    }

    startStage(idx) {
      this.stageIdx = idx;
      const stage = ns.stages[idx];
      this.sprites = ns.sprites.buildStageSprites(idx);
      this.player = new ns.entities.Player(this.w, this.h, this.sprites.player);
      this.grid = new ns.entities.EnemyGrid(stage, this.sprites, this.w);
      this.boss = null;
      this.bullets.length = 0;
      this.particles.length = 0;
      this.bgState = {};
      this.state = STATES.INTRO;
      this.introTime = 1.8;
      this.paused = false;
      ns.audio.playStageMotif(idx);
    }

    startGame() {
      this.score = 0;
      this.lives = 3;
      this.startStage(0);
    }

    update(dt) {
      const stage = ns.stages[this.stageIdx];

      if (this.state === STATES.MENU) {
        if (ns.input.consumePress('Enter')) {
          ns.audio.enable();
          this.startGame();
        }
        return;
      }

      if (this.state === STATES.OVER || this.state === STATES.WIN) {
        if (ns.input.consumePress('Enter')) this.state = STATES.MENU;
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

      this.player.update(dt, ns.input);

      if (ns.input.isDown('Space') && this.player.canFire()) {
        this.bullets.push(new ns.entities.Bullet(
          this.player.x + this.player.w / 2,
          this.player.y - 4,
          -540 * stage.bulletSpeedMul,
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

      // Boss update + attack events
      if (this.boss && this.boss.alive) {
        const ev = this.boss.update(dt);
        if (ev && ev.kind === 'shot') {
          this.bullets.push(new ns.entities.Bullet(
            ev.x, ev.y, ev.vy, 'enemy', ev.sprite, ev.vx || 0
          ));
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
          if (!hit && this.boss && this.boss.alive && ns.entities.aabb(b, this.boss)) {
            b.alive = false;
            this.boss.hit();
            this.score += 50;
            ns.entities.spawnExplosion(
              this.particles,
              b.x + b.w / 2, b.y,
              this.boss.cfg.behaviorKey === 'cage'  ? ['#FFD45A', '#C8102E', '#FFFFFF'] :
              this.boss.cfg.behaviorKey === 'r8'    ? ['#D8D8D8', '#FF1418', '#FFFFFF'] :
                                                     ['#3050FF', '#FF2030', '#FFFFFF']
            );
            ns.audio.playExplode();
            if (!this.boss.alive) {
              ns.entities.spawnBigExplosion(
                this.particles,
                this.boss.x + this.boss.w / 2,
                this.boss.y + this.boss.h / 2,
                ['#FFD400', '#FF3030', '#FFFFFF', '#FFA040']
              );
              this.score += 200;
              this.flash = 0.25;
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
          if (this.lives <= 0) this.state = STATES.OVER;
        }
      }

      // Beam vs player (R8 boss). Only one hit per firing window.
      if (this.boss && this.boss.alive) {
        const beamRect = this.boss.beamRect(this.h);
        if (beamRect && !this.boss.beam.damaged && ns.entities.aabb(beamRect, this.player)) {
          this.boss.beam.damaged = true;
          this.lives -= 1;
          this.flash = 0.45;
          ns.audio.playHit();
          ns.entities.spawnExplosion(
            this.particles,
            this.player.x + this.player.w / 2,
            this.player.y + this.player.h / 2,
            ['#FF1418', '#FFFFFF', '#FFA040']
          );
          if (this.lives <= 0) this.state = STATES.OVER;
        }
      }

      this.bullets = this.bullets.filter(b => b.alive);

      for (const p of this.particles) p.update(dt);
      this.particles = this.particles.filter(p => p.alive);

      // Lose if enemies cross player line
      if (this.grid.bottomY() >= this.player.y) this.state = STATES.OVER;

      // Stage progression: clear wave -> spawn boss -> kill boss -> next stage
      if (this.grid.aliveCount() === 0 && this.state === STATES.PLAY) {
        if (!this.boss) {
          const bossCfg = stage.boss;
          if (bossCfg) {
            this.boss = new ns.entities.Boss({
              ...bossCfg,
              bitmap: this.sprites.boss,
              bigBulletSprite: this.sprites.bigEnemyBullet,
              redBulletSprite: this.sprites.redBullet,
              blueBulletSprite: this.sprites.blueBullet
            }, this.w);
          } else if (this.stageIdx < ns.stages.length - 1) {
            this.startStage(this.stageIdx + 1);
          } else {
            this.state = STATES.WIN;
          }
        } else if (!this.boss.alive) {
          if (this.stageIdx < ns.stages.length - 1) {
            this.startStage(this.stageIdx + 1);
          } else {
            this.state = STATES.WIN;
          }
        }
      }

      if (this.flash > 0) this.flash -= dt;
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

      if (this.state === STATES.PLAY || this.state === STATES.INTRO) {
        this.player.draw(ctx);
        this.grid.draw(ctx);
        if (this.boss && this.boss.alive) {
          this.boss.draw(ctx);
          this.boss.drawBeam(ctx, this.h);
        }
        for (const b of this.bullets) b.draw(ctx);
        for (const p of this.particles) p.draw(ctx);
        this.drawHUD();
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
        this.text('GAME OVER', this.w / 2, this.h / 2 - 30, 56, '#FF3030');
        this.text(`Score: ${this.score}`, this.w / 2, this.h / 2 + 24, 22, '#fff');
        this.text('Press ENTER for menu', this.w / 2, this.h / 2 + 70, 16, '#aaa');
      }

      if (this.state === STATES.WIN) {
        this.text('YOU WIN!', this.w / 2, this.h / 2 - 36, 64, '#FFD400');
        this.text('All 3 stages cleared.', this.w / 2, this.h / 2 + 14, 18, '#fff');
        this.text(`Final Score: ${this.score}`, this.w / 2, this.h / 2 + 48, 22, '#fff');
        this.text('Press ENTER for menu', this.w / 2, this.h / 2 + 90, 16, '#aaa');
      }
    }

    drawMenu() {
      const ctx = this.ctx;
      this.text('AXIS INVADERS', this.w / 2, this.h / 2 - 90, 60, '#fff');
      this.text('a tiny invasion in three flavors', this.w / 2, this.h / 2 - 40, 16, '#888');
      this.text('Cage Rage  -  R8 Velocity  -  Samba Storm', this.w / 2, this.h / 2 + 0, 16, '#aaa');
      const blink = (Math.floor(performance.now() / 500) % 2) === 0;
      if (blink) this.text('PRESS ENTER', this.w / 2, this.h / 2 + 80, 26, '#FFD400');
      this.text('arrows / A D : move    Space : fire    P : pause', this.w / 2, this.h - 40, 13, '#666');
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
