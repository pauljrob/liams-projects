export default class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    // Star field background
    const starGfx = this.add.graphics();
    for (let i = 0; i < 180; i++) {
      const x = Phaser.Math.Between(0, W);
      const y = Phaser.Math.Between(0, H);
      const r = Math.random() < 0.15 ? 2 : 1;
      const alpha = 0.4 + Math.random() * 0.6;
      starGfx.fillStyle(0xffffff, alpha);
      starGfx.fillCircle(x, y, r);
    }

    // Nebula blobs
    const nebulaGfx = this.add.graphics();
    const nebulas = [
      { x: 130, y: 100, rx: 90, ry: 60, color: 0x220044, alpha: 0.35 },
      { x: 650, y: 480, rx: 110, ry: 70, color: 0x001133, alpha: 0.3 },
      { x: 400, y: 300, rx: 140, ry: 80, color: 0x110022, alpha: 0.2 },
    ];
    nebulas.forEach(n => {
      nebulaGfx.fillStyle(n.color, n.alpha);
      nebulaGfx.fillEllipse(n.x, n.y, n.rx * 2, n.ry * 2);
    });

    // Title
    this.add.text(W / 2, H * 0.22, 'SPACE', {
      fontSize: '64px',
      fill: '#00ccff',
      fontFamily: 'monospace',
      stroke: '#004466',
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(W / 2, H * 0.34, 'TOWER DEFENSE', {
      fontSize: '36px',
      fill: '#ffffff',
      fontFamily: 'monospace',
      stroke: '#003355',
      strokeThickness: 3,
    }).setOrigin(0.5);

    // Separator line
    const lineGfx = this.add.graphics();
    lineGfx.lineStyle(1, 0x0088aa, 0.6);
    lineGfx.lineBetween(W * 0.2, H * 0.43, W * 0.8, H * 0.43);

    // Flavour text
    this.add.text(W / 2, H * 0.5, 'Try to survive as many waves as you can!', {
      fontSize: '14px',
      fill: '#aaddff',
      fontFamily: 'monospace',
      wordWrap: { width: W * 0.7 },
      align: 'center',
    }).setOrigin(0.5);

    this.add.text(W / 2, H * 0.59, 'Build turrets. Earn credits. Survive.', {
      fontSize: '14px',
      fill: '#88aacc',
      fontFamily: 'monospace',
      align: 'center',
    }).setOrigin(0.5);

    // Tap to start — pulse animation
    const startText = this.add.text(W / 2, H * 0.76, 'Tap / Click to Start', {
      fontSize: '22px',
      fill: '#ffdd44',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.tweens.add({
      targets: startText,
      alpha: 0.2,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Version / credits line
    this.add.text(W / 2, H - 18, 'v0.1  •  Built with Phaser 3', {
      fontSize: '11px',
      fill: '#445566',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Start on click/tap
    this.input.once('pointerdown', () => {
      this.cameras.main.fadeOut(300, 0, 0, 16);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('GameScene');
      });
    });
  }
}
