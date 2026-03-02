import { GAME_CONFIG } from '../config/gameConfig.js';
import LeaderboardDisplay from '../ui/LeaderboardDisplay.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' });
  }

  init(data) {
    this.stats = data || {};
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    const cx = W / 2;

    // Star field background
    const starGfx = this.add.graphics();
    for (let i = 0; i < 120; i++) {
      const x = Phaser.Math.Between(0, W);
      const y = Phaser.Math.Between(0, H);
      const r = Math.random() < 0.15 ? 2 : 1;
      starGfx.fillStyle(0xffffff, 0.3 + Math.random() * 0.4);
      starGfx.fillCircle(x, y, r);
    }

    // GAME OVER title
    this.add.text(cx, 36, 'GAME OVER', {
      fontSize: '42px',
      fill: '#ff4444',
      fontFamily: 'monospace',
      stroke: '#440000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.add.text(cx, 72, 'The aliens have destroyed your base!', {
      fontSize: '14px',
      fill: '#aa8888',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Stats display
    const wave = this.stats.wave || 0;
    const kills = this.stats.kills || 0;
    const timeMs = this.stats.timeSurvivedMs || 0;
    const credits = this.stats.creditsEarned || 0;
    const totalSec = Math.floor(timeMs / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = (totalSec % 60).toString().padStart(2, '0');

    this.add.text(cx, 100, `Wave ${wave}  |  ${kills} Kills  |  ${min}:${sec} Survived  |  ${credits} Credits`, {
      fontSize: '14px',
      fill: '#ffdd44',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    if (this.stats.cheatMode) {
      // Cheat mode — no submission, show message + leaderboard view-only
      this.add.text(cx, 128, 'Cheat mode — score not saved to leaderboard', {
        fontSize: '12px',
        fill: '#ff8844',
        fontFamily: 'monospace',
      }).setOrigin(0.5);

      this.showLeaderboard(150, null, null);
    } else {
      // Show name input
      this.showNameInput(130);
    }
  }

  showNameInput(startY) {
    const W = this.scale.width;
    const cx = W / 2;
    this.nameElements = [];

    // Saved name from previous session
    const savedName = localStorage.getItem('spaceTD_playerName') || '';

    this.add.text(cx, startY, 'Enter your name:', {
      fontSize: '14px',
      fill: '#aaaaaa',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.nameTyped = savedName;

    const nameDisplay = this.add.text(cx, startY + 28, (this.nameTyped || '') + '|', {
      fontSize: '20px',
      fill: '#ffdd00',
      fontFamily: 'monospace',
      backgroundColor: '#111122',
      padding: { x: 16, y: 6 },
    }).setOrigin(0.5);
    this.nameElements.push(nameDisplay);

    const updateDisplay = () => {
      nameDisplay.setText((this.nameTyped || '') + '|');
    };

    const typeLetter = (letter) => {
      if (this.nameTyped.length >= 16) return;
      this.nameTyped += letter;
      updateDisplay();
    };

    const backspace = () => {
      this.nameTyped = this.nameTyped.slice(0, -1);
      updateDisplay();
    };

    const submitName = () => {
      const name = this.nameTyped.trim().replace(/[^a-zA-Z0-9 ]/g, '');
      if (name.length < 3) {
        const warn = this.add.text(cx, startY + 52, 'Name must be at least 3 characters', {
          fontSize: '11px', fill: '#ff6644', fontFamily: 'monospace',
        }).setOrigin(0.5);
        this.time.delayedCall(2000, () => warn.destroy());
        return;
      }
      closeInput();
      localStorage.setItem('spaceTD_playerName', name);
      this.submitScore(name);
    };

    const skipSubmit = () => {
      closeInput();
      this.showLeaderboard(130, null, null);
      this.showRestartPrompt();
    };

    // On-screen keyboard
    const rows = [
      ['Q','W','E','R','T','Y','U','I','O','P'],
      ['A','S','D','F','G','H','J','K','L'],
      ['Z','X','C','V','B','N','M'],
      ['1','2','3','4','5','6','7','8','9','0'],
    ];
    const keySize = 30;
    const keyGap = 3;
    const kbStartY = startY + 58;

    rows.forEach((row, ri) => {
      const rowW = row.length * (keySize + keyGap) - keyGap;
      const sx = (W - rowW) / 2;
      row.forEach((letter, ci) => {
        const x = sx + ci * (keySize + keyGap) + keySize / 2;
        const y = kbStartY + ri * (keySize + keyGap) + keySize / 2;

        const keyBg = this.add.rectangle(x, y, keySize, keySize, 0x222233, 1)
          .setInteractive({ useHandCursor: true });
        const keyTxt = this.add.text(x, y, letter, {
          fontSize: '14px', fill: '#ffffff', fontFamily: 'monospace',
        }).setOrigin(0.5);

        keyBg.on('pointerdown', () => {
          typeLetter(letter);
          keyBg.setFillStyle(0x00ffcc, 1);
        });
        keyBg.on('pointerup', () => keyBg.setFillStyle(0x222233, 1));
        keyBg.on('pointerout', () => keyBg.setFillStyle(0x222233, 1));

        this.nameElements.push(keyBg, keyTxt);
      });
    });

    // Space bar
    const spaceY = kbStartY + 4 * (keySize + keyGap) + keySize / 2;
    const spaceBg = this.add.rectangle(cx, spaceY, 160, keySize, 0x222233, 1)
      .setInteractive({ useHandCursor: true });
    const spaceTxt = this.add.text(cx, spaceY, 'SPACE', {
      fontSize: '12px', fill: '#888888', fontFamily: 'monospace',
    }).setOrigin(0.5);
    spaceBg.on('pointerdown', () => {
      typeLetter(' ');
      spaceBg.setFillStyle(0x00ffcc, 1);
    });
    spaceBg.on('pointerup', () => spaceBg.setFillStyle(0x222233, 1));
    spaceBg.on('pointerout', () => spaceBg.setFillStyle(0x222233, 1));
    this.nameElements.push(spaceBg, spaceTxt);

    // Bottom buttons: Delete, Submit, Skip
    const btnY = spaceY + keySize + 8;
    const btnStyle = { fontSize: '12px', fill: '#ffffff', fontFamily: 'monospace', padding: { x: 10, y: 6 } };

    const delBtn = this.add.text(cx - 120, btnY, 'Delete', {
      ...btnStyle, backgroundColor: '#663333',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    delBtn.on('pointerdown', backspace);
    this.nameElements.push(delBtn);

    const submitBtn = this.add.text(cx, btnY, 'Submit', {
      ...btnStyle, backgroundColor: '#336633',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    submitBtn.on('pointerdown', submitName);
    this.nameElements.push(submitBtn);

    const skipBtn = this.add.text(cx + 120, btnY, 'Skip', {
      ...btnStyle, backgroundColor: '#333344',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    skipBtn.on('pointerdown', skipSubmit);
    this.nameElements.push(skipBtn);

    // Physical keyboard support
    this.keyHandler = (event) => {
      if (event.key === 'Enter') { submitName(); return; }
      if (event.key === 'Backspace') { backspace(); return; }
      if (event.key.length === 1 && /[a-zA-Z0-9 ]/.test(event.key)) { typeLetter(event.key.toUpperCase()); }
    };

    const closeInput = () => {
      for (const el of this.nameElements) el.destroy();
      this.nameElements = [];
      if (this.keyHandler) {
        window.removeEventListener('keydown', this.keyHandler, true);
        this.keyHandler = null;
      }
    };

    window.addEventListener('keydown', this.keyHandler, true);
  }

  async submitScore(name) {
    const cx = this.scale.width / 2;

    const submittingText = this.add.text(cx, 160, 'Submitting score...', {
      fontSize: '14px', fill: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5);

    try {
      const response = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          wave: this.stats.wave || 0,
          kills: this.stats.kills || 0,
          timeSurvivedMs: this.stats.timeSurvivedMs || 0,
          creditsEarned: this.stats.creditsEarned || 0,
        }),
      });

      submittingText.destroy();

      if (response.ok) {
        const result = await response.json();
        const rankText = result.rank
          ? `You ranked #${result.rank} out of ${result.totalEntries}!`
          : 'Score submitted!';

        this.add.text(cx, 140, rankText, {
          fontSize: '16px', fill: '#44ff88', fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.showLeaderboard(160, name, result.rank);
      } else {
        const err = await response.json().catch(() => ({}));
        this.add.text(cx, 140, err.error || 'Could not submit score', {
          fontSize: '13px', fill: '#ff6644', fontFamily: 'monospace',
        }).setOrigin(0.5);
        this.showLeaderboard(160, null, null);
      }
    } catch (err) {
      submittingText.destroy();
      this.add.text(cx, 140, 'Network error — could not submit', {
        fontSize: '13px', fill: '#ff6644', fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.showLeaderboard(160, null, null);
    }

    this.showRestartPrompt();
  }

  showLeaderboard(topY, highlightName, highlightRank) {
    const cx = this.scale.width / 2;
    this.leaderboard = new LeaderboardDisplay(this, cx, topY, {
      limit: 10,
      highlightName,
      highlightRank,
    });
    this.leaderboard.show();
  }

  showRestartPrompt() {
    const cx = this.scale.width / 2;
    const H = this.scale.height;

    const restartText = this.add.text(cx, H - 30, 'Tap / Click to play again', {
      fontSize: '16px',
      fill: '#aaaaaa',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.tweens.add({
      targets: restartText,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Delay slightly so tap doesn't immediately restart
    this.time.delayedCall(500, () => {
      this.input.once('pointerdown', () => this.scene.start('GameScene'));
    });
  }

  shutdown() {
    // Clean up keyboard listener if scene is stopped
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler, true);
      this.keyHandler = null;
    }
    if (this.leaderboard) {
      this.leaderboard.clear();
    }
  }
}
