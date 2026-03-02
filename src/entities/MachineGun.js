import { playLaserFire } from '../audio/SoundManager.js';

const DEF = {
  color: 0xffdd00,
  range: 280,
  damage: 3,
  fireRate: 200,   // ms between shots — very fast
  projectileSpeed: 550,
  projectileColor: 0xffee44,
  projectileSize: 2,
};

export const UPGRADE_DEFS_MG = [
  { label: 'Damage',    key: 'damage',         costs: [60, 120, 240], values: [6, 10, 16] },
  { label: 'Range',     key: 'range',          costs: [60, 120, 240], values: [360, 440, 540] },
  { label: 'Fire Rate', key: 'fireRate',        costs: [60, 120, 240], values: [140, 90, 50] },
];

export default class MachineGun {
  constructor(scene, x, y) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    // Clone def so upgrades don't affect the global template
    this.def = { ...DEF };
    this.type = 'machineGun';
    this.fireTimer = 0;
    this.projectiles = [];
    this.hp = 6;
    this.destroyed = false;
    this.upgradeLevels = [0, 0, 0];

    this.draw();
    this.hpBarBg = scene.add.graphics();
    this.hpBar = scene.add.graphics();
    this.drawHpBar();
  }

  applyUpgrade(slotIndex) {
    const slot = UPGRADE_DEFS_MG[slotIndex];
    const nextLevel = this.upgradeLevels[slotIndex] + 1;
    if (nextLevel > slot.values.length) return;
    this.upgradeLevels[slotIndex] = nextLevel;
    this.def[slot.key] = slot.values[nextLevel - 1];
    if (slot.key === 'range') {
      this.rangeCircle.clear();
      this.rangeCircle.lineStyle(1, DEF.color, 0.15);
      this.rangeCircle.strokeCircle(this.x, this.y, this.def.range);
    }
  }

  draw() {
    const { color, range } = DEF;

    // Range circle
    this.rangeCircle = this.scene.add.graphics();
    this.rangeCircle.lineStyle(1, color, 0.15);
    this.rangeCircle.strokeCircle(this.x, this.y, range);

    // Body drawn in local coords so container rotation works
    this.graphic = this.scene.add.graphics();

    // Circular base
    this.graphic.fillStyle(color, 1);
    this.graphic.fillCircle(0, 0, 11);

    // Dark centre hub
    this.graphic.fillStyle(0x553300, 1);
    this.graphic.fillCircle(0, 0, 6);

    // Twin barrels pointing up (negative Y)
    this.graphic.fillStyle(color, 1);
    this.graphic.fillRect(-5, -18, 3, 12);
    this.graphic.fillRect(2, -18, 3, 12);

    this.container = this.scene.add.container(this.x, this.y, [this.graphic]);
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

  update(delta, enemies) {
    this.fireTimer += delta;
    if (this.fireTimer < this.def.fireRate) return;

    const target = this.getNearestEnemy(enemies);
    if (!target) return;

    this.fireTimer = 0;
    this.fireAt(target);
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

  fireAt(target) {
    const angle = Math.atan2(target.y - this.y, target.x - this.x);

    // Rotate twin barrels to face target
    this.container.setRotation(angle + Math.PI / 2);

    // Travelling bullet
    const proj = this.scene.add.graphics();
    proj.fillStyle(this.def.projectileColor, 1);
    proj.fillCircle(0, 0, this.def.projectileSize);
    proj.setPosition(this.x, this.y);

    this.projectiles.push({
      graphic: proj,
      x: this.x,
      y: this.y,
      velX: Math.cos(angle) * this.def.projectileSpeed,
      velY: Math.sin(angle) * this.def.projectileSpeed,
      target,
      damage: this.def.damage,
      dead: false,
    });

    playLaserFire();
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

      // Home in on target's current position each frame
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

      // Hit check
      const dx = p.x - p.target.x;
      const dy = p.y - p.target.y;
      if (Math.sqrt(dx * dx + dy * dy) < 12 || p.target.dead || p.target.reachedBase) {
        p.dead = true;
        if (!p.target.dead && !p.target.reachedBase) {
          p.target.takeDamage(p.damage);
        }
      }

      // Off-screen cleanup
      if (p.x < -50 || p.x > 850 || p.y < -50 || p.y > 650) {
        p.dead = true;
      }
    }
  }

  destroy() {
    this.container.destroy();
    this.rangeCircle.destroy();
    this.hpBarBg.destroy();
    this.hpBar.destroy();
    for (const p of this.projectiles) p.graphic.destroy();
  }
}
