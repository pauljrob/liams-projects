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
    this.creditsText = this.add.text(10, 10, `Credits: ${GAME_CONFIG.startingCredits}`, {
      fontSize: '18px',
      fill: '#ffdd00',
      fontFamily: 'monospace',
    }).setOrigin(0, 0);

    this.waveText = this.add.text(10, 35, `Wave: 1`, {
      fontSize: '18px',
      fill: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0, 0);

    this.hpText = this.add.text(10, 60, `Base HP: ${GAME_CONFIG.baseHitPoints}`, {
      fontSize: '18px',
      fill: '#ff4444',
      fontFamily: 'monospace',
    }).setOrigin(0, 0);

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
    const row2Y = GAME_CONFIG.height - 4;     // bottom row (originY=1)
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
  }

  selectTurret(type, btn) {
    // Deselect previous button
    if (this.activeBtn) {
      this.activeBtn.setStyle({ fill: '#00ffcc', backgroundColor: '#003333' });
    }
    this.activeBtn = btn;
    btn.setStyle({ fill: '#000000', backgroundColor: '#00ffcc' });
    this.gameScene.selectTurretType(type);

    if (!this.hintText) {
      this.hintText = this.add.text(GAME_CONFIG.width / 2, GAME_CONFIG.height - 75,
        'Click to place  |  ESC or right-click to cancel', {
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

    // Dim background box
    const bg = this.add.rectangle(GAME_CONFIG.width / 2, GAME_CONFIG.height / 2, 320, 100, 0x000000, 0.85)
      .setDepth(199);

    const prompt = this.add.text(GAME_CONFIG.width / 2, GAME_CONFIG.height / 2 - 24,
      '🔐 Enter secret code:', {
        fontSize: '14px',
        fill: '#aaaaaa',
        fontFamily: 'monospace',
      }).setOrigin(0.5).setDepth(200);

    const typed = this.add.text(GAME_CONFIG.width / 2, GAME_CONFIG.height / 2 + 4,
      '|', {
        fontSize: '18px',
        fill: '#ffdd00',
        fontFamily: 'monospace',
        backgroundColor: '#111111',
        padding: { x: 12, y: 6 },
      }).setOrigin(0.5).setDepth(200);

    const hint = this.add.text(GAME_CONFIG.width / 2, GAME_CONFIG.height / 2 + 34,
      'Press Enter to submit  |  Esc to cancel', {
        fontSize: '10px',
        fill: '#666666',
        fontFamily: 'monospace',
      }).setOrigin(0.5).setDepth(200);

    this.codeInputTyped = '';
    this.codeInput = { bg, prompt, typed, hint };

    const updateDisplay = () => {
      typed.setText((this.codeInputTyped || '') + '|');
    };

    const SECRET = 'inside';

    const keyHandler = (event) => {
      if (!this.codeInput) return;

      if (event.key === 'Escape') {
        closeInput();
        return;
      }

      if (event.key === 'Enter') {
        const guess = this.codeInputTyped.toLowerCase().trim();
        closeInput();
        if (guess === SECRET && !this.ultraUnlocked) {
          this.ultraUnlocked = true;
          const uhBtn = this.buttons.find(b => b.turretType === 'ultraHamster');
          if (uhBtn) {
            uhBtn.setVisible(true);
            uhBtn.setText('ULTRA HAMSTER (FREE)');
          }
          GAME_CONFIG.turretCosts.ultraHamster = 0;
          this.showCheatExtras();
          const flash = this.add.text(GAME_CONFIG.width / 2, GAME_CONFIG.height / 2, '👑 ULTRA HAMSTER UNLOCKED 👑', {
            fontSize: '22px',
            fill: '#ffdd00',
            fontFamily: 'monospace',
            stroke: '#000000',
            strokeThickness: 4,
          }).setOrigin(0.5).setDepth(200);
          this.tweens.add({
            targets: flash,
            alpha: 0,
            y: GAME_CONFIG.height / 2 - 60,
            duration: 2000,
            onComplete: () => flash.destroy(),
          });
        } else if (guess !== SECRET) {
          const wrong = this.add.text(GAME_CONFIG.width / 2, GAME_CONFIG.height / 2,
            '❌ Unknown code', {
              fontSize: '16px',
              fill: '#ff4444',
              fontFamily: 'monospace',
              stroke: '#000000',
              strokeThickness: 3,
            }).setOrigin(0.5).setDepth(200);
          this.tweens.add({
            targets: wrong,
            alpha: 0,
            y: GAME_CONFIG.height / 2 - 40,
            duration: 1200,
            onComplete: () => wrong.destroy(),
          });
        }
        return;
      }

      if (event.key === 'Backspace') {
        this.codeInputTyped = this.codeInputTyped.slice(0, -1);
      } else if (event.key.length === 1) {
        this.codeInputTyped += event.key;
      }

      updateDisplay();
    };

    const closeInput = () => {
      if (!this.codeInput) return;
      bg.destroy();
      prompt.destroy();
      typed.destroy();
      hint.destroy();
      this.codeInput = null;
      window.removeEventListener('keydown', keyHandler, true);
    };

    // Use capture phase so this takes priority over the background listener
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
      .on('pointerdown', () => this.gameScene.fastForwardWave())
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

  toggleAutoClicker() {
    this.autoClickerOn = !this.autoClickerOn;
    if (this.autoClickerOn) {
      this.autoClickerBtn.setText('🤖 Auto: ON');
      this.autoClickerBtn.setStyle({ fill: '#00ff88', backgroundColor: '#003322' });
      // Skip wave as fast as possible (~every frame)
      this.autoClickerInterval = this.time.addEvent({
        delay: 1,
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

  showCheatExtras() {
    this.stopWaveBtn.setVisible(true);
    this.skipWaveBtn.setVisible(true);
    this.autoClickerBtn.setVisible(true);
    this.ultimateBossBtn.setVisible(true);
    this.addCreditsBtn.setVisible(true);
  }

  setupSecretCode() {
    const SECRET = 'inside';

    this._secretKeyHandler = (event) => {
      if (!event.key || event.key.length !== 1) return;
      this.konamiBuffer = (this.konamiBuffer + event.key.toLowerCase()).slice(-SECRET.length);
      if (this.konamiBuffer === SECRET && !this.ultraUnlocked) {
        this.ultraUnlocked = true;
        GAME_CONFIG.turretCosts.ultraHamster = 0;
        const uhBtn = this.buttons.find(b => b.turretType === 'ultraHamster');
        if (uhBtn) {
          uhBtn.setVisible(true);
          uhBtn.setText('ULTRA\nHAMSTER\n(FREE)');
        }
        this.showCheatExtras();
        const flash = this.add.text(GAME_CONFIG.width / 2, GAME_CONFIG.height / 2, '👑 ULTRA HAMSTER UNLOCKED 👑', {
          fontSize: '22px',
          fill: '#ffdd00',
          fontFamily: 'monospace',
          stroke: '#000000',
          strokeThickness: 4,
        }).setOrigin(0.5).setDepth(200);
        this.tweens.add({
          targets: flash,
          alpha: 0,
          y: GAME_CONFIG.height / 2 - 60,
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
    const panelH = 130;
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

    // Close hint
    const hint = this.add.text(px + panelW / 2, py + panelH - 10, 'Click elsewhere to close', {
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
