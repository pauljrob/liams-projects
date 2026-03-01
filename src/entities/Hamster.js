// Hamster — rolls down the path from start to end, instantly killing any enemy it touches.
// One-time use, removed when it reaches the end of the path.

const HAMSTER_SPEED = 0.06;  // path progress per second (fast roll)
const HAMSTER_RADIUS = 22;   // kill radius

export default class Hamster {
  constructor(scene, path) {
    this.scene = scene;
    this.path = path;
    this.type = 'hamster';
    this.destroyed = false;

    this.t = 0.97; // start just inside the path end (near base, on-screen)
    const startPos = new Phaser.Math.Vector2();
    path.getPoint(this.t, startPos);
    this.x = startPos.x;
    this.y = startPos.y;

    this.draw();
    this.startWobble();
  }

  draw() {
    this.container = this.scene.add.container(this.x, this.y);

    // Shadow
    const shadow = this.scene.add.graphics();
    shadow.fillStyle(0x000000, 0.3);
    shadow.fillEllipse(4, 6, 36, 14);
    this.container.add(shadow);

    // Body — brown fuzzy circle
    const body = this.scene.add.graphics();
    body.fillStyle(0xc68642, 1);
    body.fillCircle(0, 0, HAMSTER_RADIUS);

    // Belly — lighter patch
    body.fillStyle(0xf5cba7, 1);
    body.fillEllipse(0, 4, 22, 18);

    // Eyes
    body.fillStyle(0x000000, 1);
    body.fillCircle(-7, -7, 4);
    body.fillCircle(7, -7, 4);

    // Eye shine
    body.fillStyle(0xffffff, 1);
    body.fillCircle(-5, -9, 2);
    body.fillCircle(9, -9, 2);

    // Nose
    body.fillStyle(0xff9999, 1);
    body.fillCircle(0, -2, 3);

    // Chubby cheeks
    body.fillStyle(0xe8a87c, 0.8);
    body.fillCircle(-14, -2, 8);
    body.fillCircle(14, -2, 8);

    // Tiny ears
    body.fillStyle(0xc68642, 1);
    body.fillCircle(-14, -17, 6);
    body.fillCircle(14, -17, 6);
    body.fillStyle(0xff9999, 1);
    body.fillCircle(-14, -17, 3);
    body.fillCircle(14, -17, 3);

    this.container.add(body);
    this.bodyGraphic = body;

    // Spinning wheel lines overlay (for roll effect)
    this.wheelGraphic = this.scene.add.graphics();
    this.drawWheelLines();
    this.container.add(this.wheelGraphic);

    // "HAMSTER!" label floating above
    this.label = this.scene.add.text(0, -36, '🐹', {
      fontSize: '20px',
    }).setOrigin(0.5);
    this.container.add(this.label);
  }

  drawWheelLines() {
    this.wheelGraphic.clear();
    this.wheelGraphic.lineStyle(2, 0x8B5E3C, 0.5);
    // 4 spoke lines that will rotate to simulate rolling
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      this.wheelGraphic.lineBetween(
        Math.cos(angle) * 4, Math.sin(angle) * 4,
        Math.cos(angle) * HAMSTER_RADIUS, Math.sin(angle) * HAMSTER_RADIUS,
      );
    }
  }

  startWobble() {
    // Squash and stretch bounce as it rolls
    this.scene.tweens.add({
      targets: this.container,
      scaleX: { from: 1.08, to: 0.93 },
      scaleY: { from: 0.93, to: 1.08 },
      duration: 120,
      yoyo: true,
      repeat: -1,
    });
  }

  update(delta, enemies) {
    if (this.destroyed) return true;

    // Advance along path in reverse
    this.t -= HAMSTER_SPEED * (delta / 1000);

    if (this.t <= 0) {
      // Reached the end — fly off with a little spin
      this.destroy();
      return true;
    }

    const pos = new Phaser.Math.Vector2();
    this.path.getPoint(this.t, pos);
    this.x = pos.x;
    this.y = pos.y;
    this.container.setPosition(this.x, this.y);

    // Spin the wheel lines
    this.wheelGraphic.setAngle(this.wheelGraphic.angle + 12);

    // Kill any enemy in radius
    for (const enemy of enemies) {
      if (enemy.dead || enemy.reachedBase) continue;
      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      if (Math.sqrt(dx * dx + dy * dy) <= HAMSTER_RADIUS + 10) {
        this.squashEnemy(enemy);
        enemy.takeDamage(99999); // instant kill
      }
    }

    return false;
  }

  squashEnemy(enemy) {
    // Burst of radiating lines
    const g = this.scene.add.graphics();
    g.lineStyle(3, 0xffff00, 1);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      g.lineBetween(
        enemy.x + Math.cos(angle) * 6,
        enemy.y + Math.sin(angle) * 6,
        enemy.x + Math.cos(angle) * 18,
        enemy.y + Math.sin(angle) * 18,
      );
    }
    g.fillStyle(0xff4400, 0.8);
    g.fillCircle(enemy.x, enemy.y, 8);
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      scaleX: 2,
      scaleY: 2,
      duration: 350,
      onComplete: () => g.destroy(),
    });

    // "SQUASH!" text pop
    const txt = this.scene.add.text(enemy.x, enemy.y - 20, 'SQUASH!', {
      fontSize: '13px',
      fill: '#ffff00',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(50);
    this.scene.tweens.add({
      targets: txt,
      y: enemy.y - 55,
      alpha: 0,
      duration: 600,
      onComplete: () => txt.destroy(),
    });
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;

    // Spin off screen
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      scaleX: 0.3,
      scaleY: 0.3,
      duration: 300,
      onComplete: () => this.container.destroy(),
    });
  }
}
