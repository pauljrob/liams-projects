// Core game settings
export const GAME_CONFIG = {
  width: 800,
  height: 600,

  // Economy
  startingCredits: 750,
  rewards: {
    babyShip: 10,
    mothership: 100,
  },

  // Base
  baseHitPoints: 3,

  // Turret costs
  turretCosts: {
    laser: 50,
    machineGun: 75,
    missile: 200,
    forceField: 75,
    bomb: 100,
    hamster: 1000,
    ultraHamster: 10000,
    attackPlane: 150,
    plasmaGun: 125,
    plasmaRailgun: 300,
  },
};

// Enemy scaling per wave
export const WAVE_CONFIG = {
  babyShipsPerWave: (wave) => 4 + wave * 3,        // starts at 7, adds 3 more each wave
  babyShipSpeed: (wave) => Math.min(0.05 + wave * 0.005, 0.12),   // faster base speed, grows each wave
  babyShipHealth: (wave) => 20 + wave * 10,       // grows each wave
  mothershipHealth: (wave) => 200 + wave * 100,   // gets tougher each wave
  bossHealth: (wave) => (wave / 10) * 1000,        // wave 10 = 1000, wave 20 = 2000, wave 30 = 3000, etc.
  ultimateBossHealth: (wave) => 10000 + Math.floor(wave / 10) * 10000, // wave 1-9=10k, wave 10-19=20k, etc.
  mothershipFireRate: (wave) => Math.max(3000 - wave * 200, 1000), // fires more often (ms)
  mothershipFireRange: 9999,  // mothership can target any turret on the map

  // Baby ship firing
  babyFireRange: 250,        // px — farther than mothership (200px)
  babyFireRate: 4000,        // ms between shots
  babyFireDamage: 1,         // 1 hp per hit on a turret (turrets get destroyed at 4 hits)
};
