# Leaderboard Feature

## Overview
Global leaderboard that persists player scores after game over. Players enter their name and see how they rank against others.

## Storage
**Vercel KV (Redis)** — sorted sets for ranked retrieval, hashes for entry metadata. Top 100 entries kept.

## Ranking
- **Primary:** Wave reached (highest wins)
- **Tiebreaker:** Time survived (faster wins)
- Composite score: `wave * 1,000,000,000 + (999,999,999 - timeSurvivedMs)`

## Data per Entry
| Field | Type | Description |
|-------|------|-------------|
| name | string | Player name, 3-16 chars |
| wave | int | Wave reached |
| kills | int | Total enemies killed |
| timeSurvivedMs | int | Milliseconds survived |
| creditsEarned | int | Total credits earned (not remaining) |
| timestamp | ISO 8601 | When score was submitted |

## API Endpoints

### GET /api/leaderboard?limit=20
Returns top N entries with rank, name, wave, kills, time.

### POST /api/leaderboard
Submit a score. Body: `{ name, wave, kills, timeSurvivedMs, creditsEarned }`.
Returns: `{ rank, totalEntries }`.

## Anti-Abuse
- Rate limit: 3 submissions/minute per IP
- Input validation: name length, wave bounds (1-200), non-negative values
- Cheat mode games excluded entirely (blocked client-side)

## Cheat Mode Policy
- Cheat games **cannot** submit scores
- Notification shown when cheats are activated: "Score will not be saved to leaderboard"
- Game over screen for cheat games skips name input, shows leaderboard as view-only

## Where Leaderboard Appears
1. **Game Over screen** — after stats display, name input, and submission
2. **Title screen** — "Leaderboard" button opens an overlay

## Stats Tracked During Gameplay
- `totalKills` — incremented on each enemy death
- `totalCreditsEarned` — incremented by enemy reward value
- `gameStartTime` — `Date.now()` at game start, used to calculate survival time

## New Files
- `package.json` — `@vercel/kv` dependency
- `api/leaderboard.js` — serverless function (GET + POST)
- `src/ui/LeaderboardDisplay.js` — shared Phaser renderer for leaderboard table

## Modified Files
- `src/scenes/GameScene.js` — stat tracking + pass data to GameOverScene
- `src/scenes/GameOverScene.js` — full rewrite with stats, name input, API, leaderboard
- `src/scenes/TitleScene.js` — leaderboard button + overlay
- `src/scenes/UIScene.js` — cheat activation notification
