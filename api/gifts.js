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
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(204).setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      .setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      .end();
  }

  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  try {
    if (req.method === 'POST') return await handleSendGift(req, res);
    if (req.method === 'GET') return await handlePollGifts(req, res);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Gifts error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleSendGift(req, res) {
  // Admin only
  const authHeader = req.headers['authorization'] || '';
  const password = authHeader.replace(/^Bearer\s+/i, '');
  const adminPassword = process.env.ADMIN_PASSWORD;

  const GIFT_PASSWORD = 'admininside';
  if (password !== adminPassword && password !== GIFT_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { targetName, type, amount } = req.body || {};

  if (!targetName || typeof targetName !== 'string' || targetName.trim().length < 3) {
    return res.status(400).json({ error: 'Invalid target name' });
  }
  if (type !== 'credits' && type !== 'hp') {
    return res.status(400).json({ error: 'Type must be credits or hp' });
  }
  if (!Number.isInteger(amount) || amount < 1 || amount > 10000) {
    return res.status(400).json({ error: 'Amount must be 1-10000' });
  }

  const kv = getRedis();
  const key = `gifts:${targetName.trim()}`;
  const gift = JSON.stringify({ type, amount, timestamp: new Date().toISOString() });
  await kv.rpush(key, gift);
  // Expire after 24 hours so unclaimed gifts don't linger forever
  await kv.expire(key, 86400);

  return res.status(200).json({ success: true });
}

async function handlePollGifts(req, res) {
  const player = req.query.player;
  if (!player || typeof player !== 'string' || player.trim().length < 3) {
    return res.status(200).json({ gifts: [] });
  }

  const kv = getRedis();
  const key = `gifts:${player.trim()}`;

  // Atomically read and clear all pending gifts
  const pipeline = kv.pipeline();
  pipeline.lrange(key, 0, -1);
  pipeline.del(key);
  const results = await pipeline.exec();

  const rawGifts = results[0][1] || [];
  const gifts = rawGifts.map(g => {
    try { return JSON.parse(g); } catch { return null; }
  }).filter(Boolean);

  return res.status(200).json({ gifts });
}
