export type EntityId = number;
export type PlayerId = number;
export type Tick = number;

export interface Vec2 {
  x: number;
  y: number;
}

export type EntityKind =
  | "player"
  | "enemy"
  | "projectile"
  | "pickup"
  | "obstacle";

export type EntityLifecycle = "active" | "dead" | "despawned";

export interface BaseEntity {
  readonly id: EntityId;
  readonly kind: EntityKind;
  lifecycle: EntityLifecycle;
  position: Vec2;
  velocity: Vec2;
  radius: number;
  health: number;
  maxHealth: number;
  spawnTick: Tick;
  despawnTick: Tick | null;
}

export interface PlayerEntity extends BaseEntity {
  readonly kind: "player";
  playerId: PlayerId;
  fireCooldownTicks: number;
  deadSinceTick?: Tick;
  respawnCount?: number;
  /** A defeated player is downed for the remainder of the wave. */
  downed?: boolean;
}

export interface EnemyEntity extends BaseEntity {
  readonly kind: "enemy";
  enemyType: string;
  contactDamage: number;
  fireCooldownTicks: number;
  targetPlayerId: PlayerId | null;
}

export interface ProjectileEntity extends BaseEntity {
  readonly kind: "projectile";
  ownerId: EntityId;
  damage: number;
  lifetimeTicks: number;
  ageTicks: number;
}

export interface PickupEntity extends BaseEntity {
  readonly kind: "pickup";
  pickupType: string;
}

export type GameEntity =
  | PlayerEntity
  | EnemyEntity
  | ProjectileEntity
  | PickupEntity
  | BaseEntity;

export interface WaveState {
  currentWave: number;
  totalWaves: number;
  spawnedForWave: number;
  defeatedForWave: number;
  waveComplete: boolean;
  matchComplete: boolean;
}

export type EnemyRole = "swarm" | "charger" | "ranged" | "tank" | "disabler" | "flanker";
export type Difficulty = 1 | 2 | 3 | 4;

export interface SpawnDirectorState {
  threatBudget: number;
  threatSpent: number;
  spawnCursor: number;
  nextSpawnTick: number;
  activeComposition: Record<string, number>;
  elapsedTicks: number;
}

export interface ShopState {
  currentNodeId: string | null;
  telegraphStartTick: number | null;
  accessible: boolean;
  used: boolean;
}

export interface MapNodeState {
  id: string;
  kind: "spawn" | "shop" | "objective";
  x: number;
  y: number;
  navigationDistance?: Record<string, number>;
}

export interface GameState {
  readonly version: 1;
  tick: Tick;
  readonly seed: number | string;
  nextEntityId: EntityId;
  /** Legacy phases remain readable for replay compatibility. */
  phase: GamePhase;
  matchPhaseStartTick: Tick;
  countdownTick?: Tick;
  waveTimerTicks: number;
  waveDurationTicks: number;
  wavePhase: WavePhase;
  entities: Record<EntityId, GameEntity>;
  players: Record<PlayerId, EntityId>;
  wave: WaveState;
  /** Per-player/shared deterministic reward ledger, populated at wave end. */
  waveRewards: Record<number, { xp: number; materials: number; loot: string[] }>;
  score: number;
  difficulty: Difficulty;
  spawnDirector: SpawnDirectorState;
  shop: ShopState;
  mapNodes: Record<string, MapNodeState>;
}

/** Current phases are the four values below; legacy values remain accepted by the
 * wire type so older replay/test fixtures can still be decoded. */
export type WavePhase = "waveActive" | "waveEnding" | "intermission" | "nextWaveReady";

export type GamePhase = "lobby" | "countdown" | "waveActive" | "gameOver" | "playing" | "victory" | "defeat";

export interface InputCommand {
  type: "move" | "fire" | "reload" | "ability" | "pause" | "usePickup" | "readyForNextWave";
  tick: Tick;
  playerId: PlayerId;
  moveX?: number;
  moveY?: number;
  aimX?: number;
  aimY?: number;
  reloadTick?: Tick;
  abilityId?: string;
  /** Deprecated wire aliases retained for clients from protocol v2. */
  direction?: Vec2;
  pickupId?: EntityId;
}

export type SimulationEvent =
  | {
      type: "waveWarning" | "waveEnding" | "waveEnded" | "intermissionStarted";
      tick: Tick;
      wave: number;
    }
  | {
      type: "entitySpawned";
      tick: Tick;
      entityId: EntityId;
      kind: EntityKind;
    }
  | {
      type: "entityDamaged";
      tick: Tick;
      targetId: EntityId;
      sourceId: EntityId | null;
      amount: number;
      remainingHealth: number;
    }
  | {
      type: "entityDespawned";
      tick: Tick;
      entityId: EntityId;
      reason: "dead" | "expired" | "removed";
    }
  | {
      type: "waveStarted" | "waveCompleted" | "matchCompleted" | "matchDefeated";
      tick: Tick;
      wave: number;
    }
  | {
      type: "shopTelegraphStarted" | "shopOpened" | "shopMoved";
      tick: Tick;
      nodeId: string;
    }
  | { type: "shopUnavailable"; tick: Tick; reason: string }
  | { type: "spawnBatchQueued"; tick: Tick; wave: number; count: number; roles: EnemyRole[] }
  | { type: "roleCompositionSelected"; tick: Tick; composition: Record<EnemyRole, number> };

export interface SimulationResult {
  readonly state: GameState;
  readonly events: readonly SimulationEvent[];
  readonly stateHash: string;
}
