# Phase 3B.3 — Enemy Balance Sweep

**Status:** Test plan and contract defined; implementation pending.  
**Scope:** Adventure and Endless, 2/3/4 players, waves 1–20, fixed seeds.

This is a measurement gate, not a request to change the Phase 3B.2 formulas. Constants may be tuned only after a failing metric has been reproduced and attributed to a stat or composition rule.

## 1. Telemetry contract

Every run is identified by `{ schemaVersion, buildId, seed, mode, difficulty, playerCount, mapId, weaponLoadout }`. The harness must record raw events and one immutable summary per wave. All durations are seconds; all tick values remain available for deterministic diagnosis.

```ts
interface BalanceWaveTelemetry {
  runId: string; wave: number; mode: "adventure" | "endless";
  difficulty: 1 | 2 | 3 | 4; playerCount: 2 | 3 | 4; seed: number | string;
  startTick: number; endTick: number; waveDurationSeconds: number;
  result: "survived" | "wiped" | "timed_out";

  threatBudget: number; threatSpent: number; threatUnspent: number;
  spawned: number; defeated: number; remainingAtEnd: number;
  roleCounts: Record<"swarm"|"charger"|"ranged"|"tank"|"disabler"|"flanker", number>;
  roleThreat: Record<string, number>; // count × definition.threatCost
  roleDamageTaken: Record<string, number>;

  combatClearTimeSeconds: number | null; // last enemy death - first spawn
  completionTimeSeconds: number; // wave end - wave start
  damageTakenTotal: number; damageTakenByPlayer: Record<string, number>;
  healthLostPercentByPlayer: Record<string, number>;
  downedPlayers: number; deaths: number;
  peakConcurrentEnemies: number; peakConcurrentByRole: Record<string, number>;
  enemySecondsByRole: Record<string, number>;
  playerDamageDealt: number; playerDps: number;

  compositionExpected: Record<string, number>;
  unusedBudgetReason: "none" | "role-cap" | "unlock-gate" | "spawn-time" | "other";
  stateHashAtEnd: string;
}
```

Run-level telemetry is the ordered list of wave records plus `wavesReached`, `totalDeaths`, `wipeWave`, total damage, median/p95 clear time, and a final state hash. Store the exact command frames and RNG/replay version alongside it; a metric without a replay is not actionable.

### Collection rules

* Emit `waveStarted`, `waveCompleted`/`matchDefeated`, `entitySpawned`, `entityDamaged`, and `entityDespawned` into the recorder. `entitySpawned` must expose `enemyRole` and `threatCost` (or the recorder must resolve them from the immutable content registry).
* Count damage from authoritative combat events only, excluding self damage, duplicate client events, and damage after a wave-ending transition. Attribute enemy damage by role and player.
* Sample active enemy count after every simulation tick; `peakConcurrentEnemies` is the maximum sample, not the number spawned.
* Record role composition from the selection event and independently reconstruct it from spawn events. Fail the run if they disagree.
* Use `completionTimeSeconds` for the fixed survival timer and `combatClearTimeSeconds` for combat workload. Never call a timed-out fixed wave a fast clear.
* Keep raw event logs for failed runs and aggregate JSON/CSV for dashboards. Do not use wall-clock time or `Math.random()` in the simulation.

## 2. Balance labels and pass/fail thresholds

Normalize damage by the party's total starting health (`100 × players` in the current simulation), and normalize clear time by the 2-player same-wave baseline after the same weapon/DPS script. Each cell is run with at least 20 fixed seeds; report median and p95. A cell passes only when both its median and its p95 meet the applicable limits.

| Label | Damage taken / party HP | Normalized combat clear time | Interpretation |
|---|---:|---:|---|
| **Trivial** | `<10%` median and `<20%` p95 | `<0.80` median | Little meaningful threat; investigate if it persists for two adjacent waves. |
| **Viable** | `10–30%` median and `<45%` p95 | `0.80–1.25` | Target default band: consistently completable without a wipe. |
| **Pressured** | `30–55%` median, `<65%` p95 | `1.25–1.60` | Intended late-wave/high-pressure band; no forced wipe or control lockout. |
| **Punishing** | `>55%` median, `>65%` p95, any party wipe rate `>5%`, or timeout | `>1.60` p95 or no combat clear | Failing unless explicitly intended as the final Endless challenge. |

A wave is **pass** when it is Viable or intentionally Pressured, wipe rate is ≤5%, no player-count cell is Punishing, and no hard invariant fails. A single seed is not a balance decision; it is a reproduction case.

### Hard invariants and ratio targets

* Threat utilization `threatSpent / threatBudget`: median `0.85–1.00`; p95 must be `≥0.75`. A lower value is acceptable only when `unusedBudgetReason` is a known cap/unlock/spawn-time limitation and is tracked for follow-up.
* Role counts must never exceed the Phase 3B.2 cap of **2 per role per wave**. For unlocked roles, aggregate observed/expected count across the seed set must be `0.80–1.20`; zero is valid only before its unlock wave or when it was unaffordable.
* Every wave whose affordable budget supports two roles must contain at least two roles. A one-role composition is a hard fail after the guaranteed-two-role fallback is implemented.
* For each player count, `peakConcurrentEnemies` must be ≤ `getMaxActiveEnemies`. Report peak/players; the target is not “same enemy count”: 4p should have a higher absolute peak, but per-player peak should remain within `0.75–1.25×` the 2p value.
* After DPS normalization, 3p and 4p median clear time and damage/party-HP must be within `±15%` of the 2p cell. Absolute pressure should rise with player count: damage/player and peak/party should not decrease by more than 15% from 2p to 4p.
* The intended feel curve is different, not identical: 2p should show a steeper single-target/challenger pressure curve (more focus-fire and less swarm saturation); 4p should show more simultaneous threats and role interactions, with normalized damage and clear time still in the viable/pressured bands. Never “balance” 4p by making 2p trivial.
* Endless must exceed Adventure pressure at the same wave/player count (higher health/damage/budget or later-tail slope), but Adventure wave 20 and Endless wave 20 must each remain completable. Endless p95 damage must stay below 65% and wipe rate ≤5% for the supported test script.

