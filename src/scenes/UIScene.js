import { GAME_CONFIG } from '../config/gameConfig.js';
import { UPGRADE_DEFS } from '../entities/Turret.js';
import { UPGRADE_DEFS_MG } from '../entities/MachineGun.js';

export default class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
  }

  init(data) {
    this.gameScene = data.gameScene;
    this.cheatMode = data.cheatMode || false;
  }

  create() {
    this.creditsText = this.add.text(10, 10, `Credits: ${this.gameScene.credits}`, {
      fontSize: '18px',
      fill: '#ffdd00',
      fontFamily: 'monospace',
    }).setOrigin(0, 0);

    this.waveText = this.add.text(10, 35, `Wave: 1`, {
      fontSize: '18px',
      fill: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0, 0);

    this.hpText = this.add.text(10, 60, `Base HP: ${this.gameScene.baseHP}`, {
      fontSize: '18px',
      fill: '#ff4444',
      fontFamily: 'monospace',
    }).setOrigin(0, 0);

    // Pause button — always visible
    this.paused = false;
    this.pauseBtn = this.add.text(GAME_CONFIG.width - 10, 60, '⏸ Pause', {
      fontSize: '14px',
      fill: '#ffffff',
      fontFamily: 'monospace',
      backgroundColor: '#333333',
      padding: { x: 10, y: 6 },
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });

    this.pauseBtn.on('pointerdown', () => this.togglePause());
    this.pauseBtn.on('pointerover', () => this.pauseBtn.setStyle({ fill: '#00ffcc' }));
    this.pauseBtn.on('pointerout', () => this.pauseBtn.setStyle({ fill: this.paused ? '#ffdd00' : '#ffffff' }));

    this.activeBtn = null;
    this.hintText = null;
    this.ultraUnlocked = false;
    this.konamiBuffer = '';
    this.upgradePanel = null;
    this.createTurretButtons();
    this.setupSecretCode();
    this.createCodesPanel();
    this.createSkipWaveButton();

    // Listen for turret clicks from GameScene
    this.gameScene.events.on('turretClicked', (turret) => {
      if (turret) {
        this.openUpgradePanel(turret);
      } else {
        this.closeUpgradePanel();
      }
    });

    // Auto-unlock cheats if cheat mode was enabled on the title screen
    if (this.cheatMode) {
      this.ultraUnlocked = true;
      GAME_CONFIG.turretCosts.ultraHamster = 0;
      const uhBtn = this.buttons.find(b => b.turretType === 'ultraHamster');
      if (uhBtn) {
        uhBtn.setVisible(true);
        uhBtn.setText('ULTRA\nHAMSTER\n(FREE)');
      }
      this.showCheatExtras();
    }
  }

  createTurretButtons() {
    // Two centered rows at the bottom of the screen
    const PAD = 6;
    const BTN_H = 29;
    const ROW_GAP = 4;
    const W = GAME_CONFIG.width;
    const SAFE_BOTTOM = 20; // extra padding for iPhone home indicator / safe area
    const row2Y = GAME_CONFIG.height - 4 - SAFE_BOTTOM;     // bottom row (originY=1)
    const row1Y = row2Y - BTN_H - ROW_GAP;    // top row (originY=1)

    const charW = 8;
    const btnPad = 16;
    const estW = (label) => label.length * charW + btnPad;

    const defs = [
      { label: `Laser (${GAME_CONFIG.turretCosts.laser}cr)`,        type: 'laser' },
      { label: `M.Gun (${GAME_CONFIG.turretCosts.machineGun}cr)`,   type: 'machineGun' },
      { label: `Missile (${GAME_CONFIG.turretCosts.missile}cr)`,    type: 'missile' },
      { label: `Field (${GAME_CONFIG.turretCosts.forceField}cr)`,   type: 'forceField' },
      { label: `Bomb (${GAME_CONFIG.turretCosts.bomb}cr)`,          type: 'bomb' },
      { label: `Plasma (${GAME_CONFIG.turretCosts.plasmaGun}cr)`, type: 'plasmaGun' },
      { label: `Railgun (${GAME_CONFIG.turretCosts.plasmaRailgun}cr)`, type: 'plasmaRailgun' },
      { label: `Plane (${GAME_CONFIG.turretCosts.attackPlane}cr)`,  type: 'attackPlane' },
      { label: `Hamster (${GAME_CONFIG.turretCosts.hamster}cr)`,    type: 'hamster' },
      { label: `ULTRA HAMSTER`,                                      type: 'ultraHamster', hidden: true },
    ];

    // Split visible defs into two rows (roughly half each)
    const visible = defs.filter(d => !d.hidden);
    const hidden = defs.filter(d => d.hidden);
    const splitIdx = Math.ceil(visible.length / 2);
    const row1Defs = visible.slice(0, splitIdx);
    const row2Defs = [...visible.slice(splitIdx), ...hidden];

    // Calculate centered positions for a row
    const layoutRow = (rowDefs, y) => {
      const totalW = rowDefs.reduce((sum, d) => sum + estW(d.label) + PAD, -PAD);
      let cursor = (W - totalW) / 2;
      return rowDefs.map(d => {
        const x = cursor;
        cursor += estW(d.label) + PAD;
        return { ...d, x, y };
      });
    };

    const buttons = [...layoutRow(row1Defs, row1Y), ...layoutRow(row2Defs, row2Y)];

    this.buttons = [];

    buttons.forEach(({ label, x, y, type, hidden }) => {
      const btn = this.add.text(x, y, label, {
        fontSize: '13px',
        fill: '#00ffcc',
        fontFamily: 'monospace',
        backgroundColor: '#003333',
        padding: { x: 8, y: 6 },
      })
        .setOrigin(0, 1)
        .setInteractive()
        .on('pointerdown', () => this.selectTurret(type, btn))
        .on('pointerover', () => { if (btn !== this.activeBtn) btn.setStyle({ fill: '#ffffff' }); })
        .on('pointerout', () => { if (btn !== this.activeBtn) btn.setStyle({ fill: '#00ffcc' }); });

      btn.turretType = type;
      if (hidden) btn.setVisible(false);
      this.buttons.push(btn);
    });

    // ESC to cancel placement
    this.input.keyboard.on('keydown-ESC', () => this.cancelTurret());

    // Right-click to cancel
    this.input.on('pointerdown', (pointer) => {
      if (pointer.rightButtonDown()) this.cancelTurret();
    });

    // Listen for auto-cancel from GameScene (e.g. can't afford turret)
    this.gameScene.events.on('placementCancelled', () => {
      if (this.activeBtn) {
        this.activeBtn.setStyle({ fill: '#00ffcc', backgroundColor: '#003333' });
        this.activeBtn = null;
      }
      if (this.hintText) this.hintText.setVisible(false);
    });
  }

  selectTurret(type, btn) {
    // Toggle off if clicking the same button
    if (this.activeBtn === btn) {
      this.cancelTurret();
      return;
    }
    // Deselect previous button
    if (this.activeBtn) {
      this.activeBtn.setStyle({ fill: '#00ffcc', backgroundColor: '#003333' });
    }
    this.activeBtn = btn;
    btn.setStyle({ fill: '#000000', backgroundColor: '#00ffcc' });
    this.gameScene.selectTurretType(type);

    if (!this.hintText) {
      this.hintText = this.add.text(GAME_CONFIG.width / 2, GAME_CONFIG.height - 95,
        'Click to place  |  ESC / right-click / re-tap to cancel', {
          fontSize: '11px',
          fill: '#aaaaaa',
          fontFamily: 'monospace',
          stroke: '#000000',
          strokeThickness: 3,
        }).setOrigin(0.5);
    }
    this.hintText.setVisible(true);
  }

  cancelTurret() {
    if (this.activeBtn) {
      this.activeBtn.setStyle({ fill: '#00ffcc', backgroundColor: '#003333' });
      this.activeBtn = null;
    }
    if (this.hintText) this.hintText.setVisible(false);
    this.gameScene.cancelPlacement();
  }

  createCodesPanel() {
    const lines = [
      '🔐 Secret Codes',
      '——————————',
      '??? — click to enter',
    ];
    const panel = this.add.text(GAME_CONFIG.width - 10, 10, lines.join('\n'), {
      fontSize: '12px',
      fill: '#aaaaaa',
      fontFamily: 'monospace',
      align: 'right',
      lineSpacing: 4,
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });

    this.codeInput = null;
    this.codeInputTyped = '';

    panel.on('pointerdown', () => this.openCodeInput());
    panel.on('pointerover', () => panel.setStyle({ fill: '#ffffff' }));
    panel.on('pointerout', () => panel.setStyle({ fill: '#aaaaaa' }));
  }

  openCodeInput() {
    if (this.codeInput) return;

    const W = GAME_CONFIG.width;
    const H = GAME_CONFIG.height;
    const elements = [];

    // Dim background — full screen
    const bg = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.85).setDepth(199);
    elements.push(bg);

    const prompt = this.add.text(W / 2, 60, '🔐 Enter secret code:', {
      fontSize: '16px', fill: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(200);
    elements.push(prompt);

    const typed = this.add.text(W / 2, 100, '|', {
      fontSize: '22px', fill: '#ffdd00', fontFamily: 'monospace',
      backgroundColor: '#111111', padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setDepth(200);
    elements.push(typed);

    this.codeInputTyped = '';

    const updateDisplay = () => {
      typed.setText((this.codeInputTyped || '') + '|');
    };

    const SECRET = 'inside';

    const submitCode = () => {
      const guess = this.codeInputTyped.toLowerCase().trim();
      closeInput();
      if (guess === SECRET && !this.ultraUnlocked) {
        this.ultraUnlocked = true;
        this.gameScene.cheatMode = true;
        const uhBtn = this.buttons.find(b => b.turretType === 'ultraHamster');
        if (uhBtn) {
          uhBtn.setVisible(true);
          uhBtn.setText('ULTRA HAMSTER (FREE)');
        }
        GAME_CONFIG.turretCosts.ultraHamster = 0;
        this.showCheatExtras();
        const flash = this.add.text(W / 2, H / 2, '👑 ULTRA HAMSTER UNLOCKED 👑', {
          fontSize: '22px', fill: '#ffdd00', fontFamily: 'monospace',
          stroke: '#000000', strokeThickness: 4,
        }).setOrigin(0.5).setDepth(200);
        this.tweens.add({
          targets: flash, alpha: 0, y: H / 2 - 60, duration: 2000,
          onComplete: () => flash.destroy(),
        });
      } else if (guess !== SECRET) {
        const wrong = this.add.text(W / 2, H / 2, '❌ Unknown code', {
          fontSize: '16px', fill: '#ff4444', fontFamily: 'monospace',
          stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(200);
        this.tweens.add({
          targets: wrong, alpha: 0, y: H / 2 - 40, duration: 1200,
          onComplete: () => wrong.destroy(),
        });
      }
    };

    const typeLetter = (letter) => {
      this.codeInputTyped += letter;
      updateDisplay();
    };

    const backspace = () => {
      this.codeInputTyped = this.codeInputTyped.slice(0, -1);
      updateDisplay();
    };

    // On-screen keyboard
    const rows = [
      ['q','w','e','r','t','y','u','i','o','p'],
      ['a','s','d','f','g','h','j','k','l'],
      ['z','x','c','v','b','n','m'],
    ];
    const keySize = 34;
    const keyGap = 4;
    const startY = 150;

    rows.forEach((row, ri) => {
      const rowW = row.length * (keySize + keyGap) - keyGap;
      const startX = (W - rowW) / 2;
      row.forEach((letter, ci) => {
        const x = startX + ci * (keySize + keyGap) + keySize / 2;
        const y = startY + ri * (keySize + keyGap) + keySize / 2;

        const keyBg = this.add.rectangle(x, y, keySize, keySize, 0x222233, 1)
          .setDepth(200).setInteractive({ useHandCursor: true });
        const keyTxt = this.add.text(x, y, letter, {
          fontSize: '16px', fill: '#ffffff', fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(201);

        keyBg.on('pointerdown', () => {
          typeLetter(letter);
          keyBg.setFillStyle(0x00ffcc, 1);
        });
        keyBg.on('pointerup', () => keyBg.setFillStyle(0x222233, 1));
        keyBg.on('pointerout', () => keyBg.setFillStyle(0x222233, 1));

        elements.push(keyBg, keyTxt);
      });
    });

    // Bottom row: Backspace, Submit, Cancel
    const btnY = startY + 3 * (keySize + keyGap) + keySize / 2 + 8;
    const btnStyle = { fontSize: '13px', fill: '#ffffff', fontFamily: 'monospace', padding: { x: 10, y: 8 } };

    const delBtn = this.add.text(W / 2 - 130, btnY, '⌫ Delete', {
      ...btnStyle, backgroundColor: '#663333',
    }).setOrigin(0.5).setDepth(200).setInteractive({ useHandCursor: true });
    delBtn.on('pointerdown', backspace);
    elements.push(delBtn);

    const submitBtn = this.add.text(W / 2, btnY, '✓ Submit', {
      ...btnStyle, backgroundColor: '#336633',
    }).setOrigin(0.5).setDepth(200).setInteractive({ useHandCursor: true });
    submitBtn.on('pointerdown', submitCode);
    elements.push(submitBtn);

    const cancelBtn = this.add.text(W / 2 + 130, btnY, '✕ Cancel', {
      ...btnStyle, backgroundColor: '#333333',
    }).setOrigin(0.5).setDepth(200).setInteractive({ useHandCursor: true });
    cancelBtn.on('pointerdown', () => closeInput());
    elements.push(cancelBtn);

    this.codeInput = { elements };

    // Physical keyboard still works too
    const keyHandler = (event) => {
      if (!this.codeInput) return;
      if (event.key === 'Escape') { closeInput(); return; }
      if (event.key === 'Enter') { submitCode(); return; }
      if (event.key === 'Backspace') { backspace(); return; }
      if (event.key.length === 1) { typeLetter(event.key); }
    };

    const closeInput = () => {
      if (!this.codeInput) return;
      for (const el of this.codeInput.elements) el.destroy();
      this.codeInput = null;
      window.removeEventListener('keydown', keyHandler, true);
    };

    window.addEventListener('keydown', keyHandler, true);
  }

  createSkipWaveButton() {
    this.stopWaveBtn = this.add.text(GAME_CONFIG.width / 2 - 210, 10, '⏹ Stop Wave', {
      fontSize: '13px',
      fill: '#ff6666',
      fontFamily: 'monospace',
      backgroundColor: '#330000',
      padding: { x: 8, y: 6 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true }).setVisible(false);

    this.stopWaveBtn
      .on('pointerdown', () => {
        if (this.gameScene.waveStopped) {
          this.gameScene.resumeWave();
          this.stopWaveBtn.setText('⏹ Stop Wave');
          this.stopWaveBtn.setStyle({ fill: '#ff6666', backgroundColor: '#330000' });
        } else {
          this.gameScene.stopWave();
          this.stopWaveBtn.setText('▶ Resume Wave');
          this.stopWaveBtn.setStyle({ fill: '#00ff88', backgroundColor: '#003322' });
        }
      })
      .on('pointerover', () => this.stopWaveBtn.setStyle({ fill: '#ffffff' }))
      .on('pointerout', () => {
        const col = this.gameScene.waveStopped ? '#00ff88' : '#ff6666';
        this.stopWaveBtn.setStyle({ fill: col });
      });

    this.skipWaveBtn = this.add.text(GAME_CONFIG.width / 2 - 70, 10, '⏭ Skip Wave', {
      fontSize: '13px',
      fill: '#ffdd00',
      fontFamily: 'monospace',
      backgroundColor: '#333300',
      padding: { x: 8, y: 6 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true }).setVisible(false);

    this.skipWaveBtn
      .on('pointerdown', () => this.gameScene.skipOneWave())
      .on('pointerover', () => this.skipWaveBtn.setStyle({ fill: '#ffffff' }))
      .on('pointerout', () => this.skipWaveBtn.setStyle({ fill: '#ffdd00' }));

    // Auto clicker toggle button
    this.autoClickerOn = false;
    this.autoClickerInterval = null;

    this.autoClickerBtn = this.add.text(GAME_CONFIG.width / 2 + 70, 10, '🤖 Auto: OFF', {
      fontSize: '13px',
      fill: '#aaaaaa',
      fontFamily: 'monospace',
      backgroundColor: '#222222',
      padding: { x: 8, y: 6 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true }).setVisible(false);

    this.autoClickerBtn
      .on('pointerdown', () => this.toggleAutoClicker())
      .on('pointerover', () => this.autoClickerBtn.setStyle({ fill: '#ffffff' }))
      .on('pointerout', () => this.autoClickerBtn.setStyle({ fill: this.autoClickerOn ? '#00ff88' : '#aaaaaa' }));

    // Add Credits button — hidden until secret code unlocked
    this.addCreditsBtn = this.add.text(GAME_CONFIG.width / 2 + 180, 10, '+1000 Credits', {
      fontSize: '13px',
      fill: '#ffdd00',
      fontFamily: 'monospace',
      backgroundColor: '#333300',
      padding: { x: 8, y: 6 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true }).setVisible(false);

    this.addCreditsBtn
      .on('pointerdown', () => { this.gameScene.credits += 1000; })
      .on('pointerover', () => this.addCreditsBtn.setStyle({ fill: '#ffffff' }))
      .on('pointerout', () => this.addCreditsBtn.setStyle({ fill: '#ffdd00' }));

    // Events list button — hidden until secret code unlocked
    this.eventsBtn = this.add.text(GAME_CONFIG.width - 10, 10, 'Events', {
      fontSize: '13px',
      fill: '#00ccff',
      fontFamily: 'monospace',
      backgroundColor: '#002233',
      padding: { x: 8, y: 6 },
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true }).setVisible(false);

    this.eventsListOpen = false;
    this.eventsListItems = [];

    this.eventsBtn
      .on('pointerdown', () => this.toggleEventsList())
      .on('pointerover', () => this.eventsBtn.setStyle({ fill: '#ffffff' }))
      .on('pointerout', () => this.eventsBtn.setStyle({ fill: '#00ccff' }));

    // Save Wave button — hidden until secret code unlocked
    this.saveWaveBtn = this.add.text(GAME_CONFIG.width / 2 - 70, 36, 'Save Wave', {
      fontSize: '13px',
      fill: '#44ff88',
      fontFamily: 'monospace',
      backgroundColor: '#003322',
      padding: { x: 8, y: 6 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true }).setVisible(false);

    this.saveWaveBtn
      .on('pointerdown', () => this.saveWaveToLeaderboard())
      .on('pointerover', () => this.saveWaveBtn.setStyle({ fill: '#ffffff' }))
      .on('pointerout', () => this.saveWaveBtn.setStyle({ fill: '#44ff88' }));

    // Upgrade All button — hidden until secret code unlocked
    this.upgradeAllBtn = this.add.text(GAME_CONFIG.width / 2 + 70, 36, 'Upgrade All', {
      fontSize: '13px',
      fill: '#ffaa00',
      fontFamily: 'monospace',
      backgroundColor: '#332200',
      padding: { x: 8, y: 6 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true }).setVisible(false);

    this.upgradeAllBtn
      .on('pointerdown', () => this.upgradeAllTurrets())
      .on('pointerover', () => this.upgradeAllBtn.setStyle({ fill: '#ffffff' }))
      .on('pointerout', () => this.upgradeAllBtn.setStyle({ fill: '#ffaa00' }));

    // Gift button — hidden until secret code unlocked
    this.giftBtn = this.add.text(GAME_CONFIG.width / 2 - 210, 36, 'Gift', {
      fontSize: '13px',
      fill: '#ff66cc',
      fontFamily: 'monospace',
      backgroundColor: '#330022',
      padding: { x: 8, y: 6 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true }).setVisible(false);

    this.giftBtn
      .on('pointerdown', () => this.openGiftPanel())
      .on('pointerover', () => this.giftBtn.setStyle({ fill: '#ffffff' }))
      .on('pointerout', () => this.giftBtn.setStyle({ fill: '#ff66cc' }));

    this.giftPanelOpen = false;
    this.giftPanelItems = [];

    // Servers button — hidden until secret code unlocked
    this.serversBtn = this.add.text(GAME_CONFIG.width / 2 - 280, 36, 'Servers', {
      fontSize: '13px',
      fill: '#00ddff',
      fontFamily: 'monospace',
      backgroundColor: '#002233',
      padding: { x: 8, y: 6 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true }).setVisible(false);

    this.serversBtn
      .on('pointerdown', () => this.toggleServerPanel())
      .on('pointerover', () => this.serversBtn.setStyle({ fill: '#ffffff' }))
      .on('pointerout', () => this.serversBtn.setStyle({ fill: '#00ddff' }));

    this.serverPanelOpen = false;
    this.serverPanelItems = [];

    // Ultimate Boss spawn button — hidden until secret code unlocked
    this.ultimateBossBtn = this.add.text(GAME_CONFIG.width / 2, 62, '** SPAWN ULTIMATE BOSS **', {
      fontSize: '13px',
      fill: '#ff00ff',
      fontFamily: 'monospace',
      backgroundColor: '#220022',
      padding: { x: 8, y: 6 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true }).setVisible(false);

    this.ultimateBossBtn
      .on('pointerdown', () => this.gameScene.spawnUltimateBoss())
      .on('pointerover', () => this.ultimateBossBtn.setStyle({ fill: '#ffffff' }))
      .on('pointerout', () => this.ultimateBossBtn.setStyle({ fill: '#ff00ff' }));
  }

  togglePause() {
    this.paused = !this.paused;
    if (this.paused) {
      this.pauseBtn.setText('▶ Resume');
      this.pauseBtn.setStyle({ fill: '#ffdd00', backgroundColor: '#333300' });
      this.gameScene.scene.pause('GameScene');
    } else {
      this.pauseBtn.setText('⏸ Pause');
      this.pauseBtn.setStyle({ fill: '#ffffff', backgroundColor: '#333333' });
      this.gameScene.scene.resume('GameScene');
    }
  }

  toggleAutoClicker() {
    this.autoClickerOn = !this.autoClickerOn;
    if (this.autoClickerOn) {
      this.autoClickerBtn.setText('🤖 Auto: ON');
      this.autoClickerBtn.setStyle({ fill: '#00ff88', backgroundColor: '#003322' });
      // Skip 1000 waves every tick
      this.autoClickerInterval = this.time.addEvent({
        delay: 100,
        loop: true,
        callback: () => this.gameScene.fastForwardWave(),
      });
    } else {
      this.autoClickerBtn.setText('🤖 Auto: OFF');
      this.autoClickerBtn.setStyle({ fill: '#aaaaaa', backgroundColor: '#222222' });
      if (this.autoClickerInterval) {
        this.autoClickerInterval.remove();
        this.autoClickerInterval = null;
      }
    }
  }

  saveWaveToLeaderboard() {
    const gs = this.gameScene;
    const savedName = localStorage.getItem('spaceTD_playerName') || '';

    if (!savedName || savedName.length < 3) {
      const msg = this.add.text(this.scale.width / 2, this.scale.height / 2, 'Play a full game first to set your name!', {
        fontSize: '14px', fill: '#ff6644', fontFamily: 'monospace',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(500);
      this.time.delayedCall(2000, () => msg.destroy());
      return;
    }

    this.saveWaveBtn.setText('Saving...');
    this.saveWaveBtn.disableInteractive();

    // Capture stats now before scene transitions
    const stats = {
      wave: gs.currentWave || 0,
      kills: gs.totalKills || 0,
      timeSurvivedMs: Date.now() - gs.gameStartTime,
      creditsEarned: gs.totalCreditsEarned || 0,
      cheatMode: gs.cheatMode,
    };

    // Clamp values to API limits before sending
    const wave = Math.min(Math.floor(stats.wave), 999999) || 1;
    const kills = Math.min(Math.floor(stats.kills), 99999999) || 0;
    const timeSurvivedMs = Math.max(Math.floor(stats.timeSurvivedMs), 0) || 0;
    const creditsEarned = Math.min(Math.floor(stats.creditsEarned), 99999999) || 0;

    // Save to leaderboard, then kill the player
    fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: savedName, wave, kills, timeSurvivedMs, creditsEarned }),
    }).then(res => {
      if (!res.ok) return res.json().then(e => console.error('Save failed:', e));
    }).catch(err => {
      console.error('Save network error:', err);
    }).finally(() => {
      // Kill the player — go to game over (score already saved)
      gs.waveActive = false;
      gs.enemies = [];
      gs.scene.stop('UIScene');
      gs.scene.start('GameOverScene', stats);
    });
  }

  upgradeAllTurrets() {
    const gs = this.gameScene;
    for (const turret of gs.turrets) {
      if (turret.destroyed) continue;
      // Max out all 3 upgrade slots (each has 3 levels)
      for (let slot = 0; slot < 3; slot++) {
        while (turret.upgradeLevels[slot] < 3) {
          turret.applyUpgrade(slot);
        }
      }
    }
  }

  openGiftPanel() {
    if (this.giftPanelOpen) {
      this.closeGiftPanel();
      return;
    }

    this.showGiftServerList();
  }

  async showGiftServerList() {
    this.giftPanelOpen = true;
    const W = this.scale.width;
    const items = this.giftPanelItems;

    const bg = this.add.rectangle(W - 120, 140, 220, 320, 0x111122, 0.95)
      .setDepth(600).setStrokeStyle(1, 0xff66cc);
    items.push(bg);

    const title = this.add.text(W - 120, 15, 'Select Server', {
      fontSize: '13px', fill: '#ff66cc', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(601);
    items.push(title);

    const loading = this.add.text(W - 120, 80, 'Loading...', {
      fontSize: '11px', fill: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(601);
    items.push(loading);

    try {
      const res = await fetch('/api/players');
      const data = await res.json();
      if (!this.giftPanelOpen) return;
      loading.destroy();

      if (!data.players || data.players.length === 0) {
        const noPlayers = this.add.text(W - 120, 80, 'No players online', {
          fontSize: '11px', fill: '#888888', fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(601);
        items.push(noPlayers);
      } else {
        // Group by server
        const servers = {};
        for (const p of data.players) {
          const sn = p.serverName || 'Unknown';
          if (!servers[sn]) servers[sn] = [];
          servers[sn].push(p.name);
        }
        this._giftServers = servers;

        let y = 40;
        for (const serverName of Object.keys(servers)) {
          const count = servers[serverName].length;
          const srvBtn = this.add.text(W - 120, y, `${serverName} (${count})`, {
            fontSize: '12px', fill: '#00ddff', fontFamily: 'monospace',
            backgroundColor: '#002233', padding: { x: 10, y: 5 },
          }).setOrigin(0.5).setDepth(601).setInteractive({ useHandCursor: true });

          srvBtn.on('pointerdown', () => this.showGiftPlayersInServer(serverName));
          srvBtn.on('pointerover', () => srvBtn.setStyle({ fill: '#ffffff' }));
          srvBtn.on('pointerout', () => srvBtn.setStyle({ fill: '#00ddff' }));
          items.push(srvBtn);
          y += 28;
          if (y > 260) break;
        }
      }
    } catch {
      loading.setText('Failed to load');
    }

    const closeBtn = this.add.text(W - 120, 285, 'Close', {
      fontSize: '12px', fill: '#ff6666', fontFamily: 'monospace',
      backgroundColor: '#330000', padding: { x: 10, y: 4 },
    }).setOrigin(0.5).setDepth(601).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.closeGiftPanel());
    items.push(closeBtn);
  }

  showGiftPlayersInServer(serverName) {
    this.closeGiftPanel();
    this.giftPanelOpen = true;
    const W = this.scale.width;
    const items = this.giftPanelItems;
    const players = (this._giftServers && this._giftServers[serverName]) || [];

    const bg = this.add.rectangle(W - 120, 140, 220, 320, 0x111122, 0.95)
      .setDepth(600).setStrokeStyle(1, 0xff66cc);
    items.push(bg);

    const title = this.add.text(W - 120, 15, `[${serverName}]`, {
      fontSize: '13px', fill: '#00ddff', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(601);
    items.push(title);

    let y = 40;
    for (const playerName of players) {
      const nameBtn = this.add.text(W - 120, y, playerName, {
        fontSize: '12px', fill: '#ffffff', fontFamily: 'monospace',
        backgroundColor: '#222244', padding: { x: 8, y: 4 },
      }).setOrigin(0.5).setDepth(601).setInteractive({ useHandCursor: true });

      nameBtn.on('pointerdown', () => this.showGiftOptions(playerName));
      nameBtn.on('pointerover', () => nameBtn.setStyle({ fill: '#ff66cc' }));
      nameBtn.on('pointerout', () => nameBtn.setStyle({ fill: '#ffffff' }));
      items.push(nameBtn);
      y += 24;
      if (y > 250) break;
    }

    const backBtn = this.add.text(W - 160, 285, 'Back', {
      fontSize: '12px', fill: '#aaaaaa', fontFamily: 'monospace',
      backgroundColor: '#222222', padding: { x: 10, y: 4 },
    }).setOrigin(0.5).setDepth(601).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => {
      this.closeGiftPanel();
      this.showGiftServerList();
    });
    items.push(backBtn);

    const closeBtn = this.add.text(W - 80, 285, 'Close', {
      fontSize: '12px', fill: '#ff6666', fontFamily: 'monospace',
      backgroundColor: '#330000', padding: { x: 10, y: 4 },
    }).setOrigin(0.5).setDepth(601).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.closeGiftPanel());
    items.push(closeBtn);
  }

  showGiftOptions(playerName) {
    this.closeGiftPanel();
    this.giftPanelOpen = true;
    const W = this.scale.width;
    const items = this.giftPanelItems;

    const bg = this.add.rectangle(W - 120, 100, 220, 180, 0x111122, 0.95)
      .setDepth(600).setStrokeStyle(1, 0xff66cc);
    items.push(bg);

    const title = this.add.text(W - 120, 30, `Gift to ${playerName}`, {
      fontSize: '12px', fill: '#ff66cc', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(601);
    items.push(title);

    const creditsBtn = this.add.text(W - 120, 70, '+500 Credits', {
      fontSize: '14px', fill: '#ffdd00', fontFamily: 'monospace',
      backgroundColor: '#333300', padding: { x: 12, y: 8 },
    }).setOrigin(0.5).setDepth(601).setInteractive({ useHandCursor: true });
    items.push(creditsBtn);

    const hpBtn = this.add.text(W - 120, 110, '+3 Base HP', {
      fontSize: '14px', fill: '#ff4444', fontFamily: 'monospace',
      backgroundColor: '#330000', padding: { x: 12, y: 8 },
    }).setOrigin(0.5).setDepth(601).setInteractive({ useHandCursor: true });
    items.push(hpBtn);

    const statusText = this.add.text(W - 120, 145, '', {
      fontSize: '11px', fill: '#44ff88', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(601);
    items.push(statusText);

    const backBtn = this.add.text(W - 120, 170, 'Back', {
      fontSize: '12px', fill: '#aaaaaa', fontFamily: 'monospace',
      backgroundColor: '#222222', padding: { x: 10, y: 4 },
    }).setOrigin(0.5).setDepth(601).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => {
      this.closeGiftPanel();
      this.showGiftServerList();
    });
    items.push(backBtn);

    const sendGift = async (type, amount) => {
      statusText.setText('Sending...');
      try {
        const payload = { targetName: playerName, type, amount };
        console.log('Sending gift:', payload);
        const res = await fetch('/api/gifts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer admininside',
          },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          if (statusText.scene) statusText.setText('Sent!').setStyle({ fill: '#44ff88' });
        } else {
          const err = await res.json().catch(() => ({}));
          console.error('Gift failed:', err);
          if (statusText.scene) statusText.setText(err.error || 'Failed').setStyle({ fill: '#ff6644' });
        }
      } catch (e) {
        console.error('Gift network error:', e);
        if (statusText.scene) statusText.setText('Network error').setStyle({ fill: '#ff6644' });
      }
    };

    creditsBtn.on('pointerdown', () => sendGift('credits', 500));
    hpBtn.on('pointerdown', () => sendGift('hp', 3));
  }

  closeGiftPanel() {
    this.giftPanelItems.forEach(i => i.destroy());
    this.giftPanelItems = [];
    this.giftPanelOpen = false;
  }

  toggleServerPanel() {
    if (this.serverPanelOpen) {
      this.closeServerPanel();
      return;
    }
    this.showServerList();
  }

  async showServerList() {
    this.serverPanelOpen = true;
    const items = this.serverPanelItems;
    const W = GAME_CONFIG.width;

    // Panel background
    const bg = this.add.rectangle(W / 2, 200, 340, 280, 0x000011, 0.95)
      .setDepth(500).setInteractive();
    items.push(bg);

    const border = this.add.rectangle(W / 2, 200, 340, 280)
      .setStrokeStyle(1, 0x00ddff, 0.6).setDepth(500);
    items.push(border);

    const title = this.add.text(W / 2, 75, 'Active Servers', {
      fontSize: '16px', fill: '#00ddff', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(501);
    items.push(title);

    const loading = this.add.text(W / 2, 120, 'Loading...', {
      fontSize: '12px', fill: '#888888', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(501);
    items.push(loading);

    try {
      const res = await fetch('/api/players');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      if (!this.serverPanelOpen) return; // panel was closed while loading
      loading.destroy();
      items.splice(items.indexOf(loading), 1);

      if (!data.players || data.players.length === 0) {
        const none = this.add.text(W / 2, 140, 'No players online', {
          fontSize: '13px', fill: '#666666', fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(501);
        items.push(none);
      } else {
        // Group players by server name
        const servers = {};
        for (const p of data.players) {
          const sn = p.serverName || 'Unknown';
          if (!servers[sn]) servers[sn] = [];
          servers[sn].push(p.name);
        }

        let y = 100;
        for (const [serverName, playerNames] of Object.entries(servers)) {
          const serverLabel = this.add.text(W / 2 - 150, y, `[${serverName}]`, {
            fontSize: '14px', fill: '#00ddff', fontFamily: 'monospace',
          }).setDepth(501);
          items.push(serverLabel);
          y += 20;

          for (const pName of playerNames) {
            const playerLabel = this.add.text(W / 2 - 130, y, pName, {
              fontSize: '12px', fill: '#aaaaaa', fontFamily: 'monospace',
            }).setDepth(501);
            items.push(playerLabel);
            y += 18;
          }
          y += 6;
        }
      }
    } catch {
      loading.setText('Error loading servers');
      loading.setFill('#ff4444');
    }

    // Close button
    const closeBtn = this.add.text(W / 2, 325, 'Close', {
      fontSize: '13px', fill: '#ffffff', fontFamily: 'monospace',
      backgroundColor: '#333344', padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setDepth(501).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.closeServerPanel());
    items.push(closeBtn);
  }

  closeServerPanel() {
    this.serverPanelItems.forEach(i => { if (i && i.scene) i.destroy(); });
    this.serverPanelItems = [];
    this.serverPanelOpen = false;
  }

  showCheatExtras() {
    this.stopWaveBtn.setVisible(true);
    this.skipWaveBtn.setVisible(true);
    this.autoClickerBtn.setVisible(true);
    this.ultimateBossBtn.setVisible(true);
    this.addCreditsBtn.setVisible(true);
    this.eventsBtn.setVisible(true);
    this.saveWaveBtn.setVisible(true);
    this.upgradeAllBtn.setVisible(true);
    this.giftBtn.setVisible(true);
    this.serversBtn.setVisible(true);
  }

  toggleEventsList() {
    if (this.eventsListOpen) {
      // Close the list
      this.eventsListItems.forEach(item => item.destroy());
      this.eventsListItems = [];
      this.eventsListOpen = false;
      return;
    }

    this.eventsListOpen = true;
    const x = GAME_CONFIG.width - 10;
    const startY = 38;
    const events = [
      { name: 'Meteor Storm', desc: '60s damage rain (stackable)', color: '#ffaa00', trigger: 'triggerMeteorStorm' },
      { name: 'Ion Pulse', desc: '60s slow 50% (stackable)', color: '#00ccff', trigger: 'triggerIonPulse' },
      { name: 'Solar Flare', desc: '50% HP to 1 enemy (stackable)', color: '#ffff44', trigger: 'triggerSolarFlare' },
      { name: 'Bomb Rain', desc: '60s bombs on track (stay till hit)', color: '#ff4400', trigger: 'triggerBombRain' },
    ];

    events.forEach((evt, i) => {
      const y = startY + i * 36;
      const title = this.add.text(x, y, evt.name, {
        fontSize: '12px',
        fill: evt.color,
        fontFamily: 'monospace',
        backgroundColor: '#111111',
        padding: { x: 4, y: 2 },
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(1, 0).setDepth(400).setInteractive({ useHandCursor: true });

      title.on('pointerdown', () => {
        if (this.gameScene[evt.trigger]) this.gameScene[evt.trigger]();
      });
      title.on('pointerover', () => title.setStyle({ fill: '#ffffff' }));
      title.on('pointerout', () => title.setStyle({ fill: evt.color }));

      const desc = this.add.text(x, y + 17, evt.desc, {
        fontSize: '10px',
        fill: '#aaaaaa',
        fontFamily: 'monospace',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(1, 0).setDepth(400);

      this.eventsListItems.push(title, desc);
    });
  }

  setupSecretCode() {
    const SECRET = 'inside';

    this._secretKeyHandler = (event) => {
      if (!event.key || event.key.length !== 1) return;
      this.konamiBuffer = (this.konamiBuffer + event.key.toLowerCase()).slice(-SECRET.length);
      if (this.konamiBuffer === SECRET && !this.ultraUnlocked) {
        this.ultraUnlocked = true;
        this.gameScene.cheatMode = true;
        GAME_CONFIG.turretCosts.ultraHamster = 0;
        const uhBtn = this.buttons.find(b => b.turretType === 'ultraHamster');
        if (uhBtn) {
          uhBtn.setVisible(true);
          uhBtn.setText('ULTRA\nHAMSTER\n(FREE)');
        }
        this.showCheatExtras();
        const W = GAME_CONFIG.width;
        const H = GAME_CONFIG.height;
        const flash = this.add.text(W / 2, H / 2, '👑 ULTRA HAMSTER UNLOCKED 👑', {
          fontSize: '22px',
          fill: '#ffdd00',
          fontFamily: 'monospace',
          stroke: '#000000',
          strokeThickness: 4,
        }).setOrigin(0.5).setDepth(200);
        this.tweens.add({
          targets: flash,
          alpha: 0,
          y: H / 2 - 60,
          duration: 2000,
          onComplete: () => flash.destroy(),
        });
      }
    };

    window.addEventListener('keydown', this._secretKeyHandler);

    // Clean up when scene shuts down
    this.events.on('shutdown', () => {
      window.removeEventListener('keydown', this._secretKeyHandler);
    });
  }

  openUpgradePanel(turret) {
    this.closeUpgradePanel();

    const PLANE_UPGRADES = [
      { label: 'Damage',    costs: [80, 160, 320], values: [null, null, null] },
      { label: 'Range',     costs: [80, 160, 320], values: [null, null, null] },
      { label: 'Fire Rate', costs: [80, 160, 320], values: [null, null, null] },
    ];
    const upgrades = turret.type === 'machineGun' ? UPGRADE_DEFS_MG
      : turret.type === 'attackPlane' ? PLANE_UPGRADES
      : UPGRADE_DEFS[turret.type];
    if (!upgrades) return;

    const panelW = 200;
    const panelH = 160;
    // Position panel above/below turret, clamped to screen
    let px = turret.x - panelW / 2;
    let py = turret.y - panelH - 30;
    if (py < 5) py = turret.y + 30;
    px = Math.max(5, Math.min(px, GAME_CONFIG.width - panelW - 5));

    const items = [];

    // Background
    const bg = this.add.graphics().setDepth(150);
    bg.fillStyle(0x001122, 0.92);
    bg.lineStyle(1, 0x00ffcc, 0.6);
    bg.fillRoundedRect(px, py, panelW, panelH, 6);
    bg.strokeRoundedRect(px, py, panelW, panelH, 6);
    items.push(bg);

    // Title
    const typeLabel = { laser: 'Laser', missile: 'Missile', forceField: 'Force Field', machineGun: 'M.Gun', attackPlane: 'Attack Plane', plasmaGun: 'Plasma', plasmaRailgun: 'Railgun' }[turret.type] || turret.type;
    const title = this.add.text(px + panelW / 2, py + 10, `${typeLabel} Upgrades`, {
      fontSize: '11px', fill: '#00ffcc', fontFamily: 'monospace',
    }).setOrigin(0.5, 0).setDepth(151);
    items.push(title);

    // 3 upgrade buttons
    upgrades.forEach((slot, i) => {
      const level = turret.upgradeLevels[i];
      const maxed = level >= slot.costs.length;
      const cost = maxed ? null : slot.costs[level];
      const canAfford = !maxed && this.gameScene.credits >= cost;

      const btnY = py + 28 + i * 32;
      const stars = '★'.repeat(level) + '☆'.repeat(slot.costs.length - level);
      const label = maxed
        ? `${slot.label} [MAX]`
        : `${slot.label} ${stars} (${cost}cr)`;

      const fillColor = maxed ? '#444444' : canAfford ? '#00ffcc' : '#886644';
      const bgColor = maxed ? '#111111' : canAfford ? '#003322' : '#221100';

      const btn = this.add.text(px + 8, btnY, label, {
        fontSize: '10px', fill: fillColor, fontFamily: 'monospace',
        backgroundColor: bgColor, padding: { x: 6, y: 4 },
      }).setDepth(151);

      if (!maxed) {
        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerdown', () => {
          if (this.gameScene.credits < cost) return;
          this.gameScene.credits -= cost;
          turret.applyUpgrade(i);
          // Reopen panel to refresh
          this.openUpgradePanel(turret);
        });
        btn.on('pointerover', () => btn.setStyle({ fill: '#ffffff' }));
        btn.on('pointerout', () => btn.setStyle({ fill: fillColor }));
      }

      items.push(btn);
    });

    // Sell button — refund 50% of base cost + upgrade costs
    const baseCost = GAME_CONFIG.turretCosts[turret.type] || 0;
    let upgradeCost = 0;
    upgrades.forEach((slot, i) => {
      for (let lvl = 0; lvl < turret.upgradeLevels[i]; lvl++) {
        upgradeCost += slot.costs[lvl];
      }
    });
    const sellPrice = Math.floor((baseCost + upgradeCost) * 0.5);

    const sellBtn = this.add.text(px + panelW / 2, py + panelH - 28, `Sell (${sellPrice}cr)`, {
      fontSize: '11px', fill: '#ff6666', fontFamily: 'monospace',
      backgroundColor: '#331111', padding: { x: 10, y: 4 },
    }).setOrigin(0.5).setDepth(151).setInteractive({ useHandCursor: true });

    sellBtn.on('pointerdown', () => {
      this.gameScene.credits += sellPrice;
      this.gameScene.sellTurret(turret);
      this.closeUpgradePanel();
    });
    sellBtn.on('pointerover', () => sellBtn.setStyle({ fill: '#ffffff' }));
    sellBtn.on('pointerout', () => sellBtn.setStyle({ fill: '#ff6666' }));
    items.push(sellBtn);

    // Close hint
    const hint = this.add.text(px + panelW / 2, py + panelH - 8, 'Click elsewhere to close', {
      fontSize: '9px', fill: '#446655', fontFamily: 'monospace',
    }).setOrigin(0.5, 1).setDepth(151);
    items.push(hint);

    this.upgradePanel = { items, turret };
  }

  closeUpgradePanel() {
    if (!this.upgradePanel) return;
    for (const item of this.upgradePanel.items) item.destroy();
    this.upgradePanel = null;
  }

  update() {
    if (this.gameScene) {
      this.creditsText.setText(`Credits: ${this.gameScene.credits}`);
      this.waveText.setText(`Wave: ${this.gameScene.currentWave}`);
      this.hpText.setText(`Base HP: ${this.gameScene.baseHP}`);
    }
  }
}
