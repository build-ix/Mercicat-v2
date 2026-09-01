# Mercicat v2 — Phase 0 Detailed Implementation Blueprint

**Repository:** `/home/alfr/mercicat-rebuild`  
**Audience:** implementation subagents  
**Rule:** preserve the public contracts and legacy replay adapters already present. Do not add gameplay rules to `apps/server` or `apps/client`.

## Non-negotiable conventions

- Simulation rate is exactly `TICKS_PER_SECOND = 30`; timers, cooldowns, lifetimes, and telegraphs are ticks.
- `step` is the only state transition: `step(previous, commands, context): SimulationResult`.
- State is copied before modification (`structuredClone` is acceptable); never mutate `previous`.
- Iterate IDs and command lists in ascending stable order. Never depend on object insertion order.
- RNG is passed through context. Use named streams (`wave`, `enemySpawn`, `loot`, `weaponSpread`, `ai`); no `Math.random()` in gameplay code.
- Content modules contain immutable data only; simulation consumes content through a registry/definitions interface.
- All numeric gameplay values are integer/fixed-point. Do not introduce time-based floating-point behavior.
- Focused tests live beside the owning package; Phase 0 gate is `pnpm typecheck && pnpm test && pnpm build`.

## Existing baseline to preserve

`packages/shared/src/random/SeededRandom.ts` already exposes `next()`, `nextFloat()`, `nextInt(min,max?)`, `chance`, `pick`, `getState`, `setState`, `serialize`, and `deserialize`. Existing simulation entry points are `createInitialState(seed, playerIds)`, `step(previous, commands, context)`, and `stepCoordinator`. Existing Phase 3A/3B spawning modules and tests must be migrated/adapted, not duplicated.

---

## P0.1 — Freeze contracts and versioning

### 1. Purpose
Create the serializable, versioned vocabulary that every later task can compile against: state fields, entities, commands, events, rejection codes, replay headers, and RNG snapshot fields.

### 2. Numbered implementation steps

1. In `packages/shared/src/contracts/replay.ts`, export:
   ```ts
   export const CONTENT_VERSION = 1 as const;
   export const REPLAY_VERSION = 1 as const;
   export interface ReplayHeader { replayVersion: number; contentVersion: number; seed: number|string; playerIds: number[]; mode: string; difficulty: number; }
   export interface ReplayRecord extends ReplayHeader { commands: InputCommand[]; tickHashes: string[]; finalHash: string; }
   export function assertReplayVersion(header: ReplayHeader): void;
   ```
   Throw `Error("Unsupported replay version: <n>")` or `Error("Unsupported content version: <n>")` for unsupported versions.
2. In `packages/shared/src/contracts/rng.ts`, export `RngState = Record<RngStreamName, string>` and `RngStreamName = "wave"|"enemySpawn"|"loot"|"weaponSpread"|"ai"`. Keep the type independent of simulation/content.
3. Extend `packages/shared/src/simulation/contracts.ts` `GameState` with `contentVersion`, `replayVersion`, player combat/build placeholders (`aim`, `weaponIds`, `weaponLevels`, `fireCooldownTicks`, `downed`, `xp`, `credits`, `inventory`), and `rewardLedger`; add enemy `role`, `tier`, `threatCost`, `isBoss`, `telegraphEndTick`, `downed`, and `targetPlayerId` fields. Use nullable fields when preserving old fixtures.
4. Add `commandId: string` to `InputCommand`; constrain numeric inputs at decoding boundaries. Keep `direction` as a deprecated alias only in protocol decoding.
5. In `packages/shared/src/contracts/simulationEvents.ts`, move/export the discriminated `SimulationEvent` union. Include stable payloads for `entitySpawned`, `entityDamaged`, `entityDespawned`, `projectileExpired`, `waveStarted`, `waveCompleted`, `matchCompleted`, `matchDefeated`, and reserved `creditsAwarded`, `xpAwarded`, `lootDropped`, `playerDowned`, `playerRevived`, `playerDefeated`, `pursuerDowned`, `shopOpened`, `shopClosed`.
6. Export exact rejection union `RejectionReason = "not_intermission"|"insufficient_credits"|"offer_unavailable"|"inventory_full"|"already_owned"|"not_owner"|"out_of_range"|"downed"|"duplicate_command"|"invalid_state"`.
7. Re-export new contracts from `packages/shared/src/index.ts`; update encode/decode fixtures without changing legacy version-1 meanings.

