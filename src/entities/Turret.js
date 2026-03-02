import { playLaserFire, playMissileFire, playMissileExplosion } from '../audio/SoundManager.js';

/** Shortest distance from point (px,py) to line segment (x1,y1)-(x2,y2). */
function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
}

export const TURRET_DEFS = {
  laser: {
    color: 0x00ffcc,
    range: 360,
    damage: 10,
    fireRate: 800,   // ms between shots
    projectileSpeed: 400,
    projectileColor: 0x00ffff,
    projectileSize: 3,
  },
  missile: {
    color: 0xff6600,
    range: 320,
    damage: 50,
    fireRate: 3000,
    projectileSpeed: 160,
    projectileColor: 0xff8800,
    projectileSize: 6,
    splash: 60,
  },
  adminMissile: {
    color: 0xff00ff,
    range: 320,
    damage: 50,
    fireRate: 100,
    projectileSpeed: 160,
    projectileColor: 0xff00ff,
    projectileSize: 6,
    splash: 60,
  },
  forceField: {
    color: 0xaa00ff,
    range: 240,
    damage: 0,
    fireRate: 0,
    slowFactor: 0.4,   // enemies move at 40% speed inside field
  },
  plasmaGun: {
    color: 0x44ff88,
    range: 300,
    damage: 15,
    fireRate: 1800,
    projectileSpeed: 140,
    projectileColor: 0x66ff66,
    projectileSize: 5,
    burnDamage: 5,         // DOT damage per tick
    burnDuration: 3000,    // ms — pool linger time
    burnTickRate: 500,     // ms between DOT ticks
    burnRadius: 40,        // px — pool radius
  },
  plasmaRailgun: {
    color: 0xff44cc,
    range: 400,
    damage: 25,
    fireRate: 2000,
    projectileSpeed: 0,
    projectileColor: 0xff66ff,
    projectileSize: 0,
    pierceWidth: 20,       // px — how close to beam line to get hit
    burnDamage: 4,         // DOT damage per tick
    burnDuration: 3000,    // ms — trail linger time
    burnTickRate: 500,     // ms between DOT ticks
    burnWidth: 16,         // px — proximity to trail for DOT
  },
};

export const UPGRADE_DEFS = {
  laser:      [
    { label: 'Damage',   key: 'damage',    costs: [60, 120, 240], values: [15, 22, 32] },
    { label: 'Range',    key: 'range',     costs: [60, 120, 240], values: [440, 520, 620] },
    { label: 'Fire Rate',key: 'fireRate',  costs: [60, 120, 240], values: [550, 350, 200] },
  ],
  missile:    [
    { label: 'Damage',   key: 'damage',    costs: [80, 160, 320], values: [80, 120, 180] },
    { label: 'Range',    key: 'range',     costs: [80, 160, 320], values: [400, 500, 620] },
    { label: 'Splash',   key: 'splash',    costs: [80, 160, 320], values: [90, 130, 180] },
  ],
  forceField: [
    { label: 'Range',    key: 'range',     costs: [60, 120, 240], values: [310, 400, 500] },
    { label: 'Slow',     key: 'slowFactor',costs: [60, 120, 240], values: [0.28, 0.18, 0.1] },
    { label: 'Shield',   key: 'shieldHp',  costs: [60, 120, 240], values: [5, 8, 12] },
  ],
  plasmaGun: [
    { label: 'Damage',    key: 'damage',     costs: [60, 120, 240], values: [22, 30, 40] },
    { label: 'Burn DPS',  key: 'burnDamage', costs: [60, 120, 240], values: [8, 12, 18] },
    { label: 'Pool Size', key: 'burnRadius', costs: [60, 120, 240], values: [55, 70, 90] },
  ],
  plasmaRailgun: [
    { label: 'Damage',   key: 'damage',     costs: [100, 200, 400], values: [35, 50, 70] },
    { label: 'Burn DPS', key: 'burnDamage', costs: [100, 200, 400], values: [7, 12, 20] },
    { label: 'Range',    key: 'range',      costs: [100, 200, 400], values: [480, 560, 650] },
  ],
  adminMissile: [],
};

