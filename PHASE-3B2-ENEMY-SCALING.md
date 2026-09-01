# Phase 3B.2 — Enemy Wave Difficulty Scaling

## Runtime contract

All formulas are pure functions of `(wave, playerCount, difficulty)`; all random choices use the wave RNG stream. Player count is clamped to 2–4.

- **Health:** `min(3.25, P_hp × W_hp × T)` where Adventure `P_hp=1+0.09(p-2)`, `W_hp=1+0.025(w-1)`; Endless uses `P_hp=1+0.10(p-2)`, `W_hp=1+0.035(w-1)^1.08`.
- **Damage:** Adventure `min(2.05, (1+0.06(p-2))(1+0.015(w-1))T)`; Endless replaces the player coefficient with `.075` and wave coefficient with `.022`.
- **Speed:** `min(1.35, 1+0.025(p-2)+k(w-1))`, with `k=.004` Adventure and `.006` Endless.
- **Cooldown:** attack interval multiplier `max(.80, 1-.025(p-2)-k(w-1))`, with `k=.003` Adventure and `.004` Endless. Lower is faster. Per-role base health/damage/speed/cooldown comes from `ENEMY_ROLES`.
- **Tier:** `T=1+0.02(difficulty-1)` Adventure and `1+0.025(difficulty-1)` Endless. Numeric difficulties 1–2 map to Adventure and 3–4 to Endless.

Legacy `calculateThreatBudget` remains unchanged for replay compatibility. New mode-aware budget is `round(B × (1+.35(p-2)))`: Adventure `B=20+12(w-1)`; Endless `B=24×1.14^(w-1)`. The existing director uses the legacy curve until replay versioning is introduced.

## Composition rules

The seeded selector sorts roles before rolling, applies unlock-wave gates, and hard-caps every role at **2** per wave. It may leave a small budget remainder rather than violate the cap. Weight changes must not replace this cap. At least two roles should be guaranteed when the affordable budget supports two role types (follow-up tuning gate).

## Verification and phase gates

1. **Gate A — formula/unit tests:** monotonic 2p < 3p < 4p; caps; Adventure/Endless distinction; cooldown never below 0.80; no NaN/negative values.
2. **Gate B — deterministic integration:** same seed + inputs produces identical composition, resolved stats, event order, and state hash; RNG snapshots replay identically. No wall-clock/random API.
3. **Gate C — balance sweep:** run 2p/3p/4p × waves 1–20 × both modes with fixed seeds. Record clear time, player damage taken, active-enemy peak, threat spent, role counts. Target 3p/4p clear-time and damage bands within ±15% of 2p baseline after accounting for player DPS; flag any role >2.
4. **Gate D — playtest:** confirm swarm/challenger/ranged/tank counterplay, no ranged/disabler lockout, and Endless remains survivable through wave 20. Tune only constants, not deterministic ordering.
5. **Gate E — replay/content review:** serialize a replay fixture from each player count and mode; reject changes to legacy budget or RNG call order unless replay version is bumped.

## Implementation checklist

- [x] Pure stat and mode-aware budget formulas in `packages/content/src/waves.ts`.
- [x] Resolve per-role stats at spawn and use speed/damage/cooldown in enemy AI.
- [x] Enforce max-two composition cap in the threat-budget director.
- [x] Add deterministic scaling/composition tests.
- [ ] Add guaranteed-two-role fallback and telemetry for unused budget.
- [ ] Add automated 2p/3p/4p wave-20 balance sweep and golden metrics.
- [ ] Add replay schema/version gate before switching live director to mode-aware budgets.
