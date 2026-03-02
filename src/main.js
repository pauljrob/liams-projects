import { GAME_CONFIG } from './config/gameConfig.js';
import BootScene from './scenes/BootScene.js';
import TitleScene from './scenes/TitleScene.js';
import GameScene from './scenes/GameScene.js';
import UIScene from './scenes/UIScene.js';
import GameOverScene from './scenes/GameOverScene.js';
import VictoryScene from './scenes/VictoryScene.js';

const config = {
  type: Phaser.AUTO, // WebGL with Canvas fallback
  width: GAME_CONFIG.width,
  height: GAME_CONFIG.height,
  backgroundColor: '#000010',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [
    BootScene,
    TitleScene,
    GameScene,
    UIScene,
    GameOverScene,
    VictoryScene,
  ],
};

window.__phaserGame = new Phaser.Game(config);
