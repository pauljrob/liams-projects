// Procedural sound effects via Web Audio API — no audio files needed

let ctx = null;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

function resume() {
  const c = getCtx();
  if (c.state === 'suspended') c.resume();
}

// ── helpers ──────────────────────────────────────────────────────────────────

function playTone({ freq = 440, type = 'sine', gain = 0.3, attack = 0.01, decay = 0.1, end = 0.001, duration = 0.15 } = {}) {
  const c = getCtx();
  const now = c.currentTime;

  const osc = c.createOscillator();
  const env = c.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(gain, now + attack);
  env.gain.exponentialRampToValueAtTime(end, now + attack + decay);

  osc.connect(env);
  env.connect(c.destination);

  osc.start(now);
  osc.stop(now + duration);
}

function playNoise({ gain = 0.2, attack = 0.005, decay = 0.15, duration = 0.2, lowpass = 800 } = {}) {
  const c = getCtx();
  const now = c.currentTime;
  const bufLen = Math.ceil(c.sampleRate * duration);
  const buf = c.createBuffer(1, bufLen, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buf;

  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowpass;

  const env = c.createGain();
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(gain, now + attack);
  env.gain.exponentialRampToValueAtTime(0.001, now + attack + decay);

  src.connect(filter);
  filter.connect(env);
  env.connect(c.destination);

  src.start(now);
  src.stop(now + duration);
}

// ── public sound effects ──────────────────────────────────────────────────────

export function playLaserFire() {
  resume();
  const c = getCtx();
  const now = c.currentTime;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(900, now);
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);
  env.gain.setValueAtTime(0.18, now);
  env.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  osc.connect(env);
  env.connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.1);
}

export function playMissileFire() {
  resume();
  // Low whoosh
  playNoise({ gain: 0.25, attack: 0.01, decay: 0.25, duration: 0.3, lowpass: 400 });
  // Ignition thud
  playTone({ freq: 80, type: 'sine', gain: 0.35, attack: 0.005, decay: 0.12, end: 0.001, duration: 0.15 });
}

export function playMissileExplosion() {
  resume();
  playNoise({ gain: 0.5, attack: 0.005, decay: 0.35, duration: 0.5, lowpass: 1200 });
  playTone({ freq: 60, type: 'sine', gain: 0.4, attack: 0.005, decay: 0.3, end: 0.001, duration: 0.35 });
}

export function playEnemyFire() {
  resume();
  const c = getCtx();
  const now = c.currentTime;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(300, now);
  osc.frequency.exponentialRampToValueAtTime(120, now + 0.1);
  env.gain.setValueAtTime(0.12, now);
  env.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  osc.connect(env);
  env.connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.12);
}

export function playEnemyExplosion() {
  resume();
  playNoise({ gain: 0.3, attack: 0.005, decay: 0.25, duration: 0.35, lowpass: 900 });
  playTone({ freq: 100, type: 'sine', gain: 0.25, attack: 0.005, decay: 0.2, end: 0.001, duration: 0.25 });
}

export function playMothershipExplosion() {
  resume();
  playNoise({ gain: 0.6, attack: 0.005, decay: 0.6, duration: 0.8, lowpass: 1500 });
  playTone({ freq: 55, type: 'sine', gain: 0.5, attack: 0.005, decay: 0.5, end: 0.001, duration: 0.6 });
  // Second boom slightly delayed
  const c = getCtx();
  const delay = c.currentTime + 0.15;
  setTimeout(() => playNoise({ gain: 0.4, attack: 0.005, decay: 0.4, duration: 0.5, lowpass: 800 }), 150);
}

export function playBaseHit() {
  resume();
  playNoise({ gain: 0.45, attack: 0.005, decay: 0.4, duration: 0.5, lowpass: 600 });
  playTone({ freq: 70, type: 'sine', gain: 0.4, attack: 0.005, decay: 0.35, end: 0.001, duration: 0.4 });
}

export function playTurretDamage() {
  resume();
  playNoise({ gain: 0.2, attack: 0.005, decay: 0.15, duration: 0.2, lowpass: 700 });
}

export function playShieldHit() {
  resume();
  const c = getCtx();
  const now = c.currentTime;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(600, now);
  osc.frequency.exponentialRampToValueAtTime(900, now + 0.05);
  osc.frequency.exponentialRampToValueAtTime(400, now + 0.18);
  env.gain.setValueAtTime(0.22, now);
  env.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc.connect(env);
  env.connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.2);
}

export function playShieldDestroyed() {
  resume();
  playNoise({ gain: 0.35, attack: 0.005, decay: 0.3, duration: 0.4, lowpass: 1000 });
  playTone({ freq: 200, type: 'sawtooth', gain: 0.2, attack: 0.005, decay: 0.28, end: 0.001, duration: 0.3 });
}

export function playWaveStart(wave) {
  resume();
  const c = getCtx();
  const now = c.currentTime;
  // Ascending arpeggio — pitch rises with wave number
  const baseFreq = 220 + wave * 20;
  [1, 1.25, 1.5, 2].forEach((ratio, i) => {
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.type = 'triangle';
    osc.frequency.value = baseFreq * ratio;
    const t = now + i * 0.1;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.2, t + 0.02);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(env);
    env.connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  });
}

export function playTurretPlace() {
  resume();
  playTone({ freq: 440, type: 'sine', gain: 0.2, attack: 0.01, decay: 0.12, end: 0.001, duration: 0.15 });
  playTone({ freq: 660, type: 'sine', gain: 0.15, attack: 0.05, decay: 0.1, end: 0.001, duration: 0.18 });
}
