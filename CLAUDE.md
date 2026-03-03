# Liam Coding — Project Notes

## Active Project: Space Tower Defense

A browser-based tower defense game built with Phaser.js, playable on desktop and iPhone/iPad via Safari.

### Project Location
`/Users/liamroberts/Documents/Liam Coding/space-tower-defense/`

### Running the Game
Requires a local HTTP server (ES modules don't work over `file://`):
```bash
cd "/Users/liamroberts/Documents/Liam Coding/space-tower-defense"
python3 -m http.server 8080
```
Then open `http://localhost:8080` in the browser.

### Project Structure
```
space-tower-defense/
├── index.html                  # Entry point, loads Phaser via CDN, PWA meta tags
├── manifest.json               # Web app manifest (PWA standalone mode)
├── README.md                   # GitHub readme with screenshots
├── api/
│   └── leaderboard.js          # Vercel serverless — GET/POST/DELETE leaderboard (Redis)
├── src/
│   ├── main.js                 # Phaser game config, scene list, window.__phaserGame exposed
│   ├── config/
│   │   └── gameConfig.js       # All game constants (costs, waves, rewards, HP)
│   ├── audio/
│   │   └── SoundManager.js     # Procedural sound effects (Web Audio API)
│   ├── scenes/
│   │   ├── BootScene.js        # Asset preloading (placeholder, assets TBD)
│   │   ├── TitleScene.js       # Title screen, leaderboard view, admin mode
│   │   ├── GameScene.js        # Core game loop, path, enemies, turrets, placement
│   │   ├── UIScene.js          # Overlay HUD — credits, wave, HP, turret buttons, cheat menu
│   │   ├── GameOverScene.js    # Game over — stats, name input, leaderboard submission
│   │   └── VictoryScene.js     # Win screen
│   ├── ui/
│   │   ├── LeaderboardDisplay.js       # Read-only leaderboard renderer
│   │   └── AdminLeaderboardDisplay.js  # Admin leaderboard with delete buttons
│   └── entities/
│       ├── Enemy.js            # Enemy class — path following, health bar, explosion
│       ├── Turret.js           # Turret class + TURRET_DEFS, firing, projectiles, burn trails
│       ├── MachineGun.js       # Machine gun turret (standalone entity)
│       ├── Bomb.js             # Path bomb (standalone entity)
│       ├── AttackPlane.js      # Air strike plane
│       ├── Hamster.js          # Hamster turret (secret)
│       └── UltraHamster.js     # Ultra Hamster (secret, unlocked via cheat code)
├── docs/
│   └── features/               # Feature specs (one markdown per feature)
├── assets/
│   ├── screenshots/            # Title screen + gameplay screenshots for README
│   ├── images/                 # (empty — all graphics are procedural for now)
│   ├── sounds/                 # (empty — sounds TBD)
│   └── music/                  # (empty — music TBD)
└── .claude/
    └── settings.json           # Auto-approve git/gh commands
```

### Game Design Summary
- **Endless waves** — survive as many as you can
- **Mothership spawns after all baby ships are destroyed** (with "MOTHERSHIP INCOMING!" warning)
- **Boss wave every 10th wave** — massive mothership, no baby ships
- **Economy:** Start with 750 credits, earn 10cr per Baby Ship, 100cr per Mothership
- **Lose condition:** 3 enemy hits on the space base = game over
- **Scaling:** More baby ships, tougher enemies, faster fire rates each wave

### Turrets (all in `gameConfig.js` turretCosts)
| Turret | Cost | Key mechanic |
|--------|------|-------------|
| Laser | 50cr | Fast fire, instant beam, 360px range |
| M.Gun | 75cr | Rapid fire, short range |
| Missile | 200cr | Slow homing missiles, splash damage |
| Force Field | 75cr | Slows enemies (no damage), has shield HP |
| Bomb | 100cr | Placed ON path, explodes on contact |
| Plasma Gun | 125cr | Travelling projectile, leaves burning DOT pool on impact |
| Plasma Railgun | 300cr | Piercing beam hits ALL enemies in a line + lingering burn trail |
| Attack Plane | 150cr | Air strike |
| Hamster | 1000cr | Secret turret |
| Ultra Hamster | cheat | Unlocked via secret code "inside" |

### Enemy Types
- **Baby Ships** — fast, low HP, fire at nearby turrets
- **Mothership** — slow, high HP, fires at any turret (unlimited range), spawns after babies cleared
- **Splitters** (wave 2+) — split into 2 mini ships on death
- **Shield Bearers** (wave 3+) — absorb hits with shields
- **Carriers** (wave 4+) — release 3 baby ships at half HP
- **EMP Frigates** (wave 5+) — stun turrets temporarily
- **Boss** (every 10th wave) — massive mothership

### What's Built
- [x] Title screen with "Try to survive as many waves as you can!"
- [x] Opening message on game start (fade in/out)
- [x] Star field background with nebula blobs
- [x] Winding enemy path (Z-shaped across screen)
- [x] All enemy types with scaling per wave
- [x] All turret types including Plasma Gun and Plasma Railgun
- [x] Plasma Gun — travelling projectile + burning DOT pool (green, 40px radius, 3s)
- [x] Plasma Railgun — piercing beam + lingering burn trail (pink/purple, 3s DOT)
- [x] Turret upgrade system (3 slots per turret, 3 levels each)
- [x] Mothership spawns AFTER all baby ships destroyed (with warning text)
- [x] HUD — credits/wave/HP in top-left (doesn't overlap cheat buttons)
- [x] Two-row centered weapon bar at bottom
- [x] On-screen QWERTY keyboard for secret code input (mobile/iPad support)
- [x] Secret code system ("inside" unlocks Ultra Hamster + cheat extras)
- [x] Cheat extras: Stop/Skip Wave, Auto-clicker, +1000 Credits, Ultimate Boss
- [x] Game Over and Victory screens
- [x] Procedural sound effects (Web Audio API)
- [x] PWA support — fullscreen standalone mode on iPhone via "Add to Home Screen"
- [x] Safe area handling for iPhone (notch + home indicator)
- [x] Global leaderboard (Redis-backed via Vercel serverless, scores ranked by wave then time)
- [x] Leaderboard on title screen and game over screen
- [x] Name input on game over for leaderboard submission
- [x] Cheat mode games excluded from leaderboard
- [x] Admin mode — password-protected leaderboard management (delete entries) on title screen
- [x] Admin password validation against server before showing admin panel

### What's Not Built Yet
- [ ] Credits earned visual feedback on kill
- [ ] Sound effects polish and music
- [ ] Sprite art (currently all procedural graphics)
- [ ] Mobile touch controls refinement

### Key Implementation Notes
- `window.__phaserGame` is exposed for browser console debugging
- Enemy `slowMultiplier` resets to 1 each frame; force fields reapply in update
- UIScene runs as a parallel scene on top of GameScene (launched via `scene.launch`)
- Turret placement cancels after one placement; ESC or right-click also cancels
- Path validation samples 80 points along the Phaser Curves.Path to check clearance
- Mothership held in `this.pendingMothership` until all other enemies dead, then spawns with warning
- Plasma Railgun uses `pointToSegmentDistance()` helper for piercing + burn trail DOT
- Plasma Gun projectiles have `isPlasma: true` flag; on hit they call `createBurnPool()`
- Burn trails/pools stored in `turret.burnTrails[]`, updated in `turret.update()`, cleaned up in `destroy()`
- `turret.destroyed = true` is flagged before removal so in-flight projectiles can skip dead targets
- Turrets have `hp = 6`; mothership hits deal 2, baby ships deal 1
- Wave-end check requires `!this.pendingMothership` to avoid premature wave completion

### Git & Deployment
- **Repository:** `https://github.com/pauljrob/liams-projects.git`
- **ONLY push to this repo** — do not add or push to any other remote
- **All commits must include:** `Co-Authored-By: Liam Roberts <liamroberts@users.noreply.github.com>`
- Branch: `main`
- **Hosting:** Vercel auto-deploys on every push to `main`
- **Live URL:** `https://Liamsworld.dev`
- **Testing on iPhone:** Push to GitHub → Vercel deploys automatically → open live URL on iPhone Safari

### Feature Development Workflow
When adding a new feature:
1. **Create a feature branch** — `git checkout -b feature/<feature-name>`
2. **Create a feature spec** — `docs/features/<feature-name>.md` describing the feature, API, UI flow, files changed
3. **Build on the feature branch** — commit, push, create a PR
4. **Merge to main** when the feature is complete and tested, then delete the feature branch (local + remote)

### Leaderboard & Admin
- **Backend:** Vercel serverless function (`api/leaderboard.js`) with Redis (ioredis)
- **Storage:** Redis sorted set (`leaderboard`) for ranking + Redis hashes for entry metadata
- **Composite score:** `wave * 100_000_000_000 + kills * 1_000_000 + (999_999 - timeSec)` — wave primary, kills secondary, faster time tertiary
- **Entry IDs:** `entry:<timestamp>-<random>` (e.g., `entry:1709312345678-a1b2c3d4`)
- **Admin auth:** `Authorization: Bearer <password>` header, validated against `ADMIN_PASSWORD` env var
- **Env vars on Vercel:** `REDIS_URL`, `ADMIN_PASSWORD` (must have Preview checkbox enabled for preview deploys)

### Tech Stack
- **Phaser 3.60.0** via CDN (WebGL renderer, Canvas fallback)
- **ES Modules** — no bundler, pure browser native modules
- **Phaser.Scale.FIT** — scales to fit any screen size (desktop + iPhone)
- **Vercel** — hosting + serverless functions
- **Redis** (via ioredis) — leaderboard storage
