# Mercicat v2 Implementation Roadmap

> **For agentic workers:** Implement task-by-task. Each numbered task has an owner boundary, files, deterministic contract, tests, and a gate. Do not invent behavior that is not specified here or in `MERCICAT-V2-DESIGN-LOCKDOWN.md`.

**Status:** Design lockdown approved by product owner (14 sections, 28-item sign-off). This document converts it into an executable Phase 0/Phase 1 blueprint.

**Goal:** Build a deterministic, server-authoritative combat slice first, then extend it into the complete 20-wave Classic run loop without breaking replay compatibility.

**Architecture:** `packages/simulation` is the authoritative pure TypeScript simulation. `packages/shared` owns serializable contracts, RNG, snapshots, hashes, and event vocabulary. `packages/content` owns immutable versioned data. Server networking consumes simulation results; client rendering never makes gameplay decisions. Existing Phase 3A/3B wave/director code is retained and incrementally migrated behind the contracts below.

**Tech stack:** pnpm workspace; TypeScript 5.6+; Node.js 18+; Vitest; Socket.IO; Vite/Three.js client; fixed 30 Hz simulation.

## Global constraints

1. Simulation advances exactly one tick at `TICKS_PER_SECOND = 30`; no frame-time or wall-clock gameplay decisions.
2. Server is authoritative for movement validation, combat, purchases, pickups, XP, revive, rewards, and phase transitions.
3. All gameplay randomness uses separated persistent streams: `wave`, `enemySpawn`, `loot`, `weaponSpread`, `ai`; no `Math.random()` in `packages/**` or server gameplay code.
4. All prices, rewards, cooldowns, timers, drops, and scaling values are integer or fixed-point values.
5. State, RNG stream state, content version, reward ledger, and pending commands are snapshot/replay serializable.
6. Stable ordering is mandatory: player IDs, entity IDs, role keys, offers, and event emission are sorted before iteration.
7. Existing replay fixtures remain readable; any contract change increments the replay/content version and adds a migration or explicit rejection test.
8. No client-side inferred purchase success, reward grant, ownership, or phase transition.
9. Run power resets at run end; meta progression is separate and cannot dominate run power.
10. Every task ends with focused tests, then `pnpm typecheck && pnpm test && pnpm build` at the phase gate.

## Repository map and module boundaries

```text
mercicat-rebuild/
├── apps/
│   ├── server/src/                 # Socket.IO adapter; no gameplay rules
│   └── client/src/                 # input, prediction, rendering, UI; no authority
├── packages/
│   ├── shared/src/
│   │   ├── random/SeededRandom.ts  # RNG algorithm + serializable state
│   │   ├── contracts/              # GameState, entities, phase, shop, events
│   │   ├── snapshot.ts             # canonical encode/decode/validation
│   │   └── stateHash.ts            # canonical hash input and hash
│   ├── content/src/
│   │   ├── registry/               # immutable versioned content registry
│   │   ├── weapons/                # weapon definitions and fire profiles
│   │   ├── enemies/                # roles, stats, affixes, boss mutation
│   │   ├── items/                  # augments, abilities, consumables, loot
│   │   ├── progression/             # XP offers, skill-tree definitions
│   │   └── waves/                  # mode/difficulty/wave tables
│   ├── simulation/src/
│   │   ├── engine/                 # step coordinator and system order
│   │   ├── systems/                # one deterministic system per concern
│   │   ├── combat/                 # weapons, projectiles, damage, collision
│   │   ├── spawning/               # director, role selection, pacing, factory
│   │   ├── economy/                # credits, payouts, offers, purchases
│   │   ├── progression/            # XP, run levels, skill tree/meta adapter
│   │   ├── co-op/                  # down, revive, death, reconnect policy
│   │   ├── replay/                 # command log, snapshot suffix, validation
│   │   └── harness/                # headless 1P/2P/4P runners and diagnostics
│   └── protocol/src/               # validated wire events and rejection codes
├── packages/simulation/tests/      # headless deterministic tests
└── docs/                           # design and implementation records
```

### Boundary rules

- `shared` imports no simulation/content code.
- `content` contains data only; definitions cannot call RNG or mutate state.
- `simulation` receives `ContentRegistry` and RNG streams through `SimulationContext`; systems do not import server/client modules.
- `protocol` validates payload shape and command identity, but does not decide whether a command is legal in the simulation.
- `apps/server` owns sockets, room lifecycle, fixed loop, reconnect grace, and snapshot transport only.
- `apps/client` owns presentation and local input buffering; prediction calls the same public simulation adapter but cannot grant state.

