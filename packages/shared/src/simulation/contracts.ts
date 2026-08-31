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

export interface GameState {
  readonly version: 1;
  tick: Tick;
  readonly seed: number | string;
  nextEntityId: EntityId;
  phase: "playing" | "victory" | "defeat";
  entities: Record<EntityId, GameEntity>;
  players: Record<PlayerId, EntityId>;
  wave: WaveState;
  score: number;
}

export interface InputCommand {
  type: "move" | "fire" | "reload" | "ability" | "pause" | "usePickup";
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
    };

export interface SimulationResult {
  readonly state: GameState;
  readonly events: readonly SimulationEvent[];
  readonly stateHash: string;
}
