const BOMB_RADIUS = 80;   // trigger + splash radius
const BOMB_DAMAGE = 150;  // damage to each enemy caught in blast

export default class Bomb {
  constructor(scene, x, y) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.type = 'bomb';
    this.triggered = false;
    this.destroyed = false;

    this.draw();
  }

  draw() {
    this.graphic = this.scene.add.graphics();

    // Outer casing — dark red circle
    this.graphic.fillStyle(0x880000, 1);
    this.graphic.fillCircle(this.x, this.y, 12);

    // Inner glow — bright red core
    this.graphic.fillStyle(0xff2200, 1);
    this.graphic.fillCircle(this.x, this.y, 7);

    // Fuse spark (small yellow dot on top)
    this.graphic.fillStyle(0xffee00, 1);
    this.graphic.fillCircle(this.x, this.y - 13, 3);

    // Pulse animation on the fuse dot
    this.fuseGraphic = this.scene.add.graphics();
    this.fuseGraphic.fillStyle(0xffee00, 1);
    this.fuseGraphic.fillCircle(this.x, this.y - 13, 3);
    this.scene.tweens.add({
      targets: this.fuseGraphic,
      alpha: { from: 1, to: 0.1 },
      duration: 400,
      yoyo: true,
      repeat: -1,
    });

    // Faint trigger radius ring
    this.radiusRing = this.scene.add.graphics();
    this.radiusRing.lineStyle(1, 0xff4400, 0.2);
    this.radiusRing.strokeCircle(this.x, this.y, BOMB_RADIUS);
  }

  // Called each frame — returns true when the bomb has detonated and should be removed
  update(enemies) {
    if (this.triggered) return true;

    for (const enemy of enemies) {
      if (enemy.dead || enemy.reachedBase) continue;
      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      if (Math.sqrt(dx * dx + dy * dy) <= BOMB_RADIUS) {
        this.detonate(enemies);
        return true;
      }
    }

    return false;
  }

  detonate(enemies) {
    this.triggered = true;

    // Deal splash damage to all enemies in radius
    for (const enemy of enemies) {
      if (enemy.dead || enemy.reachedBase) continue;
      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      if (Math.sqrt(dx * dx + dy * dy) <= BOMB_RADIUS) {
        enemy.takeDamage(BOMB_DAMAGE);
      }
    }

    this.drawExplosion();
    this.destroy();
  }

  drawExplosion() {
    // Outer shockwave ring
    const ring = this.scene.add.graphics();
    ring.lineStyle(4, 0xff6600, 1);
    ring.strokeCircle(this.x, this.y, 10);
    this.scene.tweens.add({
      targets: ring,
      scaleX: BOMB_RADIUS / 10,
      scaleY: BOMB_RADIUS / 10,
      alpha: 0,
      duration: 400,
      onComplete: () => ring.destroy(),
    });

    // Big orange fireball
    const g = this.scene.add.graphics();
    g.fillStyle(0xff6600, 0.9);
    g.fillCircle(this.x, this.y, 40);
    g.fillStyle(0xffcc00, 0.8);
    g.fillCircle(this.x, this.y, 22);
    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(this.x, this.y, 10);
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      scaleX: 2.5,
      scaleY: 2.5,
      duration: 500,
      onComplete: () => g.destroy(),
    });
  }

  destroy() {
    this.graphic.destroy();
    this.fuseGraphic.destroy();
    this.radiusRing.destroy();
    this.destroyed = true;
  }
}