# Phase 0 — Combat Prototype

## Phase 0 exit target

A headless and local 1-player combat slice can start from a seed, move, aim, fire, damage and kill deterministic enemies, spawn a bounded wave, complete it, and produce identical hashes/replays across two runs. The slice must use the eventual state/snapshot/event contracts so Phase 1 extends rather than rewrites it. Networking and full economy are not required for Phase 0, but their serializable fields and command vocabulary must be reserved.

## Phase 0 numbered implementation steps

### P0.1 Freeze contracts and versioning

**Files:** modify `packages/shared/src/simulation/contracts.ts`, `packages/shared/src/contracts/entities.ts`, `packages/shared/src/contracts/simulationEvents.ts`; create `packages/shared/src/contracts/replay.ts`, `packages/shared/src/contracts/rng.ts`.

1. Set a single `CONTENT_VERSION` and `REPLAY_VERSION` constant; include both in `GameState` and replay headers.
2. Extend state with fixed-point-safe player combat fields: aim vector, weapon IDs/levels, fire cooldown, HP/downed placeholder, XP/credits/inventory placeholders, and a reward ledger.
3. Extend enemy fields with immutable role/tier metadata, threat cost, boss flag, arrival telegraph end tick, down state fields, and target ID.
4. Define commands with `commandId`, `tick`, `playerId`, type, and bounded numeric fields; preserve legacy aliases only in protocol decoding.
5. Define the approved event types, including combat events and the required economy/co-op/pursuer names, with stable payloads and tick.
6. Define rejection reason codes exactly: `not_intermission`, `insufficient_credits`, `offer_unavailable`, `inventory_full`, `already_owned`, `not_owner`, `out_of_range`, `downed`, `duplicate_command`, `invalid_state`.

**Acceptance tests:** compile-time contract fixtures; encode/decode round-trip preserves every field; old replay fixture either decodes unchanged or fails with the documented version error; event union contains all required vocabulary.

### P0.2 Make RNG streams persistent and auditable

**Files:** modify `packages/shared/src/random/SeededRandom.ts`; create `packages/shared/src/random/randomStreams.ts`; test `packages/shared/src/random/SeededRandom.test.ts`.

1. Expose `nextInt`, `nextFloat`, `pickStable`, and `serialize/restore` with explicit state.
2. Derive named streams from the run seed without sharing mutable state between streams.
3. Pass RNG only through `SimulationContext`; prohibit module-level RNG and `Math.random()`.
4. Define consumption rules: `wave` only for composition/wave decisions; `enemySpawn` only spawn placement/variant; `loot` only loot; `weaponSpread` only spread; `ai` only tie-breaking/AI choices.
5. Add an audit test that scans gameplay source for `Math.random` and fails on any match.

**Acceptance tests:** same seed and calls produce same sequence; restoring a serialized stream reproduces the suffix exactly; advancing one stream does not change another; source audit returns zero forbidden calls.

### P0.3 Establish the pure step pipeline

**Files:** modify `packages/simulation/src/engine/stepCoordinator.ts`, `packages/simulation/src/engine/simulationContext.ts`, `packages/simulation/src/step.ts`; create `packages/simulation/src/engine/systemOrder.ts`.

1. Define `step(previous, commands, context): SimulationResult` as the sole state transition entrypoint.
2. Filter commands to `command.tick === state.tick`, sort by `playerId` then `commandId`, and reject duplicate command IDs deterministically.
3. Run systems in this fixed order: normalize commands → phase/timer → player movement/aim → weapon fire → projectile movement → collision/damage → enemy AI → death/down placeholder → spawn director → event finalization → canonical hash.
4. Clone or structurally replace state; no system mutates prior snapshots.
5. Advance exactly one tick even when there are no commands.

**Acceptance tests:** current-tick commands apply; future/past commands do not; command permutation gives the same result; no-command tick increments once; system-order fixture records the expected sequence.

### P0.4 Implement player movement, aim, and collision-safe bounds

**Files:** modify `packages/simulation/src/systems/inputSystem.ts`, `packages/simulation/src/entities/movement.ts`; create `packages/simulation/src/combat/aim.ts`, `packages/simulation/src/combat/bounds.ts`; tests under `packages/simulation/tests/combat/`.