### 3. Dependencies
- Existing: `packages/shared/src/simulation/contracts.ts`, `contracts/entities.ts`, `contracts/simulationEvents.ts`, `shared/src/index.ts`.
- Create: `contracts/replay.ts`, `contracts/rng.ts`.
- No imports from simulation, content, apps, or server.

### 4. Determinism constraints
Contracts and validators are pure. Preserve field presence/nullability during serialization. Sort `playerIds`, entity IDs, and command IDs in canonical helpers; never use timestamps or generated IDs in fixtures.

### 5. Acceptance tests
Create `packages/shared/src/contracts/contracts.test.ts`: compile a typed fixture containing every required field; assert replay encode/decode deep-equals; assert unsupported versions throw exact documented errors; assert every required event/rejection literal is assignable; assert legacy fixture either deep-equals or rejects with version error (never silently reinterpret).

### 6. Order
1→2→3→4→5→6→7. Do not begin P0.2–P0.9 against unexported or guessed types.

### 7. Estimate
**180–260 LOC** including tests and migration adapters.

### 8. Pitfalls / mitigations
- Breaking old fixtures: make additions optional during decode, then normalize to defaults.
- Numeric NaN/Infinity: reject in decoder, not in renderer.
- Event drift: one discriminated union and literal tests prevent misspellings.

---

## P0.2 — Persistent, auditable RNG streams

### 1. Purpose
Make every random decision reproducible and independently restorable.

### 2. Numbered implementation steps

1. Modify `packages/shared/src/random/SeededRandom.ts` to retain current Mulberry32 behavior and add explicit signatures:
   ```ts
   nextFloat(): number;                 // [0,1)
   nextInt(maxExclusive: number): number; // [0,maxExclusive), overload existing inclusive form only if compatibility requires it
   pickStable<T>(items: readonly T[], key: (item:T)=>string): T;
   serialize(): string;
   static deserialize(value: string): SeededRandom;
   ```
   Validate integer bounds and empty arrays.
2. Create `packages/shared/src/random/randomStreams.ts`:
   ```ts
   export interface RandomStreams { wave: SeededRandom; enemySpawn: SeededRandom; loot: SeededRandom; weaponSpread: SeededRandom; ai: SeededRandom; }
   export function createRandomStreams(seed:number|string): RandomStreams;
   export function serializeRandomStreams(streams:RandomStreams): RngState;
   export function restoreRandomStreams(state:RngState): RandomStreams;
   ```
   Derive each stream from `hashSeed(`${seed}::${name}`)` and never share instances.
3. Extend `SimulationContext` in `packages/simulation/src/engine/simulationContext.ts` with `readonly rng: RandomStreams` (temporarily accept the legacy single RNG through an adapter).
4. Update `packages/simulation/src/step.ts`, `createInitialState.ts`, and callers to construct/forward streams; do not store mutable RNG in `GameState`.
5. Add `packages/shared/src/random/SeededRandom.test.ts` with 100 seeds, suffix restore, stream independence, bounds, and empty-pick rejection.
6. Add `packages/shared/src/random/randomAudit.test.ts` scanning `packages/simulation/src`, `packages/content/src`, and gameplay portions of `apps/server/src` for `Math.random(`; assert zero matches.

### 3. Dependencies
- Existing `SeededRandom.ts`, `hashSeed`, `SimulationContext`.
- Create `randomStreams.ts` and tests.
- P0.1 `RngState` is required.

