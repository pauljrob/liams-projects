import { GAME_CONFIG, WAVE_CONFIG } from '../config/gameConfig.js';
import Enemy from '../entities/Enemy.js';
import Turret from '../entities/Turret.js';
import MachineGun from '../entities/MachineGun.js';
import Bomb from '../entities/Bomb.js';
import Hamster from '../entities/Hamster.js';
import UltraHamster from '../entities/UltraHamster.js';
import AttackPlane from '../entities/AttackPlane.js';
import { playBaseHit, playTurretDamage, playShieldHit, playShieldDestroyed, playWaveStart, playTurretPlace } from '../audio/SoundManager.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  init(data) {
    this.cheatMode = data && data.cheatMode ? true : false;
    this.difficulty = (data && data.difficulty) || 'normal';
  }

  create() {
    // Difficulty modifiers
    const DIFFICULTY_MODS = {
      easy:   { credits: 1000, baseHP: 5, hpMul: 0.7, speedMul: 0.85, countMul: 0.7, rewardMul: 1.5 },
      normal: { credits: 750,  baseHP: 3, hpMul: 1.0, speedMul: 1.0,  countMul: 1.0, rewardMul: 1.0 },
      hard:   { credits: 500,  baseHP: 2, hpMul: 1.4, speedMul: 1.15, countMul: 1.3, rewardMul: 0.7 },
    };
    this.diffMod = DIFFICULTY_MODS[this.difficulty] || DIFFICULTY_MODS.normal;

    this.credits = this.diffMod.credits;
    this.baseHP = this.diffMod.baseHP;
    this.currentWave = 0;
    this.turrets = [];
    this.bombs = [];
    this.hamsters = [];
    this.ultraHamsters = [];
    this.attackPlanes = [];
    this.enemies = [];
    this.orphanedShots = []; // in-flight enemy shots that outlive their shooter
    this.waveActive = false;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.pendingMothership = null;
    this.mothershipSpawning = false;
    this.timeScale = 1;
    this.spawnInterval = this.randomSpawnInterval(); // randomized ms between each enemy spawn

    // Leaderboard stats
    this.totalKills = 0;
    this.totalCreditsEarned = 0;
    this.gameStartTime = Date.now();

    // Random events
    this.eventTimer = 0;
    this.eventInterval = Phaser.Math.Between(60000, 300000); // 1-5 minutes
    this.ionPulseActive = false;

    this.selectedTurretType = null;
    this.placementPreview = null;

    this.createBackground();
    this.createPath();
    this.createBase();
    this.setupPlacementInput();

    // Launch UI scene on top
    this.scene.launch('UIScene', { gameScene: this, cheatMode: this.cheatMode });

    // Listen for enemy attack events
    this.events.on('mothershipHitBase', () => this.damageBase());
    this.events.on('mothershipHitTurret', (turret) => this.damageTurret(turret, 2));
    this.events.on('bossHitTurret', (turret) => this.damageTurret(turret, 4)); // one-shots turrets
    this.events.on('babyShipHitTurret', (turret) => this.damageTurret(turret, WAVE_CONFIG.babyFireDamage));
    this.events.on('forceFieldBlocked', (turret) => { playShieldHit(); turret.damageShield(); });
    this.events.on('forceFieldDestroyed', (turret) => { playShieldDestroyed(); this.destroyTurret(turret); });

    // EMP — disable a turret for 3 seconds
    this.events.on('empHitTurret', (turret) => {
      if (!turret || turret.destroyed || turret.empStunned) return;
      turret.empStunned = true;
      // Visual flash
      const flash = this.add.graphics();
      flash.fillStyle(0xaa44ff, 0.7);
      flash.fillCircle(turret.x, turret.cy !== undefined ? turret.cy : turret.y, 30);
      this.tweens.add({
        targets: flash, alpha: 0, scaleX: 2, scaleY: 2, duration: 400,
        onComplete: () => flash.destroy(),
      });
      this.time.delayedCall(3000, () => { if (turret) turret.empStunned = false; });
    });

    // Carrier releases 3 baby ships at half HP
    this.events.on('carrierRelease', (carrier) => {
      for (let i = 0; i < 3; i++) {
        this.time.delayedCall(i * 300, () => {
          if (carrier.dead || carrier.reachedBase) return;
          const baby = new Enemy(this, this.enemyPath, {
            type: 'babyShip',
            hp: WAVE_CONFIG.babyShipHealth(this.currentWave),
            speed: WAVE_CONFIG.babyShipSpeed(this.currentWave) * 1.2,
            reward: GAME_CONFIG.rewards.babyShip,
            fireRate: WAVE_CONFIG.babyFireRate,
            fireRange: WAVE_CONFIG.babyFireRange,
          });
          // Start the baby at the carrier's current path position
          baby.t = carrier.t;
          this.enemies.push(baby);
        });
      }
    });

    // Splitter spawns 2 mini ships at its path position on death
    this.events.on('splitterDied', (splitter) => {
      for (let i = 0; i < 2; i++) {
        const mini = new Enemy(this, this.enemyPath, {
          type: 'miniSplitter',
          hp: 15,
          speed: splitter.speed * 1.4,
          reward: 5,
          fireRate: 99999, // doesn't fire
          fireRange: 0,
          isMiniSplitter: true,
        });
        mini.t = splitter.t;
        this.enemies.push(mini);
      }
    });

    // Opening message
    const W = this.scale.width;
    const H = this.scale.height;
    const openingText = this.add.text(W / 2, H / 2, 'Try to survive as many waves as you can!', {
      fontSize: '24px',
      fill: '#00ccff',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
    }).setOrigin(0.5).setDepth(300).setAlpha(0);

    // Fade in, hold, fade out, then start first wave
    this.tweens.add({
      targets: openingText,
      alpha: 1,
      duration: 600,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.time.delayedCall(2000, () => {
          this.tweens.add({
            targets: openingText,
            alpha: 0,
            duration: 600,
            ease: 'Sine.easeOut',
            onComplete: () => {
              openingText.destroy();
              this.startNextWave();
            },
          });
        });
      },
    });
  }

  createBackground() {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x000010, 1);
    graphics.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);

    // Star field — two layers for depth
    for (let i = 0; i < 200; i++) {
      const x = Phaser.Math.Between(0, GAME_CONFIG.width);
      const y = Phaser.Math.Between(0, GAME_CONFIG.height);
      const size = Phaser.Math.FloatBetween(0.3, 1.5);
      const alpha = Phaser.Math.FloatBetween(0.2, 1);
      graphics.fillStyle(0xffffff, alpha);
      graphics.fillCircle(x, y, size);
    }

    // A couple of distant nebula blobs
    graphics.fillStyle(0x220044, 0.3);
    graphics.fillEllipse(200, 120, 180, 80);
    graphics.fillStyle(0x002244, 0.3);
    graphics.fillEllipse(600, 450, 200, 100);
  }

  createPath() {
    const W = GAME_CONFIG.width;
    const H = GAME_CONFIG.height;

    // Winding path across the screen — enemies enter left, exit right
    this.enemyPath = new Phaser.Curves.Path(-30, H * 0.5);
    this.enemyPath.lineTo(W * 0.15, H * 0.5);
    this.enemyPath.lineTo(W * 0.25, H * 0.2);
    this.enemyPath.lineTo(W * 0.45, H * 0.2);
    this.enemyPath.lineTo(W * 0.55, H * 0.75);
    this.enemyPath.lineTo(W * 0.75, H * 0.75);
    this.enemyPath.lineTo(W * 0.85, H * 0.4);
    this.enemyPath.lineTo(W + 30, H * 0.4);

    // Draw the path as a visible track
    const pathGraphics = this.add.graphics();

    // Track border (darker)
    pathGraphics.lineStyle(22, 0x1a1a3a, 1);
    this.enemyPath.draw(pathGraphics, 64);

    // Track centre (subtle grid-like lane)
    pathGraphics.lineStyle(14, 0x0d0d2a, 1);
    this.enemyPath.draw(pathGraphics, 64);

    // Track edge highlight
    pathGraphics.lineStyle(2, 0x334466, 0.6);
    this.enemyPath.draw(pathGraphics, 64);
  }

  createBase() {
    const baseX = GAME_CONFIG.width - 30;
    const baseY = GAME_CONFIG.height * 0.4;

    const g = this.add.graphics();

    // Base structure
    g.fillStyle(0x0055cc, 1);
    g.fillRect(baseX - 18, baseY - 28, 36, 56);

    // Accent / windows
    g.fillStyle(0x00ccff, 1);
    g.fillRect(baseX - 8, baseY - 18, 16, 10);
    g.fillRect(baseX - 8, baseY + 4,  16, 10);

    // Antenna
    g.lineStyle(2, 0x00ccff, 1);
    g.lineBetween(baseX, baseY - 28, baseX, baseY - 42);
    g.fillStyle(0x00ffff, 1);
    g.fillCircle(baseX, baseY - 44, 4);

    this.baseGraphic = g;
    this.baseX = baseX;
    this.baseY = baseY;
  }

  setupPlacementInput() {
    // Preview ghost follows the pointer
    this.input.on('pointermove', (pointer) => {
      if (!this.selectedTurretType) return;
      this.updatePreview(pointer.x, pointer.y);
    });

    this.input.on('pointerdown', (pointer) => {
      if (pointer.y > GAME_CONFIG.height - 70) return;
      if (this.selectedTurretType) {
        this.placeTurret(pointer.x, pointer.y);
        return;
      }
      // Check if clicking on a placed turret or plane to open upgrade panel
      const clicked = [...this.turrets, ...this.attackPlanes].find(t => {
        if (t.destroyed) return false;
        // For attack planes, click the centre of the orbit, not the moving plane
        const cx = t.cx !== undefined ? t.cx : t.x;
        const cy = t.cy !== undefined ? t.cy : t.y;
        const radius = t.cx !== undefined ? 30 : 22;
        const dx = pointer.x - cx;
        const dy = pointer.y - cy;
        return Math.sqrt(dx * dx + dy * dy) < radius;
      });
      if (clicked) {
        this.events.emit('turretClicked', clicked);
      } else {
        this.events.emit('turretClicked', null);
      }
    });
  }

  selectTurretType(type) {
    this.selectedTurretType = type;
    if (!this.placementPreview) {
      this.placementPreview = this.add.graphics();
    }
  }

  cancelPlacement() {
    this.selectedTurretType = null;
    if (this.placementPreview) {
      this.placementPreview.clear();
    }
    this.events.emit('placementCancelled');
  }

  updatePreview(x, y) {
    if (!this.placementPreview) return;
    this.placementPreview.clear();

    const type = this.selectedTurretType;
    const valid = this.isValidPlacement(x, y, type);
    const color = valid ? (type === 'bomb' ? 0xff6600 : 0x00ffcc) : 0xff2222;
    this.placementPreview.lineStyle(2, color, 0.8);
    this.placementPreview.strokeCircle(x, y, type === 'bomb' ? 12 : 14);
    this.placementPreview.fillStyle(color, 0.25);
    this.placementPreview.fillCircle(x, y, type === 'bomb' ? 12 : 14);
  }

  isValidPlacement(x, y, type) {
    // Hamsters launch from path end — any click on the map is valid
    if (type === 'hamster' || type === 'ultraHamster') {
      if (x < 10 || x > GAME_CONFIG.width - 10 || y < 10 || y > GAME_CONFIG.height - 60) return false;
      return true;
    }

    const isBomb = type === 'bomb';

    if (isBomb) {
      // Bombs must be ON the path — within 20px of the path centre line
      let onPath = false;
      const pts = 80;
      for (let i = 0; i <= pts; i++) {
        const vec = new Phaser.Math.Vector2();
        this.enemyPath.getPoint(i / pts, vec);
        const dx = vec.x - x;
        const dy = vec.y - y;
        if (Math.sqrt(dx * dx + dy * dy) < 20) { onPath = true; break; }
      }
      if (!onPath) return false;
      // Must not overlap another bomb
      for (const b of this.bombs) {
        const dx = b.x - x;
        const dy = b.y - y;
        if (Math.sqrt(dx * dx + dy * dy) < 28) return false;
      }
    } else {
      // Turrets must not be on the path
      const pts = 80;
      for (let i = 0; i <= pts; i++) {
        const vec = new Phaser.Math.Vector2();
        this.enemyPath.getPoint(i / pts, vec);
        const dx = vec.x - x;
        const dy = vec.y - y;
        if (Math.sqrt(dx * dx + dy * dy) < 36) return false;
      }
      // Must not overlap another turret
      for (const t of this.turrets) {
        const dx = t.x - x;
        const dy = t.y - y;
        if (Math.sqrt(dx * dx + dy * dy) < 32) return false;
      }
    }

    // Must be within game bounds
    if (x < 10 || x > GAME_CONFIG.width - 10 || y < 10 || y > GAME_CONFIG.height - 60) return false;
    return true;
  }

  placeTurret(x, y) {
    const type = this.selectedTurretType;
    const cost = GAME_CONFIG.turretCosts[type];
    if (this.credits < cost) return;
    if (!this.isValidPlacement(x, y, type)) return;

    this.credits -= cost;

    if (type === 'bomb') {
      this.bombs.push(new Bomb(this, x, y));
    } else if (type === 'hamster') {
      this.hamsters.push(new Hamster(this, this.enemyPath));
    } else if (type === 'ultraHamster') {
      this.ultraHamsters.push(new UltraHamster(this, this.enemyPath));
    } else if (type === 'attackPlane') {
      this.attackPlanes.push(new AttackPlane(this, x, y));
    } else if (type === 'machineGun') {
      this.turrets.push(new MachineGun(this, x, y));
    } else {
      this.turrets.push(new Turret(this, x, y, type));
    }
    playTurretPlace();

    // Stay in placement mode — player can keep placing the same turret type
    // Cancel automatically if they can no longer afford it
    if (this.credits < cost) {
      this.cancelPlacement();
    }
  }

  randomSpawnInterval() {
    // Random gap between 200ms and 600ms
    return Phaser.Math.Between(200, 600);
  }

  startNextWave() {
    this.currentWave++;
    const isBossWave = this.currentWave % 10 === 0;

    this.showWaveAnnouncement(this.currentWave, isBossWave, () => {
      this.spawnQueue = [];

      const dm = this.diffMod;
      const babySpeed = WAVE_CONFIG.babyShipSpeed(this.currentWave) * dm.speedMul;
      const babyHP = Math.ceil(WAVE_CONFIG.babyShipHealth(this.currentWave) * dm.hpMul);
      const motherFireRate = WAVE_CONFIG.mothershipFireRate(this.currentWave);
      const motherFireRange = WAVE_CONFIG.mothershipFireRange;

      if (isBossWave) {
        // Boss wave — only the massive boss mothership, no regular enemies
        const bossHP = Math.ceil(WAVE_CONFIG.bossHealth(this.currentWave) * dm.hpMul);
        this.spawnQueue.push({
          type: 'mothership',
          hp: bossHP,
          fireRate: 3000, // exactly one shot every 3 seconds
          fireRange: motherFireRange,
          isBoss: true,
        });
      } else {
        // Normal wave — baby ships in clusters + mothership + special enemies
        const babyCount = Math.min(Math.ceil(WAVE_CONFIG.babyShipsPerWave(this.currentWave) * dm.countMul), 50);
        const motherHP = Math.ceil(WAVE_CONFIG.mothershipHealth(this.currentWave) * dm.hpMul);
        const wave = this.currentWave;
        // Cluster size scales with wave
        const clusterSize = Math.max(3, Math.floor(wave * 3));
        for (let i = 0; i < babyCount; i++) {
          const posInCluster = i % clusterSize;
          const delay = posInCluster === 0 && i > 0 ? 900 : 400;
          this.spawnQueue.push({ type: 'babyShip', speed: babySpeed, hp: babyHP, delay });
        }

        // Splitter — appears from wave 2, one per wave (more from wave 6)
        if (wave >= 2) {
          const splitterCount = wave >= 6 ? 2 : 1;
          for (let i = 0; i < splitterCount; i++) {
            this.spawnQueue.push({
              type: 'splitter', isSplitter: true,
              hp: Math.ceil((60 + wave * 15) * dm.hpMul), speed: babySpeed * 0.9,
              reward: Math.ceil(20 * dm.rewardMul), fireRate: 99999, fireRange: 0, delay: 800,
            });
          }
        }

        // Shield Bearer — appears from wave 3
        if (wave >= 3) {
          this.spawnQueue.push({
            type: 'shieldBearer',
            hp: Math.ceil((40 + wave * 10) * dm.hpMul), speed: babySpeed * 0.8,
            reward: Math.ceil(25 * dm.rewardMul), fireRate: WAVE_CONFIG.babyFireRate, fireRange: WAVE_CONFIG.babyFireRange,
            shieldHits: Math.min(1 + Math.floor(wave / 3), 4), delay: 900,
          });
        }

        // Carrier — appears from wave 4
        if (wave >= 4) {
          this.spawnQueue.push({
            type: 'carrier',
            hp: Math.ceil((120 + wave * 20) * dm.hpMul), speed: babySpeed * 0.6,
            reward: Math.ceil(40 * dm.rewardMul), fireRate: 99999, fireRange: 0, delay: 1000,
          });
        }

        // EMP Frigate — appears from wave 5
        if (wave >= 5) {
          this.spawnQueue.push({
            type: 'empFrigate', isEmp: true,
            hp: Math.ceil((50 + wave * 12) * dm.hpMul), speed: babySpeed * 0.85,
            reward: Math.ceil(30 * dm.rewardMul), fireRate: 2500, fireRange: 300, delay: 1000,
          });
        }

        // Mothership held back until all baby ships/specials are destroyed
        this.pendingMothership = { type: 'mothership', hp: motherHP, fireRate: motherFireRate, fireRange: motherFireRange };
      }

      playWaveStart(this.currentWave);
      this.waveActive = true;
      this.spawnTimer = 0;
    });
  }

  showWaveAnnouncement(_wave, _isBossWave, onComplete) {
    // No center-screen announcement — wave number shown in HUD
    onComplete();
  }

  spawnEnemy(config) {
    const hp = config.hp ?? (config.type === 'mothership' ? 200 : 20);
    const speed = config.speed ?? 0.025;
    const baseReward = config.isBoss
      ? GAME_CONFIG.rewards.mothership * 10
      : config.type === 'mothership'
        ? GAME_CONFIG.rewards.mothership
        : config.reward ?? GAME_CONFIG.rewards.babyShip;
    const reward = Math.ceil(baseReward * this.diffMod.rewardMul);

    const fireRate = config.fireRate ?? (config.type === 'babyShip' ? WAVE_CONFIG.babyFireRate : 3000);
    const fireRange = config.fireRange ?? (config.type === 'babyShip' ? WAVE_CONFIG.babyFireRange : 200);

    const enemy = new Enemy(this, this.enemyPath, {
      type: config.type,
      hp,
      speed,
      reward,
      fireRate,
      fireRange,
      isBoss: config.isBoss ?? false,
      isUltimateBoss: config.isUltimateBoss ?? false,
      isSplitter: config.isSplitter ?? false,
      isEmp: config.isEmp ?? false,
      shieldHits: config.shieldHits ?? 0,
    });

    this.enemies.push(enemy);
  }

  update(time, delta) {
    delta *= this.timeScale;

    // Spawn enemies from queue
    if (this.waveActive && this.spawnQueue.length > 0) {
      this.spawnTimer += delta;
      const nextDelay = this.spawnQueue[0].delay ?? this.randomSpawnInterval();
      if (this.spawnTimer >= nextDelay) {
        this.spawnTimer = 0;
        const next = this.spawnQueue.shift();
        this.spawnEnemy(next);
      }
    }

    // Spawn mothership once all baby ships/specials are cleared
    if (this.waveActive && this.pendingMothership && this.spawnQueue.length === 0 && this.enemies.length === 0) {
      const ms = this.pendingMothership;
      this.pendingMothership = null;
      this.mothershipSpawning = true;

      // "Mothership incoming!" warning
      const W = this.scale.width;
      const H = this.scale.height;
      const warn = this.add.text(W / 2, H / 2, 'MOTHERSHIP INCOMING!', {
        fontSize: '28px',
        fill: '#ff4444',
        fontFamily: 'monospace',
        stroke: '#000000',
        strokeThickness: 4,
      }).setOrigin(0.5).setDepth(300).setAlpha(0);

      this.tweens.add({
        targets: warn, alpha: 1, duration: 300, yoyo: true, hold: 1200,
        onComplete: () => {
          warn.destroy();
          this.spawnEnemy(ms);
          this.mothershipSpawning = false;
        },
      });
    }

    // Update all enemies (iterate snapshot so mid-loop removals don't cause index issues)
    for (const enemy of [...this.enemies]) {
      if (enemy.dead || enemy.reachedBase) continue;
      enemy.update(delta, this.turrets, this.baseX, this.baseY);
      // Apply ion pulse slow after normal update (slowMultiplier resets each frame)
      if (this.ionPulseActive) enemy.slowMultiplier = 0.5;
    }
    // Remove dead/arrived enemies after all updates
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (enemy.reachedBase) {
        this.enemies.splice(i, 1);
        this.damageBase();
        if (this.baseHP <= 0) return; // scene is transitioning to Game Over
      } else if (enemy.dead) {
        this.credits += enemy.reward;
        this.totalCreditsEarned += enemy.reward;
        this.totalKills++;
        this.enemies.splice(i, 1);
      }
    }

    // Update hamsters — roll along path and squash enemies
    for (let i = this.hamsters.length - 1; i >= 0; i--) {
      const done = this.hamsters[i].update(delta, this.enemies);
      if (done) this.hamsters.splice(i, 1);
    }

    // Update ultra hamsters — patrol forever
    for (const uh of this.ultraHamsters) {
      uh.update(delta, this.enemies);
    }

    // Update attack planes (respect EMP stun)
    for (const plane of this.attackPlanes) {
      if (!plane.empStunned) plane.update(delta, this.enemies);
    }

    // Update bombs — detonate when an enemy walks over them
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const bomb = this.bombs[i];
      const detonated = bomb.update(this.enemies);
      if (detonated) {
        this.bombs.splice(i, 1);
      }
    }

    // Update turrets (snapshot so destroyTurret mid-loop doesn't cause issues)
    for (const turret of [...this.turrets]) {
      if (turret.destroyed) continue;
      if (!turret.empStunned) turret.update(delta, this.enemies);
      turret.updateProjectiles(delta, this.enemies);
    }

    // Advance orphaned shots (fired by enemies that have since died)
    const dt = delta / 1000;
    for (let i = this.orphanedShots.length - 1; i >= 0; i--) {
      const p = this.orphanedShots[i];
      p.x += p.velX * dt;
      p.y += p.velY * dt;
      p.graphic.setPosition(p.x, p.y);

      // Check if the orphaned shot hits any turret
      let hit = false;
      for (const turret of this.turrets) {
        if (turret.destroyed) continue;
        // Force field blocks orphaned shots too
        if (turret.type === 'forceField' && turret.shieldHp > 0) {
          const fx = p.x - turret.x;
          const fy = p.y - turret.y;
          if (Math.sqrt(fx * fx + fy * fy) <= turret.def.range) {
            hit = true;
            this.events.emit('forceFieldBlocked', turret);
            break;
          }
        } else if (turret.type !== 'forceField') {
          const dx = p.x - turret.x;
          const dy = p.y - turret.y;
          if (Math.sqrt(dx * dx + dy * dy) < 16) {
            hit = true;
            if (p.target && p.target.isBabyShot) {
              this.damageTurret(turret, WAVE_CONFIG.babyFireDamage);
            } else if (p.isBossShot) {
              this.damageTurret(turret, 4);
            } else {
              this.damageTurret(turret, 2);
            }
            break;
          }
        }
      }

      if (hit || p.x < -50 || p.x > GAME_CONFIG.width + 50 || p.y < -50 || p.y > GAME_CONFIG.height + 50) {
        p.graphic.destroy();
        this.orphanedShots.splice(i, 1);
      }
    }

    // Random event timer
    if (this.waveActive && this.enemies.length > 0) {
      this.eventTimer += delta;
      if (this.eventTimer >= this.eventInterval) {
        this.triggerRandomEvent();
        this.eventTimer = 0;
        this.eventInterval = Phaser.Math.Between(60000, 300000);
      }
    }

    // Check if wave is finished
    if (this.waveActive && this.spawnQueue.length === 0 && this.enemies.length === 0 && !this.pendingMothership && !this.mothershipSpawning) {
      this.waveActive = false;
      this.timeScale = 1;
      this.events.emit('timeScaleChanged', 1);
      // Brief pause between waves then start next
      this.time.delayedCall(2000, () => this.startNextWave());
    }
  }

  destroyTurret(turret) {
    const idx = this.turrets.indexOf(turret);
    if (idx === -1) return;
    turret.destroyed = true;

    // Flash red then destroy
    const flash = this.add.graphics();
    flash.fillStyle(0xff0000, 0.8);
    flash.fillCircle(turret.x, turret.y, 22);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: 2,
      scaleY: 2,
      duration: 300,
      onComplete: () => flash.destroy(),
    });

    turret.destroy();
    this.turrets.splice(idx, 1);
  }

  damageTurret(turret, amount) {
    if (turret.destroyed) return;
    turret.hp -= amount;
    turret.drawHpBar();
    playTurretDamage();

    // Flash orange to show damage
    const flash = this.add.graphics();
    flash.fillStyle(0xff8800, 0.6);
    flash.fillCircle(turret.x, turret.y, 16);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 150,
      onComplete: () => flash.destroy(),
    });

    if (turret.hp <= 0) {
      this.destroyTurret(turret);
    }
  }

  damageBase() {
    this.baseHP--;
    playBaseHit();

    // Flash the base red
    this.cameras.main.shake(200, 0.01);
    this.baseGraphic.setAlpha(0.3);
    this.time.delayedCall(200, () => this.baseGraphic.setAlpha(1));

    if (this.baseHP <= 0) {
      this.waveActive = false;
      this.enemies = [];
      this.scene.stop('UIScene');
      this.scene.start('GameOverScene', {
        wave: this.currentWave,
        kills: this.totalKills,
        creditsEarned: this.totalCreditsEarned,
        timeSurvivedMs: Date.now() - this.gameStartTime,
        cheatMode: this.cheatMode,
      });
    }
  }

  spawnUltimateBoss() {
    const hp = WAVE_CONFIG.ultimateBossHealth(this.currentWave);
    const enemy = new Enemy(this, this.enemyPath, {
      type: 'mothership',
      hp,
      speed: 0.02, // moderately fast
      reward: hp,   // credits equal to its health
      fireRate: 800,
      fireRange: WAVE_CONFIG.mothershipFireRange,
      isBoss: true,
      isUltimateBoss: true,
    });
    this.enemies.push(enemy);

    // Announce it
    const label = this.add.text(GAME_CONFIG.width / 2, GAME_CONFIG.height / 2,
      '*** ULTIMATE BOSS INCOMING ***', {
        fontSize: '26px',
        fill: '#ff00ff',
        fontFamily: 'monospace',
        stroke: '#000000',
        strokeThickness: 5,
      }).setOrigin(0.5).setDepth(200);
    this.tweens.add({
      targets: label,
      alpha: 0,
      y: GAME_CONFIG.height / 2 - 80,
      duration: 2500,
      onComplete: () => label.destroy(),
    });
  }

  skipOneWave() {
    if (!this.waveActive) return;
    this.spawnQueue = [];
    this.pendingMothership = null;
    this.mothershipSpawning = false;
    for (const enemy of this.enemies) {
      if (!enemy.dead) {
        enemy.dead = true;
        this.credits += enemy.reward;
        this.totalCreditsEarned += enemy.reward;
        this.totalKills++;
        enemy.destroy();
      }
    }
    this.enemies = [];
    this.waveActive = false;
    this.startNextWaveImmediate();
  }

  fastForwardWave() {
    // Clear all pending spawns and enemies
    this.spawnQueue = [];
    this.pendingMothership = null;
    this.mothershipSpawning = false;
    this.waveActive = false;
    for (const enemy of this.enemies) {
      if (!enemy.dead) {
        enemy.dead = true;
        this.credits += enemy.reward;
        this.totalCreditsEarned += enemy.reward;
        this.totalKills++;
        enemy.destroy();
      }
    }
    this.enemies = [];

    // Skip ahead 1000 waves instantly — use simple math instead of looping
    const dm = this.diffMod;
    const startW = this.currentWave + 1;
    const endW = this.currentWave + 1000;
    // Average baby count across the range: babyShipsPerWave = 4 + w*3
    const avgBabies = Math.ceil((WAVE_CONFIG.babyShipsPerWave(startW) + WAVE_CONFIG.babyShipsPerWave(endW)) / 2 * dm.countMul);
    const avgKillsPerWave = avgBabies + 6; // babies + mothership + specials
    const babyReward = Math.ceil(GAME_CONFIG.rewards.babyShip * dm.rewardMul);
    const motherReward = Math.ceil(GAME_CONFIG.rewards.mothership * dm.rewardMul);
    const avgCreditsPerWave = avgBabies * babyReward + motherReward;

    this.totalKills += avgKillsPerWave * 1000;
    this.credits += avgCreditsPerWave * 1000;
    this.totalCreditsEarned += avgCreditsPerWave * 1000;
    this.currentWave += 1000;
    // waveActive stays false — auto clicker handles the loop
  }

  // Like startNextWave but without the announcement delay (used by auto clicker)
  startNextWaveImmediate() {
    this.currentWave++;
    const isBossWave = this.currentWave % 10 === 0;
    this.spawnQueue = [];

    const dm = this.diffMod;
    const babySpeed = WAVE_CONFIG.babyShipSpeed(this.currentWave) * dm.speedMul;
    const babyHP = Math.ceil(WAVE_CONFIG.babyShipHealth(this.currentWave) * dm.hpMul);
    const motherFireRate = WAVE_CONFIG.mothershipFireRate(this.currentWave);
    const motherFireRange = WAVE_CONFIG.mothershipFireRange;

    if (isBossWave) {
      const bossHP = Math.ceil(WAVE_CONFIG.bossHealth(this.currentWave) * dm.hpMul);
      this.spawnQueue.push({
        type: 'mothership', hp: bossHP, fireRate: 3000, fireRange: motherFireRange, isBoss: true,
      });
    } else {
      // Cap baby count at 50 so high waves don't freeze the game
      const rawBabyCount = Math.ceil(WAVE_CONFIG.babyShipsPerWave(this.currentWave) * dm.countMul);
      const babyCount = Math.min(rawBabyCount, 50);
      const motherHP = Math.ceil(WAVE_CONFIG.mothershipHealth(this.currentWave) * dm.hpMul);
      const wave = this.currentWave;
      const clusterSize = Math.max(3, Math.floor(wave * 3));
      for (let i = 0; i < babyCount; i++) {
        const posInCluster = i % clusterSize;
        const delay = posInCluster === 0 && i > 0 ? 900 : 400;
        this.spawnQueue.push({ type: 'babyShip', speed: babySpeed, hp: babyHP, delay });
      }
      if (wave >= 2) {
        const splitterCount = wave >= 6 ? 2 : 1;
        for (let i = 0; i < splitterCount; i++) {
          this.spawnQueue.push({
            type: 'splitter', isSplitter: true,
            hp: Math.ceil((60 + wave * 15) * dm.hpMul), speed: babySpeed * 0.9,
            reward: Math.ceil(20 * dm.rewardMul), fireRate: 99999, fireRange: 0, delay: 800,
          });
        }
      }
      if (wave >= 3) {
        this.spawnQueue.push({
          type: 'shieldBearer',
          hp: Math.ceil((40 + wave * 10) * dm.hpMul), speed: babySpeed * 0.8,
          reward: Math.ceil(25 * dm.rewardMul), fireRate: WAVE_CONFIG.babyFireRate, fireRange: WAVE_CONFIG.babyFireRange,
          shieldHits: Math.min(1 + Math.floor(wave / 3), 4), delay: 900,
        });
      }
      if (wave >= 4) {
        this.spawnQueue.push({
          type: 'carrier',
          hp: Math.ceil((120 + wave * 20) * dm.hpMul), speed: babySpeed * 0.6,
          reward: Math.ceil(40 * dm.rewardMul), fireRate: 99999, fireRange: 0, delay: 1000,
        });
      }
      if (wave >= 5) {
        this.spawnQueue.push({
          type: 'empFrigate', isEmp: true,
          hp: Math.ceil((50 + wave * 12) * dm.hpMul), speed: babySpeed * 0.85,
          reward: Math.ceil(30 * dm.rewardMul), fireRate: 2500, fireRange: 300, delay: 1000,
        });
      }
      this.pendingMothership = { type: 'mothership', hp: motherHP, fireRate: motherFireRate, fireRange: motherFireRange };
    }

    playWaveStart(this.currentWave);
    this.waveActive = true;
    this.spawnTimer = 0;
  }

  stopWave() {
    if (!this.waveActive) return;
    // Clear spawn queue and kill all enemies, but stay on current wave number
    this.spawnQueue = [];
    this.pendingMothership = null;
    for (const enemy of [...this.enemies]) {
      if (!enemy.dead && !enemy.reachedBase) {
        enemy.hp = 0;
        enemy.dead = true;
        enemy.spawnExplosion();
        enemy.destroy();
      }
    }
    this.enemies = [];
    this.waveActive = false;
    this.waveStopped = true;
  }

  resumeWave() {
    if (this.waveActive) return;
    this.waveStopped = false;
    // Replay the current wave without incrementing the wave counter
    const wave = this.currentWave;
    const isBossWave = wave % 10 === 0;
    this.spawnQueue = [];

    const babySpeed = WAVE_CONFIG.babyShipSpeed(wave);
    const babyHP = WAVE_CONFIG.babyShipHealth(wave);
    const motherFireRate = WAVE_CONFIG.mothershipFireRate(wave);
    const motherFireRange = WAVE_CONFIG.mothershipFireRange;

    if (isBossWave) {
      const bossHP = WAVE_CONFIG.bossHealth(wave);
      this.spawnQueue.push({ type: 'mothership', hp: bossHP, fireRate: 3000, fireRange: motherFireRange, isBoss: true });
    } else {
      const babyCount = WAVE_CONFIG.babyShipsPerWave(wave);
      const motherHP = WAVE_CONFIG.mothershipHealth(wave);
      const clusterSize = Math.max(3, Math.floor(wave * 3));
      for (let i = 0; i < babyCount; i++) {
        const posInCluster = i % clusterSize;
        const delay = posInCluster === 0 && i > 0 ? 700 : 50;
        this.spawnQueue.push({ type: 'babyShip', speed: babySpeed, hp: babyHP, delay });
      }
      this.pendingMothership = { type: 'mothership', hp: motherHP, fireRate: motherFireRate, fireRange: motherFireRange };
    }

    this.waveActive = true;
    this.spawnTimer = 0;
  }

  // ── Random Events ──────────────────────────────────────────────

  triggerRandomEvent() {
    const events = ['meteorStorm', 'ionPulse', 'solarFlare', 'bombRain'];
    const pick = events[Phaser.Math.Between(0, events.length - 1)];
    switch (pick) {
      case 'meteorStorm': this.triggerMeteorStorm(); break;
      case 'ionPulse':    this.triggerIonPulse();    break;
      case 'solarFlare':  this.triggerSolarFlare();  break;
      case 'bombRain':    this.triggerBombRain();     break;
    }
  }

  showEventAnnouncement(text, color, onComplete) {
    const W = this.scale.width;
    const H = this.scale.height;
    const announce = this.add.text(W / 2, H / 2, text, {
      fontSize: '26px',
      fill: color,
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(300).setAlpha(0);

    this.tweens.add({
      targets: announce, alpha: 1, duration: 300, yoyo: true, hold: 1200,
      onComplete: () => {
        announce.destroy();
        if (onComplete) onComplete();
      },
    });
  }

  triggerMeteorStorm() {
    this.showEventAnnouncement('METEOR STORM! (60s)', '#ffaa00', () => {
      const W = this.scale.width;
      const H = this.scale.height;
      const METEOR_DAMAGE = 100;

      // Continuous meteors — spawn one every 150ms for 60 seconds
      this.time.addEvent({
        delay: 150,
        repeat: 399, // 400 meteors over 60 seconds
        callback: () => {
          const startX = Phaser.Math.Between(0, W);
          const endX = startX + Phaser.Math.Between(-60, 60);
          const size = Phaser.Math.Between(3, 8);
          const duration = Phaser.Math.Between(400, 800);

          // Meteor visual — falls from top to bottom
          const meteor = this.add.circle(startX, -10, size, 0xff8800)
            .setDepth(250).setAlpha(0.9);

          // Trail effect
          const trail = this.add.circle(startX, -10, size - 1, 0xffcc00)
            .setDepth(249).setAlpha(0.5);

          this.tweens.add({
            targets: trail,
            x: endX,
            y: H + 20,
            alpha: 0,
            duration: duration + 100,
            onComplete: () => trail.destroy(),
          });

          this.tweens.add({
            targets: meteor,
            x: endX,
            y: H + 20,
            alpha: 0,
            duration,
            onUpdate: () => {
              // Check collision with enemies each frame
              for (const enemy of this.enemies) {
                if (enemy.dead) continue;
                const dx = meteor.x - enemy.x;
                const dy = meteor.y - enemy.y;
                if (Math.sqrt(dx * dx + dy * dy) < 20) {
                  enemy.takeDamage(METEOR_DAMAGE);
                  // Small impact flash
                  const flash = this.add.circle(meteor.x, meteor.y, 12, 0xffaa00)
                    .setDepth(251).setAlpha(0.8);
                  this.tweens.add({
                    targets: flash, alpha: 0, scaleX: 2, scaleY: 2,
                    duration: 200, onComplete: () => flash.destroy(),
                  });
                  meteor.destroy();
                  trail.destroy();
                  return;
                }
              }
            },
            onComplete: () => meteor.destroy(),
          });
        },
      });
    });
  }

  triggerIonPulse() {
    this.showEventAnnouncement('ION PULSE! (60s)', '#00ccff', () => {
      const W = this.scale.width;
      const H = this.scale.height;

      // Blue flash effect
      const flash = this.add.rectangle(W / 2, H / 2, W, H, 0x00ccff)
        .setDepth(250).setAlpha(0.3);
      this.tweens.add({
        targets: flash, alpha: 0, duration: 800,
        onComplete: () => flash.destroy(),
      });

      // Slow all enemies for 60 seconds (stacks — each click adds 60s)
      this.ionPulseActive = true;
      this.ionPulseStacks = (this.ionPulseStacks || 0) + 1;
      this.time.delayedCall(60000, () => {
        this.ionPulseStacks--;
        if (this.ionPulseStacks <= 0) {
          this.ionPulseActive = false;
          this.ionPulseStacks = 0;
        }
      });
    });
  }

  triggerSolarFlare() {
    // Pick a random living enemy
    const alive = this.enemies.filter(e => !e.dead);
    if (alive.length === 0) return;
    const target = alive[Phaser.Math.Between(0, alive.length - 1)];

    this.showEventAnnouncement('SOLAR FLARE!', '#ffff44', () => {
      if (target.dead) return;

      // Bright beam from top of screen to the enemy
      const beam = this.add.rectangle(target.x, target.y / 2, 6, target.y, 0xffff88)
        .setDepth(250).setAlpha(0.9);
      const glow = this.add.circle(target.x, target.y, 30, 0xffff44)
        .setDepth(250).setAlpha(0.7);

      this.tweens.add({
        targets: [beam, glow], alpha: 0, duration: 600,
        onComplete: () => { beam.destroy(); glow.destroy(); },
      });

      // Deal 50% of max HP
      const dmg = Math.ceil(target.maxHp * 0.5);
      target.takeDamage(dmg);
    });
  }

  triggerBombRain() {
    this.showEventAnnouncement('BOMB RAIN! (60s)', '#ff4400', () => {
      // Drop a persistent bomb on the track every 2 seconds for 1 minute
      this.time.addEvent({
        delay: 2000,
        repeat: 29,
        callback: () => {
          // Pick a random point on the track
          const t = Math.random();
          const pt = this.enemyPath.getPoint(t);
          const bx = pt.x + Phaser.Math.Between(-15, 15);
          const by = pt.y + Phaser.Math.Between(-15, 15);

          // Falling animation then place a real Bomb
          const falling = this.add.circle(bx, -20, 8, 0xff2200).setDepth(260).setAlpha(0.9);
          this.tweens.add({
            targets: falling,
            y: by,
            duration: 500,
            ease: 'Quad.easeIn',
            onComplete: () => {
              falling.destroy();
              // Place a real Bomb entity that waits for enemies
              const bomb = new Bomb(this, bx, by);
              this.bombs.push(bomb);
            },
          });
        },
      });
    });
  }
}