1. Clamp input components to the contract range and normalize aim using fixed-point/integer-safe arithmetic.
2. Apply movement at fixed per-tick speed; clamp to map bounds; reject movement for dead/downed players as specified by the current prototype contract.
3. Resolve entity iteration by ascending entity ID.
4. Add tests for diagonal input, zero aim, boundary clamping, malformed numeric input, and deterministic repeated movement.

**Acceptance tests:** a 120-tick input script reaches the same position twice; out-of-range input cannot create NaN/Infinity; player cannot leave the map; aim is stable for equivalent inputs.

### P0.5 Implement weapon fire and projectile lifecycle

**Files:** create `packages/content/src/weapons/definitions.ts`, `packages/simulation/src/combat/weaponSystem.ts`, `packages/simulation/src/combat/projectileSystem.ts`; modify content registry and simulation exports.

1. Implement the initial prototype weapon as a manual aimed single shot using the `fire` command and `weaponSpread` stream only if spread exists.
2. Enforce fire cooldown in ticks; never use elapsed milliseconds.
3. Allocate projectile IDs monotonically; record owner, damage, velocity, lifetime, and spawn tick.
4. Despawn expired projectiles deterministically and emit one event.
5. Keep the eventual roster data-driven: Pistol, SMG, Shotgun, Boomerang, Drone Rack, Turret Kit, Arc Wand are definitions, but Phase 0 needs only Pistol behavior.

**Acceptance tests:** fire during cooldown creates no projectile; valid fire creates exactly one projectile with expected fields; projectile expires at exact lifetime; same seed/input script gives identical projectile IDs and hashes.

### P0.6 Implement enemy factory, roles, AI, collision, and damage

**Files:** modify `packages/simulation/src/spawning/enemyFactory.ts`, `packages/simulation/src/systems/enemyAiSystem.ts`, `packages/simulation/src/combat/damageSystem.ts`, `packages/simulation/src/combat/collisionSystem.ts`; use immutable enemy data in `packages/content/src/enemies/`.

1. Implement Swarm and Charger first; retain role metadata and threat costs from the lockdown table.
2. Use deterministic movement and stable target selection; `ai` stream is the only random source for equal-choice decisions.
3. Apply arrival telegraph rules to large enemies; no damage before telegraph end.
4. Resolve projectile/enemy hits by ascending projectile ID then enemy ID; apply integer damage and emit one damage/death event per transition.
5. Make size mechanical: Small radius `0.65×`, HP `0.6×`, hitstun `1.25×`; Medium baseline; Large radius `1.35×`, HP `2.5×`, hitstun resistance `60%`.

**Acceptance tests:** deterministic target tie-break; no pre-telegraph damage; hit removes exact HP; dead enemies do not attack; collision ordering is invariant under object insertion order; role stats come only from content tables.

### P0.7 Implement bounded wave/director slice

**Files:** modify existing `packages/simulation/src/spawning/spawnDirector.ts`, `roleSelection.ts`, `waveSpawner.ts`, `spawnPacing.ts`, and `packages/simulation/src/wavePhase.ts`; add `packages/simulation/src/waves/waveRules.ts` if needed.

1. Keep current Phase 3A/3B telemetry and classify unused threat as `role-cap`, `unlock-gate`, or `spawn-time`.
2. Select stable sorted roles with `wave` RNG; never spend above threat budget.
3. Enforce active cap 40 for 1–2 players, 60 for 3, 80 for 4; Phase 0 runs with one player and cap 40.
4. Spawn enemies from authored edge points at least 8 units from players; consume `enemySpawn` only for legal point/variant selection.
5. Complete the prototype wave when the timer expires and all spawned enemies are resolved; emit `waveStarted`, `waveCompleted`, and composition telemetry.

**Acceptance tests:** budget never exceeded; active cap never exceeded; no spawn inside safety radius; same seed gives same composition/spawn ticks; telemetry distinguishes all three unused-budget reasons.

### P0.8 Implement snapshot, canonical hash, and replay harness

**Files:** modify `packages/shared/src/snapshot.ts`, `packages/shared/src/stateHash.ts`; modify `packages/simulation/src/replay/replay.ts`, `headless.ts`; create tests `deterministicCombat.test.ts`, `snapshotRoundTrip.test.ts`, `replayValidation.test.ts`.

1. Canonicalize state by fixed field order, sorted entity IDs, sorted player IDs, and explicit null/boolean encoding.
2. Snapshot all simulation state plus all RNG streams, content/replay versions, pending commands, and reward ledger.
3. Record seed, roster, mode, difficulty, content version, command sequence, per-tick hash, and final hash.
4. Validate a replay by rerunning from the seed and comparing each tick hash, not only final state.
5. Add a suffix test: restore snapshot at tick N and run the remaining commands; suffix hashes must equal the original run.

