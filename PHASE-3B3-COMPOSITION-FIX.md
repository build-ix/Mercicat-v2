# Phase 3B.3 Composition Fix - Implementation Summary

## Changes Made

### 1. Fixed `selectEnemyComposition()` to support multiple role groups

**File:** `packages/simulation/src/spawnDirector.ts`

**Change:** Refactored the composition selector from a single-group 2-per-role cap to a multi-group architecture that:

- Builds role groups sequentially until budget is exhausted
- Each group independently maintains the 2-per-role cap
- Allows roles to appear in multiple groups for high-budget waves
- Maintains deterministic seeding and reproducibility

**Rationale from diagnostic:** The old design capped total spend at 56 (2 per role × 6 roles × 28 threat/role set), while wave 20 budgets reached 368-613. This created a hard utilization ceiling of ~15%.

**Result:** Budget utilization now reaches 100% (1.0) across all calibration cells, vs. previously ~0.16-0.27.

### 2. Updated composition-related tests

**Files:** 
- `packages/simulation/tests/phase3b.spawnDirector.test.ts` - Updated expectations for multi-group support
- `packages/simulation/tests/phase3b2.scaling.test.ts` - Updated test to allow roles > 2 in multi-group scenarios

**Added:** `packages/simulation/tests/phase3b3-composition-utilization.test.ts` - New calibration test suite verifying:
- 3 seeds × 5 waves × 6 cells = 90 budget constraints (all pass)
- Median utilization 0.85-1.00 across all cells (actual: 1.000)
- P95 utilization ≥ 0.75 (actual: 1.000)

## Test Results - Calibration Pass

### Utilization Metrics (3 seeds, 5 waves, 6 cells)

| Cell | Median | P95 | Status |
|---|---|---|---|
| Adventure 2p | 1.000 | 1.000 | ✓ PASS |
| Adventure 3p | 1.000 | 1.000 | ✓ PASS |
| Adventure 4p | 1.000 | 1.000 | ✓ PASS |
| Endless 2p | 1.000 | 1.000 | ✓ PASS |
| Endless 3p | 1.000 | 1.000 | ✓ PASS |
| Endless 4p | 1.000 | 1.000 | ✓ PASS |

**Improvement from diagnostic baseline:** ~6x improvement (0.16-0.27 → 1.000 utilization)

### All Phase 3B Test Results

- ✓ phase3b.spawnDirector.test.ts (7 tests)
- ✓ phase3b1.integration.test.ts (3 tests)
- ✓ phase3b2.scaling.test.ts (4 tests)
- ✓ phase3b3-composition-utilization.test.ts (4 tests)
- **Total: 18/18 tests passing**

## Design Invariants Maintained

1. ✓ Budget never exceeded (per diagnostic requirement)
2. ✓ 2-per-role cap maintained **per group**
3. ✓ Deterministic seeding preserved (replay-safe)
4. ✓ Unlock gates applied correctly
5. ✓ At least 2 distinct roles per composition
6. ✓ Alphabetically sorted composition output

## Next Steps per Diagnostic

This fix addresses **P1 structural mismatch** priority from the diagnostic:

- [x] Fix composition strategy / hard role cap
- [x] Preserve two-per-role diversity (within groups)
- [ ] Budget tuning (optional, after composition validated)
- [ ] Full confidence run (20-24 seeds per cell, all waves 1-20)

**P0 telemetry fixes** still needed:
- [ ] Add `unusedBudgetReason` classification (role-cap vs unlock-gate vs spawn-time)
- [ ] Preserve role metadata on spawn events
- [ ] Post-despawn aggregation validation

**Note:** No replay version bump required - composition strategy remained deterministic and seeded.
