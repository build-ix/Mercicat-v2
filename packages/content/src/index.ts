// Data-driven content definitions — no behavior, just schemas

import type { EnemyDefinition } from "./contracts/enemyDefinition.js";

export interface CharacterDefinition {
  id: string;
  name: string;
  maxHealth: number;
  speed: number;
  radius: number;
  defaultAttack: string;
  description?: string;
  rarity?: "common" | "uncommon" | "rare";
}

export interface AttackDefinition {
  id: string;
  name: string;
  cooldown: number; // seconds
  damage: number;
  range: number;
  projectileSpeed: number;
  description?: string;
}

export interface ProjectileDefinition {
  id: string;
  name: string;
  radius: number;
  lifetime: number; // seconds
  color?: string;
}

export interface WaveDefinition {
  waveNumber: number;
  enemySpawns: Array<{
    enemyId: string;
    count: number;
    spawnDelay: number; // seconds
  }>;
  duration: number; // seconds until wave ends
}

// Content registry
export interface ContentRegistry {
  characters: Map<string, CharacterDefinition>;
  enemies: Map<string, EnemyDefinition>;
  attacks: Map<string, AttackDefinition>;
  projectiles: Map<string, ProjectileDefinition>;
  waves: Map<number, WaveDefinition>;
}

export function createContentRegistry(): ContentRegistry {
  return {
    characters: new Map(),
    enemies: new Map(),
    attacks: new Map(),
    projectiles: new Map(),
    waves: new Map(),
  };
}

// ============== DEFAULT TEST CONTENT ==============

// Characters
export const DEFAULT_CHARACTER: CharacterDefinition = {
  id: "player_cat",
  name: "Mercicat",
  maxHealth: 100,
  speed: 300,
  radius: 12,
  defaultAttack: "basic_shot",
  description: "A nimble feline warrior with natural agility.",
  rarity: "common",
};

export const TIGER_CHARACTER: CharacterDefinition = {
  id: "player_tiger",
  name: "Tigerstrike",
  maxHealth: 140,
  speed: 250,
  radius: 14,
  defaultAttack: "heavy_shot",
  description: "Powerful tiger with increased durability.",
  rarity: "uncommon",
};

export const LEOPARD_CHARACTER: CharacterDefinition = {
  id: "player_leopard",
  name: "Shadowpounce",
  maxHealth: 80,
  speed: 360,
  radius: 10,
  defaultAttack: "rapid_fire",
  description: "Swift leopard specializing in speed and evasion.",
  rarity: "uncommon",
};

// Enemies
export const DEFAULT_ENEMY: EnemyDefinition = {
  id: "test_rat",
  name: "Rat",
  maxHealth: 20,
  speed: 150,
  radius: 8,
  attack: "rat_bite",
  xpReward: 10,
  health: 20,
  damage: 5,
  attackCooldown: 1,
};

export const GIANT_RAT_ENEMY: EnemyDefinition = {
  id: "giant_rat",
  name: "Giant Rat",
  maxHealth: 60,
  speed: 120,
  radius: 12,
  attack: "heavy_bite",
  xpReward: 30,
  health: 60,
  damage: 15,
  attackCooldown: 1.5,
};

export const SWIFT_RAT_ENEMY: EnemyDefinition = {
  id: "swift_rat",
  name: "Swift Rat",
  maxHealth: 12,
  speed: 200,
  radius: 6,
  attack: "scratch",
  xpReward: 8,
  health: 12,
  damage: 3,
  attackCooldown: 0.7,
};

// Attacks / Weapons
export const BASIC_SHOT: AttackDefinition = {
  id: "basic_shot",
  name: "Basic Shot",
  cooldown: 0.15,
  damage: 10,
  range: 500,
  projectileSpeed: 600,
  description: "Standard firearm attack.",
};

export const HEAVY_SHOT: AttackDefinition = {
  id: "heavy_shot",
  name: "Heavy Shot",
  cooldown: 0.4,
  damage: 30,
  range: 400,
  projectileSpeed: 500,
  description: "Powerful but slow attack.",
};

export const RAPID_FIRE: AttackDefinition = {
  id: "rapid_fire",
  name: "Rapid Fire",
  cooldown: 0.08,
  damage: 6,
  range: 400,
  projectileSpeed: 700,
  description: "Fast attack with lower damage.",
};