**Acceptance tests:** JSON/binary snapshot round-trip is deep-equal; 120-tick replay validates; altered command or seed fails at the first divergent tick; snapshot resume produces identical final hash.

### P0.9 Wire local 1-player playable prototype

**Files:** modify `apps/client/src/` entry/input/render adapter; modify `packages/client/src/renderAdapter.ts` or current live client entrypoint; do not add gameplay rules to the UI.

1. Add local seed/run bootstrap calling `createInitialState(seed, [playerId])` and the simulation adapter.
2. Feed fixed-tick commands to the simulation; render at display rate from the latest state.
3. Display player HP, weapon cooldown, enemy count, wave timer, and deterministic error diagnostics.
4. Add a manual reset button that restarts the identical seed and command-free state.

**Acceptance tests:** local client boots, player moves, fires, kills an enemy, and reaches wave completion; reset reproduces the same visible enemy spawn sequence; browser console has no uncaught errors.

## Phase 0 milestone checkpoints

- **M0-A contracts:** typecheck passes; contract fixtures pass; replay version is explicit.
- **M0-B deterministic core:** RNG audit passes; pure-step, movement, fire, collision tests pass.
- **M0-C wave slice:** 120-tick and five-wave headless diagnostics pass; caps/budget/telemetry invariants pass.
- **M0-D replay gate:** snapshot round-trip, altered-replay rejection, suffix equivalence, and hash-per-tick tests pass.
- **M0-E manual gate:** local 1P can complete the prototype wave; no visible tunneling, pre-telegraph damage, duplicate deaths, or nondeterministic reset.
- **Phase gate:** `pnpm typecheck && pnpm test && pnpm build`; `Math.random` audit is empty; commit Phase 0 as one reviewable milestone after focused task commits.

## Phase 0 risks and mitigations

- **Highest risk: determinism drift from implicit iteration/RNG consumption.** Mitigate with sorted iteration, named streams, per-tick hashes, and source audit.
- **Existing contract migration risk:** current state retains legacy phase and role names. Add adapters/migrations; do not silently reinterpret old replays.
- **Collision tunneling at fixed ticks:** use swept or conservative collision checks and a regression fixture at high projectile speed.
- **Wave/director budget regressions:** preserve existing telemetry and run balance diagnostics after every director change.
- **Client false confidence:** manual play is only a presentation gate; all outcomes must be asserted in headless tests.

# Phase 1 — MVP Classic Loop

## Phase 1 exit target

A 1–4 player server-authoritative Classic run supports lobby/start, 20 waves, deterministic wave/director pacing, personal credits and XP, intermission shop, run build progression, loot, boss mutations, the shared pursuer schedule, down/revive/death, reconnect snapshot resume, victory/defeat, and authoritative client UI. Meta skill-tree persistence may use a server-side adapter, but no combat rule may depend on an unimplemented account system.

## Phase 1 numbered implementation steps

### P1.1 Expand state and content registry

**Files:** modify shared contracts; create content directories shown in the repository map; update `packages/content/src/registry/createDefaultRegistry.ts`.

1. Add serializable per-player `credits`, XP/run level, pity counter, inventory slots, weapon levels, abilities, owned offer IDs, and down/revive state.
2. Add shared wave state: mode, difficulty, active-player count at wave start, boss/pursuer status, intermission boundaries, and reward ledger.
3. Add `ContentRegistry` version validation and immutable definitions for all seven weapons, six enemy families plus specials, item rarities, XP offers, and six 10-node meta branches.
4. Encode all lockdown constants in content tables: price bands, payouts, inventory limits, role unlock waves/costs/caps, difficulty multipliers, boss/pursuer timers.

**Acceptance tests:** registry version is present in snapshots; definitions contain no mutable runtime state; every approved table value has a fixture; missing content version rejects start/resume.

### P1.2 Implement Classic phase machine and fixed server loop

**Files:** modify `apps/server/src/tickLoop.ts`, `roomManager.ts`; modify simulation phase files; create `packages/simulation/src/match/classicRules.ts`.

1. Implement lobby → countdown → active wave → wave ending → intermission → next wave, then victory or defeat.
2. Run server simulation at exactly 30 Hz; queue commands by tick; process once; broadcast authoritative snapshot/events.
3. Freeze run seed, mode, difficulty, roster, and content version at start.
4. Apply difficulty after base enemy stats and before player mitigation; keep player-count budget scaling separate and published.
5. Implement Classic boss mutation on waves 5/10/15/20, including five-second announcement, eligible Large role selection, mutation stats, and overtime victory rule.

