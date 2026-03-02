import { playEnemyFire, playEnemyExplosion, playMothershipExplosion } from '../audio/SoundManager.js';

export default class Enemy {
  constructor(scene, path, config) {
    this.scene = scene;
    this.path = path;
    this.hp = config.hp;
    this.maxHp = config.hp;
    this.speed = config.speed;   // 0–1 path progress per ms
    this.type = config.type;     // 'babyShip' | 'mothership'
    this.isBoss = config.isBoss ?? false;
    this.isUltimateBoss = config.isUltimateBoss ?? false;
    this.reward = config.reward;
    this.dead = false;
    this.reachedBase = false;
    this.slowMultiplier = 1;

    // Shield Bearer — absorbs hits before taking real damage
    this.shieldHits = config.shieldHits ?? 0;
    this.maxShieldHits = config.shieldHits ?? 0;
    this.shieldGraphic = null;

    // Carrier — releases baby ships when it drops to half HP (only once)
    this.hasReleased = false;

    // Splitter — spawns two mini ships on death
    this.isSplitter = config.isSplitter ?? false;
    this.isMiniSplitter = config.isMiniSplitter ?? false; // mini don't split again

    // EMP Frigate — fires EMP shots that disable turrets
    this.isEmp = config.isEmp ?? false;

    // Mothership firing state
    this.fireTimer = 0;
    this.fireRate = config.fireRate ?? 3000; // ms between shots
    this.fireRange = config.fireRange ?? 200; // px firing range
    this.shotProjectiles = [];

    // Path follower
    this.t = 0; // 0 = start, 1 = end
    this.pathVec = new Phaser.Math.Vector2();

    // Draw the ship graphic
    this.graphics = scene.add.graphics();
    this.drawShip();

    // Health bar
    this.hpBarBg = scene.add.graphics();
    this.hpBar = scene.add.graphics();

    // Mothership range indicator
    this.rangeGraphic = null; // mothership now targets entire map, no range circle needed

    // Get starting position
    this.path.getPoint(0, this.pathVec);
    this.x = this.pathVec.x;
    this.y = this.pathVec.y;

    this.updatePosition();

    // Boss vibrate effect
    if (this.isBoss) {
      this.shakeOffset = { x: 0, y: 0 };
      const amplitude = this.isUltimateBoss ? 5 : 3;
      this.scene.tweens.add({
        targets: this.shakeOffset,
        x: { from: -amplitude, to: amplitude },
        y: { from: -amplitude * 0.5, to: amplitude * 0.5 },
        duration: this.isUltimateBoss ? 60 : 80,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  drawShip() {
    this.graphics.clear();

    if (this.type === 'babyShip') {
      // Small triangle ship — green/teal alien
      this.graphics.fillStyle(0x00ff88, 1);
      this.graphics.fillTriangle(-10, 6, 10, 6, 0, -8);
      this.graphics.fillStyle(0xff4400, 1);
      this.graphics.fillCircle(0, 0, 3); // cockpit glow
    } else if (this.isUltimateBoss) {
      // Ultimate Boss — enormous, black/gold, truly terrifying
      // Outer ring
      this.graphics.lineStyle(5, 0xffdd00, 1);
      this.graphics.strokeCircle(0, 0, 68);
      // Dark core hull
      this.graphics.fillStyle(0x110022, 1);
      this.graphics.fillEllipse(0, 0, 130, 70);
      // Inner rings
      this.graphics.lineStyle(3, 0xff00ff, 0.8);
      this.graphics.strokeCircle(0, 0, 50);
      this.graphics.lineStyle(2, 0xffaa00, 0.6);
      this.graphics.strokeCircle(0, 0, 35);
      // Top dome
      this.graphics.fillStyle(0x330055, 1);
      this.graphics.fillEllipse(0, -18, 70, 34);
      // Massive wings
      this.graphics.fillStyle(0x220033, 1);
      this.graphics.fillTriangle(-65, 0, -90, 30, -25, 14);
      this.graphics.fillTriangle(65, 0, 90, 30, 25, 14);
      // Wing accents
      this.graphics.lineStyle(2, 0xff00ff, 0.7);
      this.graphics.lineBetween(-65, 0, -90, 30);
      this.graphics.lineBetween(65, 0, 90, 30);
      // Core glow — pulsing red-hot
      this.graphics.fillStyle(0x990000, 1);
      this.graphics.fillCircle(0, 0, 18);
      this.graphics.fillStyle(0xff0000, 1);
      this.graphics.fillCircle(0, 0, 12);
      this.graphics.fillStyle(0xffffff, 1);
      this.graphics.fillCircle(0, 0, 5);
      // Eye-like ports
      this.graphics.fillStyle(0xff0000, 1);
      this.graphics.fillCircle(-28, -8, 6);
      this.graphics.fillCircle(28, -8, 6);
      this.graphics.fillStyle(0xffff00, 1);
      this.graphics.fillCircle(-28, -8, 3);
      this.graphics.fillCircle(28, -8, 3);
    } else if (this.isBoss) {
      // Boss — massive, purple/dark red, unmistakably huge
      this.graphics.fillStyle(0x880000, 1);
      this.graphics.fillEllipse(0, 0, 100, 50);
      this.graphics.fillStyle(0xcc0044, 1);
      this.graphics.fillEllipse(0, -12, 60, 28);
      this.graphics.fillStyle(0xff0000, 1);
      this.graphics.fillEllipse(0, -18, 30, 16);
      // Side wings
      this.graphics.fillStyle(0x660022, 1);
      this.graphics.fillTriangle(-50, 0, -70, 20, -20, 10);
      this.graphics.fillTriangle(50, 0, 70, 20, 20, 10);
      // Centre core glow
      this.graphics.fillStyle(0xff4400, 1);
      this.graphics.fillCircle(0, 0, 10);
      this.graphics.fillStyle(0xffff00, 1);
      this.graphics.fillCircle(0, 0, 5);
    } else if (this.type === 'carrier') {
      // Carrier — wide flat ship, grey/blue, cargo bay visible
      this.graphics.fillStyle(0x445566, 1);
      this.graphics.fillEllipse(0, 0, 80, 30);
      this.graphics.fillStyle(0x334455, 1);
      this.graphics.fillRect(-22, -6, 44, 12); // cargo bay
      this.graphics.fillStyle(0x00ccff, 1);
      this.graphics.fillCircle(-16, 0, 4); // bay door left
      this.graphics.fillCircle(0, 0, 4);   // bay door centre
      this.graphics.fillCircle(16, 0, 4);  // bay door right
      this.graphics.lineStyle(1, 0x0088aa, 0.7);
      this.graphics.strokeEllipse(0, 0, 80, 30);
    } else if (this.type === 'shieldBearer') {
      // Shield Bearer — diamond-shaped, blue with visible shield ring
      this.graphics.fillStyle(0x0044cc, 1);
      this.graphics.fillTriangle(0, -18, -14, 0, 0, 18);
      this.graphics.fillTriangle(0, -18, 14, 0, 0, 18);
      this.graphics.fillStyle(0x3399ff, 1);
      this.graphics.fillCircle(0, 0, 6);
      // Shield ring drawn separately in drawShield()
    } else if (this.type === 'splitter') {
      // Splitter — orange/yellow angular ship
      this.graphics.fillStyle(0xff8800, 1);
      this.graphics.fillTriangle(-12, 8, 12, 8, 0, -12);
      this.graphics.fillStyle(0xffdd00, 1);
      this.graphics.fillTriangle(-6, 4, 6, 4, 0, -6);
      // Seam line showing it splits
      this.graphics.lineStyle(1, 0xff4400, 0.8);
      this.graphics.lineBetween(0, -12, 0, 8);
    } else if (this.type === 'miniSplitter') {
      // Mini splitter — smaller orange triangle
      this.graphics.fillStyle(0xff8800, 1);
      this.graphics.fillTriangle(-7, 5, 7, 5, 0, -7);
      this.graphics.fillStyle(0xffdd00, 1);
      this.graphics.fillCircle(0, 0, 2);
    } else if (this.type === 'empFrigate') {
      // EMP Frigate — sleek purple ship with electric accents
      this.graphics.fillStyle(0x440088, 1);
      this.graphics.fillEllipse(0, 0, 56, 22);
      this.graphics.fillStyle(0x8800ff, 1);
      this.graphics.fillEllipse(0, -6, 28, 12);
      // Electric fork prongs
      this.graphics.lineStyle(2, 0xaa44ff, 0.9);
      this.graphics.lineBetween(-24, 0, -32, -8);
      this.graphics.lineBetween(-24, 0, -32, 8);
      this.graphics.lineBetween(24, 0, 32, -8);
      this.graphics.lineBetween(24, 0, 32, 8);
      this.graphics.fillStyle(0xddaaff, 1);
      this.graphics.fillCircle(0, 0, 5);
    } else {
      // Mothership — large, menacing, red/orange
      this.graphics.fillStyle(0xff2200, 1);
      this.graphics.fillEllipse(0, 0, 60, 30);
      this.graphics.fillStyle(0xff6600, 1);
      this.graphics.fillEllipse(0, -8, 30, 16);
      this.graphics.fillStyle(0xffaa00, 1);
      this.graphics.fillCircle(0, 0, 6); // centre glow
    }

    // Draw shield ring on top for shield bearers
    if (this.type === 'shieldBearer' && this.shieldHits > 0) {
      this.drawShieldRing();
    }
  }

  drawShieldRing() {
    if (!this.shieldGraphic) {
      this.shieldGraphic = this.scene.add.graphics();
    }
    this.shieldGraphic.clear();
    if (this.shieldHits <= 0) return;
    const alpha = 0.3 + (this.shieldHits / this.maxShieldHits) * 0.5;
    this.shieldGraphic.lineStyle(3, 0x44aaff, alpha);
    this.shieldGraphic.strokeCircle(this.x, this.y, 22);
    this.shieldGraphic.fillStyle(0x0066ff, alpha * 0.3);
    this.shieldGraphic.fillCircle(this.x, this.y, 22);
  }

  update(delta, turrets, baseX, baseY) {
    if (this.dead || this.reachedBase) return;

    // Reset slow each frame (force fields reapply each update)
    this.slowMultiplier = 1;

    // Advance along path
    this.t += (this.speed * this.slowMultiplier * delta) / 1000;

    if (this.t >= 1) {
      this.reachedBase = true;
      this.destroy();
      return;
    }

    this.path.getPoint(this.t, this.pathVec);
    this.x = this.pathVec.x;
    this.y = this.pathVec.y;
    this.updatePosition();

    // Carrier — release baby ships at half HP
    if (this.type === 'carrier' && !this.hasReleased && this.hp <= this.maxHp * 0.5) {
      this.hasReleased = true;
      this.scene.events.emit('carrierRelease', this);
    }

    // Update shield ring position
    if (this.shieldGraphic) {
      this.drawShieldRing();
    }

    // Enemy firing
    this.fireTimer += delta;
    if (this.fireTimer >= this.fireRate) {
      this.fireTimer = 0;
      if (this.type === 'mothership') {
        this.fireAtTarget(turrets, baseX, baseY);
      } else if (this.isEmp) {
        this.fireEmpShot(turrets);
      } else {
        this.fireAtRandomTurret(turrets);
      }
    }
    this.updateShotProjectiles(delta, turrets);
  }

  fireAtTarget(turrets, baseX, baseY) {
    // Pick nearest turret within firing range only
    let target = null;
    let nearestDist = this.fireRange;

    for (const t of turrets) {
      if (t.destroyed) continue;
      const dx = t.x - this.x;
      const dy = t.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= nearestDist) {
        nearestDist = dist;
        target = { x: t.x, y: t.y, turret: t };
      }
    }

    // Only fire at base if it's also within range
    if (!target) {
      const dx = baseX - this.x;
      const dy = baseY - this.y;
      const distToBase = Math.sqrt(dx * dx + dy * dy);
      if (distToBase <= this.fireRange) {
        target = { x: baseX, y: baseY, isBase: true };
      }
    }

    // Nothing in range — don't fire
    if (!target) return;

    const angle = Math.atan2(target.y - this.y, target.x - this.x);
    const speed = 180;
    const proj = this.scene.add.graphics();

    if (this.isBoss) {
      // Boss shot — large, menacing purple/red orb
      proj.fillStyle(0x660099, 1);
      proj.fillCircle(0, 0, 12);
      proj.fillStyle(0xff00ff, 0.8);
      proj.fillCircle(0, 0, 7);
      proj.lineStyle(3, 0xff44ff, 0.9);
      proj.strokeCircle(0, 0, 14);
    } else {
      proj.fillStyle(0xff0000, 1);
      proj.fillCircle(0, 0, 5);
      // Outer glow ring
      proj.lineStyle(2, 0xff6600, 0.7);
      proj.strokeCircle(0, 0, 8);
    }
    proj.setPosition(this.x, this.y);

    this.shotProjectiles.push({
      graphic: proj,
      x: this.x,
      y: this.y,
      velX: Math.cos(angle) * speed,
      velY: Math.sin(angle) * speed,
      target,
      isBossShot: this.isBoss,
      dead: false,
    });
    playEnemyFire();

    // Muzzle flash on the mothership
    const flash = this.scene.add.graphics();
    flash.fillStyle(0xff4400, 0.9);
    flash.fillCircle(this.x, this.y, 14);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: 2,
      scaleY: 2,
      duration: 150,
      onComplete: () => flash.destroy(),
    });
  }

  fireAtRandomTurret(turrets) {
    // Collect live turrets
    const alive = turrets.filter(t => !t.destroyed);
    if (alive.length === 0) return;

    // Prefer turrets within firing range; fall back to nearest if none are in range
    const inRange = alive.filter(t => {
      const dx = t.x - this.x;
      const dy = t.y - this.y;
      return Math.sqrt(dx * dx + dy * dy) <= this.fireRange;
    });

    const pool = inRange.length > 0 ? inRange : alive;

    // Pick a random one from the pool
    const t = pool[Math.floor(Math.random() * pool.length)];
    const target = { x: t.x, y: t.y, turret: t, isBabyShot: true };

    const angle = Math.atan2(target.y - this.y, target.x - this.x);
    const speed = 220;
    const proj = this.scene.add.graphics();
    proj.fillStyle(0x00ff88, 1);   // teal-green — distinct from mothership red
    proj.fillCircle(0, 0, 3);
    proj.setPosition(this.x, this.y);

    this.shotProjectiles.push({
      graphic: proj,
      x: this.x,
      y: this.y,
      velX: Math.cos(angle) * speed,
      velY: Math.sin(angle) * speed,
      target,
      dead: false,
    });
    playEnemyFire();
  }

  fireEmpShot(turrets) {
    const alive = turrets.filter(t => !t.destroyed);
    if (alive.length === 0) return;
    const inRange = alive.filter(t => {
      const dx = t.x - this.x;
      const dy = t.y - this.y;
      return Math.sqrt(dx * dx + dy * dy) <= this.fireRange;
    });
    const pool = inRange.length > 0 ? inRange : alive;
    const t = pool[Math.floor(Math.random() * pool.length)];
    const target = { x: t.x, y: t.y, turret: t, isEmpShot: true };

    const angle = Math.atan2(target.y - this.y, target.x - this.x);
    const proj = this.scene.add.graphics();
    proj.fillStyle(0xaa44ff, 1);
    proj.fillCircle(0, 0, 5);
    proj.lineStyle(2, 0xddaaff, 0.8);
    proj.strokeCircle(0, 0, 8);
    proj.setPosition(this.x, this.y);

    this.shotProjectiles.push({
      graphic: proj,
      x: this.x, y: this.y,
      velX: Math.cos(angle) * 200,
      velY: Math.sin(angle) * 200,
      target,
      isEmpShot: true,
      dead: false,
    });
    playEnemyFire();
  }

  updateShotProjectiles(delta, turrets) {
    const dt = delta / 1000;

    for (let i = this.shotProjectiles.length - 1; i >= 0; i--) {
      const p = this.shotProjectiles[i];
      if (p.dead) {
        p.graphic.destroy();
        this.shotProjectiles.splice(i, 1);
        continue;
      }

      p.x += p.velX * dt;
      p.y += p.velY * dt;
      p.graphic.setPosition(p.x, p.y);

      // Check if shot is intercepted by a force field bubble
      let blocked = false;
      for (const t of turrets) {
        if (t.destroyed || t.type !== 'forceField' || t.shieldHp <= 0) continue;
        const fx = p.x - t.x;
        const fy = p.y - t.y;
        if (Math.sqrt(fx * fx + fy * fy) <= t.def.range) {
          p.dead = true;
          blocked = true;
          this.scene.events.emit('forceFieldBlocked', t);
          this.drawImpact(p.x, p.y);
          break;
        }
      }

      if (!blocked) {
        // Only check hit if the target is still alive
        const targetAlive = p.target.isBase
          || (p.target.turret && !p.target.turret.destroyed);
        if (targetAlive) {
          const dx = p.x - p.target.x;
          const dy = p.y - p.target.y;
          if (Math.sqrt(dx * dx + dy * dy) < 16) {
            p.dead = true;
            if (p.target.isBase) {
              this.scene.events.emit('mothershipHitBase');
            } else {
              if (p.isEmpShot) {
                this.scene.events.emit('empHitTurret', p.target.turret);
              } else if (p.target.isBabyShot) {
                this.scene.events.emit('babyShipHitTurret', p.target.turret);
              } else if (p.isBossShot) {
                this.scene.events.emit('bossHitTurret', p.target.turret);
              } else {
                this.scene.events.emit('mothershipHitTurret', p.target.turret);
              }
            }
            this.drawImpact(p.x, p.y);
          }
        }
        // If target is gone, shot keeps flying until it leaves the screen
      }

      // Off-screen cleanup
      if (p.x < -50 || p.x > this.scene.scale.width + 50 || p.y < -50 || p.y > this.scene.scale.height + 50) {
        p.dead = true;
      }
    }
  }

  drawImpact(x, y) {
    const g = this.scene.add.graphics();
    g.fillStyle(0xff2200, 0.9);
    g.fillCircle(x, y, 18);
    g.fillStyle(0xff8800, 0.7);
    g.fillCircle(x, y, 10);
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      scaleX: 1.6,
      scaleY: 1.6,
      duration: 250,
      onComplete: () => g.destroy(),
    });
  }

  updatePosition() {
    const sx = this.shakeOffset ? this.shakeOffset.x : 0;
    const sy = this.shakeOffset ? this.shakeOffset.y : 0;
    this.graphics.setPosition(this.x + sx, this.y + sy);
    if (this.rangeGraphic) this.rangeGraphic.setPosition(this.x, this.y);
    this.drawHealthBar();
  }

  drawHealthBar() {
    const barW = this.isUltimateBoss ? 140 : this.isBoss ? 100 : this.type === 'mothership' ? 60 : 24;
    const barH = this.isUltimateBoss ? 8 : this.isBoss ? 6 : 4;
    const barX = this.x - barW / 2;
    const barY = this.y - (this.isUltimateBoss ? 55 : this.isBoss ? 40 : this.type === 'mothership' ? 24 : 16);

    this.hpBarBg.clear();
    this.hpBarBg.fillStyle(0x333333, 1);
    this.hpBarBg.fillRect(barX, barY, barW, barH);

    this.hpBar.clear();
    const pct = Math.max(this.hp / this.maxHp, 0);
    const color = pct > 0.5 ? 0x00ff00 : pct > 0.25 ? 0xffaa00 : 0xff0000;
    this.hpBar.fillStyle(color, 1);
    this.hpBar.fillRect(barX, barY, barW * pct, barH);
  }

  takeDamage(amount) {
    // Shield absorbs hits
    if (this.shieldHits > 0) {
      this.shieldHits--;
      this.drawShieldRing();
      // Flash the shield
      const flash = this.scene.add.graphics();
      flash.fillStyle(0x44aaff, 0.6);
      flash.fillCircle(this.x, this.y, 26);
      this.scene.tweens.add({
        targets: flash, alpha: 0, duration: 200,
        onComplete: () => flash.destroy(),
      });
      return;
    }

    this.hp -= amount;
    if (this.hp <= 0) {
      this.dead = true;
      // Splitter spawns two minis on death
      if (this.isSplitter) {
        this.scene.events.emit('splitterDied', this);
      }
      this.spawnExplosion();
      this.destroy();
    }
  }

  spawnExplosion() {
    if (this.type === 'mothership') playMothershipExplosion();
    else playEnemyExplosion();

    const particles = this.scene.add.graphics();
    const color = this.type === 'mothership' ? 0xff6600 : 0x00ff88;
    const count = this.type === 'mothership' ? 16 : 8;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const dist = Phaser.Math.Between(5, this.type === 'mothership' ? 40 : 20);
      const px = this.x + Math.cos(angle) * dist;
      const py = this.y + Math.sin(angle) * dist;
      particles.fillStyle(color, 1);
      particles.fillCircle(px, py, Phaser.Math.Between(2, 5));
    }

    // Fade and destroy explosion
    this.scene.tweens.add({
      targets: particles,
      alpha: 0,
      duration: 400,
      onComplete: () => particles.destroy(),
    });
  }

  destroy() {
    this.graphics.destroy();
    this.hpBarBg.destroy();
    this.hpBar.destroy();
    if (this.rangeGraphic) this.rangeGraphic.destroy();
    if (this.shieldGraphic) { this.shieldGraphic.destroy(); this.shieldGraphic = null; }
    // Transfer in-flight shots to the scene so they keep moving after death
    for (const p of this.shotProjectiles) {
      this.scene.orphanedShots.push(p);
    }
    this.shotProjectiles = [];
  }
}