### 4. Determinism constraints
Only the owning named stream may be consumed by a decision. `wave` never supplies weapon spread; advancing `ai` cannot alter `loot`. `pickStable` sorts a copy by key before consuming one draw. No module-level singleton RNG.

### 5. Acceptance tests
For each of 100 seeds, two instances produce identical 1,000-value sequences. Restore at draw 37 and assert the next 500 values equal the original suffix. Advance every stream except `loot`; assert `loot` sequence unchanged. Assert all `nextInt(7)` values satisfy `0 <= n < 7`. Audit count is zero.

### 6. Order
1 API compatibility→2 factory/serialization→3 context adapter→4 call-site migration→5 unit tests→6 source audit.

### 7. Estimate
**120–180 LOC**.

### 8. Pitfalls / mitigations
- Existing inclusive `nextInt(min,max)` callers: retain a clearly named compatibility overload or migrate all callers in one change; add boundary tests.
- Restoring only the base seed: serialize each stream state, not just seed.
- Hidden RNG consumption: require every RNG call to appear in a named system and review the audit.

---

## P0.3 — Pure fixed-order step pipeline

### 1. Purpose
Establish one replay-compatible, one-tick state transition with deterministic command handling and system order.

### 2. Numbered implementation steps

1. Create `packages/simulation/src/engine/systemOrder.ts`:
   ```ts
   export const SYSTEM_ORDER = ["normalizeCommands","phaseTimer","playerMovementAim","weaponFire","projectileMovement","collisionDamage","enemyAI","deathDown","spawnDirector","eventFinalization","canonicalHash"] as const;
   export type SystemName = typeof SYSTEM_ORDER[number];
   ```
2. In `packages/simulation/src/engine/stepCoordinator.ts`, expose:
   ```ts
   export function stepCoordinator(previous: GameState, commands: readonly InputCommand[], context: SimulationContext): SimulationResult;
   ```
   Clone `previous`; filter `command.tick === state.tick`; sort by numeric `playerId`, then lexical `commandId`; reject duplicate command IDs once with `duplicate_command`.
3. Call systems in the exact `SYSTEM_ORDER`; keep `state.tick += 1` exactly once even in lobby/intermission/no-command paths.
4. Split helpers only when needed: `normalizeCommands`, `finalizeEvents`, and `canonicalHash` should be pure functions in `packages/simulation/src/engine/`.
5. Ensure each existing system (`inputSystem`, combat systems, enemy AI, spawn director, lifecycle) receives state plus explicit dependencies and returns events/patches; it must not mutate `previous` or consume an undeclared stream.
6. Export the public facade from `packages/simulation/src/step.ts` and preserve legacy context adaptation.

### 3. Dependencies
- Existing `stepCoordinator.ts`, systems, `SimulationResult`, `hashGameState`.
- Create `systemOrder.ts`; modify coordinator/context/step.
- P0.1 and P0.2 contracts/RNG required.

### 4. Determinism constraints
System order is a compatibility contract. Stable sort commands and all entity loops. Future/past commands are ignored, not applied opportunistically. No wall-clock access.

### 5. Acceptance tests
Create `packages/simulation/tests/stepPipeline.test.ts`: assert a current-tick command applies; future and past commands do not; 100 permutations of the same command list yield deep-equal state/events/hash; no-command call increments tick once; duplicate IDs produce one rejection; instrument a fixture and assert exact `SYSTEM_ORDER`.

### 6. Order
1 order constant→2 command normalization→3 coordinator ordering→4 migrate systems→5 facade→6 tests.

### 7. Estimate
**180–280 LOC**.

### 8. Pitfalls / mitigations
- Existing coordinator consumes RNG in legacy order: document/migrate order once and lock it with a fixture.
- `structuredClone` can hide accidental mutation tests: compare frozen input before/after.
- Duplicate commands must not consume RNG or partially mutate state.

---