**Acceptance tests:** 20-wave no-op fixture reaches defeat/victory at exact boundaries; boss appears exactly four times and cannot duplicate; overtime stops normal spawning; fixed loop never processes a tick twice.

### P1.3 Implement economy, intermission shop, and rejection ledger

**Files:** create `packages/simulation/src/economy/credits.ts`, `payouts.ts`, `shop.ts`, `purchaseValidation.ts`; modify `packages/shared/src/contracts/shopState.ts`, events, protocol.

1. Grant survival payout `20 + 5 × wave + 2 × defeatedForWave`; dead player gets 50% rounded down; add boss +25 and pursuer +40 once per eligible player.
2. Create four item offers, one consumable, and a guaranteed weapon every three waves; all players see same identities/prices, purchases remain personal.
3. Implement prices Common 25, Uncommon 45, Rare 75, Epic 115, Legendary 170; weapon +20; consumable 15.
4. Implement reroll cost `5 + 5 × rerollsThisVisit`, first cost 5, cap 40; preserve guaranteed weapon and already purchased items.
5. Open shop only in intermission; atomically close at active-wave start; carry unspent credits within run.
6. Validate affordability, ownership, phase, inventory, and command id; write accepted/rejected events and ledger entries.

**Acceptance tests:** identical seeds produce identical offers/prices/rerolls; retry cannot double-buy; credits never negative; two players buy independent copies; all rejection codes are stable and tested; 20-wave balance sweep reports median credits/purchases for 1–4 players.

### P1.4 Implement XP, run-level choices, and skill-tree adapter

**Files:** create `packages/simulation/src/progression/xpTracker.ts`, `runLevelOffers.ts`, `metaUnlocks.ts`; content progression definitions; shared progression contracts.

1. Award XP from wave completion and enemy defeats into each player’s run-level bar; bank level-ups until intermission.
2. At each level, generate exactly three deterministic offers; offer reroll uses the separate progression command/economy rule and `loot`-independent deterministic stream policy.
3. Enforce level cap 20 for a 20-wave Classic run and apply the fixed stat order: base → additive weapon modifiers → additive player augments → multiplicative effects → difficulty scaling.
4. Add account adapter for marks and six branches (Offense, Defense, Mobility, Fortune, Teamwork, Arsenal), with 10-node prerequisites and the +10% raw-stat ceiling.
5. Ensure meta unlock checks are per-player; a locked weapon cannot be purchased merely because a teammate owns it.

**Acceptance tests:** XP crossing a level during combat banks until intermission; three offers are reproducible; cap cannot be exceeded; meta bonuses stay within ceiling; different player unlock inventories deterministically replace unavailable shared offers.

### P1.5 Implement full weapons, builds, and stat evaluation

**Files:** extend content weapon definitions; create/modify `weaponSystem.ts`, `modifierSystem.ts`, `statEvaluator.ts`, `abilitySystem.ts`, `inventory.ts`.

1. Add Pistol, SMG, Shotgun, Boomerang, Drone Rack, Turret Kit, Arc Wand with manual/automatic fire flags.
2. Enforce one primary, one secondary, two abilities; swap lockout 0.25 seconds = 8 ticks, disabled while downed.
3. Implement levels 1–8, duplicate weapon level-up, level 4/8 authored evolution, explicit stackable passive behavior, and non-stackable conversion to 25% listed value.
4. Implement deterministic automatic timers, aimed manual fire, cone/chain/returning projectile behavior, and placed turret IDs.
5. Ensure every stat calculation is integer/fixed-point and uses the locked order.

**Acceptance tests:** each weapon has a headless fire fixture; cooldown/swap boundaries are exact; duplicate behavior/evolution occurs once; stat-order golden tests catch reordering; automatic weapons do not consume manual fire RNG.

### P1.6 Implement loot, pity, inventory, and salvage

**Files:** create `packages/simulation/src/economy/loot.ts`, `inventory.ts`, `salvage.ts`; content loot tables; shared loot contracts/events.

1. Roll personal loot only with `loot` stream in stable player-ID order; assign roll at down/death time, never pickup time.
2. Implement role drop rates and normal rarity weights; boss/pursuer rarity weights; pity upgrades after three eligible rolls without Rare+.
3. Auto-collect within 1.25 units only for owner; enforce 4 weapon, 6 augment, 2 ability, 5 consumable slots.
4. On full inventory, reject pickup and create owner-only 20-second visible drop; expire exactly at timer.
5. Permit salvage only in shop for 25% listed price rounded down.

