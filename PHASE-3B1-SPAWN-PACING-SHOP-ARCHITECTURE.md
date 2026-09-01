# Phase 3B.1 — Spawn Pacing + Strategic Shop Placement (Fable 5)

## Goal

Make every wave a positioning problem rather than a spawn-at-tick-zero DPS check. The
server owns a deterministic threat queue, consumes it over the wave clock, and places
one shop at a safe map node. Players must decide whether to split to reach the shop,
regroup to defend it, or defer access while enemies continue arriving.

> Repository note: the current authoritative simulation constant is `TICKS_PER_SECOND =
> 30` (the server loop is 30 Hz). The algorithms below are tick-rate independent; when
> the 120 Hz target is enabled, only wave durations/interval constants should be scaled.

## Architecture

### Spawn director

1. At wave start calculate `threatBudget = calculateThreatBudget(wave, players,
   difficulty)`.
2. Build `activeComposition` once using only roles unlocked for the wave. Weighted
   selection uses `threatCost <= remaining`; selection order is stable and total cost
   never exceeds the budget.
3. Flatten the composition by sorted role name into an immutable queue. The persisted
   `spawnCursor` is the queue index, not an RNG-derived collection iterator.
4. Assign queue entry `i` the slot `floor(i * waveDurationTicks / queueLength)`.
   On each active-wave tick consume at most one entry whose slot has arrived. This
   guarantees pressure across the whole wave and avoids a large same-tick burst.
5. `threatSpent` increments when an entry is actually emitted. `nextSpawnTick`,
   `elapsedTicks`, `spawnCursor`, composition, and budget are snapshot state.
6. Spawn locations remain server authoritative and use the existing seeded enemy-spawn
   RNG stream. A future map-aware spawn selector must sort candidate nodes and reject
   blocked/occupied locations before consuming a random roll.

This separates *what* the wave contains from *when* it arrives. It also makes pacing
replay-safe: a late client cannot cause the director to recalculate or catch up with a
second composition.

### Shop placement

The selected product decision is **static once placed**. On the first active-wave tick,
`placeShop` considers map nodes of kind `shop`, then:

- requires finite coordinates, reachability, line of sight, and a valid interaction
  radius;
- rejects a node if any active player or enemy overlaps its clearance ring;
- sorts IDs before scoring, so object insertion order cannot affect a result;
- scores safe candidates by distance from the sorted party centroid and selects the
  farthest candidate (seeded tie break only). This deliberately creates a choice to
  travel/split rather than always placing a shop under the team;
- sets `currentNodeId`, `accessible`, `used`, and `telegraphStartTick`, emitting
  `shopTelegraphStarted` and `shopOpened`.

The shop is an interaction point, not a physics obstacle. It must not block movement,
projectiles, navigation corridors, enemy routes, or the player spawn. The clearance rule
is `distance(shop, occupant) >= SHOP_RADIUS + occupant.radius + PLAYER_CLEARANCE` at
placement. Interaction should require the player to be within the node's
`safeInteractionRadius`; inventory/currency validation is server-side and must not move
or re-place the shop. A dynamic/repositioning variant should be an explicit future mode
that resets `currentNodeId` during intermission, never mid-wave.

## Implementation checklist and gates

### Gate 1 — Contracts and map data

- [x] Persist director cursor, budget, spent cost, next slot, and elapsed ticks.
- [x] Persist shop node, telegraph tick, accessibility, and used state in `GameState`.
- [x] Keep map node IDs, coordinates, reachability, LOS, and navigation distances
      data-driven.
- [ ] Add inventory/currency contract and purchase command only when economy work begins.

**Gate:** serialize/deserialize a state mid-wave and continue with identical hashes.

### Gate 2 — Threat composition

- [x] Filter roles by unlock wave and affordable remaining threat.
- [x] Use stable sorted role keys and seeded weighted selection.
- [x] Verify composition total cost is `<= threatBudget` and no role is locked.

**Gate:** same seed/wave/player count/difficulty gives byte-equivalent composition;
changing player count or difficulty changes budget without client input.

### Gate 3 — Pacing integration

- [x] Select composition before the director consumes its first slot.
- [x] Spawn the first eligible queue entry at wave start; pace subsequent entries.
- [x] Consume no more than one queue entry per simulation tick.
- [x] Keep wave timer authoritative; never extend the wave to wait for the queue.

**Gate:** wave-ending still occurs at the timer with enemies alive; no spawn occurs in
intermission/countdown/defeat; queue cursor and threat spent are monotonic.

### Gate 4 — Shop placement and collision

- [x] Place only once, at a sorted, reachable, LOS-enabled shop candidate.
- [x] Reject invalid coordinates and occupant-overlapping nodes.
- [x] Keep the shop static and non-solid; use interaction-radius checks for access.
- [ ] Add explicit obstacle geometry/navmesh clearance once map obstacles land.

**Gate:** every generated placement is reachable, non-overlapping, and identical for
identical snapshot/RNG state; no player or enemy is displaced by placement.

### Gate 5 — Gameplay tuning and release

- [ ] Playtest 2/3/4-player waves at each difficulty.
- [ ] Tune budget, role weights, minimum role intervals, and shop distance so regrouping
      is viable but not mandatory.
- [ ] Add limited inventory and affordability UI/events.
- [ ] Run full monorepo build, determinism suite, replay suite, and network smoke test.

## Testing strategy and determinism guarantees

### Unit tests

- budget arithmetic: affordable composition, unlock boundaries, exact/leftover budget;
- pacing: first spawn, evenly distributed slots, one-per-tick cap, final spawn before
  wave end, empty/zero budget, short waves, and wave-ending cutoff;
- shop: candidate filtering, invalid/blocked nodes, no candidates (`shopUnavailable`),
  centroid scoring, tie-break reproducibility, static placement across ticks/waves;
- geometry: boundary equality, player/enemy radius clearance, interaction radius, and
  non-solid shop behavior.

### Integration/property tests

- run seeds across waves 1–5, difficulties 1–4, and player counts 2–4; assert no locked
  roles, budget overflow, invalid positions, or duplicate shop movement;
- replay the same command stream twice and compare per-tick state hashes/events;
- snapshot/restore RNG and `GameState` at random ticks, then compare the suffix;
- vary enemy counts and kills while asserting the wave clock remains unchanged;
- network test server/client prediction: clients may display telegraphs, but only the
  authoritative server emits placement, spawn, and purchase results.

### Rules that preserve determinism

- Use `SeededRandom` only; never `Math.random`, wall-clock time, unordered map iteration,
  or floating-point threshold comparisons for identity decisions.
- Sort role keys, map node IDs, entity IDs, and command streams before decisions.
- Consume RNG in a documented stage order: composition, shop tie-break, enemy spawn,
  then AI. Do not consume a roll for rejected candidates; validate first.
- Store all decision state in snapshots. Rendering, UI, telegraphs, and analytics never
  consume simulation RNG.
- Keep event ordering stable: composition, shop events, then spawn events within a tick.

## Files implemented in this phase

- `packages/simulation/src/spawnDirector.ts`: threat composition plus paced queue
  consumption.
- `packages/simulation/src/enemies.ts`: cursor-aware bounded batch spawning.
- `packages/simulation/src/shopPlacement.ts`: static safe-node placement and events.
- `packages/simulation/src/engine/stepCoordinator.ts`: deterministic stage integration.
