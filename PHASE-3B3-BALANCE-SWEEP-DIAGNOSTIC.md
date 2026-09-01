# Phase 3B.3 Balance Sweep Diagnostic

**Date:** 2026-09-01  
**Status:** Confidence gate remains **FAIL**; remediation prescribed.  
**Scope:** Adventure/Endless × 2p/3p/4p, waves 1–20, current `3B.3` artifact.

## Executive finding

The low threat-utilization verdict is primarily a **composition-cap/budget-coupling defect**, not evidence that enemy role damage, health, or cooldown stats are too low.

The current selector (`packages/simulation/src/spawnDirector.ts`) does all of the following:

- Selects an affordable composition against the calculated budget.
- Limits every role to **two copies per wave**.
- Has only six roles, with threat costs `1 + 3 + 4 + 8 + 7 + 5 = 28` per complete role set; at two copies each, the theoretical maximum spend is **56**.
- Stops when no affordable, under-cap role remains, leaving the rest of the budget unspendable.

The budget formula (`packages/content/src/waves.ts`) rises from 30/37/45 at wave 1 for 2p/3p/4p Adventure to 368/464/559 at wave 20. Endless is similarly 32/41/49 at wave 1 and 402/506/610 at wave 20 in the current artifact. Thus, by late waves the selector can spend at most 56 against budgets many times larger. The observed late-wave utilization of roughly 9–15% is the expected consequence of that ceiling.

This is also consistent with the artifact: all 120 waves survived, damage taken is zero, and each row is flagged `threat-utilization-below-median-band`; run-level median utilization is about 0.16–0.27 by cell, versus the required median 0.85–1.00. The 4p cells are lower because player-scaled budgets are higher while the composition ceiling is unchanged.

## Evidence and diagnosis

### Observed artifact metrics

The checked-in CSV contains 120 wave records (six runs × 20 waves):

| Cell | Median threat utilization | p95 utilization | Wave-20 utilization |
|---|---:|---:|---:|
| Adventure 2p | ~0.267 | 0.800 | ~0.149 |
| Adventure 3p | ~0.212 | 0.634 | ~0.119 |
| Adventure 4p | ~0.175 | 0.525 | ~0.098 |
| Endless 2p | ~0.244 | 0.732 | ~0.137 |
| Endless 3p | ~0.194 | 0.578 | ~0.109 |
| Endless 4p | ~0.161 | 0.481 | ~0.090 |

Overall median is approximately 0.207. This is not a borderline confidence miss; it is a systematic late-wave ceiling.

The first wave's sample composition is `2 charger + 1 ranged + 2 swarm`, costing 12 against a 30-point 2p Adventure budget. Later rows spend approximately 48–55 while budgets continue growing into the hundreds. The role definitions do not explain this ratio: role threat costs are being applied correctly, but the selector cannot continue adding roles after the two-copy cap is reached.

### Root-cause ranking

1. **Composition strategy / hard role cap — primary (high confidence).** The cap is a per-role count cap, but there is no wave-level mechanism to create additional role groups, elite variants, or a larger legal queue as budget grows. The selector therefore leaves budget stranded by construction.
2. **Threat-budget curve — secondary design mismatch.** The budget scales with wave and party size independently of the selector's maximum legal spend. It is not necessarily “too high” for the intended amount of combat, but it is too high for the currently legal composition space.
3. **Spawn pacing / active cap — possible secondary constraint, not the observed primary cause.** The current queue itself is usually only 5–11 enemies in the artifact. A pacing cap could matter after composition is expanded, but it cannot account for a theoretical late-wave spend ceiling of 56 when the budget is 368–613.
4. **Enemy role stats — not indicated by this failure.** Health, damage, speed, and cooldown affect pressure and clear time, not `threatSpent / threatBudget`. They should only be tuned after composition and budget are made coherent and the resulting damage/clear-time telemetry is measured. Changing stats now would risk hiding the real issue or making a newly filled composition punishing.
5. **Telemetry classification — instrumentation gap.** `unusedBudgetReason` is hard-coded to `"none"`, so the report does not distinguish cap exhaustion from unlock or spawn-time remainder. Also, reconstructed `roleCounts` can be zero because despawned entities are no longer available at wave finalization. Fix this before using role-distribution evidence for a gate decision.

## Recommended order: composition/budget diagnosis before seed expansion