**Acceptance tests:** same seed gives same item and rarity sequence; pity persists through snapshot and resets after upgrade; teammate cannot collect personal loot; full inventory/expiry/salvage boundaries are tested; boss/pursuer unique reward ledger prevents duplicate grants.

### P1.7 Implement large enemies, boss mutation, and pursuer

**Files:** create `packages/simulation/src/systems/largeEnemySystem.ts`, `pursuerSystem.ts`, `navigation.ts`; extend enemy content/state.

1. Spawn Large enemies through authored edge points at least 8 units away with one-second arrival telegraph.
2. Down Large enemies at zero HP for 8 seconds, bosses for 12; make downed entities invulnerable, executeable once, and loot-resolved at down time.
3. Spawn one shared pursuer at wave 3, then waves 8/13/18 only if previously defeated; preserve it across intermission if downed unresolved.
4. Implement pursuer 10-second protection/telegraph, 14-unit aggro plus line of sight, lowest-health target with stable ID tie-break, 2-second target-switch condition, navigation, shop-radius exclusion, and persistent re-entry schedule.
5. Award shared pursuer reward once and personal rewards once per connected player using the reward ledger.

**Acceptance tests:** pursuer schedule across 20 waves; no duplicate active pursuer; LOS/target-switch timing; shop exclusion; down timer/loot resolution; snapshot resume preserves phase, target, timer, schedule, and loot result.

### P1.8 Implement co-op down/revive/death/reconnect/late join

**Files:** create `packages/simulation/src/co-op/downState.ts`, `revive.ts`, `partyRules.ts`; modify server `roomManager.ts`, reconnect/session code, protocol validators.

1. Enter downed at zero HP for 20 seconds; crawl at 25% speed; disable firing/purchases.
2. Revive by holding interact for 3 seconds within 1.5 units; damage to either participant interrupts and resets progress; revived player returns at 35% HP with 1.5-second invulnerability.
3. Allow one down per player per wave; second down causes death/spectate and 50% survival payout; all down/dead triggers defeat after three-second resolution.
4. Give disconnect 15-second grace; reconnect restores exact snapshot state without rewind; permanent leave changes scaling only at next wave boundary.
5. Late join receives current-wave baseline credits, XP floor minus one level, starter weapon level 1, no prior loot/marks, and does not retroactively alter enemies or revive party.

**Acceptance tests:** 2P revive success/interruption; damage during revive resets exactly; one-down-per-wave; all-down defeat timer; disconnect/reconnect hash continuity; late join does not change current budget; personal ownership prevents cross-player grants.

### P1.9 Wire authoritative network/UI surfaces

**Files:** modify `packages/protocol/src/networkProtocol.ts`, `apps/server/src/`, `packages/client-net/src/`, `apps/client/src/`; add UI tests where the client framework supports them.

1. Add validated messages for start, input, snapshot, shop offer, purchase request/result, loot visibility, revive progress, telegraphs, phase, and rejection reason.
2. Keep server tick and snapshot cadence fixed; client prediction replays unacknowledged inputs after authoritative snapshots.
3. Render authoritative shop state, credits, timers, inventory ownership, telegraphs, down/revive state, boss/pursuer indicators, victory/defeat.
4. Never remove an offer, add credits, or show a pickup as collected until the server event arrives.
5. Use symmetric latency simulation for request-response tests; register delayed inbound listeners before emitting requests.

**Acceptance tests:** local 1P completes one full Classic run; 2P co-op completes a wave with purchase/revive; delayed snapshots reconcile; invalid network commands produce stable rejection; client console remains clean.

### P1.10 Add run-end persistence and meta adapter

**Files:** create `apps/server/src/persistence/runSnapshotStore.ts`, `metaStore.ts`; shared persistence contracts; simulation run-end system.

1. Persist resumable gameplay snapshot for 10 minutes after disconnect/process failure; resume exact state only when seed/mode/difficulty/roster/content version match.
2. Award marks: 10 per completed wave, +25 victory, +10 boss wave survived, 0 if failed before wave 3, failed runs retain completed-wave marks plus 50% boss-wave marks.
3. Carry only marks, unlocks, cosmetics, lifetime statistics, achievements; clear credits, XP, items, levels, pity, and buffs at run end.
4. Record one immutable run result and reject duplicate finalization.

