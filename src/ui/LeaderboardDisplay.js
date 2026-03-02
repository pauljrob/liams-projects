/**
 * Shared leaderboard display component for Phaser scenes.
 * Fetches and renders a ranked table of top scores.
 */
export default class LeaderboardDisplay {
  /**
   * @param {Phaser.Scene} scene - The Phaser scene to render into
   * @param {number} x - Center X position
   * @param {number} y - Top Y position for the leaderboard
   * @param {object} [options]
   * @param {number} [options.limit=10] - Number of entries to show
   * @param {string} [options.highlightName] - Player name to highlight
   * @param {number} [options.highlightRank] - Player rank to highlight
   */
  constructor(scene, x, y, options = {}) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.limit = options.limit || 10;
    this.highlightName = options.highlightName || null;
    this.highlightRank = options.highlightRank || null;
    this.elements = [];
  }

  async show() {
    this.clear();

    // Loading text
    const loadingText = this.scene.add.text(this.x, this.y + 20, 'Loading leaderboard...', {
      fontSize: '14px',
      fill: '#aaaaaa',
      fontFamily: 'monospace',
    }).setOrigin(0.5);
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

    // Header
    const header = this.scene.add.text(this.x, headerY, '--- LEADERBOARD ---', {
      fontSize: '16px',
      fill: '#00ccff',
      fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.elements.push(header);

    if (entries.length === 0) {
      const noEntries = this.scene.add.text(this.x, startY + 10, 'No scores yet. Be the first!', {
        fontSize: '13px',
        fill: '#888888',
        fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.elements.push(noEntries);
      return;
    }

    // Column header
    const colHeader = this.scene.add.text(this.x, startY, '#    Name             Wave  Kills  Time', {
      fontSize: '11px',
      fill: '#666688',
      fontFamily: 'monospace',
    }).setOrigin(0.5);
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

      // Highlight current player
      const isHighlighted = (this.highlightRank && entry.rank === this.highlightRank) ||
        (this.highlightName && entry.name === this.highlightName);

      const text = this.scene.add.text(this.x, startY + (i + 1) * lineHeight, line, {
        fontSize: '12px',
        fill: isHighlighted ? '#ffdd44' : '#cccccc',
        fontFamily: 'monospace',
        fontStyle: isHighlighted ? 'bold' : 'normal',
      }).setOrigin(0.5);
      this.elements.push(text);
    });
  }

  clear() {
    this.elements.forEach(el => el.destroy());
    this.elements = [];
  }
}
