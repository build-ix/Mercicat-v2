// Pure deterministic game simulation — no I/O, no external dependencies
// This is the single source of truth for all game rules

import {
  EntityId,
  PlayerId,
  Vec2,
  vec2,
  vec2Add,
  vec2Sub,
  vec2Mul,
  vec2Distance,
  vec2Normalize,
  TICK_RATE,
  TICK_DURATION,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  PLAYER_SPEED,
  PLAYER_RADIUS,
  ENEMY_RADIUS,
  SeededRandom,
  brandEntityId,
  brandPlayerId,
} from "@mercicat/shared";
import {
  CharacterDefinition,
  EnemyDefinition,
  AttackDefinition,
  ProjectileDefinition,
  ContentRegistry,
} from "@mercicat/content";

// Game state types
export interface PlayerState {
  id: PlayerId;
  position: Vec2;
  velocity: Vec2;
  health: number;
  maxHealth: number;
  character: string; // character ID
  attackCooldown: number;
  lastAttackDirection: Vec2;
  alive: boolean;
}

export interface EnemyState {
  id: EntityId;
  position: Vec2;
  velocity: Vec2;
  health: number;
  maxHealth: number;
  enemyType: string; // enemy ID
  attackCooldown: number;
  targetPlayerId: PlayerId | null;
  alive: boolean;
}

export interface ProjectileState {
  id: EntityId;
  position: Vec2;
  velocity: Vec2;
  lifetime: number;
  ownerId: PlayerId | EntityId; // who fired it
  damage: number;
  radius: number;
}

export interface GameWorld {
  tick: number;
  players: Map<PlayerId, PlayerState>;
  enemies: Map<EntityId, EnemyState>;
  projectiles: Map<EntityId, ProjectileState>;
  waveNumber: number;
  waveElapsed: number;
  waveDuration: number;
  rng: SeededRandom;
  entityIdCounter: number;
  nextEntityId(): EntityId;
}

export function createGameWorld(matchSeed: number): GameWorld {
  return {
    tick: 0,
    players: new Map(),
    enemies: new Map(),
    projectiles: new Map(),
    waveNumber: 1,
    waveElapsed: 0,
    waveDuration: 30,
    rng: new SeededRandom(matchSeed),
    entityIdCounter: 0,
    nextEntityId() {
      return brandEntityId(`entity_${++this.entityIdCounter}`);
    },
  };
}

// Input commands from clients
export interface PlayerInput {
  playerId: PlayerId;
  moveDirection: Vec2; // normalized, or zero
  attackDirection: Vec2; // normalized, or zero
}

// Events emitted by simulation
export type SimulationEvent =
  | { type: "player_spawned"; playerId: PlayerId; position: Vec2 }
  | { type: "enemy_spawned"; enemyId: EntityId; position: Vec2; enemyType: string }
  | { type: "projectile_fired"; projectileId: EntityId; owner: PlayerId | EntityId; position: Vec2 }
  | { type: "damage_dealt"; target: PlayerId | EntityId; amount: number; source: PlayerId | EntityId }
  | { type: "entity_died"; entityId: PlayerId | EntityId; type: "player" | "enemy" }
  | { type: "wave_ended"; waveNumber: number };

export class SimulationResult {
  events: SimulationEvent[] = [];

  addEvent(event: SimulationEvent) {
    this.events.push(event);
  }
}

