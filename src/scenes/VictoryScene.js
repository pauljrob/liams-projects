export default class VictoryScene extends Phaser.Scene {
  constructor() {
    super({ key: 'VictoryScene' });
  }

  create() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    this.add.text(cx, cy - 60, 'VICTORY!', {
      fontSize: '48px',
      fill: '#ffdd00',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(cx, cy, 'You defended the space base!', {
      fontSize: '18px',
      fill: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(cx, cy + 60, 'Tap / Click to play again', {
      fontSize: '16px',
      fill: '#aaaaaa',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.input.once('pointerdown', () => this.scene.start('GameScene'));
  }
}
