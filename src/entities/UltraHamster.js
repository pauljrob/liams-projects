// Ultra Hamster — permanently patrols the entire track back and forth, instantly killing everything.
// One per game. Cannot be destroyed.

const ULTRA_SPEED = 0.3;   // very fast
const KILL_RADIUS = 80;    // large enough to hit any enemy including Ultimate Boss

export default class UltraHamster {
  constructor(scene, path) {
    this.scene = scene;
    this.path = path;
    this.type = 'ultraHamster';
    this.destroyed = false;

    this.t = 0.97;
    this.direction = -1; // -1 = toward start, +1 = toward end

    const startPos = new Phaser.Math.Vector2();
    path.getPoint(this.t, startPos);
    this.x = startPos.x;
    this.y = startPos.y;

    this.draw();
    this.startAnimations();
  }

  draw() {
    this.container = this.scene.add.container(this.x, this.y);
    this.container.setDepth(10);

    // Glowing aura ring
    this.aura = this.scene.add.graphics();
    this.aura.lineStyle(4, 0xff00ff, 0.6);
    this.aura.strokeCircle(0, 0, 36);
    this.aura.lineStyle(2, 0xffff00, 0.4);
    this.aura.strokeCircle(0, 0, 44);
    this.container.add(this.aura);

    // Crown on top
    const crown = this.scene.add.graphics();
    crown.fillStyle(0xffdd00, 1);
    crown.fillRect(-12, -46, 24, 10);
    crown.fillTriangle(-12, -46, -6, -56, 0, -46);
    crown.fillTriangle(0, -46, 6, -56, 12, -46);
    crown.fillTriangle(12, -46, 18, -58, 18, -46);
    crown.fillStyle(0xff0000, 1);
    crown.fillCircle(-6, -55, 3);
    crown.fillCircle(6, -55, 3);
    crown.fillCircle(18, -57, 3);
    this.container.add(crown);

    // Shadow
    const shadow = this.scene.add.graphics();
    shadow.fillStyle(0x000000, 0.4);
    shadow.fillEllipse(5, 8, 50, 18);
    this.container.add(shadow);

    // Big body — golden brown
    const body = this.scene.add.graphics();
    body.fillStyle(0xd4840a, 1);
    body.fillCircle(0, 0, 30);

    // Belly — lighter
    body.fillStyle(0xf5cba7, 1);
    body.fillEllipse(0, 6, 30, 24);

    // Eyes — big and fierce
    body.fillStyle(0xff0000, 1);
    body.fillCircle(-9, -9, 6);
    body.fillCircle(9, -9, 6);
    body.fillStyle(0x000000, 1);
    body.fillCircle(-9, -9, 4);
    body.fillCircle(9, -9, 4);
    // Angry pupils
    body.fillStyle(0xffffff, 1);
    body.fillCircle(-7, -11, 2);
    body.fillCircle(11, -11, 2);

    // Angry eyebrows
    body.lineStyle(3, 0x330000, 1);
    body.lineBetween(-14, -17, -5, -14);
    body.lineBetween(5, -14, 14, -17);

    // Nose
    body.fillStyle(0xff4444, 1);
    body.fillCircle(0, -2, 4);

    // Cheek pouches — extra chubby
    body.fillStyle(0xc68030, 0.9);
    body.fillCircle(-20, -2, 12);
    body.fillCircle(20, -2, 12);

    // Ears
    body.fillStyle(0xd4840a, 1);
    body.fillCircle(-20, -24, 9);
    body.fillCircle(20, -24, 9);
    body.fillStyle(0xff6666, 1);
    body.fillCircle(-20, -24, 5);
    body.fillCircle(20, -24, 5);

    // Tiny angry mouth
    body.lineStyle(2, 0x330000, 1);
    body.lineBetween(-6, 4, 6, 4);

    this.container.add(body);

    // Spinning wheel spokes
    this.wheelGraphic = this.scene.add.graphics();
    this.drawWheelSpokes();
    this.container.add(this.wheelGraphic);

    // "ULTRA" label
    const label = this.scene.add.text(0, -68, '👑 ULTRA 👑', {
      fontSize: '12px',
      fill: '#ffdd00',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.container.add(label);
  }

  drawWheelSpokes() {
    this.wheelGraphic.clear();
    this.wheelGraphic.lineStyle(3, 0xffaa00, 0.7);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      this.wheelGraphic.lineBetween(
        Math.cos(angle) * 5, Math.sin(angle) * 5,
        Math.cos(angle) * 28, Math.sin(angle) * 28,
      );
    }
  }

  startAnimations() {
    // Pulsing aura
    this.scene.tweens.add({
      targets: this.aura,
      alpha: { from: 0.4, to: 1 },
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    // Squash/stretch bounce
    this.scene.tweens.add({
      targets: this.container,
      scaleX: { from: 1.12, to: 0.9 },
      scaleY: { from: 0.9, to: 1.12 },
      duration: 100,
      yoyo: true,
      repeat: -1,
    });
  }

  update(delta, enemies) {
    if (this.destroyed) return false;

    this.t += this.direction * ULTRA_SPEED * (delta / 1000);

    // Bounce at ends
    if (this.t <= 0.03) {
      this.t = 0.03;
      this.direction = 1;
    } else if (this.t >= 0.97) {
      this.t = 0.97;
      this.direction = -1;
    }

    const pos = new Phaser.Math.Vector2();
    this.path.getPoint(this.t, pos);
    this.x = pos.x;
    this.y = pos.y;
    this.container.setPosition(this.x, this.y);

    // Spin spokes faster
    this.wheelGraphic.setAngle(this.wheelGraphic.angle + 18);

    // Instantly kill any enemy in range
    for (const enemy of enemies) {
      if (enemy.dead || enemy.reachedBase) continue;
      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      if (Math.sqrt(dx * dx + dy * dy) <= KILL_RADIUS) {
        this.squashEnemy(enemy);
        enemy.hp = 0;
        enemy.dead = true;
        enemy.spawnExplosion();
        enemy.destroy();
      }
    }

    return false; // never removes itself
  }

  squashEnemy(enemy) {
    const g = this.scene.add.graphics();
    // Golden burst
    g.lineStyle(3, 0xffdd00, 1);
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      g.lineBetween(
        enemy.x + Math.cos(angle) * 6,
        enemy.y + Math.sin(angle) * 6,
        enemy.x + Math.cos(angle) * 22,
        enemy.y + Math.sin(angle) * 22,
      );
    }
    g.fillStyle(0xff00ff, 0.9);
    g.fillCircle(enemy.x, enemy.y, 10);
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      scaleX: 2.5,
      scaleY: 2.5,
      duration: 400,
      onComplete: () => g.destroy(),
    });

    const txt = this.scene.add.text(enemy.x, enemy.y - 20, 'OBLITERATED!', {
      fontSize: '11px',
      fill: '#ffdd00',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(50);
    this.scene.tweens.add({
      targets: txt,
      y: enemy.y - 60,
      alpha: 0,
      duration: 700,
      onComplete: () => txt.destroy(),
    });
  }

  destroy() {
    // Ultra Hamster cannot be destroyed — this is a no-op
  }
}
