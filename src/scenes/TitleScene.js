import LeaderboardDisplay from '../ui/LeaderboardDisplay.js';
import AdminLeaderboardDisplay from '../ui/AdminLeaderboardDisplay.js';

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.leaderboardOpen = false;
    this.adminOpen = false;

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
    const startText = this.add.text(W / 2, H * 0.73, 'Tap / Click to Start', {
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

    // Leaderboard button
    const lbBtn = this.add.text(W / 2, H * 0.84, 'Leaderboard', {
      fontSize: '16px',
      fill: '#00ccff',
      fontFamily: 'monospace',
      backgroundColor: '#112233',
      padding: { x: 14, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    lbBtn.on('pointerover', () => lbBtn.setFill('#44eeff'));
    lbBtn.on('pointerout', () => lbBtn.setFill('#00ccff'));
    lbBtn.on('pointerdown', () => {
      if (!this.leaderboardOpen && !this.adminOpen) this.openLeaderboard();
    });

    // Admin button
    const adminBtn = this.add.text(W / 2, H * 0.91, 'Admin', {
      fontSize: '16px',
      fill: '#00ccff',
      fontFamily: 'monospace',
      backgroundColor: '#112233',
      padding: { x: 14, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    adminBtn.on('pointerover', () => adminBtn.setFill('#44eeff'));
    adminBtn.on('pointerout', () => adminBtn.setFill('#00ccff'));
    adminBtn.on('pointerdown', () => {
      if (!this.leaderboardOpen && !this.adminOpen) this.openAdminPasswordInput();
    });

    // Version / credits line
    this.add.text(W / 2, H - 18, 'v0.1  •  Built with Phaser 3', {
      fontSize: '11px',
      fill: '#445566',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Start on click/tap (only when overlays are closed)
    this.input.on('pointerdown', (pointer) => {
      if (this.leaderboardOpen || this.adminOpen) return;
      // Don't start game if clicking button areas
      const lbBounds = lbBtn.getBounds();
      if (lbBounds.contains(pointer.x, pointer.y)) return;
      const adminBounds = adminBtn.getBounds();
      if (adminBounds.contains(pointer.x, pointer.y)) return;

      this.input.removeAllListeners('pointerdown');
      this.cameras.main.fadeOut(300, 0, 0, 16);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('GameScene');
      });
    });
  }

  openLeaderboard() {
    this.leaderboardOpen = true;
    const W = this.scale.width;
    const H = this.scale.height;
    this.lbOverlayElements = [];

    // Dim overlay
    const bg = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.88)
      .setDepth(100).setInteractive(); // blocks clicks through
    this.lbOverlayElements.push(bg);

    // Title
    const title = this.add.text(W / 2, 30, 'TOP SCORES', {
      fontSize: '24px',
      fill: '#00ccff',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(101);
    this.lbOverlayElements.push(title);

    // Leaderboard display
    this.lbDisplay = new LeaderboardDisplay(this, W / 2, 60, { limit: 15 });
    this.lbDisplay.show().then(() => {
      // Set depth on all leaderboard elements
      this.lbDisplay.elements.forEach(el => el.setDepth(101));
    });

    // Close button
    const closeBtn = this.add.text(W / 2, H - 40, 'Close', {
      fontSize: '16px',
      fill: '#ffffff',
      fontFamily: 'monospace',
      backgroundColor: '#333344',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor: true });

    closeBtn.on('pointerdown', () => this.closeLeaderboard());
    this.lbOverlayElements.push(closeBtn);
  }

  closeLeaderboard() {
    this.leaderboardOpen = false;
    if (this.lbDisplay) {
      this.lbDisplay.clear();
      this.lbDisplay = null;
    }
    for (const el of this.lbOverlayElements) el.destroy();
    this.lbOverlayElements = [];
  }

  openAdminPasswordInput() {
    this.adminOpen = true;
    const W = this.scale.width;
    const H = this.scale.height;
    const elements = [];

    // Dim background
    const bg = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.85)
      .setDepth(100).setInteractive();
    elements.push(bg);

    const prompt = this.add.text(W / 2, 60, 'Enter admin password:', {
      fontSize: '16px', fill: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(101);
    elements.push(prompt);

    const typed = this.add.text(W / 2, 100, '|', {
      fontSize: '22px', fill: '#ffdd00', fontFamily: 'monospace',
      backgroundColor: '#111111', padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setDepth(101);
    elements.push(typed);

    let passwordText = '';

    const updateDisplay = () => {
      typed.setText('*'.repeat(passwordText.length) + '|');
    };

    const submit = async () => {
      const pw = passwordText.trim();
      if (!pw) return;
      // Validate password by attempting a delete with a dummy ID
      try {
        const res = await fetch('/api/leaderboard', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${pw}`,
          },
          body: JSON.stringify({ entryId: 'entry:validate-check' }),
        });
        // 401 = wrong password, 404 = correct password (entry not found)
        if (res.status === 401) {
          passwordText = '';
          updateDisplay();
          const err = this.add.text(W / 2, 40, 'Wrong password', {
            fontSize: '14px', fill: '#ff4444', fontFamily: 'monospace',
          }).setOrigin(0.5).setDepth(102);
          elements.push(err);
          this.time.delayedCall(2000, () => err.destroy());
          return;
        }
      } catch (e) {
        // Network error — let them try anyway
      }
      closeInput();
      this.openAdminPanel(pw);
    };

    const typeLetter = (letter) => {
      passwordText += letter;
      updateDisplay();
    };

    const backspace = () => {
      passwordText = passwordText.slice(0, -1);
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
          .setDepth(101).setInteractive({ useHandCursor: true });
        const keyTxt = this.add.text(x, y, letter, {
          fontSize: '16px', fill: '#ffffff', fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(102);

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

    const delBtn = this.add.text(W / 2 - 130, btnY, 'Delete', {
      ...btnStyle, backgroundColor: '#663333',
    }).setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor: true });
    delBtn.on('pointerdown', backspace);
    elements.push(delBtn);

    const submitBtn = this.add.text(W / 2, btnY, 'Submit', {
      ...btnStyle, backgroundColor: '#336633',
    }).setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor: true });
    submitBtn.on('pointerdown', submit);
    elements.push(submitBtn);

    const cancelBtn = this.add.text(W / 2 + 130, btnY, 'Cancel', {
      ...btnStyle, backgroundColor: '#333333',
    }).setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor: true });
    cancelBtn.on('pointerdown', () => closeInput());
    elements.push(cancelBtn);

    // Physical keyboard support
    const keyHandler = (event) => {
      if (event.key === 'Escape') { closeInput(); return; }
      if (event.key === 'Enter') { submit(); return; }
      if (event.key === 'Backspace') { backspace(); return; }
      if (event.key.length === 1) { typeLetter(event.key); }
    };

    const closeInput = () => {
      window.removeEventListener('keydown', keyHandler);
      for (const el of elements) el.destroy();
      if (!this.adminDisplay) this.adminOpen = false;
    };

    window.addEventListener('keydown', keyHandler);
    this.adminPasswordElements = elements;
    this.adminPasswordCleanup = closeInput;
  }

  openAdminPanel(password) {
    this.adminOpen = true;
    const W = this.scale.width;
    const H = this.scale.height;
    this.adminOverlayElements = [];

    // Dim overlay
    const bg = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.88)
      .setDepth(100).setInteractive();
    this.adminOverlayElements.push(bg);

    // Admin leaderboard display
    this.adminDisplay = new AdminLeaderboardDisplay(this, W / 2, 40, {
      limit: 20, password, depth: 101,
    });
    this.adminDisplay.show();

    // Close button
    const closeBtn = this.add.text(W / 2, H - 40, 'Close', {
      fontSize: '16px',
      fill: '#ffffff',
      fontFamily: 'monospace',
      backgroundColor: '#333344',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor: true });

    closeBtn.on('pointerdown', () => this.closeAdminPanel());
    this.adminOverlayElements.push(closeBtn);
  }

  closeAdminPanel() {
    this.adminOpen = false;
    if (this.adminDisplay) {
      this.adminDisplay.clear();
      this.adminDisplay = null;
    }
    for (const el of this.adminOverlayElements || []) el.destroy();
    this.adminOverlayElements = [];
  }
}