export default class Turret {
  constructor(scene, x, y, type) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.type = type;
    // Clone def so upgrades don't affect the global template
    this.def = { ...TURRET_DEFS[type] };
    this.fireTimer = 0;
    this.projectiles = [];
    this.hp = 6;  // 3 mothership hits or 6 baby ship hits to destroy

    // Upgrade levels — one per upgrade slot (0 = not upgraded)
    this.upgradeLevels = [0, 0, 0];

    // Force field shield HP — blocks incoming shots, destroyed after 3 hits
    this.shieldHp = type === 'forceField' ? 3 : 0;
    this.maxShieldHp = this.shieldHp;
    this.shieldCooldown = 0; // ms until next hit can be absorbed

    this.draw();
    this.hpBarBg = scene.add.graphics();
    this.hpBar = scene.add.graphics();
    this.drawHpBar();

    if (type === 'forceField') {
      this.drawForceField();
    }
  }

  applyUpgrade(slotIndex) {
    const upgrades = UPGRADE_DEFS[this.type];
    if (!upgrades) return;
    const slot = upgrades[slotIndex];
    const nextLevel = this.upgradeLevels[slotIndex] + 1;
    if (nextLevel > slot.values.length) return;
    this.upgradeLevels[slotIndex] = nextLevel;
    this.def[slot.key] = slot.values[nextLevel - 1];
    // For forceField shield upgrades, also update live shieldHp/maxShieldHp
    if (slot.key === 'shieldHp') {
      this.shieldHp = this.def.shieldHp;
      this.maxShieldHp = this.def.shieldHp;
      this.drawForceField();
    }
    // Redraw range circle if range changed
    if (slot.key === 'range') {
      this.rangeCircle.clear();
      this.rangeCircle.lineStyle(1, this.def.color, 0.15);
      this.rangeCircle.strokeCircle(this.x, this.y, this.def.range);
      if (this.type === 'forceField') this.drawForceField();
    }
  }

  draw() {
    const { color, range } = this.def;
    this.graphic = this.scene.add.graphics();

    // Range circle (faint)
    this.rangeCircle = this.scene.add.graphics();
    this.rangeCircle.lineStyle(1, color, 0.15);
    this.rangeCircle.strokeCircle(this.x, this.y, range);

    if (this.type === 'laser') {
      // Draw in local coords (0,0) inside a container so we can rotate it
      this.graphic.fillStyle(color, 1);
      this.graphic.fillRect(-10, -10, 20, 20);
      this.graphic.fillStyle(0x004444, 1);
      this.graphic.fillRect(-6, -6, 12, 12);
      // Barrel points up (negative Y) — rotation will aim it at targets
      this.graphic.fillStyle(color, 1);
      this.graphic.fillRect(-2, -18, 4, 10);

      // Wrap in a container so rotation works around the turret centre
      this.container = this.scene.add.container(this.x, this.y, [this.graphic]);

    } else if (this.type === 'missile') {
      // Missile turret — hexagon shape
      this.graphic.fillStyle(color, 1);
      this.graphic.fillCircle(this.x, this.y, 13);
      this.graphic.fillStyle(0x331a00, 1);
      this.graphic.fillCircle(this.x, this.y, 8);
      // Two missile pods
      this.graphic.fillStyle(color, 1);
      this.graphic.fillRect(this.x - 14, this.y - 4, 6, 8);
      this.graphic.fillRect(this.x + 8, this.y - 4, 6, 8);

    } else if (this.type === 'forceField') {
      // Force field emitter — diamond shape
      this.graphic.fillStyle(color, 1);
      this.graphic.fillTriangle(this.x, this.y - 14, this.x + 10, this.y, this.x - 10, this.y);
      this.graphic.fillTriangle(this.x, this.y + 14, this.x + 10, this.y, this.x - 10, this.y);

    } else if (this.type === 'plasmaGun') {
      // Plasma gun — rounded green base with nozzle
      this.graphic.fillStyle(color, 1);
      this.graphic.fillCircle(this.x, this.y, 12);
      this.graphic.fillStyle(0x003311, 1);
      this.graphic.fillCircle(this.x, this.y, 7);
      // Nozzle
      this.graphic.fillStyle(0x66ff66, 1);
      this.graphic.fillRect(this.x - 3, this.y - 16, 6, 10);
      // Glow tip
      this.graphic.fillStyle(0xaaffaa, 0.7);
      this.graphic.fillCircle(this.x, this.y - 16, 4);

    } else if (this.type === 'plasmaRailgun') {
      // Railgun — circle base with long barrel, in a container for rotation
      this.graphic.fillStyle(color, 1);
      this.graphic.fillCircle(0, 0, 14);
      this.graphic.fillStyle(0x330022, 1);
      this.graphic.fillCircle(0, 0, 9);
      // Long barrel pointing up
      this.graphic.fillStyle(color, 1);
      this.graphic.fillRect(-3, -24, 6, 16);
      // Glowing tip
      this.graphic.fillStyle(0xffffff, 0.8);
      this.graphic.fillCircle(0, -24, 3);
      // Energy coils along barrel
      this.graphic.lineStyle(1, 0xff88ff, 0.6);
      this.graphic.strokeRect(-4, -20, 8, 4);
      this.graphic.strokeRect(-4, -14, 8, 4);

      this.container = this.scene.add.container(this.x, this.y, [this.graphic]);
    }
  }

  drawHpBar() {
    const barW = 24;
    const barH = 4;
    const barX = this.x - barW / 2;
    const barY = this.y + 18;

    this.hpBarBg.clear();
    this.hpBarBg.fillStyle(0x333333, 1);
    this.hpBarBg.fillRect(barX, barY, barW, barH);

    this.hpBar.clear();
    const pct = Math.max(this.hp / 4, 0);
    const color = pct > 0.5 ? 0x00ff00 : pct > 0.25 ? 0xffaa00 : 0xff0000;
    this.hpBar.fillStyle(color, 1);
    this.hpBar.fillRect(barX, barY, barW * pct, barH);
  }

  drawForceField() {
    const { color, range } = this.def;
    if (this.fieldGraphic) this.fieldGraphic.destroy();
    this.fieldGraphic = this.scene.add.graphics();
    const strength = this.shieldHp / this.maxShieldHp; // 1.0 → 0.33
    this.fieldGraphic.lineStyle(2, color, 0.5 * strength);
    this.fieldGraphic.fillStyle(color, 0.07 * strength);
    this.fieldGraphic.strokeCircle(this.x, this.y, range);
    this.fieldGraphic.fillCircle(this.x, this.y, range);

    // Pulse animation
    this.scene.tweens.add({
      targets: this.fieldGraphic,
      alpha: { from: 0.6 * strength, to: 0.2 * strength },
      duration: 1200,
      yoyo: true,
      repeat: -1,
    });
  }

  damageShield() {
    if (this.shieldHp <= 0 || this.destroyed) return;
    if (this.shieldCooldown > 0) return; // still absorbing last hit
    this.shieldCooldown = 500; // 500ms before next hit registers
    this.shieldHp--;

    // Flash white on the shield bubble
    const { color, range } = this.def;
    const flash = this.scene.add.graphics();
    flash.lineStyle(4, 0xffffff, 1);
    flash.strokeCircle(this.x, this.y, range);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 200,
      onComplete: () => flash.destroy(),
    });

    if (this.shieldHp <= 0) {
      // Shield is gone — destroy the whole turret
      this.scene.events.emit('forceFieldDestroyed', this);
    } else {
      // Redraw dimmer to show degradation
      this.drawForceField();
    }
  }

  update(delta, enemies) {
    if (this.type === 'forceField') {
      if (this.shieldCooldown > 0) this.shieldCooldown -= delta;
      this.applySlowField(enemies);
      return;
    }

    this.fireTimer += delta;

    // Update burn trails even while waiting to fire
    if (this.burnTrails && this.burnTrails.length > 0) {
      this.updateBurnTrails(delta, enemies);
    }

    if (this.fireTimer < this.def.fireRate) return;

    // Find nearest enemy in range
    const target = this.getNearestEnemy(enemies);
    if (!target) return;

    this.fireTimer = 0;
    this.fireAt(target, enemies);
  }

  applySlowField(enemies) {
    const { range, slowFactor } = this.def;
    for (const enemy of enemies) {
      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      enemy.slowMultiplier = dist <= range ? slowFactor : 1;
    }
  }

  updateBurnTrails(delta, enemies) {
    for (let i = this.burnTrails.length - 1; i >= 0; i--) {
      const trail = this.burnTrails[i];
      trail.remainingMs -= delta;

      // Fade based on remaining time
      const pct = Math.max(trail.remainingMs / trail.totalMs, 0);
      trail.graphic.setAlpha(pct * 0.6);

      // Expired — remove
      if (trail.remainingMs <= 0) {
        trail.graphic.destroy();
        this.burnTrails.splice(i, 1);
        continue;
      }

      // DOT tick
      trail.tickTimer += delta;
      if (trail.tickTimer >= trail.burnTickRate) {
        trail.tickTimer = 0;
        for (const enemy of enemies) {
          if (enemy.dead || enemy.reachedBase) continue;
          let dist;
          if (trail.isPool) {
            // Circular pool — simple radius check
            const dx = enemy.x - trail.cx;
            const dy = enemy.y - trail.cy;
            dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= trail.burnRadius) {
              enemy.takeDamage(trail.burnDamage);
            }
          } else {
            // Line trail — point-to-segment distance
            dist = pointToSegmentDistance(
              enemy.x, enemy.y, trail.x1, trail.y1, trail.x2, trail.y2
            );
            if (dist <= trail.burnWidth) {
              enemy.takeDamage(trail.burnDamage);
            }
          }
        }
      }
    }
  }

  createBurnPool(x, y) {
    const { burnDamage, burnDuration, burnTickRate, burnRadius } = this.def;

    // Green splash visual
    const splashGfx = this.scene.add.graphics();
    splashGfx.fillStyle(0x44ff88, 0.3);
    splashGfx.fillCircle(x, y, burnRadius);
    splashGfx.lineStyle(2, 0x66ff66, 0.5);
    splashGfx.strokeCircle(x, y, burnRadius);
    this.scene.tweens.add({
      targets: splashGfx, alpha: 0, scaleX: 1.3, scaleY: 1.3, duration: 200,
      onComplete: () => splashGfx.destroy(),
    });

    // Lingering pool graphic
    const poolGfx = this.scene.add.graphics();
    poolGfx.fillStyle(0x33cc55, 0.4);
    poolGfx.fillCircle(x, y, burnRadius);
    poolGfx.fillStyle(0x66ff88, 0.2);
    poolGfx.fillCircle(x, y, burnRadius * 0.6);

    if (!this.burnTrails) this.burnTrails = [];
    this.burnTrails.push({
      graphic: poolGfx,
      isPool: true,
      cx: x, cy: y,
      burnRadius,
      remainingMs: burnDuration,
      totalMs: burnDuration,
      tickTimer: 0,
      burnDamage, burnTickRate,
    });
  }

  getNearestEnemy(enemies) {
    let nearest = null;
    let nearestDist = this.def.range;

    for (const enemy of enemies) {
      if (enemy.dead || enemy.reachedBase) continue;
      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= nearestDist) {
        nearestDist = dist;
        nearest = enemy;
      }
    }
    return nearest;
  }

  fireAt(target, enemies) {
    const { projectileColor, projectileSize, projectileSpeed, damage, splash } = this.def;

    const angle = Math.atan2(target.y - this.y, target.x - this.x);

    // Rotate laser turret to face the target (barrel points up = -π/2 offset)
    if (this.type === 'laser' && this.container) {
      this.container.setRotation(angle + Math.PI / 2);
    }

    if (this.type === 'plasmaGun') {
      // Plasma gun — travelling projectile that creates a burn pool on impact
      const proj = this.scene.add.graphics();
      proj.fillStyle(0x66ff66, 1);
      proj.fillCircle(0, 0, projectileSize);
      proj.fillStyle(0xaaffaa, 0.5);
      proj.fillCircle(0, 0, projectileSize + 2);
      proj.setPosition(this.x, this.y);

      const velX = Math.cos(angle) * projectileSpeed;
      const velY = Math.sin(angle) * projectileSpeed;

      this.projectiles.push({
        graphic: proj, x: this.x, y: this.y, velX, velY,
        target, damage, splash: 0, dead: false,
        isPlasma: true,
      });
      playLaserFire();
      return;
    }

    if (this.type === 'plasmaRailgun') {
      const { range, pierceWidth, burnDamage, burnDuration, burnTickRate, burnWidth } = this.def;

      // Rotate barrel to face target
      if (this.container) {
        this.container.setRotation(angle + Math.PI / 2);
      }

      // Beam endpoint — extend ray from turret through target to max range
      const beamEndX = this.x + Math.cos(angle) * range;
      const beamEndY = this.y + Math.sin(angle) * range;

      // Piercing — hit ALL enemies near the beam line
      for (const enemy of enemies) {
        if (enemy.dead || enemy.reachedBase) continue;
        const dist = pointToSegmentDistance(enemy.x, enemy.y, this.x, this.y, beamEndX, beamEndY);
        if (dist <= pierceWidth) {
          enemy.takeDamage(damage);
        }
      }

      // Beam visual — triple-layer pink/purple beam
      const beam = this.scene.add.graphics();
      beam.lineStyle(6, 0xff00ff, 0.5);
      beam.lineBetween(this.x, this.y, beamEndX, beamEndY);
      beam.lineStyle(3, 0xff66ff, 1);
      beam.lineBetween(this.x, this.y, beamEndX, beamEndY);
      beam.lineStyle(1, 0xffffff, 0.9);
      beam.lineBetween(this.x, this.y, beamEndX, beamEndY);
      this.scene.tweens.add({
        targets: beam, alpha: 0, duration: 200,
        onComplete: () => beam.destroy(),
      });

      // Muzzle flash
      const flash = this.scene.add.graphics();
      flash.fillStyle(0xff44cc, 0.9);
      flash.fillCircle(this.x, this.y, 12);
      this.scene.tweens.add({
        targets: flash, alpha: 0, scaleX: 1.5, scaleY: 1.5, duration: 150,
        onComplete: () => flash.destroy(),
      });

      // Create burn trail
      const trailGraphic = this.scene.add.graphics();
      trailGraphic.lineStyle(4, 0xff44cc, 0.6);
      trailGraphic.lineBetween(this.x, this.y, beamEndX, beamEndY);
      trailGraphic.lineStyle(2, 0xff88ff, 0.3);
      trailGraphic.lineBetween(this.x, this.y, beamEndX, beamEndY);

      if (!this.burnTrails) this.burnTrails = [];
      this.burnTrails.push({
        graphic: trailGraphic,
        x1: this.x, y1: this.y,
        x2: beamEndX, y2: beamEndY,
        remainingMs: burnDuration,
        totalMs: burnDuration,
        tickTimer: 0,
        burnDamage, burnTickRate, burnWidth,
      });

      playLaserFire();
      return;
    }

    if (this.type === 'laser') {
      // Instant hit — deal damage immediately
      target.takeDamage(damage);
      playLaserFire();

      // Beam flash from turret to target
      const beam = this.scene.add.graphics();
      beam.lineStyle(3, projectileColor, 1);
      beam.lineBetween(this.x, this.y, target.x, target.y);
      beam.lineStyle(1, 0xffffff, 0.8);
      beam.lineBetween(this.x, this.y, target.x, target.y);
      this.scene.tweens.add({
        targets: beam,
        alpha: 0,
        duration: 80,
        onComplete: () => beam.destroy(),
      });
      return;
    }

    // Missile — travelling projectile
    const proj = this.scene.add.graphics();
    proj.fillStyle(projectileColor, 1);
    proj.fillCircle(0, 0, projectileSize);
    proj.setPosition(this.x, this.y);

    const velX = Math.cos(angle) * projectileSpeed;
    const velY = Math.sin(angle) * projectileSpeed;

    const projectile = { graphic: proj, x: this.x, y: this.y, velX, velY, target, damage, splash, dead: false };
    this.projectiles.push(projectile);
    playMissileFire();
  }

  updateProjectiles(delta, enemies) {
    const dt = delta / 1000;

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (p.dead) {
        p.graphic.destroy();
        this.projectiles.splice(i, 1);
        continue;
      }

      // Missiles home in on target's current position
      if (p.splash && !p.target.dead && !p.target.reachedBase) {
        const tdx = p.target.x - p.x;
        const tdy = p.target.y - p.y;
        const tdist = Math.sqrt(tdx * tdx + tdy * tdy);
        if (tdist > 0) {
          const speed = Math.sqrt(p.velX * p.velX + p.velY * p.velY);
          p.velX = (tdx / tdist) * speed;
          p.velY = (tdy / tdist) * speed;
        }
      }

      p.x += p.velX * dt;
      p.y += p.velY * dt;
      p.graphic.setPosition(p.x, p.y);

      // Hit check — close enough to target
      const dx = p.x - p.target.x;
      const dy = p.y - p.target.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 12 || p.target.dead || p.target.reachedBase) {
        p.dead = true;
        if (!p.target.dead && !p.target.reachedBase) {
          if (p.isPlasma) {
            // Plasma gun — direct hit + burn pool
            p.target.takeDamage(p.damage);
            this.createBurnPool(p.x, p.y);
          } else if (p.splash) {
            // Splash damage
            for (const enemy of enemies) {
              const ex = enemy.x - p.x;
              const ey = enemy.y - p.y;
              if (Math.sqrt(ex * ex + ey * ey) <= p.splash) {
                enemy.takeDamage(p.damage);
              }
            }
            playMissileExplosion();
            this.drawExplosion(p.x, p.y);
          } else {
            p.target.takeDamage(p.damage);
          }
        } else if (p.isPlasma) {
          // Plasma pool even if target died mid-flight
          this.createBurnPool(p.x, p.y);
        }
      }

      // Off-screen cleanup
      if (p.x < -50 || p.x > 850 || p.y < -50 || p.y > 650) {
        p.dead = true;
      }
    }
  }

  drawExplosion(x, y) {
    const g = this.scene.add.graphics();
    g.fillStyle(0xff6600, 0.9);
    g.fillCircle(x, y, 30);
    g.fillStyle(0xffcc00, 0.7);
    g.fillCircle(x, y, 16);
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      scaleX: 1.8,
      scaleY: 1.8,
      duration: 300,
      onComplete: () => g.destroy(),
    });
  }

  destroy() {
    if (this.container) this.container.destroy();
    else this.graphic.destroy();
    this.rangeCircle.destroy();
    this.hpBarBg.destroy();
    this.hpBar.destroy();
    if (this.fieldGraphic) this.fieldGraphic.destroy();
    for (const p of this.projectiles) p.graphic.destroy();
    if (this.burnTrails) {
      for (const trail of this.burnTrails) trail.graphic.destroy();
      this.burnTrails = [];
    }
  }
}