Do **not** spend the full confidence-run budget on 20 seeds per cell against the known-broken selector. First run a small deterministic calibration matrix, then expand coverage.

Recommended order:

1. **Instrument and reproduce with the existing seed.** Record selected composition, actual spawn list, threat cost per role, and an explicit unused-budget reason. Preserve replay/state hashes.
2. **Make the composition model and budget coherent.** Prefer a composition fix that preserves the two-per-role diversity invariant while allowing multiple legal role groups at higher budgets (or introduce explicitly designed elite/variant entries with their own costs and caps). Do not simply delete the role cap.
3. **Tune budget only after the legal composition can consume it.** If the intended wave pressure is lower than the current curve, run a controlled budget sweep; do not infer this from utilization alone.
4. **Run a small smoke calibration:** 3 seeds per cell, all six cells, waves 1/5/10/15/20; verify utilization and pressure move in the intended direction.
5. **Then expand to the authoritative seed set:** 20 fixed, independent seeds per cell minimum, with median and p95 reporting. Prefer 24 seeds per cell for a modest margin against a single flaky/rejected seed (144 runs total for six mode/player cells, or 2,880 wave observations if each run covers waves 1–20).

Seed coverage is still mandatory for the gate, but it cannot diagnose or cure a deterministic structural ceiling. Expanding from 1 to 20 seeds first would make the failure more statistically confident without making the harness pass.

## Concrete path to PASS

### A. Required implementation changes

- Add a versioned seed manifest with **at least 20 seeds per mode/player cell**; recommended production gate set is **24 seeds per cell**.
- Fix `unusedBudgetReason` classification. At minimum distinguish `role-cap`, `unlock-gate`, `spawn-time`, and `other`.
- Independently reconstruct role counts from spawn events and compare them with the selected composition; fail telemetry if they disagree.
- Preserve role metadata on spawn events or resolve it from immutable content so post-despawn aggregation is valid.
- Keep the two-copy role-diversity invariant, but add a legal high-budget mechanism. Candidate designs, in priority order:
  - repeated composition groups with an explicit wave-level/group cap and pacing budget;
  - tier/elite variants with separately reviewed threat costs and caps;
  - a revised role-cap rule that is explicitly approved by the 3B.2 design contract.
- Ensure active-enemy cap and spawn interval are checked after the composition change; utilization must not be raised solely by queuing enemies that cannot spawn during the wave.
- Keep RNG call order/replay versioning stable unless the content change intentionally bumps the replay/schema version.

### B. Budget tuning recommendation and range

No global budget reduction should be the first fix. The current late-wave mismatch would require reducing a 368-point 2p wave to roughly the 56-point legal maximum—an 80–85% reduction—and reducing 4p wave-20 budgets even more. That would be a design rewrite, not a safe tuning pass, and would likely erase intended scaling.

After composition expansion, test a **10%, 15%, and 20% downward budget multiplier** (and a no-change control) per mode, while preserving Adventure < Endless pressure. Treat approximately **±15%** as the initial tuning search range; do not exceed **25%** without a design review. Select the smallest change that meets pressure metrics, not the value that merely makes utilization look good.

If the team intentionally decides that the existing two-copy cap is immutable, the alternative is to redesign the budget curve to fit the legal ceiling, targeting 0.85–1.00 utilization. That would imply a severe late-wave budget reduction and should be rejected unless the intended wave has only about 10–12 enemies and a much lighter pressure curve.

### C. Pass thresholds

Use the existing contract, not a new relaxed gate:

- Threat utilization median: **0.85–1.00** per wave/cell.
- Threat utilization p95: **≥0.75**.
- Lower utilization may be accepted only where `unusedBudgetReason` is a known cap/unlock/spawn-time limitation and the exception is explicitly reviewed; it should not be the normal late-wave result.
- At least two roles whenever the affordable budget supports two roles.
- No role above two copies unless the design contract is formally changed.
- No Punishing cell; wipe rate **≤5%**; no timeout.
- Viable or intentionally Pressured labels, with damage/clear-time bands from the Phase 3B.3 contract.
- 3p/4p normalized damage and clear time within **±15%** of the 2p baseline.
- Endless more pressuring than Adventure at the same wave/player count while both remain completable.
- Active-enemy cap, role-ratio, deterministic replay, and full test-suite invariants all green.

Utilization is a diagnostic invariant, not a substitute for player-pressure metrics. A filled budget that produces zero damage (as the current scripted artifact does) is not a balance pass.