## P0.4 — Player movement, aim, and safe bounds

### 1. Purpose
Provide fixed-tick movement and aim normalization that cannot escape the map or create invalid numbers.

### 2. Numbered implementation steps

1. In `packages/simulation/src/combat/aim.ts`, export:
   ```ts
   export interface AimVector { x:number; y:number; }
   export function normalizeAim(x:number|undefined, y:number|undefined): AimVector;
   ```
   Clamp inputs to `[-1,1]`; return `{x:1,y:0}` only when the contract’s default aim is required, otherwise `{0,0}` for zero aim; never return NaN/Infinity.
2. In `packages/simulation/src/combat/bounds.ts`, export:
   ```ts
   export interface Bounds { minX:number; maxX:number; minY:number; maxY:number; }
   export function clampPosition(position:Vec2, radius:number, bounds:Bounds): Vec2;
   ```
   Clamp center by radius so the whole player remains inside the map.
3. Modify `packages/simulation/src/entities/movement.ts` to export pure `moveEntity(position:Vec2, input:Vec2, speed:number, bounds:Bounds): Vec2` and use integer/fixed-point quantization agreed by the contract.
4. Modify `packages/simulation/src/systems/inputSystem.ts`: `applyCommands(state, commands, events, createProjectile)` processes sorted players, clamps move/aim, skips dead/downed movement as specified, and writes velocity/position only on the cloned state.
5. Add `packages/simulation/tests/combat/movement.test.ts` and `aim.test.ts`.

### 3. Dependencies
- Existing `inputSystem.ts`, `entities/movement.ts`, `Vec2`, `PLAYER_SPEED_PER_TICK`.
- Create `combat/aim.ts`, `combat/bounds.ts`.
- P0.3 pipeline required.

### 4. Determinism constraints
Movement is pure and RNG-free. Iterate player IDs ascending. Equivalent command values produce byte-identical positions; no frame delta, DOM, or `Date.now()`.

### 5. Acceptance tests
Assert normalized components are bounded and finite for zero, diagonal, `±Infinity`, NaN, and huge inputs. Assert radius-aware edge clamping. Run an identical 120-tick script twice and deep-equal positions. Assert a dead/downed player does not move and player cannot cross any boundary.

### 6. Order
1 aim→2 bounds→3 movement→4 input integration→5 tests.

### 7. Estimate
**130–210 LOC**.

### 8. Pitfalls / mitigations
- Normalizing diagonal input changes speed: normalize only aim unless movement contract explicitly requires vector normalization; test both.
- Radius omitted from clamp causes clipping: bounds test must use nonzero radius.
- Legacy `direction` alias: normalize it once at protocol/command boundary.

---

## P0.5 — Pistol fire and projectile lifecycle

### 1. Purpose
Implement the first data-driven weapon: one manual aimed Pistol shot, deterministic cooldown, movement, expiry, and events.

### 2. Numbered implementation steps

1. Create `packages/content/src/weapons/definitions.ts`:
   ```ts
   export interface WeaponDefinition { id:string; kind:"manual"; damage:number; cooldownTicks:number; projectileSpeed:number; lifetimeTicks:number; spreadFixed:number; }
   export const PISTOL: Readonly<WeaponDefinition>;
   export const WEAPON_DEFINITIONS: Readonly<Record<string,WeaponDefinition>>;
   ```
   Use integer values and `spreadFixed = 0` for Phase 0.
2. Add the weapon definitions to `packages/content/src/registry/ContentRegistry.ts` and `createDefaultRegistry.ts`; export through `packages/content/src/index.ts`.
3. Create `packages/simulation/src/combat/weaponSystem.ts`:
   ```ts
   export function tryFireWeapon(state:GameState, playerId:PlayerId, definition:WeaponDefinition, streams:RandomStreams, events:SimulationEvent[]): ProjectileEntity|null;
   ```
   Return null for cooldown/downed/invalid aim; decrement cooldown once per tick; use `weaponSpread` only when `spreadFixed !== 0`.
