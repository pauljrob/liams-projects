export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' });
  }

  create() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    this.add.text(cx, cy - 60, 'GAME OVER', {
      fontSize: '48px',
      fill: '#ff4444',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(cx, cy, 'The aliens have destroyed your base!', {
      fontSize: '18px',
      fill: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(cx, cy + 60, 'Tap / Click to try again', {
      fontSize: '16px',
      fill: '#aaaaaa',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.input.once('pointerdown', () => this.scene.start('GameScene'));
  }
}