// Core simulation step
export function stepSimulation(
  world: GameWorld,
  inputs: PlayerInput[],
  content: ContentRegistry
): SimulationResult {
  const result = new SimulationResult();

  // Update tick
  world.tick++;
  world.waveElapsed += TICK_DURATION;

  // Process player input and movement
  for (const input of inputs) {
    const player = world.players.get(input.playerId);
    if (!player || !player.alive) continue;

    // Apply movement
    if (input.moveDirection.x !== 0 || input.moveDirection.y !== 0) {
      const normalized = vec2Normalize(input.moveDirection);
      const charDef = content.characters.get(player.character);
      const speed = charDef?.speed ?? PLAYER_SPEED;
      player.velocity = vec2Mul(normalized, speed);
    } else {
      player.velocity = { x: 0, y: 0 };
    }

    // Apply attack
    if (input.attackDirection.x !== 0 || input.attackDirection.y !== 0) {
      player.lastAttackDirection = vec2Normalize(input.attackDirection);
      if (player.attackCooldown <= 0) {
        firePlayerAttack(world, player, content, result);
        player.attackCooldown = getAttackCooldown(player.character, content);
      }
    }
  }

  // Update player positions (with collision bounds)
  for (const player of world.players.values()) {
    if (!player.alive) continue;
    const newPos = vec2Add(player.position, vec2Mul(player.velocity, TICK_DURATION));
    player.position = clampToWorldBounds(newPos, PLAYER_RADIUS);
    player.attackCooldown = Math.max(0, player.attackCooldown - TICK_DURATION);
  }

  // Update enemy AI
  for (const enemy of world.enemies.values()) {
    if (!enemy.alive) continue;

    // Find nearest player
    let nearest: PlayerId | null = null;
    let nearestDist = 500;
    for (const [playerId, player] of world.players) {
      if (!player.alive) continue;
      const dist = vec2Distance(enemy.position, player.position);
      if (dist < nearestDist) {
        nearest = playerId;
        nearestDist = dist;
      }
    }

    enemy.targetPlayerId = nearest;

    // Move towards target
    if (nearest) {
      const target = world.players.get(nearest)!;
      const dir = vec2Sub(target.position, enemy.position);
      const dist = vec2Distance(enemy.position, target.position);

      if (dist > 0.1) {
        const enemyDef = content.enemies.get(enemy.enemyType);
        const speed = enemyDef?.speed ?? 150;
        const normalized = vec2Mul(dir, 1 / dist);
        enemy.velocity = vec2Mul(normalized, speed);

        const newPos = vec2Add(enemy.position, vec2Mul(enemy.velocity, TICK_DURATION));
        enemy.position = clampToWorldBounds(newPos, ENEMY_RADIUS);
      }

      // Try to attack
      if (enemy.attackCooldown <= 0 && dist < 100) {
        fireEnemyAttack(world, enemy, content, result);
        enemy.attackCooldown = getEnemyAttackCooldown(enemy.enemyType, content);
      }
    }

    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - TICK_DURATION);
  }

  // Update and resolve projectiles
  const deadProjectiles: EntityId[] = [];
  for (const [projectileId, projectile] of world.projectiles) {
    projectile.lifetime -= TICK_DURATION;
    const newPos = vec2Add(projectile.position, vec2Mul(projectile.velocity, TICK_DURATION));
    projectile.position = newPos;

    if (projectile.lifetime <= 0 || isOutOfBounds(projectile.position)) {
      deadProjectiles.push(projectileId);
      continue;
    }

    // Check collisions with enemies
    for (const [enemyId, enemy] of world.enemies) {
      if (!enemy.alive) continue;
      if (projectile.ownerId === enemyId) continue; // don't hit self

      const dist = vec2Distance(projectile.position, enemy.position);
      if (dist < projectile.radius + ENEMY_RADIUS) {
        applyDamage(enemy, projectile.damage, result);
        deadProjectiles.push(projectileId);
        result.addEvent({
          type: "damage_dealt",
          target: enemyId,
          amount: projectile.damage,
          source: projectile.ownerId,
        });
        break;
      }
    }

    // Check collisions with players
    for (const [playerId, player] of world.players) {
      if (!player.alive) continue;
      if (projectile.ownerId === playerId) continue; // don't hit self

      const dist = vec2Distance(projectile.position, player.position);
      if (dist < projectile.radius + PLAYER_RADIUS) {
        applyDamage(player, projectile.damage, result);
        deadProjectiles.push(projectileId);
        result.addEvent({
          type: "damage_dealt",
          target: playerId,
          amount: projectile.damage,
          source: projectile.ownerId,
        });
        break;
      }
    }
  }

  for (const id of deadProjectiles) {
    world.projectiles.delete(id);
  }

  // Check wave end and spawn next wave
  if (world.waveElapsed >= world.waveDuration) {
    result.addEvent({ type: "wave_ended", waveNumber: world.waveNumber });
    world.waveNumber++;
    world.waveElapsed = 0;
    spawnWave(world, world.waveNumber, content, result);
  }

  return result;
}

// Helper functions
function firePlayerAttack(
  world: GameWorld,
  player: PlayerState,
  content: ContentRegistry,
  result: SimulationResult
) {
  const charDef = content.characters.get(player.character);
  if (!charDef) return;

  const attackId = charDef.defaultAttack;
  const attackDef = content.attacks.get(attackId);
  if (!attackDef) return;

  const projectileDef = content.projectiles.get("basic_projectile");
  if (!projectileDef) return;

  const projectileId = world.nextEntityId();
  const spawnOffset = vec2Mul(player.lastAttackDirection, 50);
  const spawnPos = vec2Add(player.position, spawnOffset);
  const velocity = vec2Mul(player.lastAttackDirection, attackDef.projectileSpeed);

  world.projectiles.set(projectileId, {
    id: projectileId,
    position: spawnPos,
    velocity,
    lifetime: projectileDef.lifetime,
    ownerId: player.id,
    damage: attackDef.damage,
    radius: projectileDef.radius,
  });

  result.addEvent({
    type: "projectile_fired",
    projectileId,
    owner: player.id,
    position: spawnPos,
  });
}

