import type { EntityId, EntityKind, EnemyRole, PlayerId, LegacySimulationEvent, Tick } from "../simulation/contracts.js";

export type RejectionReason =
  | "not_intermission" | "insufficient_credits" | "offer_unavailable" | "inventory_full"
  | "already_owned" | "not_owner" | "out_of_range" | "downed" | "duplicate_command" | "invalid_state";

export interface EntitySpawnedEvent { type: "entitySpawned"; tick: Tick; entityId: EntityId; kind: EntityKind; wave?: number; role?: EnemyRole; threatCost?: number }
export interface EntityDamagedEvent { type: "entityDamaged"; tick: Tick; targetId: EntityId; sourceId: EntityId | null; amount: number; remainingHealth: number }
export interface WaveStartedEvent { type: "waveStarted"; tick: Tick; wave: number }
export interface WaveCompletedEvent { type: "waveCompleted"; tick: Tick; wave: number }
export interface MatchCompletedEvent { type: "matchCompleted"; tick: Tick; wave: number }
export interface CreditsAwardedEvent { type: "creditsAwarded"; tick: Tick; playerId: PlayerId; amount: number; reason?: string }
export interface XpAwardedEvent { type: "xpAwarded"; tick: Tick; playerId: PlayerId; amount: number; reason?: string }
export interface LootDroppedEvent { type: "lootDropped"; tick: Tick; lootId: string; entityId?: EntityId; playerId?: PlayerId }
export interface PlayerDownedEvent { type: "playerDowned"; tick: Tick; playerId: PlayerId; entityId?: EntityId }
export interface PlayerRevivedEvent { type: "playerRevived"; tick: Tick; playerId: PlayerId; entityId?: EntityId }
export interface PursuerDownedEvent { type: "pursuerDowned"; tick: Tick; entityId: EntityId; playerId?: PlayerId }
export interface ShopOpenedEvent { type: "shopOpened"; tick: Tick; nodeId: string }
export interface ShopClosedEvent { type: "shopClosed"; tick: Tick; nodeId: string }

export type SimulationEvent =
  | EntitySpawnedEvent | EntityDamagedEvent | WaveStartedEvent | WaveCompletedEvent | MatchCompletedEvent
  | CreditsAwardedEvent | XpAwardedEvent | LootDroppedEvent | PlayerDownedEvent | PlayerRevivedEvent
  | PursuerDownedEvent | ShopOpenedEvent | ShopClosedEvent | LegacySimulationEvent;
