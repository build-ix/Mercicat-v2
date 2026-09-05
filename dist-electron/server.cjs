"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const node_http = require("node:http");
const socket_io = require("socket.io");
const zod = require("zod");
const crypto = require("crypto");
function hashSeed(seed) {
  if (typeof seed === "number") {
    return seed >>> 0;
  }
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
class SeededRandom {
  constructor(seed) {
    const normalized = hashSeed(seed);
    this.state = normalized === 0 ? 1831565813 : normalized;
  }
  nextUint32() {
    let t = this.state += 1831565813;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return (t ^ t >>> 14) >>> 0;
  }
  nextFloat() {
    return this.nextUint32() / 4294967296;
  }
  /** Short alias used by simulation-specific RNG streams. */
  next() {
    return this.nextFloat();
  }
  nextInt(minInclusive, maxInclusive) {
    if (maxInclusive === void 0) {
      if (!Number.isInteger(minInclusive) || minInclusive <= 0)
        throw new Error("nextInt max must be a positive integer");
      return Math.floor(this.nextFloat() * minInclusive);
    }
    if (!Number.isInteger(minInclusive) || !Number.isInteger(maxInclusive)) {
      throw new Error("nextInt bounds must be integers");
    }
    if (maxInclusive < minInclusive) {
      throw new Error("maxInclusive must be >= minInclusive");
    }
    const range = maxInclusive - minInclusive + 1;
    return minInclusive + Math.floor(this.nextFloat() * range);
  }
  chance(probability) {
    if (probability <= 0)
      return false;
    if (probability >= 1)
      return true;
    return this.nextFloat() < probability;
  }
  pick(items) {
    if (items.length === 0) {
      throw new Error("Cannot pick from an empty array");
    }
    return items[this.nextInt(0, items.length - 1)];
  }
  getState() {
    return this.state >>> 0;
  }
  serialize() {
    return (this.state >>> 0).toString(16).padStart(8, "0");
  }
  setState(state) {
    if (!Number.isInteger(state) || state < 0 || state > 4294967295)
      throw new Error("Invalid RNG state");
    this.state = state >>> 0;
  }
  static deserialize(serialized) {
    if (!/^[0-9a-fA-F]{8}$/.test(serialized))
      throw new Error("Invalid serialized RNG state");
    const rng = new SeededRandom(1);
    rng.setState(Number.parseInt(serialized, 16));
    return rng;
  }
}
const TICK_RATE = 30;
const TICK_MS = 1e3 / TICK_RATE;
const MAX_PLAYERS = 2;
function canonicalize(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new Error("Non-finite number in state");
    return Number(value.toFixed(6));
  }
  if (Array.isArray(value))
    return value.map(canonicalize);
  if (value !== null && typeof value === "object")
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = canonicalize(value[key]);
      return out;
    }, {});
  return value;
}
function hashGameState(state) {
  let hash = 0xcbf29ce484222325n;
  for (const character of JSON.stringify(canonicalize(state))) {
    hash ^= BigInt(character.charCodeAt(0));
    hash = hash * 0x100000001b3n & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, "0");
}
const vec2Schema = zod.z.object({ x: zod.z.number().finite(), y: zod.z.number().finite() });
const baseEntitySchema = zod.z.object({ id: zod.z.number().int().nonnegative(), lifecycle: zod.z.enum(["active", "dead", "despawned"]), position: vec2Schema, velocity: vec2Schema, radius: zod.z.number().finite().nonnegative(), health: zod.z.number().finite(), maxHealth: zod.z.number().finite(), spawnTick: zod.z.number().int().nonnegative(), despawnTick: zod.z.number().int().nonnegative().nullable() });
zod.z.discriminatedUnion("kind", [
  baseEntitySchema.extend({ kind: zod.z.literal("player"), playerId: zod.z.number().int().nonnegative(), fireCooldownTicks: zod.z.number().int().nonnegative() }),
  baseEntitySchema.extend({ kind: zod.z.literal("enemy"), enemyType: zod.z.string(), contactDamage: zod.z.number().finite(), fireCooldownTicks: zod.z.number().int().nonnegative(), targetPlayerId: zod.z.number().int().nonnegative().nullable() }),
  baseEntitySchema.extend({ kind: zod.z.literal("projectile"), ownerId: zod.z.number().int().nonnegative(), damage: zod.z.number().finite(), lifetimeTicks: zod.z.number().int().positive(), ageTicks: zod.z.number().int().nonnegative() }),
  baseEntitySchema.extend({ kind: zod.z.literal("pickup"), pickupType: zod.z.string() }),
  baseEntitySchema.extend({ kind: zod.z.literal("obstacle") })
]);
zod.z.object({ type: zod.z.string(), tick: zod.z.number().int().nonnegative() }).passthrough();
const WireInputSchema = zod.z.object({
  sequence: zod.z.number().int().nonnegative(),
  tick: zod.z.number().int().nonnegative(),
  command: zod.z.object({
    type: zod.z.enum(["move", "fire", "reload", "ability", "pause", "usePickup", "readyForNextWave"]),
    tick: zod.z.number().int().nonnegative(),
    playerId: zod.z.number().int().nonnegative(),
    moveX: zod.z.number().finite().optional(),
    moveY: zod.z.number().finite().optional(),
    aimX: zod.z.number().finite().optional(),
    aimY: zod.z.number().finite().optional(),
    reloadTick: zod.z.number().int().nonnegative().optional(),
    abilityId: zod.z.string().optional(),
    direction: vec2Schema.optional(),
    pickupId: zod.z.number().int().positive().optional()
  })
});
const PROTOCOL_VERSION = 2;
const EVENTS = {
  hello: "hello",
  joinRoom: "joinRoom",
  joinedRoom: "joinedRoom",
  ready: "ready",
  initialState: "initialState",
  input: "input",
  snapshot: "snapshot",
  room: "room",
  error: "protocolError",
  event: "event"
};
function validateWireInput(input) {
  return WireInputSchema.parse(input);
}
const ENEMY_ROLES = {
  swarm: { id: "enemy_swarm", name: "Swarm", role: "swarm", threatCost: 1, unlockWave: 1, elite: false, spawnWeight: 1, minSpawnIntervalTicks: 3, counters: ["area_damage", "kiting"], tags: ["fodder", "melee"], health: 10, speed: 1.8, damage: 5, attackCooldown: 0.8 },
  charger: { id: "enemy_charger", name: "Charger", role: "charger", threatCost: 3, unlockWave: 1, elite: false, spawnWeight: 0.8, minSpawnIntervalTicks: 8, counters: ["dodge", "interrupt"], tags: ["melee", "medium"], health: 25, speed: 2.2, damage: 15, attackCooldown: 1.5 },
  ranged: { id: "enemy_ranged", name: "Ranged", role: "ranged", threatCost: 4, unlockWave: 1, elite: false, spawnWeight: 0.7, minSpawnIntervalTicks: 10, counters: ["cover", "target_priority"], tags: ["ranged", "medium"], health: 18, speed: 1.2, damage: 8, attackCooldown: 1 },
  tank: { id: "enemy_tank", name: "Tank", role: "tank", threatCost: 8, unlockWave: 2, elite: false, spawnWeight: 0.5, minSpawnIntervalTicks: 12, counters: ["sustained_damage", "armor_pierce"], tags: ["armor", "heavy"], health: 60, speed: 0.8, damage: 20, attackCooldown: 2 },
  disabler: { id: "enemy_disabler", name: "Disabler", role: "disabler", threatCost: 7, unlockWave: 3, elite: false, spawnWeight: 0.6, minSpawnIntervalTicks: 15, counters: ["cleanse", "focus_fire"], tags: ["special", "disable"], health: 22, speed: 1.4, damage: 10, attackCooldown: 2.5 },
  flanker: { id: "enemy_flanker", name: "Flanker", role: "flanker", threatCost: 5, unlockWave: 2, elite: false, spawnWeight: 0.7, minSpawnIntervalTicks: 9, counters: ["perimeter_awareness", "positioning"], tags: ["fast", "flanking"], health: 15, speed: 2.5, damage: 8, attackCooldown: 0.9 }
};
const players = (n) => Math.max(2, Math.min(4, n));
function calculateThreatBudget(wave, playerCount, difficulty) {
  const baseBudget = 20 + (wave - 1) * 12;
  return Math.round(baseBudget * (1 + 0.35 * (Math.max(1, playerCount) - 1)) * (1 + 0.1 * Math.max(0, difficulty - 1)));
}
function getMaxActiveEnemies(playerCount, wave) {
  return 8 + players(playerCount) * 4 + wave;
}
function difficultyMode(difficulty) {
  return difficulty >= 3 ? "endless" : "adventure";
}
const clampWave = (wave) => Math.max(1, wave);
const clampPlayers = (count) => Math.max(2, Math.min(4, count));
function getEnemyScaling(wave, playerCount, difficulty) {
  const w = clampWave(wave);
  const p = clampPlayers(playerCount);
  const endless = difficultyMode(difficulty) === "endless";
  const player = 1 + (p - 2) * (endless ? 0.1 : 0.09);
  const progress = endless ? 1 + 0.035 * Math.pow(w - 1, 1.08) : 1 + 0.025 * (w - 1);
  const tier = 1 + Math.max(0, difficulty - 1) * (endless ? 0.025 : 0.02);
  return { healthMultiplier: Math.min(3.25, player * progress * tier), damageMultiplier: Math.min(2.05, (1 + (p - 2) * (endless ? 0.075 : 0.06)) * (endless ? 1 + 0.022 * (w - 1) : 1 + 0.015 * (w - 1)) * tier), speedMultiplier: Math.min(1.35, 1 + (p - 2) * 0.025 + (endless ? 6e-3 : 4e-3) * (w - 1)), cooldownMultiplier: Math.max(0.8, 1 - (p - 2) * 0.025 - (endless ? 4e-3 : 3e-3) * (w - 1)) };
}
const DEFAULT_MAP_NODES = {
  spawn_1: { id: "spawn_1", kind: "spawn", x: 100, y: 100, reachableFrom: ["arena_center", "corridor_north"], safeInteractionRadius: 50, hasLineOfSight: true, distanceTo: { arena_center: 80, corridor_north: 60 }, tags: ["player_spawn"] },
  shop_cafe: { id: "shop_cafe", kind: "shop", x: 400, y: 300, reachableFrom: ["arena_center", "corridor_east"], safeInteractionRadius: 40, hasLineOfSight: true, distanceTo: { arena_center: 120, corridor_east: 90, spawn_1: 180 }, tags: ["safe_zone", "central"] },
  shop_armory: { id: "shop_armory", kind: "shop", x: 200, y: 500, reachableFrom: ["arena_south", "corridor_west"], safeInteractionRadius: 35, hasLineOfSight: true, distanceTo: { arena_south: 100, corridor_west: 75, spawn_1: 220 }, tags: ["defensive", "south"] }
};
function getShopCandidates(previousShopId, mapNodes) {
  return Object.values(mapNodes).filter((node) => node.kind === "shop" && node.id !== previousShopId && node.reachableFrom.length >= 1 && node.hasLineOfSight).map((node) => node.id);
}
function updateEntities(state, rng, events) {
  const entities = Object.values(state.entities).filter((entity) => entity.lifecycle === "active").sort((a, b) => a.id - b.id);
  for (const entity of entities) {
    entity.position = {
      x: entity.position.x + entity.velocity.x,
      y: entity.position.y + entity.velocity.y
    };
    if (entity.kind === "player" || entity.kind === "enemy") {
      const combatant = entity;
      combatant.fireCooldownTicks = Math.max(0, combatant.fireCooldownTicks - 1);
    }
    if (entity.kind === "projectile") {
      const projectile = entity;
      projectile.ageTicks += 1;
      if (projectile.ageTicks >= projectile.lifetimeTicks) {
        markDespawned(state, entity.id, "expired", events);
      }
    }
    if (entity.kind === "enemy" && rng.chance(0.05)) {
      entity.velocity = { x: rng.nextInt(-100, 100), y: rng.nextInt(-100, 100) };
    }
  }
}
function markDespawned(state, entityId, reason, events) {
  var _a;
  const entity = state.entities[entityId];
  if (!entity || entity.lifecycle === "despawned")
    return;
  entity.lifecycle = "despawned";
  entity.despawnTick = state.tick;
  events.push({
    type: "entityDespawned",
    tick: state.tick,
    entityId,
    reason,
    ...entity.kind === "enemy" ? { role: entity.enemyType, threatCost: (_a = ENEMY_ROLES[entity.enemyType]) == null ? void 0 : _a.threatCost } : {}
  });
}
function finalizeLifecycle(state, events) {
  for (const entity of Object.values(state.entities).sort((a, b) => a.id - b.id)) {
    if (entity.lifecycle === "dead" && entity.kind !== "player") {
      if (entity.kind === "enemy")
        state.score += 10;
      markDespawned(state, entity.id, "dead", events);
    }
  }
  for (const entity of Object.values(state.entities)) {
    if (entity.lifecycle === "despawned")
      delete state.entities[entity.id];
  }
}
const TICKS_PER_SECOND = 30;
const WAVE_WARNING_TICKS = 10 * TICKS_PER_SECOND;
function waveDurationTicks(waveNumber) {
  return Math.min(600 + (Math.max(1, waveNumber) - 1) * 150, 1800);
}
function emit(events, type, state) {
  events.push({ type, tick: state.tick, wave: state.wave.currentWave });
}
function advanceWavePhase(state, allPlayersReady, events) {
  if (state.wavePhase === "waveActive") {
    if (state.phase !== "playing" && state.phase !== "waveActive")
      return;
    state.waveTimerTicks += 1;
    if (state.waveTimerTicks === state.waveDurationTicks - WAVE_WARNING_TICKS)
      emit(events, "waveWarning", state);
    const players2 = Object.values(state.entities).filter((e) => e.kind === "player");
    if (players2.length > 0 && players2.every((e) => e.health <= 0 || e.lifecycle !== "active")) {
      state.wavePhase = "waveEnding";
      state.phase = "defeat";
      emit(events, "waveEnding", state);
      events.push({ type: "matchDefeated", tick: state.tick, wave: state.wave.currentWave });
      return;
    }
    if (state.waveTimerTicks >= state.waveDurationTicks) {
      state.wavePhase = "waveEnding";
      emit(events, "waveEnding", state);
    }
    return;
  }
  if (state.wavePhase === "waveEnding") {
    for (const entity of Object.values(state.entities).sort((a, b) => a.id - b.id)) {
      if (entity.kind === "enemy" && entity.lifecycle === "active")
        markDespawned(state, entity.id, "removed", events);
    }
    state.wave.waveComplete = true;
    state.wave.defeatedForWave = state.wave.spawnedForWave - Object.values(state.entities).filter((e) => e.kind === "enemy").length;
    state.wave.defeatedForWave = Math.max(0, state.wave.defeatedForWave);
    const xp = state.wave.defeatedForWave * 10 + state.waveTimerTicks;
    const materials = state.wave.defeatedForWave + Math.floor(state.waveTimerTicks / 300);
    const loot = [`wave-${state.wave.currentWave}-survival`];
    for (const playerId of Object.keys(state.players).map(Number).sort((a, b) => a - b)) {
      state.waveRewards[playerId] = { xp, materials, loot: [...loot] };
    }
    emit(events, "waveEnded", state);
    events.push({ type: "waveCompleted", tick: state.tick, wave: state.wave.currentWave });
    if (state.wave.currentWave >= state.wave.totalWaves) {
      state.wave.matchComplete = true;
      state.phase = "victory";
    } else {
      state.wavePhase = "intermission";
      state.phase = "playing";
      state.countdownTick = void 0;
      emit(events, "intermissionStarted", state);
    }
    return;
  }
  if (state.wavePhase === "intermission" && allPlayersReady) {
    state.wavePhase = "nextWaveReady";
    state.countdownTick = 30;
  } else if (state.wavePhase === "nextWaveReady") {
    state.countdownTick = Math.max(0, (state.countdownTick ?? 1) - 1);
    if (state.countdownTick === 0) {
      state.wave.currentWave += 1;
      state.wave.spawnedForWave = 0;
      state.wave.defeatedForWave = 0;
      state.wave.waveComplete = false;
      state.waveTimerTicks = 0;
      state.waveDurationTicks = waveDurationTicks(state.wave.currentWave);
      state.spawnDirector.threatBudget = 0;
      state.spawnDirector.threatSpent = 0;
      state.spawnDirector.spawnCursor = 0;
      state.spawnDirector.nextSpawnTick = 0;
      state.spawnDirector.activeComposition = {};
      state.spawnDirector.elapsedTicks = 0;
      state.spawnDirector.compositionSelectionReason = "none";
      state.wavePhase = "waveActive";
      state.phase = "playing";
      events.push({ type: "waveStarted", tick: state.tick, wave: state.wave.currentWave });
    }
  }
}
function createInitialState(seed, playerIds) {
  const state = {
    version: 1,
    tick: 0,
    seed,
    nextEntityId: 1,
    // Legacy local/headless callers begin immediately; network rooms may set
    // this to lobby and provide allPlayersReady to enter the state machine.
    phase: "playing",
    matchPhaseStartTick: 0,
    waveTimerTicks: 0,
    waveDurationTicks: waveDurationTicks(1),
    wavePhase: "waveActive",
    entities: {},
    players: {},
    wave: {
      currentWave: 1,
      totalWaves: 5,
      spawnedForWave: 0,
      defeatedForWave: 0,
      waveComplete: false,
      matchComplete: false
    },
    waveRewards: {},
    score: 0,
    difficulty: 2,
    spawnDirector: {
      threatBudget: 0,
      threatSpent: 0,
      spawnCursor: 0,
      nextSpawnTick: 0,
      activeComposition: {},
      elapsedTicks: 0,
      compositionSelectionReason: "none"
    },
    shop: {
      currentNodeId: null,
      telegraphStartTick: null,
      accessible: false,
      used: false
    },
    mapNodes: Object.fromEntries(Object.entries(DEFAULT_MAP_NODES).map(([id, node]) => [id, {
      id: node.id,
      kind: node.kind,
      x: node.x,
      y: node.y,
      navigationDistance: node.distanceTo
    }]))
  };
  for (const playerId of [...playerIds].sort((a, b) => a - b)) {
    const id = state.nextEntityId++;
    state.entities[id] = {
      id,
      kind: "player",
      lifecycle: "active",
      playerId,
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      radius: 12,
      health: 100,
      maxHealth: 100,
      spawnTick: 0,
      despawnTick: null,
      fireCooldownTicks: 0
    };
    state.players[playerId] = id;
  }
  return state;
}
function detectCollisions(state) {
  const entities = Object.values(state.entities).filter((entity) => entity.lifecycle === "active").sort((a, b) => a.id - b.id);
  const pairs = [];
  for (let i = 0; i < entities.length; i += 1) {
    for (let j = i + 1; j < entities.length; j += 1) {
      const a = entities[i];
      const b = entities[j];
      const dx = a.position.x - b.position.x;
      const dy = a.position.y - b.position.y;
      const radius = a.radius + b.radius;
      if (dx * dx + dy * dy <= radius * radius)
        pairs.push({ aId: a.id, bId: b.id });
    }
  }
  return pairs;
}
function processCollisions(state) {
  const requests = [];
  for (const { aId, bId } of detectCollisions(state)) {
    const a = state.entities[aId];
    const b = state.entities[bId];
    if (!a || !b || a.lifecycle !== "active" || b.lifecycle !== "active")
      continue;
    if (a.kind === "projectile" && a.ownerId !== b.id) {
      const projectile = a;
      requests.push({ sourceId: a.id, targetId: b.id, amount: projectile.damage });
      a.lifecycle = "despawned";
      a.despawnTick = state.tick;
    } else if (b.kind === "projectile" && b.ownerId !== a.id) {
      const projectile = b;
      requests.push({ sourceId: b.id, targetId: a.id, amount: projectile.damage });
      b.lifecycle = "despawned";
      b.despawnTick = state.tick;
    } else if (a.kind === "enemy" && b.kind === "player") {
      requests.push({ sourceId: a.id, targetId: b.id, amount: a.contactDamage });
    } else if (b.kind === "enemy" && a.kind === "player") {
      requests.push({ sourceId: b.id, targetId: a.id, amount: b.contactDamage });
    }
  }
  return requests.sort((a, b) => a.targetId - b.targetId || (a.sourceId ?? 0) - (b.sourceId ?? 0));
}
function applyDamage(state, requests, events) {
  for (const request of requests) {
    const target = state.entities[request.targetId];
    if (!target || target.lifecycle !== "active")
      continue;
    if (!Number.isFinite(request.amount) || request.amount <= 0)
      continue;
    target.health = Math.max(0, target.health - request.amount);
    events.push({
      type: "entityDamaged",
      tick: state.tick,
      targetId: target.id,
      sourceId: request.sourceId,
      amount: request.amount,
      remainingHealth: target.health
    });
    if (target.health === 0)
      target.lifecycle = "dead";
  }
}
function advanceMatchPhase(state, allPlayersReady) {
  if (state.phase === "lobby" && allPlayersReady) {
    state.phase = "countdown";
    state.matchPhaseStartTick = state.tick;
    state.countdownTick = 30;
  }
  if (state.phase === "countdown" && state.countdownTick !== void 0) {
    state.countdownTick--;
    if (state.countdownTick === 0) {
      state.phase = "waveActive";
      state.wavePhase = "waveActive";
    }
  }
}
const SHOP_RADIUS = 35;
const PLAYER_CLEARANCE = 12;
function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}
function placeShop(state, rng, events) {
  if (state.shop.currentNodeId !== null)
    return;
  const nodes = Object.values(state.mapNodes).filter((node) => node.kind === "shop");
  const metadata = Object.fromEntries(nodes.map((node) => [node.id, {
    id: node.id,
    kind: node.kind,
    x: node.x,
    y: node.y,
    reachableFrom: ["arena_center"],
    safeInteractionRadius: SHOP_RADIUS,
    hasLineOfSight: true,
    distanceTo: node.navigationDistance ?? {},
    tags: []
  }]));
  const candidates = getShopCandidates(null, metadata).filter((id) => {
    const node = state.mapNodes[id];
    const occupants = Object.values(state.entities).filter((e) => e.lifecycle === "active" && (e.kind === "player" || e.kind === "enemy"));
    return Number.isFinite(node.x) && Number.isFinite(node.y) && occupants.every((e) => distance(e.position, node) >= SHOP_RADIUS + e.radius + PLAYER_CLEARANCE);
  }).sort();
  if (!candidates.length) {
    events.push({ type: "shopUnavailable", tick: state.tick, reason: "no valid reachable shop node" });
    return;
  }
  const players2 = Object.values(state.entities).filter((e) => e.kind === "player");
  const centroid = players2.reduce((p, e) => ({ x: p.x + e.position.x, y: p.y + e.position.y }), { x: 0, y: 0 });
  if (players2.length) {
    centroid.x /= players2.length;
    centroid.y /= players2.length;
  }
  const scores = candidates.map((id) => distance(state.mapNodes[id], centroid));
  const best = Math.max(...scores);
  const tied = candidates.filter((_, i) => scores[i] === best);
  state.shop.currentNodeId = tied[rng.nextInt(0, tied.length - 1)];
  state.shop.accessible = true;
  state.shop.used = false;
  state.shop.telegraphStartTick = state.tick;
  events.push({ type: "shopTelegraphStarted", tick: state.tick, nodeId: state.shop.currentNodeId });
  events.push({ type: "shopOpened", tick: state.tick, nodeId: state.shop.currentNodeId });
}
function advanceShop(state, rng, events) {
  if (state.wavePhase === "waveActive")
    placeShop(state, rng, events);
}
const WAVE_COUNTS = [0, 3, 5, 7, 9, 11];
function enemyCount(wave) {
  return WAVE_COUNTS[Math.max(1, Math.min(WAVE_COUNTS.length - 1, wave))] ?? 3;
}
function spawnEnemies(state, rng, wave = state.wave.currentWave, events = [], maxCount = Number.POSITIVE_INFINITY) {
  const composition = state.spawnDirector.activeComposition;
  const roles = Object.keys(composition).sort();
  const queued = roles.length > 0 ? roles.flatMap((role) => Array.from({ length: composition[role] ?? 0 }, () => role)) : Array.from({ length: enemyCount(wave) }, () => "basic");
  const toSpawn = queued.slice(state.spawnDirector.spawnCursor, state.spawnDirector.spawnCursor + Math.max(0, maxCount));
  const result = [];
  for (const role of toSpawn) {
    const id = state.nextEntityId++;
    const definition = ENEMY_ROLES[role];
    const scaling = getEnemyScaling(wave, Object.keys(state.players).length, state.difficulty);
    const health = Math.max(1, Math.round((18 + wave * 2) * scaling.healthMultiplier)) + rng.nextInt(-2, 2);
    const attackCooldownTicks = Math.max(1, Math.round(((definition == null ? void 0 : definition.attackCooldown) ?? 1) * 60 * scaling.cooldownMultiplier));
    const e = { id, kind: "enemy", lifecycle: "active", position: { x: rng.nextInt(-400, 400), y: rng.nextInt(-300, 300) }, velocity: { x: 0, y: 0 }, radius: 16, health, maxHealth: health, spawnTick: state.tick, despawnTick: null, enemyType: role, contactDamage: ((definition == null ? void 0 : definition.damage) ?? 5) * scaling.damageMultiplier, fireCooldownTicks: 0, targetPlayerId: null, moveSpeed: ((definition == null ? void 0 : definition.speed) ?? 1) * scaling.speedMultiplier, attackDamage: ((definition == null ? void 0 : definition.damage) ?? 5) * scaling.damageMultiplier, attackCooldownTicks };
    state.entities[id] = e;
    state.wave.spawnedForWave++;
    result.push(e);
    events.push({ type: "entitySpawned", tick: state.tick, entityId: id, kind: "enemy", wave, role, threatCost: (definition == null ? void 0 : definition.threatCost) ?? 0 });
  }
  state.spawnDirector.spawnCursor += result.length;
  state.spawnDirector.threatSpent += result.reduce((sum, entity) => {
    var _a;
    return sum + (((_a = ENEMY_ROLES[entity.enemyType]) == null ? void 0 : _a.threatCost) ?? 0);
  }, 0);
  return result;
}
function advanceSpawnDirector(state, rng, events) {
  state.spawnDirector.elapsedTicks += 1;
  if (state.wavePhase !== "waveActive" || state.phase !== "playing")
    return;
  const composition = state.spawnDirector.activeComposition;
  const activeEnemies = Object.values(state.entities).filter((entity) => entity.kind === "enemy" && entity.lifecycle === "active").length;
  if (activeEnemies >= getMaxActiveEnemies(Object.keys(state.players).length, state.wave.currentWave))
    return;
  const total = Object.values(composition).reduce((sum, count) => sum + count, 0);
  if (total === 0 || state.spawnDirector.spawnCursor >= total)
    return;
  const duration = Math.max(1, state.waveDurationTicks);
  const cursor = state.spawnDirector.spawnCursor;
  const scheduledTick = Math.floor(cursor * Math.max(1, duration - 1) / total);
  if (state.spawnDirector.elapsedTicks - 1 < scheduledTick)
    return;
  state.spawnDirector.nextSpawnTick = state.tick + Math.max(1, Math.ceil(Math.max(1, duration - 1) / total));
  const spawned = spawnEnemies(state, rng, state.wave.currentWave, events, 1);
  if (spawned.length) {
    events.push({
      type: "spawnBatchQueued",
      tick: state.tick,
      wave: state.wave.currentWave,
      count: spawned.length,
      roles: spawned.map((enemy) => enemy.enemyType)
    });
  }
}
function selectEnemyComposition(wave, playerCount, difficulty, rng, budgetMultiplier = 1) {
  let remaining = Math.max(1, Math.round(calculateThreatBudget(wave, playerCount, difficulty) * budgetMultiplier));
  const allRoles = Object.keys(ENEMY_ROLES).filter((role) => ENEMY_ROLES[role].unlockWave <= wave).sort();
  const composition = {};
  const maxPerRolePerGroup = 2;
  while (remaining > 0) {
    const groupRoles = [...allRoles];
    for (let i = groupRoles.length - 1; i > 0; i -= 1) {
      const j = rng.nextInt(0, i);
      [groupRoles[i], groupRoles[j]] = [groupRoles[j], groupRoles[i]];
    }
    const groupComposition = {};
    const affordablePairs = [];
    for (let i = 0; i < groupRoles.length; i += 1) {
      for (let j = i + 1; j < groupRoles.length; j += 1) {
        if (ENEMY_ROLES[groupRoles[i]].threatCost + ENEMY_ROLES[groupRoles[j]].threatCost <= remaining) {
          affordablePairs.push([groupRoles[i], groupRoles[j]]);
        }
      }
    }
    let groupRemaining = remaining;
    if (affordablePairs.length > 0) {
      const [first, second] = affordablePairs[rng.nextInt(0, affordablePairs.length - 1)];
      groupComposition[first] = 1;
      groupComposition[second] = 1;
      groupRemaining -= ENEMY_ROLES[first].threatCost + ENEMY_ROLES[second].threatCost;
    }
    while (groupRemaining > 0) {
      const affordable = groupRoles.filter((role) => ENEMY_ROLES[role].threatCost <= groupRemaining && (groupComposition[role] ?? 0) < maxPerRolePerGroup);
      if (!affordable.length)
        break;
      const totalWeight = affordable.reduce((sum, role) => sum + ENEMY_ROLES[role].spawnWeight, 0);
      let roll = rng.nextFloat() * totalWeight;
      let selected = affordable[affordable.length - 1];
      for (const role of affordable) {
        roll -= ENEMY_ROLES[role].spawnWeight;
        if (roll < 0) {
          selected = role;
          break;
        }
      }
      groupRemaining -= ENEMY_ROLES[selected].threatCost;
      groupComposition[selected] = (groupComposition[selected] ?? 0) + 1;
    }
    const groupSpent = Object.entries(groupComposition).reduce((sum, [role, count]) => sum + ENEMY_ROLES[role].threatCost * count, 0);
    remaining -= groupSpent;
    for (const role of allRoles) {
      if (groupComposition[role]) {
        composition[role] = (composition[role] ?? 0) + groupComposition[role];
      }
    }
    if (groupSpent === 0)
      break;
  }
  return Object.fromEntries(Object.keys(composition).sort().map((role) => [role, composition[role]]));
}
const PLAYER_SPEED_PER_TICK = 5;
function applyCommands(state, commands, events, onFire) {
  for (const entityId of Object.values(state.players)) {
    const player = state.entities[entityId];
    const typedPlayer = player;
    if ((player == null ? void 0 : player.kind) === "player" && player.lifecycle === "active" && !typedPlayer.downed)
      player.velocity = { x: 0, y: 0 };
  }
  for (const command of commands) {
    const id = state.players[command.playerId];
    const player = state.entities[id];
    if (!player || player.lifecycle !== "active" || player.kind !== "player" || player.downed || player.health <= 0)
      continue;
    const typedPlayer = player;
    const direction = commandDirection(command);
    if (command.type === "move")
      typedPlayer.velocity = { x: clamp(direction.x, -1, 1) * PLAYER_SPEED_PER_TICK, y: clamp(direction.y, -1, 1) * PLAYER_SPEED_PER_TICK };
    if (command.type === "fire")
      onFire(state, typedPlayer, direction, events);
  }
}
function compareCommands(a, b) {
  return a.playerId - b.playerId || a.type.localeCompare(b.type);
}
function commandDirection(command) {
  return command.direction ?? { x: command.aimX ?? command.moveX ?? 0, y: command.aimY ?? command.moveY ?? 0 };
}
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
const PROJECTILE_SPEED_PER_TICK = 10;
function createPlayerProjectile(state, player, direction, events) {
  if (player.fireCooldownTicks !== 0)
    return;
  const id = state.nextEntityId++;
  state.entities[id] = {
    id,
    kind: "projectile",
    lifecycle: "active",
    ownerId: player.id,
    position: { x: player.position.x + direction.x * 20, y: player.position.y + direction.y * 20 },
    velocity: { x: direction.x * PROJECTILE_SPEED_PER_TICK, y: direction.y * PROJECTILE_SPEED_PER_TICK },
    radius: 4,
    health: 1,
    maxHealth: 1,
    spawnTick: state.tick,
    despawnTick: null,
    damage: 10,
    lifetimeTicks: 300,
    ageTicks: 0
  };
  player.fireCooldownTicks = 3;
  events.push({ type: "entitySpawned", tick: state.tick, entityId: id, kind: "projectile" });
}
const ENEMY_SPEED_PER_TICK = 2.5;
const ENEMY_PROJECTILE_SPEED_PER_TICK = 7;
const ENEMY_FIRE_RANGE = 200;
function updateEnemyAI(state, rng, events) {
  const players2 = Object.values(state.entities).filter((entity) => entity.kind === "player" && entity.lifecycle === "active");
  if (players2.length === 0)
    return;
  const player = players2.sort((a, b) => a.id - b.id)[0];
  for (const entity of Object.values(state.entities).sort((a, b) => a.id - b.id)) {
    if (entity.kind !== "enemy" || entity.lifecycle !== "active")
      continue;
    const enemy = entity;
    enemy.targetPlayerId = player.playerId;
    const dx = player.position.x - enemy.position.x;
    const dy = player.position.y - enemy.position.y;
    const distance2 = Math.hypot(dx, dy);
    const speed = enemy.moveSpeed ?? ENEMY_SPEED_PER_TICK;
    enemy.velocity = distance2 > 0 ? { x: dx / distance2 * speed, y: dy / distance2 * speed } : { x: 0, y: 0 };
    if (distance2 <= ENEMY_FIRE_RANGE && enemy.fireCooldownTicks === 0 && rng.chance(0.8)) {
      const direction = distance2 > 0 ? { x: dx / distance2, y: dy / distance2 } : { x: 1, y: 0 };
      const id = state.nextEntityId++;
      state.entities[id] = {
        id,
        kind: "projectile",
        lifecycle: "active",
        ownerId: enemy.id,
        position: { x: enemy.position.x + direction.x * 18, y: enemy.position.y + direction.y * 18 },
        velocity: { x: direction.x * ENEMY_PROJECTILE_SPEED_PER_TICK, y: direction.y * ENEMY_PROJECTILE_SPEED_PER_TICK },
        radius: 4,
        health: 1,
        maxHealth: 1,
        spawnTick: state.tick,
        despawnTick: null,
        damage: enemy.attackDamage ?? 5,
        lifetimeTicks: 180,
        ageTicks: 0
      };
      enemy.fireCooldownTicks = enemy.attackCooldownTicks ?? 45 + rng.nextInt(0, 15);
      events.push({ type: "entitySpawned", tick: state.tick, entityId: id, kind: "projectile" });
    }
  }
}
function stepCoordinator(previous, commands, context) {
  const state = structuredClone(previous);
  const events = [];
  advanceMatchPhase(state, context.allPlayersReady);
  advanceWavePhase(state, context.allPlayersReady, events);
  advanceShop(state, context.rng, events);
  if (state.wavePhase === "waveActive" && state.wave.spawnedForWave === 0 && !state.wave.waveComplete && Object.keys(state.spawnDirector.activeComposition).length === 0) {
    state.spawnDirector.threatBudget = Math.max(1, Math.round(calculateThreatBudget(state.wave.currentWave, Object.keys(state.players).length, state.difficulty) * (context.budgetMultiplier ?? 1)));
    state.spawnDirector.activeComposition = selectEnemyComposition(state.wave.currentWave, Object.keys(state.players).length, state.difficulty, context.rng, context.budgetMultiplier ?? 1);
    const selectedCost = Object.entries(state.spawnDirector.activeComposition).reduce((sum, [role, count]) => {
      var _a;
      return sum + (((_a = ENEMY_ROLES[role]) == null ? void 0 : _a.threatCost) ?? 0) * count;
    }, 0);
    const selectedRoles = Object.keys(state.spawnDirector.activeComposition);
    state.spawnDirector.compositionSelectionReason = selectedCost >= state.spawnDirector.threatBudget ? "none" : selectedRoles.length === 0 ? "unlock-gate" : selectedRoles.every((role) => (state.spawnDirector.activeComposition[role] ?? 0) >= 6) ? "role-cap" : "other";
    events.push({ type: "roleCompositionSelected", tick: state.tick, wave: state.wave.currentWave, composition: state.spawnDirector.activeComposition, groupCount: Math.ceil(Math.max(...Object.values(state.spawnDirector.activeComposition), 0) / 2) });
  }
  advanceSpawnDirector(state, context.rng, events);
  if (state.phase !== "waveActive" && state.phase !== "playing") {
    state.tick += 1;
    return { state, events, stateHash: hashGameState(state) };
  }
  const tickCommands = commands.filter((c) => c.tick === state.tick).sort(compareCommands);
  applyCommands(state, tickCommands, events, createPlayerProjectile);
  updateEnemyAI(state, context.rng, events);
  updateEntities(state, context.rng, events);
  applyDamage(state, processCollisions(state), events);
  finalizeLifecycle(state, events);
  state.tick += 1;
  return { state, events, stateHash: hashGameState(state) };
}
function step(previous, commands, context) {
  return stepCoordinator(previous, commands, { rng: context.rng, allPlayersReady: context.allPlayersReady ?? false, budgetMultiplier: context.budgetMultiplier });
}
class PlayerInputBuffer {
  constructor(playerId, options = {}) {
    this.playerId = playerId;
    this.pending = /* @__PURE__ */ new Map();
    this.consumed = /* @__PURE__ */ new Set();
    this.oneShots = /* @__PURE__ */ new Set();
    this.lastSequence = -1;
    this.maxSize = options.maxSize ?? 256;
    this.maxFutureTicks = options.maxFutureTicks ?? 12;
  }
  enqueue(value, serverTick) {
    const parsed = WireInputSchema.safeParse(value);
    if (!parsed.success)
      return false;
    const input = parsed.data;
    if (input.command.playerId !== this.playerId || input.tick !== input.command.tick || input.sequence <= this.lastSequence)
      return false;
    if (input.tick < serverTick - 2 || input.tick > serverTick + this.maxFutureTicks || this.pending.has(input.sequence))
      return false;
    const oneShot = input.command.type !== "move" ? `${input.command.type}:${input.command.type === "usePickup" ? input.command.pickupId : input.tick}` : "";
    if (oneShot && this.oneShots.has(oneShot))
      return false;
    if (this.pending.size >= this.maxSize)
      return false;
    this.pending.set(input.sequence, Object.freeze({ sequence: input.sequence, tick: input.tick, command: input.command }));
    this.lastSequence = input.sequence;
    if (oneShot)
      this.oneShots.add(oneShot);
    return true;
  }
  drain(tick) {
    const values = [...this.pending.values()].filter((v) => v.tick === tick).sort((a, b) => a.sequence - b.sequence);
    for (const value of values) {
      this.pending.delete(value.sequence);
      this.consumed.add(value.sequence);
    }
    return values.map((v) => v.command);
  }
  acknowledge(sequence) {
    for (const key of this.pending.keys())
      if (key <= sequence)
        this.pending.delete(key);
  }
  get size() {
    return this.pending.size;
  }
  get lastAcceptedSequence() {
    return this.lastSequence;
  }
}
class Room {
  constructor(id, seed = 1) {
    this.id = id;
    this.slots = /* @__PURE__ */ new Map();
    this.inputs = /* @__PURE__ */ new Map();
    this.lifecycleEvents = [];
    this.simulationEvents = [];
    this.nextEventSequence = 0;
    this.rng = new SeededRandom(seed);
    this.state = createInitialState(seed, []);
  }
  join(socketId, reconnectToken) {
    const existing = [...this.slots.values()].find((s) => s.socketId === socketId);
    if (existing)
      return existing;
    const disconnected = [...this.slots.values()].find((s) => !s.connected && (!reconnectToken || s.reconnectToken === reconnectToken));
    if (reconnectToken && !disconnected && [...this.slots.values()].some((s) => !s.connected))
      return null;
    if (!disconnected && this.connectedCount() >= MAX_PLAYERS)
      return null;
    if (disconnected) {
      disconnected.connected = true;
      disconnected.socketId = socketId;
      disconnected.ready = false;
      this.lifecycleEvents.push({ type: "reconnected", tick: this.state.tick, playerId: disconnected.playerId });
      return disconnected;
    }
    const playerId = this.slots.size + 1;
    const entityId = this.state.nextEntityId++;
    const slot = { playerId, entityId, connected: true, ready: false, socketId, reconnectToken: crypto.randomUUID() };
    this.slots.set(playerId, slot);
    this.inputs.set(playerId, new PlayerInputBuffer(playerId));
    this.state.players[playerId] = entityId;
    this.state.entities[entityId] = { id: entityId, kind: "player", lifecycle: "active", playerId, position: { x: playerId * 30, y: 0 }, velocity: { x: 0, y: 0 }, radius: 12, health: 100, maxHealth: 100, spawnTick: this.state.tick, despawnTick: null, fireCooldownTicks: 0 };
    this.lifecycleEvents.push({ type: "joined", tick: this.state.tick, playerId });
    return slot;
  }
  ready(playerId, value = true) {
    const slot = this.slots.get(playerId);
    if (!slot || !slot.connected)
      return false;
    slot.ready = value;
    return true;
  }
  disconnect(socketId) {
    const slot = [...this.slots.values()].find((s) => s.socketId === socketId);
    if (slot) {
      slot.connected = false;
      slot.socketId = null;
      slot.ready = false;
      slot.disconnectedAt = Date.now();
      this.lifecycleEvents.push({ type: "disconnected", tick: this.state.tick, playerId: slot.playerId });
    }
  }
  drainLifecycleEvents() {
    return this.lifecycleEvents.splice(0);
  }
  enqueueSimulationEvents(events) {
    this.simulationEvents.push(...events);
  }
  drainSimulationEvents() {
    return this.simulationEvents.splice(0);
  }
  allocateEventSequence() {
    return this.nextEventSequence++;
  }
  connectedCount() {
    return [...this.slots.values()].filter((s) => s.connected).length;
  }
  allReady() {
    const connected = [...this.slots.values()].filter((s) => s.connected);
    return connected.length > 0 && connected.every((s) => s.ready);
  }
}
class RoomManager {
  constructor() {
    this.rooms = /* @__PURE__ */ new Map();
  }
  getOrCreate(id, seed = 1) {
    let room = this.rooms.get(id);
    if (!room) {
      room = new Room(id, seed);
      this.rooms.set(id, room);
    }
    return room;
  }
  get(id) {
    return this.rooms.get(id);
  }
  remove(id) {
    this.rooms.delete(id);
  }
}
function canonical(value) {
  if (typeof value === "number")
    return Number(value.toFixed(6));
  if (Array.isArray(value))
    return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((o, k) => {
      o[k] = canonical(value[k]);
      return o;
    }, {});
  }
  return value;
}
function snapshotChecksum(snapshot) {
  const text = JSON.stringify(canonical(snapshot));
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
function serializeCanonicalSnapshot(state, rng, dev = false) {
  const snapshot = { schemaVersion: 1, tick: state.tick, state: structuredClone(state), stateHash: hashGameState(state), rngState: rng.serialize() };
  return dev ? { ...snapshot, checksum: snapshotChecksum(snapshot) } : snapshot;
}
class FixedTickLoop {
  constructor(room, options = {}) {
    this.room = room;
    this.options = options;
    this.timer = null;
    this.nextTime = 0;
    this.maxCatchUp = options.maxCatchUp ?? 5;
  }
  start() {
    if (this.timer)
      return;
    const now = this.options.now ?? (() => Date.now());
    this.nextTime = now();
    this.timer = setInterval(() => this.pump(now()), TICK_MS);
  }
  stop() {
    if (this.timer)
      clearInterval(this.timer);
    this.timer = null;
  }
  pump(now = (this.options.now ?? (() => Date.now()))()) {
    if (!this.nextTime)
      this.nextTime = now;
    let count = 0;
    while (now >= this.nextTime && count < this.maxCatchUp) {
      this.tick();
      this.nextTime += TICK_MS;
      count++;
    }
    if (count === this.maxCatchUp && now >= this.nextTime)
      this.nextTime = now + TICK_MS;
    return count;
  }
  tick() {
    var _a, _b, _c, _d, _e, _f;
    for (const event of this.room.drainLifecycleEvents())
      (_b = (_a = this.options).onRoomEvent) == null ? void 0 : _b.call(_a, this.room, event);
    const commands = [...this.room.inputs.entries()].sort(([a], [b]) => a - b).flatMap(([id, buffer]) => buffer.drain(this.room.state.tick).map((c) => ({ ...c, playerId: id })));
    const result = step(this.room.state, commands, { rng: this.room.rng, allPlayersReady: this.room.allReady() });
    this.room.state = result.state;
    this.room.enqueueSimulationEvents(result.events);
    (_d = (_c = this.options).onSnapshot) == null ? void 0 : _d.call(_c, this.room, serializeCanonicalSnapshot(this.room.state, this.room.rng, true));
    const events = this.room.drainSimulationEvents();
    if (events.length)
      (_f = (_e = this.options).onSimulationEvents) == null ? void 0 : _f.call(_e, this.room, events);
  }
}
const rooms = new RoomManager();
const io = new socket_io.Server({ cors: { origin: "*" } });
const loops = /* @__PURE__ */ new Map();
const socketRooms = /* @__PURE__ */ new Map();
io.on("connection", (socket) => {
  socket.emit(EVENTS.hello, { protocol: PROTOCOL_VERSION, serverTick: 0, tickRate: TICK_RATE });
  socket.on(EVENTS.joinRoom, (data) => {
    const roomId = (data == null ? void 0 : data.roomId) || "default";
    const room = rooms.getOrCreate(roomId, `match:${roomId}`);
    const slot = room.join(socket.id, data == null ? void 0 : data.reconnectToken);
    if (!slot) {
      socket.emit(EVENTS.error, { code: "ROOM_FULL" });
      return;
    }
    socketRooms.set(socket.id, roomId);
    socket.join(roomId);
    socket.emit(EVENTS.joinedRoom, { roomId, playerId: slot.playerId, slot: slot.playerId - 1, reconnectToken: slot.reconnectToken });
    io.to(roomId).emit(EVENTS.initialState, serializeCanonicalSnapshot(room.state, room.rng, true));
    if (!loops.has(roomId)) {
      const loop = new FixedTickLoop(room, {
        onSnapshot: (r, snapshot) => {
          var _a, _b;
          for (const slot2 of r.slots.values()) {
            if (!slot2.connected || !slot2.socketId)
              continue;
            const acknowledgedThrough = ((_a = r.inputs.get(slot2.playerId)) == null ? void 0 : _a.lastAcceptedSequence) ?? -1;
            (_b = io.sockets.sockets.get(slot2.socketId)) == null ? void 0 : _b.emit(EVENTS.snapshot, { ...snapshot, acknowledgedThrough });
          }
        },
        onRoomEvent: (r, event) => io.to(r.id).emit(EVENTS.room, { roomId: r.id, event }),
        onSimulationEvents: (r, events) => {
          for (const event of events) {
            const message = { schemaVersion: 1, sequence: r.allocateEventSequence(), event };
            io.to(r.id).emit(EVENTS.event, message);
          }
        }
      });
      loops.set(roomId, loop);
      loop.start();
    }
  });
  socket.on(EVENTS.ready, (data) => {
    const room = rooms.get(socketRooms.get(socket.id) ?? "");
    const slot = room && [...room.slots.values()].find((s) => s.socketId === socket.id);
    if (room && slot)
      room.ready(slot.playerId, (data == null ? void 0 : data.ready) !== false);
  });
  socket.on(EVENTS.input, (data) => {
    var _a;
    const room = rooms.get(socketRooms.get(socket.id) ?? "");
    const slot = room && [...room.slots.values()].find((s) => s.socketId === socket.id);
    if (!room || !slot)
      return;
    try {
      const wire = validateWireInput(data);
      (_a = room.inputs.get(slot.playerId)) == null ? void 0 : _a.enqueue({ ...wire, command: { ...wire.command, playerId: slot.playerId } }, room.state.tick);
    } catch {
      socket.emit(EVENTS.error, { code: "INVALID_INPUT" });
    }
  });
  socket.on("disconnect", () => {
    var _a;
    const id = socketRooms.get(socket.id);
    if (id)
      (_a = rooms.get(id)) == null ? void 0 : _a.disconnect(socket.id);
    socketRooms.delete(socket.id);
  });
});
const server = node_http.createServer();
io.attach(server, { cors: { origin: "*" } });
function shutdown() {
  for (const loop of loops.values())
    loop.stop();
  loops.clear();
  io.close();
}
if (process.env.NODE_ENV !== "test")
  server.listen(Number(process.env.PORT ?? 3001), () => console.log("Mercicat server running"));
exports.io = io;
exports.rooms = rooms;
exports.server = server;
exports.shutdown = shutdown;