4. Create `packages/simulation/src/combat/projectileSystem.ts`:
   ```ts
   export function advanceProjectiles(state:GameState, events:SimulationEvent[]): void;
   export function spawnProjectile(state:GameState, ownerId:EntityId, spec:ProjectileSpec): ProjectileEntity;
   ```
   Allocate `nextEntityId` monotonically; record owner, damage, velocity, lifetime, age, spawn tick; expire exactly when `ageTicks >= lifetimeTicks` and emit one `projectileExpired`/`entityDespawned` event.
5. Modify `playerCombatSystem.ts` to delegate to these functions; do not retain a second projectile implementation.
6. Add `packages/simulation/tests/combat/weapon.test.ts` and `projectile.test.ts`.

### 3. Dependencies
- Existing player combat facade, entity contracts, `SeededRandom`/streams.
- Create weapon/projectile systems and content definitions; modify registry/exports.
- P0.1–P0.4 required.

### 4. Determinism constraints
No elapsed milliseconds. IDs allocate only on authoritative valid fire. Sort projectile IDs before movement/expiry. Spread consumes only `weaponSpread`; Phase 0 pistol consumes zero spread draws.

### 5. Acceptance tests
Fire with cooldown >0 creates no projectile and leaves ID/RNG unchanged. Valid fire creates exactly one projectile with expected owner/damage/velocity/lifetime/spawn tick. Assert expiry on the exact lifetime tick and one event only. Assert two identical seed/input runs have identical projectile IDs, states, events, and hashes.

### 6. Order
1 content type/definition→2 registry→3 spawn helper→4 fire validation→5 movement/expiry→6 facade→7 tests.

### 7. Estimate
**180–270 LOC**.

### 8. Pitfalls / mitigations
- Off-by-one expiry: define age at start/end of tick in one test fixture.
- Projectile IDs allocated before validation: allocate after all checks pass.
- Collision system also moving projectiles: assign movement to exactly one pipeline stage.

---

## P0.6 — Enemy factory, roles, AI, collision, and damage

### 1. Purpose
Create deterministic Swarm and Charger enemies, target movement, arrival telegraphs, ordered collision, and exact damage/death transitions.

### 2. Numbered implementation steps

1. In `packages/content/src/enemies/definitions.ts` (create if absent), export:
   ```ts
   export type EnemyTier = "small"|"medium"|"large";
   export interface EnemyDefinition { role:"swarm"|"charger"; tier:EnemyTier; threatCost:number; maxHealth:number; radius:number; moveSpeed:number; contactDamage:number; attackCooldownTicks:number; telegraphTicks:number; }
   export const ENEMY_DEFINITIONS: Readonly<Record<string,EnemyDefinition>>;
   ```
   Encode Swarm and Charger lockdown values; retain old role adapters in `content/src/enemies.ts`.
2. Modify `packages/simulation/src/spawning/enemyFactory.ts`:
   ```ts
   export function createEnemy(state:GameState, definition:EnemyDefinition, position:Vec2, spawnTick:Tick, isBoss?:boolean): EnemyEntity;
   ```
   Apply tier multipliers exactly: Small radius `.65`, HP `.6`, hitstun `1.25`; Medium `1`; Large radius `1.35`, HP `2.5`, hitstun resistance `.6`; preserve integer/fixed-point representation.
3. Modify `enemyAiSystem.ts` to export `selectTarget(enemy, players, aiRng): PlayerId|null` and `updateEnemyAI(state, aiRng, events): void`. Choose nearest active player, tie-break ascending player ID; consume `ai` only where a true equal-choice remains. Dead/downed enemies do nothing.
4. Modify `collisionSystem.ts` to export `processCollisions(state): readonly CollisionHit[]`; sort projectile IDs then enemy IDs; use swept/conservative segment checks to prevent high-speed tunneling.
5. Modify `damageSystem.ts` to export `applyDamage(state, hits, events): void`; clamp damage to integer ≥0, apply telegraph gate (`state.tick < telegraphEndTick` means no contact damage), and emit one damage event plus one death transition per target.
6. Add `packages/simulation/tests/combat/enemyCombat.test.ts` and `packages/content/src/enemies/definitions.test.ts`.

