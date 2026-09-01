# Phase 3B.3 Remediation Strategy Review

**Recommendation:** Use a phased validation approach. Do not spend the authoritative full-run budget until telemetry and the composition/budget coupling are demonstrably repaired.

## Decision

The full re-run is necessary for the final Phase 3C confidence gate, but it is not necessary as the first validation of Fable's fixes. The current failure is structural and large (late-wave utilization is capped by the legal composition space), so repeating all seeds before fixing it only produces a more expensive confirmation of failure. The current harness also has telemetry attribution defects, so a full report made before those are corrected would not be trustworthy.

Implement Fable's first three remediation areas, run a deterministic directional validation, and launch the authoritative run only if the validation passes. A small run is a diagnostic/reproduction gate, not a substitute for the final confidence gate.

## Priority and deferral

1. **P0 — Telemetry correctness: time-critical and prerequisite.** Fix `unusedBudgetReason`, preserve role metadata on spawn events, reconstruct role counts from spawn events, and assert selected-vs-observed composition equality. Preserve replay/state hashes. Without this, utilization and role-distribution evidence cannot support a decision.
2. **P1 — High-budget composition mechanism: time-critical and causal.** Add repeated composition groups (preferred) or explicitly designed elite/variant entries. Preserve the two-per-role invariant unless the 3B.2 contract is formally revised. Re-check spawn interval and active-enemy caps after expansion.
3. **P2 — Budget calibration: next.** Compare multipliers `1.00`, `0.90`, `0.85`, and `0.80` only after the selector can legally consume high-wave budgets. Choose the smallest multiplier that produces viable/pressured gameplay; do not tune enemy stats from utilization alone.
4. **P3 — Seed manifest/coverage: defer until structural calibration.** Generate the versioned 20-seed minimum / 24-seed recommended manifest after the small run passes. More seeds cannot repair a deterministic cap.
5. **P4/P5 — Full sweep and confidence-gate sign-off: defer until P0–P2 and validation pass.** These are mandatory for final Phase 3C integration, but are the worst first use of compute.

Enemy role-stat tuning is explicitly deferred unless post-composition telemetry identifies a role-specific damage, survivability, or clear-time problem.

## Execution order

1. Freeze the current artifact as the pre-fix baseline and record the build/content hash.
2. Implement P0 telemetry fixes and focused regression tests, including deterministic replay/hash checks.
3. Implement P1 high-budget composition behavior; do not simply remove the role cap.
4. Verify composition, actual spawn events, pacing, active-enemy cap, and replay determinism on a single representative run.
5. Run Phase 1 directional validation below.
6. If Phase 1 passes, select the budget multiplier from the controlled P2 comparison and generate the authoritative seed manifest.
7. Run Phase 2 full coverage and the interactive/replay gates. Freeze constants and publish the baseline.
8. In parallel, Phase 3C may immediately proceed with isolated map blockouts, traversal/tooling, spawn-point authoring, and geometry-independent UX. Keep final spawn placement, chokepoint/encounter pacing claims, map-specific difficulty tuning, and release integration gated on Phase 2.

## Phase 1 — exact validation scope

**Purpose:** Confirm direction and catch overfill/pacing/punishing regressions cheaply; this is not a confidence-gate run.

- Build: one fixed post-P0/P1/P2 build; record build ID, content hash, RNG version, and schema version.
- Seeds: two fixed seeds from the eventual manifest, preferably `101` and `211`.
- Primary cells: `adventure/2p` (low-end baseline) and `endless/4p` (high-budget/high-pressure boundary).
- Waves: 1–20, yielding **2 seeds × 2 cells × 20 waves = 80 wave records**.
- Budget controls: run the same 80-wave matrix for the no-change control (`1.00`) and candidate multipliers (`0.90`, `0.85`, `0.80`) only if runtime remains short; otherwise use the selected default first and compare multipliers on representative waves 10/15/20.
- Evidence: JSON/CSV telemetry, selected composition and actual spawn list, unused-budget reason, role counts/threat, damage by role/player, clear/completion time, peak active enemies, wipe/timeouts, and per-wave/final replay hashes.
- Required directional checks:
  - no selected-vs-observed composition mismatch;
  - no role-cap or active-enemy-cap violation;
  - late-wave utilization materially rises from the pre-fix ~9–15% regime and is not stranded solely by the former cap;
  - no timeout/wipe and no Punishing result in either cell;
  - replay hashes are byte-for-byte stable on repeat;
  - Adventure remains less pressuring than Endless at corresponding sampled waves.
- Go/no-go: proceed only if the structural defect is gone, telemetry is internally consistent, determinism holds, and pressure is viable/pressured rather than punishing. Do not require Phase 1 alone to prove median/p95 confidence thresholds.

Because two cells do not test all player-count transitions, add a cheap spot check before Phase 2: the same two seeds at waves 1/10/20 for the remaining four cells (`adventure/3p`, `adventure/4p`, `endless/2p`, `endless/3p`). This adds **24 wave records** and verifies scaling/order without turning Phase 1 into the full run.

## Phase 2 — exact authoritative scope

- Use a versioned manifest of **24 fixed independent seeds per cell** (20 is the minimum accepted gate; retain 24 as recommended).
- Run every documented cell: Adventure/Endless × 2p/3p/4p, waves 1–20.
- This is **6 cells × 24 seeds × 20 waves = 2,880 wave records** and **144 runs**. If the product contract truly contains eight cells, first document the two additional cells and add them explicitly; then the corresponding count is **8 × 24 × 20 = 3,840 wave records** and **192 runs**. Do not mix the six-cell implementation with an eight-cell claim.
- Run with the frozen selected budget multiplier and build/content/schema/RNG versions. Preserve raw failed-run replays and aggregate JSON/CSV reports.
- Gate criteria: utilization median `0.85–1.00`, p95 `≥0.75` (with only explicitly reviewed cap/unlock/spawn-time exceptions); no role-cap or active-cap violations; no telemetry mismatch; no Punishing cell; wipe rate `≤5%`; viable/pressured damage and clear-time bands; 3p/4p normalized damage/clear time within `±15%` of 2p; Endless more pressuring than Adventure; stable replay hashes; full test suite green.
- After headless completion, replay every failure and run the interactive feel gate at waves 1/5/10/15/20 for representative median/p95 seeds. Only then freeze constants and unblock final Phase 3C integration.

## Bottom line

Do P0 telemetry and P1 composition immediately, calibrate budget as P2, then spend compute on the small directional matrix. This minimizes delay, exposes overfilling before the expensive run, and lets map design proceed on an isolated branch without falsely treating balance as approved. The authoritative full run remains mandatory before Phase 3C release/integration.