function fireEnemyAttack(
  world: GameWorld,
  enemy: EnemyState,
  content: ContentRegistry,
  result: SimulationResult
) {
  const enemyDef = content.enemies.get(enemy.enemyType);
  if (!enemyDef) return;

  const attackDef = content.attacks.get(enemyDef.attack);
  if (!attackDef) return;

  const projectileDef = content.projectiles.get("basic_projectile");
  if (!projectileDef) return;

  const target = enemy.targetPlayerId ? world.players.get(enemy.targetPlayerId) : null;
  if (!target || !target.alive) return;

  const direction = vec2Normalize(vec2Sub(target.position, enemy.position));
  const projectileId = world.nextEntityId();
  const spawnOffset = vec2Mul(direction, 20);
  const spawnPos = vec2Add(enemy.position, spawnOffset);
  const velocity = vec2Mul(direction, attackDef.projectileSpeed);

  world.projectiles.set(projectileId, {
    id: projectileId,
    position: spawnPos,
    velocity,
    lifetime: projectileDef.lifetime,
    ownerId: enemy.id,
    damage: attackDef.damage,
    radius: projectileDef.radius,
  });

  result.addEvent({
    type: "projectile_fired",
    projectileId,
    owner: enemy.id,
    position: spawnPos,
  });
}

function applyDamage(
  entity: PlayerState | EnemyState,
  damage: number,
  result: SimulationResult
) {
  entity.health -= damage;
  if (entity.health <= 0) {
    entity.alive = false;
    const type = "character" in entity ? "player" : "enemy";
    result.addEvent({
      type: "entity_died",
      entityId: entity.id,
      type,
    });
  }
}

function spawnWave(
  world: GameWorld,
  waveNumber: number,
  content: ContentRegistry,
  result: SimulationResult
) {
  const waveDef = content.waves.get(waveNumber);
  if (!waveDef) return;

  world.waveDuration = waveDef.duration;
  world.waveElapsed = 0;

  for (const spawn of waveDef.enemySpawns) {
    const enemyDef = content.enemies.get(spawn.enemyId);
    if (!enemyDef) continue;

    for (let i = 0; i < spawn.count; i++) {
      const enemyId = world.nextEntityId();
      const pos = randomSpawnPosition(world);

      world.enemies.set(enemyId, {
        id: enemyId,
        position: pos,
        velocity: { x: 0, y: 0 },
        health: enemyDef.maxHealth,
        maxHealth: enemyDef.maxHealth,
        enemyType: spawn.enemyId,
        attackCooldown: 0,
        targetPlayerId: null,
        alive: true,
      });

      result.addEvent({
        type: "enemy_spawned",
        enemyId,
        position: pos,
        enemyType: spawn.enemyId,
      });
    }
  }
}

function getAttackCooldown(characterId: string, content: ContentRegistry): number {
  const charDef = content.characters.get(characterId);
  if (!charDef) return 0.5;
  const attackDef = content.attacks.get(charDef.defaultAttack);
  return attackDef?.cooldown ?? 0.5;
}

function getEnemyAttackCooldown(enemyId: string, content: ContentRegistry): number {
  const enemyDef = content.enemies.get(enemyId);
  if (!enemyDef) return 1.0;
  const attackDef = content.attacks.get(enemyDef.attack);
  return attackDef?.cooldown ?? 1.0;
}

function clampToWorldBounds(pos: Vec2, radius: number): Vec2 {
  return {
    x: Math.max(radius, Math.min(WORLD_WIDTH - radius, pos.x)),
    y: Math.max(radius, Math.min(WORLD_HEIGHT - radius, pos.y)),
  };
}

function isOutOfBounds(pos: Vec2): boolean {
  return pos.x < 0 || pos.x > WORLD_WIDTH || pos.y < 0 || pos.y > WORLD_HEIGHT;
}

function randomSpawnPosition(world: GameWorld): Vec2 {
  // Spawn at edges
  const side = world.rng.nextInt(4);
  let x, y;

  switch (side) {
    case 0: // top
      x = world.rng.nextRange(100, WORLD_WIDTH - 100);
      y = 50;
      break;
    case 1: // bottom
      x = world.rng.nextRange(100, WORLD_WIDTH - 100);
      y = WORLD_HEIGHT - 50;
      break;
    case 2: // left
      x = 50;
      y = world.rng.nextRange(100, WORLD_HEIGHT - 100);
      break;
    case 3: // right
      x = WORLD_WIDTH - 50;
      y = world.rng.nextRange(100, WORLD_HEIGHT - 100);
      break;
    default:
      x = WORLD_WIDTH / 2;
      y = WORLD_HEIGHT / 2;
  }

  return { x, y };
}
