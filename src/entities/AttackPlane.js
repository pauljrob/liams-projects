// Attack Plane — circles a fixed point, shoots enemies within range

const PATROL_RADIUS = 55;   // how wide its orbit is
const PATROL_SPEED = 1.8;   // radians per second
const FIRE_RANGE = 350;     // px — attack range from plane's current position
const FIRE_RATE = 1200;     // ms between shots
const DAMAGE = 18;
const PROJ_SPEED = 380;

export default class AttackPlane {
  constructor(scene, cx, cy) {
    this.scene = scene;
    this.cx = cx;   // centre of patrol orbit
    this.cy = cy;
    this.angle = 0; // current orbit angle (radians)
    this.fireTimer = 0;
    this.projectiles = [];
    this.destroyed = false;
    this.hp = 6;
    this.type = 'attackPlane';
    this.upgradeLevels = [0, 0, 0];

    // Current position (updated each frame)
    this.x = cx + PATROL_RADIUS;
    this.y = cy;

    this.drawOrbitCircle();
    this.drawPlane();
    this.hpBarBg = scene.add.graphics();
    this.hpBar = scene.add.graphics();
    this.drawHpBar();
  }

  drawOrbitCircle() {
    this.orbitGraphic = this.scene.add.graphics();
    this.orbitGraphic.lineStyle(1, 0x00aaff, 0.2);
    this.orbitGraphic.strokeCircle(this.cx, this.cy, PATROL_RADIUS);

    // Centre dot — shows where to click to upgrade
    this.orbitGraphic.fillStyle(0x00aaff, 0.5);
    this.orbitGraphic.fillCircle(this.cx, this.cy, 5);

    // Range ring
    this.rangeCircle = this.scene.add.graphics();
    this.rangeCircle.lineStyle(1, 0x00aaff, 0.12);
    this.rangeCircle.strokeCircle(this.cx, this.cy, FIRE_RANGE);
  }

  drawPlane() {
    this.graphic = this.scene.add.graphics();
    this.container = this.scene.add.container(this.x, this.y, [this.graphic]);
    this.container.setDepth(5);
    this.redrawPlaneGraphic();
  }

  redrawPlaneGraphic() {
    this.graphic.clear();
    // Body — blue-grey fuselage
    this.graphic.fillStyle(0x4488cc, 1);
    this.graphic.fillTriangle(0, -14, -5, 6, 5, 6);   // nose pointing up

    // Wings
    this.graphic.fillStyle(0x2266aa, 1);
    this.graphic.fillTriangle(-14, 2, -3, -4, -3, 8);
    this.graphic.fillTriangle(14, 2, 3, -4, 3, 8);

    // Tail fins
    this.graphic.fillStyle(0x2266aa, 1);
    this.graphic.fillTriangle(-6, 6, -10, 14, -2, 8);
    this.graphic.fillTriangle(6, 6, 10, 14, 2, 8);

    // Cockpit glint
    this.graphic.fillStyle(0xaaddff, 1);
    this.graphic.fillCircle(0, -6, 3);

    // Engine glow
    this.graphic.fillStyle(0xff8800, 0.8);
    this.graphic.fillCircle(0, 8, 3);
  }

  drawHpBar() {
    const barW = 24;
    const barH = 4;
    const barX = this.x - barW / 2;
    const barY = this.y + 20;
    this.hpBarBg.clear();
    this.hpBarBg.fillStyle(0x333333, 1);
    this.hpBarBg.fillRect(barX, barY, barW, barH);
    this.hpBar.clear();
    const pct = Math.max(this.hp / 4, 0);
    const color = pct > 0.5 ? 0x00ff00 : pct > 0.25 ? 0xffaa00 : 0xff0000;
    this.hpBar.fillStyle(color, 1);
    this.hpBar.fillRect(barX, barY, barW * pct, barH);
  }

  get range() { return FIRE_RANGE + (this.upgradeLevels[1] > 0 ? [40, 80, 130][this.upgradeLevels[1] - 1] : 0); }
  get damage() { return DAMAGE + (this.upgradeLevels[0] > 0 ? [12, 22, 35][this.upgradeLevels[0] - 1] : 0); }
  get fireRate() { return FIRE_RATE - (this.upgradeLevels[2] > 0 ? [300, 550, 750][this.upgradeLevels[2] - 1] : 0); }