### Outlier detection

Flag a wave/player/mode cell when any of these holds: metric outside its band; median differs by >20% from both adjacent waves; p95/median >2; damage or clear time jumps >25% wave-over-wave without a documented unlock; role ratio outside `0.80–1.20`; or the same failure appears in ≥2 independent seeds. A run-level regression is a trend across three adjacent waves or two player counts, not one noisy seed.

## 3. Harness strategy

1. **Headless deterministic sweep (required gate):** add a runner around `step()` with scripted, skill-normalized commands for 2/3/4 players. Run `2 × 4 × 19 × 20` cells (mode × player count × waves × seeds), or the equivalent matrix with wave 1–20 in one run. Use fixed seed manifests, record every state hash, and produce per-cell median/p95 plus outlier flags. This is the authoritative pass/fail suite.
2. **Logged replay (required diagnosis):** persist commands, seed, content/build hash, RNG stream version, and state hashes. Any failed cell must replay byte-for-byte before tuning. Re-run the same replay after a constant change to prove the intended metric moved and unrelated waves did not regress.
3. **Interactive playtest (required feel gate):** sample at least one median and one p95 seed for 2p, 3p, and 4p at waves 1, 5, 10, 15, and 20. Capture observer notes for readability, counterplay, ranged/disabler lockout, and whether pressure feels different rather than merely spongey. Interactive results can veto a headless pass but cannot replace it.

Do not use networked clients as the primary balance harness: rendering, latency, and input timing make attribution noisy. Use a small network smoke test only after headless/replay gates pass.

## 4. Failure triage and stat adjustment procedure

1. Reproduce the exact seed and verify state-hash/replay determinism. If hashes diverge, fix the harness before balance work.
2. Classify the failure: budget/composition, spawn pacing/peak concurrency, enemy survivability, incoming damage/control, or player-script/DPS. Compare raw and normalized metrics against the adjacent wave and other player counts.
3. Inspect role slices first. A ranged/disabler damage spike points to role count, attack damage/cooldown, projectile cadence, or control duration; a tank clear-time spike points to health/armor/threat cost; a charger/flanker spike points to speed, contact damage, or spawn timing; a swarm peak spike points to budget, cap, or spawn interval.
4. Change one constant family at a time, in this order: composition/caps → threat budget or spawn interval → role count/weights → role health/damage/cooldown/speed → global scaling slope. Do not change deterministic role sorting or RNG call order.
5. Re-run the failing seed, the full affected wave ±2, all three player counts, both modes, and the golden replay fixtures. Accept only a change that fixes the targeted outlier without creating a new outlier or moving a passing cell outside its band.
6. Record the adjustment, expected metric movement, before/after telemetry, and rationale in the balance changelog. If a failure is caused by an intentional cap/unlock remainder, fix the composition fallback/telemetry rather than silently raising stats.

## 5. Implementation checklist and Phase 3C confidence gate

- [ ] Add versioned telemetry types/recorder and role-aware spawn metadata.
- [ ] Add wave finalization metrics, active-enemy tick sampler, damage attribution, and unused-budget reason.
- [ ] Add deterministic scripted headless runner and seed manifest for 2p/3p/4p × Adventure/Endless × waves 1–20.
- [ ] Add aggregate report with median/p95, normalized ratios, labels, and outlier detection.
- [ ] Add replay fixtures for one representative run per player count/mode and fail on state-hash divergence.
- [ ] Implement guaranteed-two-role fallback and test the role-cap/unlock invariants.
- [ ] Extend the simulation's current five-wave ceiling to 20, or explicitly gate the sweep until `MAX_WAVES >= 20`; do not claim wave-20 coverage before this is true.
- [ ] Run the interactive feel gate and attach notes/screenshots or recordings for milestone waves.
- [ ] Freeze approved constants and publish the baseline telemetry artifact.

**Confidence gate for Phase 3C:** full test suite green; all matrix cells have ≥20 seeds; no hard invariant failures; no Punishing cell; viable/pressured labels meet the bands; 2p/4p normalized metrics meet ±15%; Adventure/Endless ordering is present; all outliers have either been fixed or explicitly waived with evidence; and replay fixtures remain deterministic. Until these are true, Phase 3C map work may proceed only on a branch and must not be used to mask balance failures.

## Current repository readiness

The existing Phase 3B.2 tests pass (39 simulation tests in the verified run), and the content already exposes mode-aware scaling, role composition, threat budget, and active-enemy limits. The sweep is **not yet complete**: telemetry aggregation, the 20-wave runner, guaranteed-two-role fallback, golden metrics, and interactive evidence remain implementation tasks. The current `MAX_WAVES = 5` is an explicit blocker for a literal waves 1–20 confidence claim.
