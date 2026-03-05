import Redis from 'ioredis';

let redis;
function getRedis() {
  if (!redis) {
    const url = process.env.REDIS_URL || '';
    const useTls = url.startsWith('rediss://');
    redis = new Redis(url, {
      ...(useTls ? { tls: { rejectUnauthorized: false } } : {}),
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }
  return redis;
}

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const PLAYERS_KEY = 'online_players';
const EVENTS_KEY = 'player_events';
const HEARTBEAT_TTL = 30; // seconds — player considered gone after this
const MAX_EVENTS = 50;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(204).setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      .setHeader('Access-Control-Allow-Headers', 'Content-Type')
      .end();
  }

  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  try {
    if (req.method === 'POST') return await handleHeartbeat(req, res);
    if (req.method === 'GET') return await handleGetStatus(req, res);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Players error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleHeartbeat(req, res) {
  const { name, sessionId } = req.body || {};
  if (!name || typeof name !== 'string' || name.trim().length < 3) {
    return res.status(400).json({ error: 'Invalid name' });
  }
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'Invalid session' });
  }

  const kv = getRedis();
  const playerKey = `player:${sessionId}`;
  const cleanName = name.trim();

  // Check if this is a new player (key doesn't exist yet)
  const existing = await kv.get(playerKey);
  const isNew = !existing;

  // Set/refresh heartbeat with TTL
  await kv.set(playerKey, cleanName, 'EX', HEARTBEAT_TTL);

  // Track in the online set (score = current timestamp for ordering)
  await kv.zadd(PLAYERS_KEY, Date.now(), `${sessionId}:${cleanName}`);

  if (isNew) {
    // Push a join event
    const event = JSON.stringify({ type: 'join', name: cleanName, time: Date.now() });
    await kv.lpush(EVENTS_KEY, event);
    await kv.ltrim(EVENTS_KEY, 0, MAX_EVENTS - 1);
  }

  // Clean up stale players from the sorted set
  const cutoff = Date.now() - HEARTBEAT_TTL * 1000;
  const allMembers = await kv.zrangebyscore(PLAYERS_KEY, 0, cutoff);
  if (allMembers.length > 0) {
    const pipeline = kv.pipeline();
    for (const member of allMembers) {
      pipeline.zrem(PLAYERS_KEY, member);
      const memberName = member.split(':').slice(1).join(':');
      const event = JSON.stringify({ type: 'leave', name: memberName, time: Date.now() });
      pipeline.lpush(EVENTS_KEY, event);
    }
    await pipeline.exec();
    await kv.ltrim(EVENTS_KEY, 0, MAX_EVENTS - 1);
  }

  return res.status(200).json({ success: true });
}

async function handleGetStatus(req, res) {
  const kv = getRedis();
  const since = parseInt(req.query.since || '0', 10);

  // Get online players (only those with recent heartbeats)
  const cutoff = Date.now() - HEARTBEAT_TTL * 1000;
  // Remove stale entries first
  const stale = await kv.zrangebyscore(PLAYERS_KEY, 0, cutoff);
  if (stale.length > 0) {
    const pipeline = kv.pipeline();
    for (const member of stale) {
      pipeline.zrem(PLAYERS_KEY, member);
      const memberName = member.split(':').slice(1).join(':');
      const event = JSON.stringify({ type: 'leave', name: memberName, time: Date.now() });
      pipeline.lpush(EVENTS_KEY, event);
    }
    await pipeline.exec();
    await kv.ltrim(EVENTS_KEY, 0, MAX_EVENTS - 1);
  }

  // Get current online players
  const online = await kv.zrangebyscore(PLAYERS_KEY, cutoff, '+inf');
  const players = online.map(m => m.split(':').slice(1).join(':'));

  // Get recent events
  const allEvents = await kv.lrange(EVENTS_KEY, 0, 19);
  const events = allEvents
    .map(e => { try { return JSON.parse(e); } catch { return null; } })
    .filter(e => e && e.time > since);

  return res.status(200).json({ count: players.length, players, events });
}
