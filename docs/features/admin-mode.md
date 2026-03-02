# Admin Mode — Leaderboard Management

## Overview
Password-protected admin mode that allows deleting entries from the global leaderboard.

## Access
- **Location**: "Admin" link in the UIScene, below the Secret Codes panel (top-right)
- **Authentication**: Password prompt (on-screen keyboard + physical keyboard)
- **Password**: Stored as `ADMIN_PASSWORD` environment variable on Vercel

## UI Flow
1. Click "Admin" link during gameplay
2. Enter admin password via on-screen keyboard (masked with `*`)
3. Admin leaderboard panel opens showing all entries with `[X]` delete buttons
4. Click `[X]` next to an entry to delete it — list refreshes automatically
5. Click "Close" to exit admin panel

## API

### DELETE /api/leaderboard
Deletes a single leaderboard entry.

**Headers:**
- `Authorization: Bearer <password>`
- `Content-Type: application/json`

**Body:**
```json
{ "entryId": "entry:1709312345678-a1b2c3d4" }
```

**Responses:**
- `200` — `{ "success": true, "removedId": "entry:..." }`
- `400` — Invalid entry ID
- `401` — Wrong password
- `404` — Entry not found

### GET /api/leaderboard (updated)
Now includes `id` field in each entry for admin use:
```json
{
  "entries": [
    {
      "id": "entry:1709312345678-a1b2c3d4",
      "rank": 1,
      "name": "Player",
      "wave": 10,
      "kills": 50,
      "timeSurvivedMs": 120000,
      "creditsEarned": 1500,
      "timestamp": "2026-03-01T12:00:00.000Z"
    }
  ]
}
```

## Security
- Password validated server-side only (env var `ADMIN_PASSWORD`)
- Client never validates password — wrong password just results in failed deletes
- Entry IDs in GET response are not sensitive (opaque timestamps)
- Leaderboard data is already publicly visible

## Files
| File | Change |
|------|--------|
| `api/leaderboard.js` | Add entry IDs to GET, add DELETE endpoint |
| `src/ui/AdminLeaderboardDisplay.js` | New: leaderboard with delete buttons |
| `src/scenes/UIScene.js` | Admin link, password input, admin panel |
