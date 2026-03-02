import Redis from 'ioredis';

let redis;
function getRedis() {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, {
      tls: { rejectUnauthorized: false },
      lazyConnect: true,
    });
  }
  return redis;
}

const LEADERBOARD_KEY = 'leaderboard';
const MAX_ENTRIES = 100;

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      .setHeader('Access-Control-Allow-Headers', 'Content-Type')
      .end();
  }

  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  try {
    if (req.method === 'GET') {
      return await handleGet(req, res);
    }
    if (req.method === 'POST') {
      return await handlePost(req, res);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Leaderboard error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleGet(req, res) {
  const limit = Math.min(parseInt(req.query.limit || '20', 10), MAX_ENTRIES);
  const kv = getRedis();

  // Get top entries (highest scores first)
  const entryIds = await kv.zrevrange(LEADERBOARD_KEY, 0, limit - 1);

  if (!entryIds || entryIds.length === 0) {
    return res.status(200).json({ entries: [] });
  }

  // Fetch metadata for each entry via pipeline
  const pipeline = kv.pipeline();
  for (const id of entryIds) {
    pipeline.hgetall(id);
  }
  const results = await pipeline.exec();

  const entries = results.map(([err, data], i) => {
    if (err || !data || !data.name) return null;
    return {
      rank: i + 1,
      name: data.name,
      wave: parseInt(data.wave, 10),
      kills: parseInt(data.kills, 10),
      timeSurvivedMs: parseInt(data.timeSurvivedMs, 10),
      creditsEarned: parseInt(data.creditsEarned, 10),
      timestamp: data.timestamp,
    };
  }).filter(Boolean);

  return res.status(200).json({ entries });
}

async function handlePost(req, res) {
  const kv = getRedis();

  // Rate limiting by IP
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const rateKey = `ratelimit:${ip}`;
  const attempts = await kv.incr(rateKey);
  if (attempts === 1) await kv.expire(rateKey, 60);
  if (attempts > 3) {
    return res.status(429).json({ error: 'Too many submissions. Try again in a minute.' });
  }

  const { name, wave, kills, timeSurvivedMs, creditsEarned } = req.body || {};

  // Validate name
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Name is required' });
  }
  const cleanName = name.trim().replace(/[^a-zA-Z0-9 ]/g, '');
  if (cleanName.length < 3 || cleanName.length > 16) {
    return res.status(400).json({ error: 'Name must be 3-16 alphanumeric characters' });
  }

  // Validate numbers
  if (!Number.isInteger(wave) || wave < 1 || wave > 200) {
    return res.status(400).json({ error: 'Invalid wave number' });
  }
  if (!Number.isInteger(kills) || kills < 0 || kills > 50000) {
    return res.status(400).json({ error: 'Invalid kills count' });
  }
  if (!Number.isInteger(timeSurvivedMs) || timeSurvivedMs < 0) {
    return res.status(400).json({ error: 'Invalid time' });
  }
  if (!Number.isInteger(creditsEarned) || creditsEarned < 0) {
    return res.status(400).json({ error: 'Invalid credits' });
  }

  // Generate unique entry ID
  const id = `entry:${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  // Composite score: wave is primary, faster time breaks ties
  const clampedTime = Math.max(0, Math.min(timeSurvivedMs, 999_999_999));
  const compositeScore = wave * 1_000_000_000 + (999_999_999 - clampedTime);

  // Store entry in sorted set + hash
  const pipeline = kv.pipeline();
  pipeline.zadd(LEADERBOARD_KEY, compositeScore, id);
  pipeline.hset(id, {
    name: cleanName,
    wave: wave.toString(),
    kills: kills.toString(),
    timeSurvivedMs: timeSurvivedMs.toString(),
    creditsEarned: creditsEarned.toString(),
    timestamp: new Date().toISOString(),
  });
  await pipeline.exec();

  // Trim to top MAX_ENTRIES — remove lowest-ranked extras
  const total = await kv.zcard(LEADERBOARD_KEY);
  if (total > MAX_ENTRIES) {
    // Get entry IDs that will be removed
    const toRemove = await kv.zrange(LEADERBOARD_KEY, 0, total - MAX_ENTRIES - 1);
    if (toRemove.length > 0) {
      const cleanupPipeline = kv.pipeline();
      for (const oldId of toRemove) {
        cleanupPipeline.del(oldId);
      }
      cleanupPipeline.zremrangebyrank(LEADERBOARD_KEY, 0, total - MAX_ENTRIES - 1);
      await cleanupPipeline.exec();
    }
  }

  // Get player's rank (0-based, so +1)
  const rank = await kv.zrevrank(LEADERBOARD_KEY, id);
  const currentTotal = await kv.zcard(LEADERBOARD_KEY);

  return res.status(200).json({
    rank: rank !== null ? rank + 1 : null,
    totalEntries: currentTotal,
  });
}
