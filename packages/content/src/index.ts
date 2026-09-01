// Data-driven content definitions — no behavior, just schemas

export interface CharacterDefinition {
  id: string;
  name: string;
  maxHealth: number;
  speed: number;
  radius: number;
  defaultAttack: string;
}

export interface EnemyDefinition {
  id: string;
  name: string;
  maxHealth?: number;
  speed: number;
  radius?: number;
  attack?: string;
  xpReward?: number;
  /** Phase 3B role stats. */
  health: number;
  damage: number;
  attackCooldown: number;
}

export interface AttackDefinition {
  id: string;
  name: string;
  cooldown: number; // seconds
  damage: number;
  range: number;
  projectileSpeed: number;
}

export interface ProjectileDefinition {
  id: string;
  name: string;
  radius: number;
  lifetime: number; // seconds
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

// Default test content for vertical slice
export const DEFAULT_CHARACTER: CharacterDefinition = {
  id: "player_cat",
  name: "Test Cat",
  maxHealth: 100,
  speed: 300,
  radius: 30,
  defaultAttack: "basic_shot",
};

export const DEFAULT_ENEMY: EnemyDefinition = {
  id: "test_rat",
  name: "Test Rat",
  maxHealth: 20,
  speed: 150,
  radius: 20,
  attack: "rat_bite",
  xpReward: 10,
  health: 20,
  damage: 5,
  attackCooldown: 1,
};

export const BASIC_SHOT: AttackDefinition = {
  id: "basic_shot",
  name: "Basic Shot",
  cooldown: 0.1,
  damage: 10,
  range: 500,
  projectileSpeed: 600,
};

export const RAT_BITE: AttackDefinition = {
  id: "rat_bite",
  name: "Rat Bite",
  cooldown: 1.0,
  damage: 5,
  range: 50,
  projectileSpeed: 0, // melee
};

export const BASIC_PROJECTILE: ProjectileDefinition = {
  id: "basic_projectile",
  name: "Basic Projectile",
  radius: 5,
  lifetime: 10,
};

export const DEFAULT_WAVE: WaveDefinition = {
  waveNumber: 1,
  enemySpawns: [
    {
      enemyId: "test_rat",
      count: 3,
      spawnDelay: 0,
    },
  ],
  duration: 30,
};

export function createDefaultRegistry(): ContentRegistry {
  const registry = createContentRegistry();

  registry.characters.set(DEFAULT_CHARACTER.id, DEFAULT_CHARACTER);
  registry.enemies.set(DEFAULT_ENEMY.id, DEFAULT_ENEMY);
  registry.attacks.set(BASIC_SHOT.id, BASIC_SHOT);
  registry.attacks.set(RAT_BITE.id, RAT_BITE);
  registry.projectiles.set(BASIC_PROJECTILE.id, BASIC_PROJECTILE);
  registry.waves.set(1, DEFAULT_WAVE);

  return registry;
}

export * from "./enemies.js";
export * from "./waves.js";
export * from "./maps.js";