export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Assets will be loaded here once we have them
    // e.g. this.load.image('laser-turret', 'assets/images/laser-turret.png');
    // e.g. this.load.audio('laser-fire', 'assets/sounds/laser-fire.mp3');
  }

  create() {
    this.scene.start('TitleScene');
  }
}
