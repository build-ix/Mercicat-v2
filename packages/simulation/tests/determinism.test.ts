// Determinism tests — verifies same input always produces same state
import {
  createGameWorld,
  stepSimulation,
  PlayerState,
  GameWorld,
  PlayerInput,
} from "../src/index.js";
import { createDefaultRegistry } from "@mercicat/content";
import { brandPlayerId } from "@mercicat/shared";

function serializeWorldState(world: GameWorld): string {
  const snapshot = {
    tick: world.tick,
    players: Array.from(world.players.values()).map((p) => ({
      id: p.id,
      pos: { x: Math.round(p.position.x * 100) / 100, y: Math.round(p.position.y * 100) / 100 },
      health: p.health,
      alive: p.alive,
    })),
    enemies: Array.from(world.enemies.values()).map((e) => ({
      id: e.id,
      pos: { x: Math.round(e.position.x * 100) / 100, y: Math.round(e.position.y * 100) / 100 },
      health: e.health,
      alive: e.alive,
    })),
    projectiles: world.projectiles.size,
    wave: world.waveNumber,
  };
  return JSON.stringify(snapshot);
}

console.log("Testing deterministic simulation...\n");

// Test 1: Same seed, same inputs = same state
console.log("Test 1: Determinism with fixed inputs");
const seed = 12345;
const content = createDefaultRegistry();

const world1 = createGameWorld(seed);
const playerId = brandPlayerId("test_player");
world1.players.set(playerId, {
  id: playerId,
  position: { x: 960, y: 640 },
  velocity: { x: 0, y: 0 },
  health: 100,
  maxHealth: 100,
  character: "player_cat",
  attackCooldown: 0,
  lastAttackDirection: { x: 1, y: 0 },
  alive: true,
});

const world2 = createGameWorld(seed);
world2.players.set(playerId, {
  id: playerId,
  position: { x: 960, y: 640 },
  velocity: { x: 0, y: 0 },
  health: 100,
  maxHealth: 100,
  character: "player_cat",
  attackCooldown: 0,
  lastAttackDirection: { x: 1, y: 0 },
  alive: true,
});

const inputs: PlayerInput[] = [
  { playerId, moveDirection: { x: 1, y: 0 }, attackDirection: { x: 1, y: 0 } },
];

for (let i = 0; i < 30; i++) {
  stepSimulation(world1, inputs, content);
  stepSimulation(world2, inputs, content);
}

const state1 = serializeWorldState(world1);
const state2 = serializeWorldState(world2);

if (state1 === state2) {
  console.log("✓ PASS: Determinism verified");
} else {
  console.log("✗ FAIL: States diverged");
  console.log("World 1:", state1);
  console.log("World 2:", state2);
}

// Test 2: Different inputs = different states
console.log("\nTest 2: Different inputs produce different states");
const world3 = createGameWorld(seed);
world3.players.set(playerId, {
  id: playerId,
  position: { x: 960, y: 640 },
  velocity: { x: 0, y: 0 },
  health: 100,
  maxHealth: 100,
  character: "player_cat",
  attackCooldown: 0,
  lastAttackDirection: { x: 1, y: 0 },
  alive: true,
});

const inputs2: PlayerInput[] = [
  { playerId, moveDirection: { x: 0, y: 1 }, attackDirection: { x: 0, y: 0 } },
];

for (let i = 0; i < 30; i++) {
  stepSimulation(world3, inputs2, content);
}

const state3 = serializeWorldState(world3);

if (state1 !== state3) {
  console.log("✓ PASS: Different inputs diverged");
} else {
  console.log("✗ FAIL: States were identical despite different inputs");
}

// Test 3: Wave spawning
console.log("\nTest 3: Wave spawning");
const world4 = createGameWorld(seed);
world4.players.set(playerId, {
  id: playerId,
  position: { x: 960, y: 640 },
  velocity: { x: 0, y: 0 },
  health: 100,
  maxHealth: 100,
  character: "player_cat",
  attackCooldown: 0,
  lastAttackDirection: { x: 1, y: 0 },
  alive: true,
});

let enemiesTot = 0;
for (let i = 0; i < 180; i++) {
  // 6 seconds at 30Hz
  const result = stepSimulation(world4, inputs, content);
  for (const event of result.events) {
    if (event.type === "enemy_spawned") enemiesTot++;
  }
}

console.log(`✓ Spawned ${enemiesTot} enemies in 6 seconds (${world4.enemies.size} alive)`);

console.log("\nAll tests completed!");