export const RAT_BITE: AttackDefinition = {
  id: "rat_bite",
  name: "Rat Bite",
  cooldown: 1.0,
  damage: 5,
  range: 50,
  projectileSpeed: 0, // melee
  description: "Close-range bite attack.",
};

export const HEAVY_BITE: AttackDefinition = {
  id: "heavy_bite",
  name: "Heavy Bite",
  cooldown: 1.5,
  damage: 15,
  range: 60,
  projectileSpeed: 0, // melee
  description: "Powerful melee bite from large rats.",
};

export const SCRATCH: AttackDefinition = {
  id: "scratch",
  name: "Scratch",
  cooldown: 0.6,
  damage: 3,
  range: 40,
  projectileSpeed: 0, // melee
  description: "Quick scratch attack.",
};

// Projectiles
export const BASIC_PROJECTILE: ProjectileDefinition = {
  id: "basic_projectile",
  name: "Basic Projectile",
  radius: 3,
  lifetime: 10,
  color: "#ffff44",
};

export const HEAVY_PROJECTILE: ProjectileDefinition = {
  id: "heavy_projectile",
  name: "Heavy Projectile",
  radius: 5,
  lifetime: 8,
  color: "#ff8844",
};

export const RAPID_PROJECTILE: ProjectileDefinition = {
  id: "rapid_projectile",
  name: "Rapid Projectile",
  radius: 2,
  lifetime: 7,
  color: "#44ff88",
};

// Wave Definitions (early waves only for now)
export const WAVE_1: WaveDefinition = {
  waveNumber: 1,
  enemySpawns: [
    { enemyId: "test_rat", count: 3, spawnDelay: 0 },
    { enemyId: "test_rat", count: 2, spawnDelay: 1.5 },
  ],
  duration: 30,
};

export const WAVE_2: WaveDefinition = {
  waveNumber: 2,
  enemySpawns: [
    { enemyId: "test_rat", count: 4, spawnDelay: 0 },
    { enemyId: "swift_rat", count: 2, spawnDelay: 1.0 },
    { enemyId: "test_rat", count: 3, spawnDelay: 2.5 },
  ],
  duration: 35,
};

export const WAVE_3: WaveDefinition = {
  waveNumber: 3,
  enemySpawns: [
    { enemyId: "giant_rat", count: 1, spawnDelay: 0 },
    { enemyId: "test_rat", count: 5, spawnDelay: 1.5 },
    { enemyId: "swift_rat", count: 3, spawnDelay: 2.5 },
  ],
  duration: 40,
};

export function createDefaultRegistry(): ContentRegistry {
  const registry = createContentRegistry();

  // Register characters
  registry.characters.set(DEFAULT_CHARACTER.id, DEFAULT_CHARACTER);
  registry.characters.set(TIGER_CHARACTER.id, TIGER_CHARACTER);
  registry.characters.set(LEOPARD_CHARACTER.id, LEOPARD_CHARACTER);

  // Register enemies
  registry.enemies.set(DEFAULT_ENEMY.id, DEFAULT_ENEMY);
  registry.enemies.set(GIANT_RAT_ENEMY.id, GIANT_RAT_ENEMY);
  registry.enemies.set(SWIFT_RAT_ENEMY.id, SWIFT_RAT_ENEMY);

  // Register attacks
  registry.attacks.set(BASIC_SHOT.id, BASIC_SHOT);
  registry.attacks.set(HEAVY_SHOT.id, HEAVY_SHOT);
  registry.attacks.set(RAPID_FIRE.id, RAPID_FIRE);
  registry.attacks.set(RAT_BITE.id, RAT_BITE);
  registry.attacks.set(HEAVY_BITE.id, HEAVY_BITE);
  registry.attacks.set(SCRATCH.id, SCRATCH);

  // Register projectiles
  registry.projectiles.set(BASIC_PROJECTILE.id, BASIC_PROJECTILE);
  registry.projectiles.set(HEAVY_PROJECTILE.id, HEAVY_PROJECTILE);
  registry.projectiles.set(RAPID_PROJECTILE.id, RAPID_PROJECTILE);

  // Register waves
  registry.waves.set(1, WAVE_1);
  registry.waves.set(2, WAVE_2);
  registry.waves.set(3, WAVE_3);

  return registry;
}

export * from "./enemies.js";
export type { EnemyDefinition } from "./contracts/enemyDefinition.js";
export * from "./waves.js";
export * from "./maps.js";
