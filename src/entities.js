(function () {
  const ns = (window.AxisInvaders = window.AxisInvaders || {});

  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }

  class Player {
    constructor(canvasW, canvasH, bitmap) {
      this.bitmap = bitmap;
      this.w = bitmap.width;
      this.h = bitmap.height;
      this.canvasW = canvasW;
      this.x = (canvasW - this.w) / 2;
      this.y = canvasH - this.h - 24;
      this.speed = 300; // px/s
      this.cooldown = 0;
      this.cooldownMax = 0.28;
    }
    update(dt, input) {
      let dx = 0;
      if (input.isDown('ArrowLeft') || input.isDown('KeyA')) dx -= 1;
      if (input.isDown('ArrowRight') || input.isDown('KeyD')) dx += 1;
      this.x += dx * this.speed * dt;
      const margin = 8;
      if (this.x < margin) this.x = margin;
      if (this.x + this.w > this.canvasW - margin) this.x = this.canvasW - margin - this.w;
      this.cooldown -= dt;
    }
    canFire() { return this.cooldown <= 0; }
    fire() { this.cooldown = this.cooldownMax; }
    draw(ctx) { ctx.drawImage(this.bitmap, this.x, this.y); }
  }

  class Bullet {
    constructor(x, y, vy, owner, bitmap, vx = 0) {
      this.bitmap = bitmap;
      this.w = bitmap.width;
      this.h = bitmap.height;
      this.x = x - this.w / 2;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.owner = owner;
      this.alive = true;
    }
    update(dt, canvasH, canvasW) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.y < -this.h || this.y > canvasH) this.alive = false;
      if (canvasW != null && (this.x < -this.w || this.x > canvasW)) this.alive = false;
    }
    draw(ctx) { ctx.drawImage(this.bitmap, this.x, this.y); }
  }

  class Enemy {
    constructor(x, y, type, bitmap) {
      this.bitmap = bitmap;
      this.w = bitmap.width;
      this.h = bitmap.height;
      this.x = x;
      this.y = y;
      this.type = type;
      this.alive = true;
    }
    draw(ctx) { ctx.drawImage(this.bitmap, this.x, this.y); }
  }

  class EnemyGrid {
    constructor(stage, sprites, canvasW) {
      this.enemies = [];
      this.dir = 1; // 1 right, -1 left
      this.marchMs = stage.marchMs;
      this.fireMs = stage.fireMs;
      this.timer = 0;
      this.fireTimer = 0;
      this.canvasW = canvasW;

      const cols = stage.cols;
      const rows = stage.rows;
      const enemyW = sprites.enemies[0].width;
      const enemyH = sprites.enemies[0].height;
      const padX = 12;
      const padY = 14;
      const totalW = cols * enemyW + (cols - 1) * padX;
      const startX = Math.floor((canvasW - totalW) / 2);
      const startY = 60;

      for (let r = 0; r < rows; r++) {
        // type by row band: top rows = type 0, middle = 1, bottom = 2
        let typeIdx;
        if (r < Math.ceil(rows / 3)) typeIdx = 0;
        else if (r < Math.ceil((2 * rows) / 3)) typeIdx = 1;
        else typeIdx = 2;
        const bm = sprites.enemies[typeIdx];
        for (let c = 0; c < cols; c++) {
          const x = startX + c * (enemyW + padX);
          const y = startY + r * (enemyH + padY);
          this.enemies.push(new Enemy(x, y, typeIdx, bm));
        }
      }
      this.startCount = this.enemies.length;
    }

    aliveCount() {
      let n = 0;
      for (const e of this.enemies) if (e.alive) n++;
      return n;
    }

    update(dt) {
      const alive = this.aliveCount();
      const ratio = alive / this.startCount;
      // Acceleration: as enemies die, march speeds up.
      const interval = Math.max(80, this.marchMs * (0.25 + ratio * 0.75));
      this.timer += dt * 1000;
      if (this.timer >= interval) {
        this.timer = 0;
        this.step();
      }

      this.fireTimer += dt * 1000;
      const fireInterval = Math.max(180, this.fireMs * (0.4 + ratio * 0.6));
      if (this.fireTimer >= fireInterval) {
        this.fireTimer = 0;
        return this.pickShooter();
      }
      return null;
    }

    step() {
      const stepX = 8;
      let hitEdge = false;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const nx = e.x + this.dir * stepX;
        if (nx < 6 || nx + e.w > this.canvasW - 6) { hitEdge = true; break; }
      }
      if (hitEdge) {
        this.dir *= -1;
        for (const e of this.enemies) if (e.alive) e.y += 18;
      } else {
        for (const e of this.enemies) if (e.alive) e.x += this.dir * stepX;
      }
    }

    // Pick a random front-line shooter (lowest enemy in each column)
    pickShooter() {
      const cols = Object.create(null);
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const key = Math.round(e.x);
        if (!cols[key] || cols[key].y < e.y) cols[key] = e;
      }
      const front = Object.values(cols);
      if (!front.length) return null;
      const shooter = front[Math.floor(Math.random() * front.length)];
      return { x: shooter.x + shooter.w / 2, y: shooter.y + shooter.h };
    }

    bottomY() {
      let max = 0;
      for (const e of this.enemies) if (e.alive) max = Math.max(max, e.y + e.h);
      return max;
    }

    draw(ctx) {
      for (const e of this.enemies) if (e.alive) e.draw(ctx);
    }
  }

  class Particle {
    constructor(x, y, vx, vy, color, life, size) {
      this.x = x; this.y = y;
      this.vx = vx; this.vy = vy;
      this.color = color;
      this.life = life; this.maxLife = life;
      this.size = size;
    }
    update(dt) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vy += 90 * dt; // light gravity for explosion arcs
      this.life -= dt;
    }
    get alive() { return this.life > 0; }
    draw(ctx) {
      ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
      ctx.fillStyle = this.color;
      ctx.fillRect(this.x | 0, this.y | 0, this.size, this.size);
      ctx.globalAlpha = 1;
    }
  }

  function spawnExplosion(particles, x, y, palette) {
    const colors = palette.filter(c => !!c);
    for (let i = 0; i < 18; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 160;
      particles.push(new Particle(
        x, y,
        Math.cos(ang) * sp, Math.sin(ang) * sp - 30,
        colors[Math.floor(Math.random() * colors.length)],
        0.4 + Math.random() * 0.35,
        3
      ));
    }
  }

  function spawnBigExplosion(particles, x, y, palette) {
    const colors = palette.filter(c => !!c);
    for (let i = 0; i < 80; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 280;
      particles.push(new Particle(
        x, y,
        Math.cos(ang) * sp, Math.sin(ang) * sp - 60,
        colors[Math.floor(Math.random() * colors.length)],
        0.8 + Math.random() * 0.6,
        4
      ));
    }
  }

  // -- Boss ------------------------------------------------------------

  class Boss {
    constructor(cfg, canvasW) {
      this.bitmap = cfg.bitmap;
      this.w = this.bitmap.width;
      this.h = this.bitmap.height;
      this.canvasW = canvasW;
      this.x = (canvasW - this.w) / 2;
      this.y = 50;
      this.vx = cfg.vx;
      this.maxHp = cfg.hp;
      this.hp = cfg.hp;
      this.alive = true;
      this.behaviorKey = cfg.behaviorKey;
      this.cfg = cfg;
      this.fireTimer = (cfg.fireMs || 1400) / 1000;
      this.flashTimer = 0;
      this.beam = null;
      this.sirenT = 0;
      this.sirenLeft = true;
    }

    update(dt) {
      this.x += this.vx * dt;
      const margin = 10;
      if (this.x < margin) { this.x = margin; this.vx = Math.abs(this.vx); }
      if (this.x + this.w > this.canvasW - margin) {
        this.x = this.canvasW - margin - this.w;
        this.vx = -Math.abs(this.vx);
      }
      if (this.flashTimer > 0) this.flashTimer -= dt;
      const fn = bossBehaviors[this.behaviorKey];
      return fn ? fn(this, dt) : null;
    }

    hit() {
      this.hp -= 1;
      this.flashTimer = 0.1;
      if (this.hp <= 0) this.alive = false;
    }

    draw(ctx) {
      ctx.drawImage(this.bitmap, this.x | 0, this.y | 0);
      if (this.behaviorKey === 'police') drawPoliceSirens(ctx, this);
      if (this.flashTimer > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        const a = Math.min(1, this.flashTimer / 0.1) * 0.65;
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fillRect(this.x | 0, this.y | 0, this.w, this.h);
        ctx.restore();
      }
      drawHpBar(ctx, this);
    }

    drawBeam(ctx, canvasH) {
      if (!this.beam) return;
      const b = this.beam;
      const yTop = this.y + this.h;
      const beamH = canvasH - yTop;
      if (b.state === 'warning') {
        ctx.save();
        ctx.fillStyle = 'rgba(255,30,30,0.45)';
        ctx.fillRect(b.x - 1, yTop, 2, beamH);
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.04);
        ctx.fillStyle = `rgba(255,80,80,${0.18 * pulse})`;
        ctx.fillRect(b.x - 14, yTop, 28, beamH);
        ctx.restore();
      } else if (b.state === 'firing') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,30,30,0.55)';
        ctx.fillRect(b.x - 18, yTop, 36, beamH);
        ctx.fillStyle = 'rgba(255,140,90,0.7)';
        ctx.fillRect(b.x - 11, yTop, 22, beamH);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(b.x - 4, yTop, 8, beamH);
        ctx.restore();
      }
    }

    beamRect(canvasH) {
      if (!this.beam || this.beam.state !== 'firing') return null;
      const yTop = this.y + this.h;
      return { x: this.beam.x - 11, y: yTop, w: 22, h: canvasH - yTop };
    }
  }

  function drawHpBar(ctx, boss) {
    const w = boss.w;
    const x = boss.x | 0;
    const y = (boss.y | 0) - 12;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(x, y, w, 8);
    const ratio = Math.max(0, boss.hp / boss.maxHp);
    ctx.fillStyle = ratio > 0.4 ? '#3eff70' : (ratio > 0.2 ? '#ffd400' : '#ff3030');
    ctx.fillRect(x + 1, y + 1, Math.floor((w - 2) * ratio), 6);
  }

  function drawPoliceSirens(ctx, boss) {
    // Sirens sit on the housings drawn at the top of the police sprite
    // (rows ~2-6, columns ~1/4 and ~3/4 across the sprite).
    const yTop = boss.y + boss.h * 0.13;
    const r = Math.max(7, boss.w * 0.045);
    const leftX = boss.x + boss.w * 0.222;
    const rightX = boss.x + boss.w * 0.778;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (boss.sirenLeft) {
      ctx.fillStyle = 'rgba(255,40,40,0.55)';
      ctx.beginPath(); ctx.arc(leftX, yTop, r * 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff3030';
      ctx.beginPath(); ctx.arc(leftX, yTop, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#101040';
      ctx.beginPath(); ctx.arc(rightX, yTop, r * 0.8, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(60,80,255,0.55)';
      ctx.beginPath(); ctx.arc(rightX, yTop, r * 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3050ff';
      ctx.beginPath(); ctx.arc(rightX, yTop, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#400808';
      ctx.beginPath(); ctx.arc(leftX, yTop, r * 0.8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  const bossBehaviors = {
    cage(boss, dt) {
      boss.fireTimer -= dt;
      if (boss.fireTimer <= 0) {
        boss.fireTimer = (boss.cfg.fireMs || 1400) / 1000;
        return {
          kind: 'shot',
          x: boss.x + boss.w / 2,
          y: boss.y + boss.h * 0.7,
          vy: boss.cfg.bulletSpeed || 220,
          sprite: boss.cfg.bigBulletSprite
        };
      }
      return null;
    },

    r8(boss, dt) {
      if (!boss.beam) boss.beam = { state: 'idle', timer: 1.2, x: 0, damaged: false };
      const b = boss.beam;
      b.timer -= dt;
      if (b.timer <= 0) {
        if (b.state === 'idle') {
          b.state = 'warning';
          b.timer = (boss.cfg.beamWarnMs || 600) / 1000;
          b.x = boss.x + boss.w / 2;
        } else if (b.state === 'warning') {
          b.state = 'firing';
          b.timer = (boss.cfg.beamFireMs || 400) / 1000;
          b.damaged = false;
        } else if (b.state === 'firing') {
          b.state = 'cooldown';
          b.timer = (boss.cfg.beamCooldownMs || 1500) / 1000;
        } else if (b.state === 'cooldown') {
          b.state = 'idle';
          b.timer = 0.4;
        }
      }
      return null;
    },

    police(boss, dt) {
      boss.sirenT += dt;
      if (boss.sirenT >= 0.25) {
        boss.sirenT = 0;
        boss.sirenLeft = !boss.sirenLeft;
      }
      boss.fireTimer -= dt;
      if (boss.fireTimer <= 0) {
        boss.fireTimer = (boss.cfg.fireMs || 1000) / 1000;
        const fromLeft = boss.sirenLeft;
        const sx = boss.x + boss.w * (fromLeft ? 0.222 : 0.778);
        const sy = boss.y + boss.h - 6;
        return {
          kind: 'shot',
          x: sx,
          y: sy,
          vy: boss.cfg.bulletSpeed || 280,
          vx: fromLeft ? -70 : 70,
          sprite: fromLeft ? boss.cfg.redBulletSprite : boss.cfg.blueBulletSprite
        };
      }
      return null;
    }
  };

  ns.entities = {
    Player, Bullet, Enemy, EnemyGrid, Particle, Boss,
    aabb, spawnExplosion, spawnBigExplosion, bossBehaviors
  };
})();