**Acceptance tests:** exact resume hash; expired snapshot rejected; version mismatch rejected; victory/defeat marks match formulas; no run-only field leaks into next run; duplicate finalization is idempotent/rejected.

## Phase 1 milestone checkpoints

- **M1-A contracts/content:** registry fixtures, version checks, and snapshot schema pass.
- **M1-B Classic shell:** fixed server loop, lobby, phase machine, 20-wave no-op run, boss/overtime tests pass.
- **M1-C economy/progression:** shop, payouts, XP, offers, inventory, loot, pity tests pass; balance matrix artifact generated.
- **M1-D combat/build:** seven weapon fixtures, duplicate/evolution, stat-order and automatic/manual timing tests pass.
- **M1-E pursuer/co-op:** 2P headless revive, pursuer schedule/navigation, reconnect and late-join tests pass.
- **M1-F network/UI:** local 1P full-loop manual gate and 2P local co-op gate pass; delayed snapshot suite passes.
- **M1-G persistence:** resume and end-of-run carryover tests pass.
- **Phase gate:** `pnpm typecheck && pnpm test && pnpm build`; no `Math.random`; clean generated build; review working-tree diff; commit only after all gates.

## Phase 1 risks and mitigations

- **Highest complexity: pursuer navigation and LOS.** Start with authored navigation graph/edge points and deterministic fallback steering; add adversarial blocked-map fixtures before visual polish.
- **Multiplayer blocker: revive networking.** Treat down/revive as server-owned tick state with progress snapshots and interruption events; test latency and duplicate interact commands early.
- **Economy exploit risk:** retries, reconnects, and client prediction can duplicate purchases/rewards. Use command IDs, reward ledger, atomic server transactions, and replay tests.
- **State explosion:** full inventory/loot/progression can make snapshots unstable. Canonicalize every collection and enforce schema fixtures before UI work.
- **Balance risk:** 1–4 player scaling, pity, rerolls, and boss/pursuer rewards interact. Require seeded balance sweeps and publish median credits/purchases, not anecdotal tuning.
- **Late-join complexity:** no retroactive budget or rewards; apply changes only at wave boundaries and test each phase boundary.
- **Legacy integration drift:** current wave/director and legacy phase contracts coexist. Migrate behind adapters and retain compatibility fixtures until Phase 1 gate.
- **Client/server divergence:** UI must consume authoritative events/snapshots; add rejection and reconciliation tests before calling the loop playable.

# Dependency graph / unblock order

```text
P0.1 Contracts + versions
  ├──> P0.2 RNG streams ───────────────┐
  ├──> P0.3 step coordinator            │
  └──> P1.1 content/state registry      │
P0.2 + P0.3 ──> P0.4 movement ──> P0.5 weapons ──> P0.6 damage/collision
P0.6 ──> P0.7 director/waves ──> P0.8 snapshots/replays ──> P0.9 local prototype

P1.1 content/state + P0.8 snapshots
  ├──> P1.2 Classic phase/server loop
  ├──> P1.4 XP tracker
  ├──> P1.5 weapon/build system
  ├──> P1.6 loot/inventory
  └──> P1.7 large enemies/pursuer

P1.2 phase boundaries + P1.4 XP tracker
  └──> P1.3 economy/shop
        └──> P1.5 build purchases + P1.6 salvage

P1.5 combat/build + P1.6 loot
  └──> P1.7 pursuer rewards and boss rewards

P1.2 + P1.3 + P1.4 + P1.5
  └──> P1.8 co-op/down/revive (requires authoritative phase, HP, rewards)
        └──> P1.9 network/UI
              └──> P1.10 persistence/meta finalization

P1.8 co-op + P0.8 replay
  └──> 2P/4P determinism, reconnect, late-join, and full Classic acceptance
```

**Explicit unblock statements:**

- Shop requires economy contracts and phase boundaries; economy requires credits/payout rules and XP tracker integration for intermission level-up choices; XP tracker unblocks the run upgrade/skill offer surface.
- Loot requires inventory and `loot` RNG; pursuer/boss rewards require the reward ledger and large-enemy down state.
- Revive networking requires server-authoritative HP/down state, fixed tick timing, command IDs, and snapshot persistence; it is a multiplayer blocker, not a UI-only feature.
- Full Classic victory requires boss mutation, overtime, reward finalization, and persistence; do not mark the mode complete when only wave 20 starts.

# Determinism verification checklist

