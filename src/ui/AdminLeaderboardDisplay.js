/**
 * Admin leaderboard display with delete buttons per entry.
 * Used by the admin panel in UIScene to manage leaderboard entries.
 */
export default class AdminLeaderboardDisplay {
  constructor(scene, x, y, options = {}) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.limit = options.limit || 15;
    this.password = options.password || '';
    this.depth = options.depth || 200;
    this.elements = [];
    this.deleting = false;
  }

  async show() {
    this.clear();

    const loadingText = this.scene.add.text(this.x, this.y + 20, 'Loading leaderboard...', {
      fontSize: '14px', fill: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(this.depth);
    this.elements.push(loadingText);

    try {
      const response = await fetch(`/api/leaderboard?limit=${this.limit}`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      loadingText.destroy();
      this.elements = this.elements.filter(e => e !== loadingText);
      this.renderEntries(data.entries);
    } catch (err) {
      loadingText.setText('Could not load leaderboard');
      loadingText.setFill('#ff6666');
    }
  }

  renderEntries(entries) {
    const headerY = this.y;
    const startY = this.y + 24;
    const lineHeight = 22;

    const header = this.scene.add.text(this.x, headerY, '--- ADMIN LEADERBOARD ---', {
      fontSize: '16px', fill: '#ff6644', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(this.depth);
    this.elements.push(header);

    if (entries.length === 0) {
      const noEntries = this.scene.add.text(this.x, startY + 10, 'No entries', {
        fontSize: '13px', fill: '#888888', fontFamily: 'monospace',
      }).setOrigin(0.5).setDepth(this.depth);
      this.elements.push(noEntries);
      return;
    }

    // Column header
    const colHeader = this.scene.add.text(this.x - 15, startY,
      '#    Name             Wave  Kills  Time', {
      fontSize: '11px', fill: '#666688', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(this.depth);
    this.elements.push(colHeader);

    entries.forEach((entry, i) => {
      const rank = entry.rank.toString().padStart(2, ' ');
      const name = entry.name.padEnd(16, ' ').slice(0, 16);
      const wave = entry.wave.toString().padStart(4, ' ');
      const kills = entry.kills.toString().padStart(5, ' ');
      const totalSec = Math.floor(entry.timeSurvivedMs / 1000);
      const min = Math.floor(totalSec / 60);
      const sec = (totalSec % 60).toString().padStart(2, '0');
      const time = `${min}:${sec}`.padStart(5, ' ');

      const line = `${rank}   ${name} ${wave}  ${kills}  ${time}`;
      const rowY = startY + (i + 1) * lineHeight;

      const text = this.scene.add.text(this.x - 15, rowY, line, {
        fontSize: '12px', fill: '#cccccc', fontFamily: 'monospace',
      }).setOrigin(0.5).setDepth(this.depth);
      this.elements.push(text);

      // Delete [X] button
      const delBtn = this.scene.add.text(this.x + 200, rowY, '[X]', {
        fontSize: '11px', fill: '#ff4444', fontFamily: 'monospace',
        backgroundColor: '#330000', padding: { x: 4, y: 2 },
      }).setOrigin(0.5).setDepth(this.depth)
        .setInteractive({ useHandCursor: true });

      delBtn.on('pointerover', () => delBtn.setStyle({ fill: '#ffffff' }));
      delBtn.on('pointerout', () => delBtn.setStyle({ fill: '#ff4444' }));
      delBtn.on('pointerdown', () => this.deleteEntry(entry.id, entry.name));

      this.elements.push(delBtn);
    });
  }

  async deleteEntry(entryId, entryName) {
    if (this.deleting) return;
    this.deleting = true;

    try {
      const response = await fetch('/api/leaderboard', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.password}`,
        },
        body: JSON.stringify({ entryId }),
      });

      if (response.ok) {
        await this.show();
      } else {
        const err = await response.json().catch(() => ({}));
        const msg = this.scene.add.text(this.x, this.y - 20,
          `Error: ${err.error || 'Delete failed'}`, {
          fontSize: '12px', fill: '#ff4444', fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(this.depth + 1);
        this.elements.push(msg);
        this.scene.time.delayedCall(2000, () => msg.destroy());
      }
    } catch (err) {
      const msg = this.scene.add.text(this.x, this.y - 20, 'Network error', {
        fontSize: '12px', fill: '#ff4444', fontFamily: 'monospace',
      }).setOrigin(0.5).setDepth(this.depth + 1);
      this.elements.push(msg);
      this.scene.time.delayedCall(2000, () => msg.destroy());
    }

    this.deleting = false;
  }

  clear() {
    this.elements.forEach(el => el.destroy());
    this.elements = [];
  }
}