  applyUpgrade(slotIndex) {
    const maxLevels = 3;
    if (this.upgradeLevels[slotIndex] >= maxLevels) return;
    this.upgradeLevels[slotIndex]++;
    // Redraw range ring if range upgraded
    if (slotIndex === 1) {
      this.rangeCircle.clear();
      this.rangeCircle.lineStyle(1, 0x00aaff, 0.12);
      this.rangeCircle.strokeCircle(this.cx, this.cy, this.range);
    }
  }

  update(delta, enemies) {
    if (this.destroyed) return;

    // Orbit around centre point
    this.angle += PATROL_SPEED * (delta / 1000);
    this.x = this.cx + Math.cos(this.angle) * PATROL_RADIUS;
    this.y = this.cy + Math.sin(this.angle) * PATROL_RADIUS;
    this.container.setPosition(this.x, this.y);

    // Rotate plane to face direction of travel (tangent to orbit)
    this.container.setRotation(this.angle + Math.PI / 2);

    // Update HP bar position
    this.drawHpBar();

    // Shooting
    this.fireTimer += delta;
    if (this.fireTimer >= this.fireRate) {
      const target = this.getNearestEnemy(enemies);
      if (target) {
        this.fireTimer = 0;
        this.fireAt(target);
      }
    }

    // Update projectiles
    this.updateProjectiles(delta, enemies);
  }

  getNearestEnemy(enemies) {
    let nearest = null;
    let nearestDist = this.range;
    for (const enemy of enemies) {
      if (enemy.dead || enemy.reachedBase) continue;
      // Measure from orbit centre so range ring matches actual behaviour
      const dx = enemy.x - this.cx;
      const dy = enemy.y - this.cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= nearestDist) {
        nearestDist = dist;
        nearest = enemy;
      }
    }
    return nearest;
  }

  fireAt(target) {
    const angle = Math.atan2(target.y - this.y, target.x - this.x);
    const proj = this.scene.add.graphics();
    proj.fillStyle(0x00ccff, 1);
    proj.fillCircle(0, 0, 3);
    proj.lineStyle(1, 0xffffff, 0.6);
    proj.strokeCircle(0, 0, 4);
    proj.setPosition(this.x, this.y);

    this.projectiles.push({
      graphic: proj,
      x: this.x,
      y: this.y,
      velX: Math.cos(angle) * PROJ_SPEED,
      velY: Math.sin(angle) * PROJ_SPEED,
      target,
      damage: this.damage,
      dead: false,
    });

    // Muzzle flash
    const flash = this.scene.add.graphics();
    flash.fillStyle(0xffffff, 0.9);
    flash.fillCircle(this.x, this.y, 5);
    this.scene.tweens.add({
      targets: flash, alpha: 0, duration: 80,
      onComplete: () => flash.destroy(),
    });
  }

  updateProjectiles(delta, enemies) {
    const dt = delta / 1000;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (p.dead) { p.graphic.destroy(); this.projectiles.splice(i, 1); continue; }

      // Home in on target
      if (!p.target.dead && !p.target.reachedBase) {
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

      const dx = p.x - p.target.x;
      const dy = p.y - p.target.y;
      if (Math.sqrt(dx * dx + dy * dy) < 12 || p.target.dead || p.target.reachedBase) {
        p.dead = true;
        if (!p.target.dead && !p.target.reachedBase) p.target.takeDamage(p.damage);
      }
      if (p.x < -50 || p.x > this.scene.scale.width + 50 || p.y < -50 || p.y > this.scene.scale.height + 50) p.dead = true;
    }
  }

  destroy() {
    this.destroyed = true;
    this.container.destroy();
    this.orbitGraphic.destroy();
    this.rangeCircle.destroy();
    this.hpBarBg.destroy();
    this.hpBar.destroy();
    for (const p of this.projectiles) p.graphic.destroy();
  }
}