## SeededRandom audit

- [ ] Search `packages/**/*.ts` and server gameplay code for `Math.random`; result is empty.
- [ ] Every RNG call names its stream and is made through `SimulationContext`.
- [ ] Stream derivation from seed is documented and stable.
- [ ] Stream state is serialized/restored in snapshots.
- [ ] RNG call sites have stable loop order; no calls occur in rendering/logging/UI.
- [ ] A stream-consumption fixture proves changing `loot` does not change `wave` or `weaponSpread`.

## Snapshot round-trip

- [ ] Snapshot includes state, RNG streams, content/replay version, pending commands, reward ledger, and run metadata.
- [ ] `decode(encode(state))` is canonical/deep-equal.
- [ ] Null, empty collections, booleans, and integer/fixed-point values retain exact meaning.
- [ ] Entity/player/offer/inventory collections are sorted canonically.
- [ ] Restoring at ticks 0, 1, wave boundary, intermission, downed, pursuer-down, and shop-close produces the same suffix hash.
- [ ] Invalid/mismatched versions are rejected without mutating live state.

## Replay validation

- [ ] Record seed, roster, mode, difficulty, content version, command IDs/ticks, and per-tick hashes.
- [ ] Replay same input twice and compare every tick hash plus final hash.
- [ ] Mutate one command and assert failure reports first divergent tick.
- [ ] Mutate seed/content version and assert deterministic rejection or first divergence.
- [ ] Validate 120-tick combat, five-wave headless, 20-wave Classic, 2P co-op, and reconnect suffix replays.
- [ ] Verify old fixtures through migration; never silently accept incompatible replays.

# Testing strategy

## Phase 0 test matrix

| Layer | Required coverage | Gate |
|---|---|---|
| Headless unit | RNG, command filtering, movement, aim, cooldown, projectile lifetime, collision, damage, role stats, caps, budget telemetry | Every focused task |
| Determinism | 120-tick same-seed hash; command permutation; snapshot suffix; altered replay | M0-D |
| Local 1-player | Boot, move, fire, kill, wave complete, reset same seed | M0-E |
| Edge cases | Zero/invalid aim, boundary movement, cooldown at exact tick, high-speed projectile, spawn safety radius, empty command tick, duplicate command | Before phase gate |
| Regression | Existing five-wave, gameplay, spawn-director, delayed snapshot tests | Every full suite |

## Phase 1 test matrix

| Layer | Required coverage | Gate |
|---|---|---|
| Headless unit | Payouts, prices, rerolls, purchase rejection, XP banking, three offers, pity, inventory, salvage, boss/pursuer ledger, revive timers, marks | M1-C/M1-E/M1-G |
| 1-player local | Full 20-wave Classic, four boss mutations, shop/build choices, loot, pursuer, victory overtime, defeat | M1-F |
| 2-player co-op | Independent credits/loot, shared offers, revive/interruption, pursuer target tie, boss reward, disconnect/reconnect | M1-E/M1-F |
| 3/4-player matrix | Budget/active-cap scaling, late join/leave boundary, rewards and shop availability by unlock inventory | M1-G and balance artifact |
| Network | Fixed 30 Hz, delayed bidirectional request/response, prediction/reconciliation, duplicate commands, dropped/reordered snapshots | M1-F |
| Edge cases | Shop close race, insufficient credits, full inventory, expired pickup, duplicate unique reward, second down, all-down resolution, pursuer unresolved at intermission, version mismatch, run finalization retry | Before phase gate |
| Regression | All Phase 0 tests plus existing Phase 2 networking/adverse-network tests | Final gate |

## Required diagnostic artifacts

1. `packages/simulation/artifacts/seed-manifest.json`: named seeds, roster sizes, mode, difficulty, content/replay version.
2. `packages/simulation/artifacts/replays/`: compact command logs and per-tick hashes for golden runs.
3. `packages/simulation/artifacts/balance-sweep/`: 1/2/3/4-player seeded results with median end credits, purchase count, XP level, deaths, and wave reached.
4. `packages/simulation/artifacts/determinism-report.json`: RNG audit, snapshot round-trip cases, replay divergence cases.

## Definition of done

A phase is complete only when its numbered tasks are implemented in the stated boundaries, focused tests and full suite pass, typecheck/build pass, deterministic artifacts are generated, manual gates are recorded, and the working-tree diff contains no undocumented gameplay behavior. If a spec value is unavailable, stop at serializable scaffolding and a failing/blocked acceptance test rather than guessing.