## Effort and benefit estimate

### Minimum credible fix

| Work item | Estimate | Benefit |
|---|---:|---|
| Telemetry correction and targeted unit tests | 0.5–1 day | Makes cap/unlock/spawn attribution trustworthy; prevents false diagnosis. |
| Composition expansion/design review | 1–2 days | Removes the structural utilization ceiling while retaining role diversity. |
| Budget calibration (no-change + ±10/15/20% runs) | 0.5–1 day | Separates utilization repair from actual pressure tuning. |
| Seed manifest, 20–24 seeds/cell, aggregate/replay validation | 0.5–1 day | Supplies the required statistical confidence and regression protection. |
| Milestone interactive checks and changelog/baseline | 0.5–1 day | Catches spongey, unreadable, or control-lockout outcomes. |
| **Total** | **~3–6 engineering days** | A defensible 3B.3 gate decision and reusable balance baseline. |

A budget-only shortcut is faster (roughly 0.5–1 day) but is not recommended: it would require an extreme late-wave curve change or leave the composition defect intact. The likely benefit of the proper fix is high: it makes the threat budget meaningful, reveals actual role pressure, and gives map design a stable combat-load baseline. The principal risk is overfilling waves and turning a previously zero-damage script into a Punishing result; that is why composition and budget must be calibrated separately.

## Phase 3C decision

**Do not declare Phase 3C unblocked by this artifact.** The documented confidence gate explicitly requires ≥20 seeds/cell, no hard invariant failures, valid viable/pressured bands, and fixed or waived outliers. The current result fails those requirements.

Phase 3C map work may proceed **in parallel only on an isolated branch**, limited to geometry/tooling that does not claim balance validation and does not tune maps to mask the balance failure. It must not be merged as a balance baseline, and map playtest conclusions should be re-run after the approved composition/budget change.

Recommended dependency policy:

- **Parallel now:** map layout prototypes, traversal/blockout tooling, spawn-point authoring tools, and geometry-independent UX.
- **Gated:** final spawn placement, chokepoint validation, encounter pacing sign-off, map-specific difficulty claims, and Phase 3C milestone/release integration.
- **Unblock condition:** complete the corrected 3B.3 sweep and replay/interactive gates, publish the approved baseline, then validate maps against it.

## Implementation priority checklist

### P0 — establish trustworthy attribution

- [ ] Add the 20–24 seed/cell manifest, but use it after calibration rather than as the first diagnostic.
- [ ] Record selected composition and actual spawn events with role/threat metadata.
- [ ] Compute `unusedBudgetReason` instead of hard-coding `none`.
- [ ] Fix post-despawn role aggregation and assert selected-vs-observed composition equality.
- [ ] Add a focused regression test demonstrating the current late-wave spend ceiling.

### P1 — fix the structural mismatch

- [ ] Choose and document the approved high-budget composition mechanism.
- [ ] Preserve two-per-role diversity unless the design contract is explicitly revised.
- [ ] Verify spawn pacing and active-enemy caps against the expanded queue.
- [ ] Re-run the six-cell smoke calibration at 3 seeds/cell and inspect damage, clear time, peaks, role damage, and utilization.

### P2 — tune and validate

- [ ] Compare budget multipliers 1.00, 0.90, 0.85, and 0.80; start with the smallest change that meets pressure bands.
- [ ] Tune role stats only if role-attributed damage/clear-time evidence identifies a real role problem.
- [ ] Run the full 20-seed minimum (prefer 24) matrix, with medians/p95 and outlier detection.
- [ ] Replay every failing seed before/after changes; verify state hashes and golden fixtures.
- [ ] Run the interactive feel gate at waves 1/5/10/15/20 for representative median/p95 seeds.
- [ ] Freeze constants, publish the artifact/changelog, and only then gate final Phase 3C integration.

## Bottom line

Fix the **composition-cap/budget mismatch and telemetry first**, then tune the budget within about **10–20%** (initial search; **25% maximum without review**), then collect **20 minimum / 24 recommended seeds per cell**. Target median utilization **0.85–1.00** and p95 **≥0.75**, but accept the gate only when those numbers coexist with viable/pressured damage and clear-time behavior. Proceed with Phase 3C only in parallel on a quarantined branch; do not treat it as balance-approved until the corrected 3B.3 gate passes.