### 3. Dependencies
- Existing enemy factory/AI/collision/damage modules and role tables.
- Create immutable content definitions; modify four simulation modules.
- P0.1–P0.5 required.

### 4. Determinism constraints
All entity loops sorted by ID. AI uses only `ai`; role stats are read-only content. Collision result is invariant to object insertion order. No damage, attack, or death side effect in content code.

### 5. Acceptance tests
Assert nearest target and deterministic ascending-ID tie-break. Assert large enemy stats/multipliers. Assert no contact damage before `telegraphEndTick`, dead enemies never attack, exact HP subtraction, one death event, and no duplicate death on later ticks. Insert entities in 20 permutations and assert identical hits/state/hash. High-speed projectile fixture must hit or miss consistently without tunneling.

### 6. Order
1 definitions→2 factory→3 target/AI→4 collision→5 damage/lifecycle→6 tests.

### 7. Estimate
**260–400 LOC**.

### 8. Pitfalls / mitigations
- Existing role names (`tank`, `disabler`, etc.) differ from lockdown names: use explicit adapters, never silently remap replay data.
- Floating collision edge cases: use squared fixed-point distances and a documented inclusive boundary.
- Double damage from contact and projectile in one tick: define ordered hit aggregation and test it.

---

## P0.7 — Bounded wave/director slice

### 1. Purpose
Select and spawn a legal deterministic wave composition, respecting role unlocks, threat budget, active cap, safety radius, pacing, and completion.

### 2. Numbered implementation steps

1. Preserve existing modules and signatures in `packages/simulation/src/spawning/spawnDirector.ts`, `roleSelection.ts`, `waveSpawner.ts`, `spawnPacing.ts`, and `packages/simulation/src/wavePhase.ts`; first write characterization tests for current Phase 3A/3B telemetry.
2. Add `packages/simulation/src/waves/waveRules.ts`:
   ```ts
   export const ACTIVE_CAP_BY_PLAYERS: Readonly<Record<1|2|3|4,number>>;
   export function activeEnemyCap(playerCount:number): number;
   export function isSpawnSafe(position:Vec2, players:readonly PlayerEntity[], minDistance:number): boolean;
   export function classifyUnusedBudget(budget:number, spent:number, roleLegal:boolean, spawnCapacity:boolean): "none"|"role-cap"|"unlock-gate"|"spawn-time";
   ```
3. Modify `roleSelection.ts` to sort role keys, filter roles unlocked at `currentWave`, enforce max 2 copies per composition group and max 4 groups, consume only `wave`, and never exceed budget.
4. Modify `spawnDirector.ts` to track `threatBudget`, `threatSpent`, `spawnCursor`, `nextSpawnTick`, composition, and reason. Emit no more than cap 40 (1–2 players), 60 (3), 80 (4); classify queued-but-not-emitted budget as `spawn-time`.
5. Modify `waveSpawner.ts` to choose authored edge points at least 8 units from every active player using only `enemySpawn`; stable point order and legal-point filtering precede RNG consumption.
6. Modify `wavePhase.ts` to emit exactly `waveStarted` and `waveCompleted` at transitions; completion requires timer expired and all spawned enemies resolved.
7. Add `packages/simulation/tests/waves/waveDirector.test.ts` plus existing five-wave/headless diagnostics.

### 3. Dependencies
- Existing spawn/director/pacing/phase modules and Phase 3 tests.
- Create `waves/waveRules.ts`; use P0.6 content definitions and P0.2 streams.
- P0.3 pipeline required.

### 4. Determinism constraints
`wave` is composition only; `enemySpawn` is placement/variant only. Sort role keys, edge points, and players. Never call RNG when there are no legal choices. Director decisions are pure except mutation of the cloned state.

### 5. Acceptance tests
Across 100 seeds assert spent ≤ budget and active count ≤ cap. Assert no spawn within 8 units. Assert same seed gives same composition, spawn ticks, roles, and hashes. Test each unused-budget category (`role-cap`, `unlock-gate`, `spawn-time`) with a focused fixture. Run 120 ticks and five-wave headless diagnostics.

### 6. Order
1 characterization→2 wave rules→3 composition→4 pacing/cap→5 safe placement→6 phase completion→7 diagnostics.

### 7. Estimate
**300–450 LOC**.

### 8. Pitfalls / mitigations
- Existing director may consume a single RNG: adapt at boundary and lock draw order.
- Spawn-safe filtering after RNG changes sequences: filter/sort legal points before drawing.
- Timer-only completion leaves enemies alive: require both conditions.

---

## P0.8 — Canonical snapshot, hash, and replay harness

### 1. Purpose
Prove deterministic execution, resumable snapshots, and first-divergence replay diagnostics.

### 2. Numbered implementation steps

1. Modify `packages/shared/src/snapshot.ts` to export:
   ```ts
   export interface CanonicalSnapshot { state:GameState; rngState:RngState; pendingCommands:InputCommand[]; contentVersion:number; replayVersion:number; }
   export function serializeCanonicalSnapshot(state:GameState, streams:RandomStreams, pendingCommands:readonly InputCommand[]): string;
   export function deserializeCanonicalSnapshot(encoded:string): CanonicalSnapshot;
   ```
   Encode fixed field order; sort entity/player IDs and pending commands; encode null/boolean explicitly.
2. Modify `packages/shared/src/stateHash.ts` to export `canonicalStateString(state): string` and `hashGameState(state): string`; hash only canonical state, never object insertion order.
3. Modify `packages/simulation/src/replay/replay.ts`:
   ```ts
   export interface ReplayValidation { valid:boolean; firstDivergentTick:number|null; expectedHash?:string; actualHash?:string; }
   export function recordReplay(seed:number|string, playerIds:readonly number[], commands:readonly InputCommand[], options?:ReplayOptions): ReplayRecord;
   export function validateReplay(replay:ReplayRecord): ReplayValidation;
   ```
   Rerun and compare every tick hash, not only final hash.
4. Modify `packages/simulation/src/replay/headless.ts` to export `runHeadless(seed, playerIds, commands, tickCount): ReplayRecord`; retain existing callers through overload/adapters.
5. Add `packages/simulation/tests/deterministicCombat.test.ts`, `snapshotRoundTrip.test.ts`, `replayValidation.test.ts`.
6. Add altered command/seed and suffix-resume fixtures; ensure snapshot restores all streams, versions, pending commands, reward ledger, and state.

### 3. Dependencies
- Existing snapshot/hash/replay/headless modules and `serializeCanonicalSnapshot` server adapter.
- P0.1–P0.7 state, streams, and pipeline required.

### 4. Determinism constraints
Serialization is canonical and side-effect-free. Snapshot restoration must resume stream states, not recreate from seed. Replay command ordering is canonicalized without changing tick semantics.

### 5. Acceptance tests
JSON snapshot round-trip is deep-equal. A 120-tick replay validates. Altered command and altered seed fail at the first divergent tick with expected/actual hashes. Restore at tick N and run suffix; every suffix hash and final hash equals original. Two identical runs produce equal per-tick hashes.

### 6. Order
1 canonical serializer→2 hash→3 record→4 validate→5 headless adapter→6 tests.

### 7. Estimate
**260–380 LOC**.

### 8. Pitfalls / mitigations
- Hashing RNG state unintentionally: state hash and snapshot hash have separate documented inputs.
- `JSON.stringify` object order: build sorted canonical structures first.
- Missing pending commands/reward ledger: explicit round-trip fixture must enumerate every field.

---

## P0.9 — Local 1-player playable prototype

### 1. Purpose
Expose the authoritative Phase 0 slice locally for manual verification without putting gameplay decisions in presentation code.

### 2. Numbered implementation steps

1. Identify the live Vite entry under `apps/client/src/` and existing `packages/client/src/renderAdapter.ts`; do not create a parallel client entry. Add a local bootstrap module exporting:
   ```ts
   export interface LocalRun { state:GameState; streams:RandomStreams; reset():void; tick(commands:readonly InputCommand[]):SimulationResult; }
   export function createLocalRun(seed:number|string): LocalRun;
   ```
   Initialize with `createInitialState(seed,[1])`, default registry, and deterministic streams.
2. Add `apps/client/src/localRunController.ts` (or the existing live controller file) to collect keyboard/mouse input, quantize it into tick commands with monotonic `commandId`, and call `step` at 30 Hz. Never call `step` from a render frame.
3. Modify `packages/client/src/renderAdapter.ts` / current renderer to consume immutable latest `GameState` only. Add presentation for player position, HP, cooldown, enemy count, current wave, timer, and last deterministic error/hash.
4. Add a reset control that calls `LocalRun.reset()` with the exact same seed and clears command/input history; do not use a new random seed.
5. Add a minimal local diagnostics panel that shows seed, tick, state hash, and last event types; no purchase/reward/phase authority is inferred in UI.
6. Add browser/manual test instructions to `docs/PHASE-0-LOCAL-MANUAL-GATE.md` and automated smoke coverage in the existing client test harness if available.

### 3. Dependencies
- Existing `apps/client/src` entry, `packages/client/src/renderAdapter.ts`, simulation `step`, `createInitialState`, and client tests.
- P0.1–P0.8 required; this is last because it is only a presentation gate.

### 4. Determinism constraints
Fixed 30 Hz simulation loop; rendering may interpolate but cannot mutate or decide gameplay. Reset uses same seed and empty initial command history. Input commands are sorted/validated by simulation, not trusted from UI.

### 5. Acceptance tests
Use Playwright/manual gate to boot without uncaught console errors; move, aim, fire, visibly kill an enemy, and reach prototype wave completion. Click reset twice and compare visible spawn sequence plus recorded state hashes. Assert a render-rate change does not change simulation hashes for the same command script.

### 6. Order
1 locate live entry→2 `LocalRun` controller→3 fixed-tick input→4 render diagnostics→5 reset→6 browser smoke/manual gate.

### 7. Estimate
**220–350 LOC**.

### 8. Pitfalls / mitigations
- Two simulation loops (client and render): keep one fixed-tick owner.
- Client prediction accidentally grants outcomes: local mode may run the same simulation, but all future network mode authority remains server-side.
- Reset retaining commands: clear command buffer, event buffer, and RNG stream instances.
- Generic UI bloat: diagnostics are deliberately small and functional; no new gameplay menus in Phase 0.

---

## Phase 0 execution order and gates

Execute tasks strictly `P0.1 → P0.2 → P0.3 → P0.4 → P0.5 → P0.6 → P0.7 → P0.8 → P0.9`. At each task, run its focused tests and commit separately. Required milestones:

- **M0-A:** contracts compile; fixtures and version behavior pass.
- **M0-B:** RNG audit, pure step, movement, fire, collision pass.
- **M0-C:** 120-tick and five-wave diagnostics; budget/cap/safety/telemetry invariants pass.
- **M0-D:** snapshot round-trip, first-divergence rejection, suffix equivalence, per-tick hashes pass.
- **M0-E:** local 1P manual gate passes: no tunneling, pre-telegraph damage, duplicate deaths, or nondeterministic reset.

Final command: `pnpm typecheck && pnpm test && pnpm build`. A Phase 0 completion claim is invalid unless the command succeeds and the `Math.random` audit is empty.
