# Mercicat v2 — Core Systems Design Lockdown

**Purpose:** questionnaire + implementation contract for economy, combat taxonomy, loot, player power, progression, large enemies, co-op, failure, and mode identity.

**Status:** Draft for design sign-off. The decisions in the **Resolved** register are authoritative inputs already supplied by the product owner. Every item in **Proposed lock** is a concrete default intended to eliminate coding ambiguity; approve or replace the value before implementation. No system should silently invent a different value.

**Existing constraints carried forward**
- Server-authoritative deterministic simulation; fixed 30 Hz (`TICKS_PER_SECOND = 30`).
- 1–4 players; shared one-pursuer rule.
- Shop is fully safe: static once placed, non-solid, reachable, no overlap, no mid-wave relocation.
- Pursuer can be downed and drops loot.
- Classic mode uses boss mutation.
- Progression is run-based in the Brotato sense: shop choices and run power are reset each run; meta unlocks are separate.
- Existing wave/balance telemetry must remain deterministic and must distinguish role-cap, unlock-gate, and spawn-time unused budget.

---

## 0. Sign-off protocol

For each numbered question, the owner must either accept the proposed lock or write a replacement. A replacement must include units, timing, scope (per-player/shared), and whether it is run-based or permanent. “Tune later” is not a valid implementation answer unless a bounded range and selection rule are supplied.

### Already resolved

| ID | Locked answer |
|---|---|
| R1 | The shop never harms, blocks, displaces, traps, or damages a player. Placement is safe and static for the wave. |
| R2 | There is exactly one shared pursuer per run/match, not one per player. |
| R3 | A pursuer may be downed; downing it produces its loot drops. |
| R4 | Classic boss encounters use the boss-mutation rules defined below, rather than introducing a separate unrelated boss mode. |
| R5 | Run progression follows Brotato-style between-wave shop/build decisions. |

### Global invariants to approve

- All prices, rewards, cooldowns, timers, drops, and scaling formulas are integer/fixed-point simulation values.
- The server validates every purchase, pickup, revive, upgrade, and reward; clients only request.
- RNG streams remain separated (`wave`, `enemySpawn`, `loot`, `weaponSpread`, `ai`) and are snapshot/replay-safe.
- A player can never spend currency they do not own, receive the same unique reward twice, or bypass a wave/shop boundary by reconnecting.

---

## 1. Economy

### Questions

**E1. Currency:** Is there one spendable currency or separate gold/material currencies? Is currency personal or pooled in co-op? Does it persist after a run?  
**E2. Wave income:** Is the reward paid on survival, per kill, by time, or a mixture? Is the reward affected by difficulty, player count, pursuer, boss, or deaths?  
**E3. Shop inventory:** How many slots? Are offers identical for all players? Does buying remove an offer for everyone? Are offers rerolled between waves?  
**E4. Rerolls:** What is the starting cost, growth formula, cap, and whether cost is personal/shared? Is the first reroll free?  
**E5. Prices:** Should items be priced by rarity, slot, or power budget? Can a player buy duplicates?  
**E6. Safety:** Does the shop close at countdown start, wave start, or remain available through the whole intermission? What happens to unspent currency?

### Proposed lock (recommended baseline)

- **Currency:** one integer currency, `credits`, pooled per player (not shared). Credits are run-only and reset at run end. No currency persistence.
- **Wave payout:** on wave survival, each living or downed player receives `20 + 5 × wave + 2 × defeatedForWave` credits. A defeated/dead player receives 50% of the normal payout, rounded down. Boss mutation adds 25 credits to each eligible player; pursuer down adds 40 credits to each connected player, awarded once per pursuer. No passive time income.
- **Kill credits:** no direct kill credits; this prevents last-hit competition and keeps co-op rewards legible.
- **Shop:** 4 item offers, 1 consumable offer, and a guaranteed weapon offer every 3 waves. Offers are independently generated but deterministic. Each player sees the same offer identities and prices; purchases are personal and do not remove the offer for teammates. Each offer may be bought once per player per shop visit unless tagged `repeatable`.
- **Reroll:** first reroll each intermission costs 5 credits; later rerolls cost `5 + 5 × rerollsThisVisit`, capped at 40. Rerolls regenerate all offers except the guaranteed weapon slot and never change already-purchased items. No free rerolls.
- **Price bands:** Common 25, Uncommon 45, Rare 75, Epic 115, Legendary 170; weapons add +20, permanent stat items use the band directly, consumables cost 15. Prices are not randomized.
- **Shop timing:** shop opens during intermission, remains available until the next active wave begins, then closes atomically. Purchases after close are rejected. Unspent credits carry between waves in the same run.
- **Catch-up economy:** a player joining mid-run starts with the current wave’s baseline credits (`20 + 5 × currentWave`) and receives no retroactive purchases.

### Economy acceptance tests

1. Two identical seeds produce identical offers, prices, payouts, and reroll sequences.
2. A purchase cannot make credits negative, cannot occur during an active wave, and cannot be duplicated by retrying a command.
3. Co-op players can buy different copies independently without changing teammates’ offers.
4. A 20-wave run’s expected income supports a viable build while not guaranteeing Legendary items; balance sweep must publish median end-run credits and purchase count for 1/2/3/4 players.

---

## 2. Enemy taxonomy

### Questions

**N1. Which roles are core, and what is each role’s gameplay verb?**  
**N2. Are “small/medium” size tiers visual only, or do they change collision, hitstun, loot, and threat cost?**  
**N3. Which enemies are specials (elite, summoner, hazard, boss, pursuer), and what is their exact spawn gate?**  
**N4. Do variants replace base enemies or stack modifiers? Can two specials coexist?  
**N5. What are the active-enemy cap, role-copy cap, and high-budget composition rule?

### Proposed taxonomy lock

| Family | Role / tier | Function | Initial unlock | Threat cost |
|---|---|---|---:|---:|
| Swarm | Small | Fast melee pressure; low HP | 1 | 1 |
| Charger | Medium | Telegraph, charge, disengage | 1 | 3 |
| Ranged | Medium | Maintains distance; projectile volleys | 2 | 4 |
| Brute | Large | Slow contact threat; stagger-resistant | 4 | 7 |
| Controller | Medium | Zone/slow/root; low direct damage | 6 | 5 |
| Summoner | Large | Creates limited minions; vulnerable while casting | 9 | 8 |
| Elite | Any base role | One visible affix, +stats and loot chance | 8 | base + 4 |
| Boss mutation | Large | Wave boss mutation applied to one eligible base | 5, then every 5 waves | base + 12 |
| Pursuer | Large special | One persistent shared hunter; pressure and loot objective | 3 | 10 |

- **Size tiers are mechanical:** Small radius 0.65×, hitstun 1.25×, HP 0.6×; Medium baseline; Large radius 1.35×, HP 2.5×, hitstun resistance 60%. Size never changes player targeting rules.
- **Role copies:** maximum 2 simultaneous copies of a role in a single composition group. High budgets create repeated groups, each with the same cap; group count is capped at 4. This preserves diversity while fixing the existing late-wave budget ceiling.
- **Special stacking:** at most one Boss mutation and one Pursuer are active. Elite affixes may coexist with a boss but never with a Pursuer on the same entity. A Summoner’s minions do not consume the composition budget, but do consume the active-enemy cap.
- **Composition:** roles unlock at their listed wave; select stable sorted role keys using the seeded wave stream. Spend cannot exceed budget. Record selected composition and actual spawn events with immutable role metadata.
- **Baseline cap:** 40 active enemies at 1–2 players, 60 at 3 players, 80 at 4 players. Minions count. The director may queue legal entries but cannot emit beyond cap; unspent budget is classified `spawn-time`.

### Classic boss mutation

Every 5th wave, one eligible Large role is mutated into a boss: 3.5× HP, 1.25× contact damage, +1 attack pattern, +50% telegraph duration, and a guaranteed Rare-or-better party loot roll. The boss is announced 5 seconds before arrival, cannot be duplicated, and is not a second pursuer. Classic’s mutation is applied to the wave’s selected role, preserving that role’s identity.

---

## 3. Loot specification

### Questions

**L1. Are drops personal, shared pickups, or auto-awarded?**  
**L2. What are the rarity probabilities and pity/guarantee rules?**  
**L3. Which item types can drop, and can an item be duplicated?**  
**L4. Are pickups temporary for the wave, permanent for the run, or meta-permanent?**  
**L5. What occurs when inventory is full or a player disconnects?

### Proposed lock

- Loot is **personal**: a roll is assigned to a player and is visible/collectible only by that player. It is auto-collected when within 1.25 units; no competition or stealing.
- Normal enemy drop rates: Swarm 1%, Charger 2%, Ranged 2%, Brute 5%, Controller 4%, Summoner 8%, Elite 20%. Boss guarantees one party reward plus one personal reward per connected player. Downed pursuer guarantees one personal reward per connected player and one shared cosmetic/material reward.
- Rarity weights for a normal personal roll: Common 60%, Uncommon 28%, Rare 9%, Epic 2.5%, Legendary 0.5%. Boss/pursuer roll: Uncommon 35%, Rare 40%, Epic 20%, Legendary 5%.
- A player who has received no Rare-or-better item for 3 consecutive eligible rolls gets the next eligible roll upgraded to Rare, then pity resets. Pity is run-only and snapshot state.
- Item types: weapon, weapon modifier, stat augment, active ability, consumable, and cosmetic/meta token. Combat loot is run-only. Cosmetic/meta tokens are account-persistent and never affect combat.
- Inventory: 4 weapon slots, 6 augment slots, 2 active ability slots, 5 consumable slots. Full inventory rejects the pickup and creates a visible owner-only drop timer of 20 seconds; then it expires. No auto-salvage.
- Salvage is available only in the shop: discard a run item for 25% of its listed price, rounded down. No salvage during active combat.
- Loot RNG uses only the `loot` stream and rolls in stable player-ID order.

---

## 4. Player power model and build system

### Questions

**P1. Which weapons exist at launch, and which are manual versus automatic?**  
**P2. Is aiming independent from movement? Can a player carry multiple active/manual weapons?**  
**P3. Are pickups temporary or permanent? What is the build limit and duplicate behavior?**  
**P4. Does upgrading a weapon replace it, stack levels, or evolve it?**

### Proposed lock

- Every player starts with one weapon and one passive slot. Weapons are: **Pistol** (manual, aimed single shot), **SMG** (manual, aimed burst), **Shotgun** (manual, aimed cone), **Boomerang** (manual, aimed returning projectile), **Drone Rack** (automatic orbiting shots), **Turret Kit** (automatic placed turret), and **Arc Wand** (automatic nearest-target chain).
- Manual weapons fire only on an explicit fire command and use the player aim vector. Automatic weapons fire from a server timer while equipped; the player may still aim auxiliary/manual abilities.
- Each player has one primary weapon, one secondary weapon, and two active abilities. Swapping has a 0.25-second lockout and cannot occur while downed. Weapons have levels 1–8.
- Shop purchases and loot are **permanent for the current run**, not permanent across runs. Temporary wave pickups are limited to consumables and last until used or run end. No untracked “temporary buff” exists.
- Build categories: weapon, weapon modifier, passive augment, active ability, consumable. A modifier attaches to one weapon and cannot be moved without a shop respec purchase.
- Duplicating an owned weapon raises its level by 1, up to 8; at levels 4 and 8 it evolves to the next authored behavior. Duplicate passives stack only when explicitly marked stackable; otherwise the second copy is converted to 25% shop value.
- All stat changes are additive within a category, then multiplicative once in the fixed order: base → additive weapon modifiers → additive player augments → multiplicative effects → difficulty scaling. This order is part of replay compatibility.

---

## 5. Progression system

### Questions

**G1. What is earned during a run versus between runs?**  
**G2. Is there a skill tree, and does it unlock characters, weapons, maps, or raw stats?**  
**G3. What is the maximum run level and how often does a player choose an upgrade?**  
**G4. How is co-op progression handled when players have different account unlocks?

### Proposed lock

- **Run progression:** XP from wave completion and enemy defeats fills a shared run-level bar per player. Each level grants one choice from 3 deterministic offers. Rerolling offers costs the economy reroll price and is separate from shop rerolls. Level-ups pause combat only during intermission; no mid-wave menu.
- Run level cap is 20 for a 20-wave run. A player who levels during a wave banks the level-up until intermission.
- **Meta progression:** account currency `marks` and a six-branch skill tree persist across runs. Branches: Offense, Defense, Mobility, Fortune, Teamwork, and Arsenal. Each branch has 10 nodes in a linear prerequisite path; the first 8 are stat/content nodes and nodes 9–10 are capstone/content nodes. Each node grants small bounded bonuses (maximum +10% to any raw stat through the entire tree) or unlocks content. No meta node can increase enemy damage received reduction beyond 10%.
- Meta unlocks: characters, weapons, augments, maps, and difficulty presets. Meta stats are disabled in competitive/leaderboard runs; otherwise they apply at run start and are immutable during a run.
- Marks are awarded at run end: 10 for each completed wave, +25 for victory, +10 for boss wave survived, and 0 for a failed run before wave 3. Marks are never lost.
- Co-op uses each player’s own unlock inventory. A locked weapon cannot be purchased by that player even if another player has it unlocked. The shared offer list may contain an item only if at least one connected player can use it; unavailable offers are replaced deterministically.
- Power scaling target: run power must dominate meta power. At wave 20, a normal build’s run upgrades should contribute at least 70% of combat power; all meta stat bonuses together contribute at most 10% relative to a fresh account.

---

## 6. Large enemies and pursuer behavior

### Questions

**B1. When does the shared pursuer spawn, and what causes re-entry?**  
**B2. What exactly is detection: distance, line of sight, noise, or aggro?**  
**B3. How long is a large enemy downed, and can players chain-down it indefinitely?**  
**B4. Does the pursuer leave permanently, return after a timer, or follow between waves?**

### Proposed lock

- **Large enemies:** enter through authored edge spawn points, never within 8 units of a player. They have a 1.0-second arrival telegraph and cannot deal damage during it.
- **Down state:** when a Large enemy reaches 0 HP, it becomes downed for 8 seconds, is invulnerable, emits a loot telegraph, and can be executed/interacted with once. A downed enemy cannot be chain-downed. After 8 seconds it dies and drops the already-determined loot. Bosses remain downed for 12 seconds.
- **Pursuer:** one shared entity spawns at the start of wave 3, then re-enters at the start of waves 8, 13, and 18 only if previously defeated; it does not spawn twice in a wave. If downed but not yet resolved, it remains in the arena through intermission and its loot is claimable before the next wave. If it escapes at 0 HP due to the down timer, it is counted as downed and cannot return until its next scheduled re-entry.
- Pursuer detection uses a 14-unit aggro radius plus line-of-sight check; it chooses the lowest-health active player, ties by stable player ID. It can switch target only after 2 seconds without LOS or when the target is downed.
- Pursuer has a 10-second spawn protection/telegraph, then follows navigation. It cannot enter the safe shop interaction radius while the shop is open; the shop remains non-solid and safe.
- A pursuer loot roll is generated at down time, not pickup time, preventing save/reconnect rerolls. The single shared pursuer reward is awarded once even if multiple players interact.
- Large-enemy and pursuer state (phase, target, down timer, re-entry schedule, loot seed/result) is snapshot-persistent.

---

## 7. Co-op rules

### Questions

**C1. Are resources personal or pooled?**  
**C2. What is the downed state, revive duration, bleed-out timer, and revive interruption rule?**  
**C3. Can a player respawn, and what happens if all players are down?**  
**C4. How do late joins and disconnected players affect scaling and rewards?**

### Proposed lock

- Credits, XP, inventory, weapons, and loot are personal. Wave completion, boss status, pursuer status, and victory are shared.
- A player at 0 HP enters **downed** for 20 seconds. Movement is crawl-only at 25% speed; firing and purchasing are disabled. A teammate revives by holding interact for 3 seconds within 1.5 units. Damage to either player interrupts and resets progress. A revived player returns at 35% max HP with 1.5 seconds invulnerability.
- Each player has one down per wave. A second down causes death and removes that player from the active wave. Dead players spectate and receive 50% wave payout if the team survives.
- If all players are down/dead, the run is defeated after a 3-second resolution window; there is no automatic team revive.
- A disconnect gives a 15-second grace period. Reconnect restores the player’s snapshot state, including downed/dead status; it does not rewind the wave. A permanent leave removes that player from party scaling at the next wave boundary only.
- Difficulty threat budget scales from the active-player count at wave start. A late joiner does not retroactively add enemies or revive the party.
- Catch-up: a late joiner receives baseline current-wave credits, the current run-level XP floor minus one level, and a starter weapon at level 1. They receive no prior loot, marks, or meta unlocks.
- Shared telegraphs and boss/pursuer drops are visible to all, but personal ownership is enforced server-side.

---

## 8. Failure, death, checkpoints, and carryover

### Questions

**F1. Is the mode permadeath?**  
**F2. Are there checkpoints within a run, and what is persisted on quit/crash?**  
**F3. What carries to the next run: marks, unlocks, cosmetics, statistics, anything else?**  
**F4. Can a failed run be resumed or converted to a partial reward?

### Proposed lock

- Standard runs are **permadeath at the run level**: team defeat ends the run. A player death is not permanent account death; it is a run-state death.
- No mid-run gameplay checkpoints. The server may persist a resumable snapshot for 10 minutes after disconnect or process failure; resuming restores the exact deterministic state, not a favorable checkpoint. Voluntary quit ends the run and awards no victory bonus.
- Carryover: account skill-tree nodes, character/weapon/map unlocks, cosmetics, marks, lifetime statistics, and completed achievements. No credits, XP, items, weapon levels, pity counter, or run buffs carry over.
- Failed runs award marks for completed waves only, plus 50% of any boss-wave marks. A run that fails before wave 3 awards 0 marks. This is the only failure salvage.
- A run’s seed, mode, difficulty, player roster, and content version are immutable after start. Resume is rejected if the content/replay version differs.

---

## 9. Mode identity

### Questions

**M1. What is the target run duration and wave count?**  
**M2. What constitutes victory?**  
**M3. Which presets exist, and how do they differ without hidden modifiers?**  
**M4. Is Classic distinct from Endless, and what score/reward rules differ?

### Proposed lock

- **Classic:** 20 waves, target 30–40 minutes including shops, boss mutations on waves 5/10/15/20, and victory only after the wave-20 boss is defeated. If the wave timer expires while that boss is alive, normal spawning stops and the run enters boss overtime until the boss is defeated; then the victory screen is emitted. Classic is the onboarding/default mode.
- **Endless:** no final victory; waves continue until team defeat. Every 5th wave is an escalation checkpoint. Score, wave reached, and survival time are the win/leaderboard outputs. Shop and run-level systems continue, but Legendary offer probability is hard-capped at the normal table.
- **Challenge:** out of the core implementation scope until an authored challenge record supplies one fixed seed, one wave count (10 or 20), and a complete modifier list. It will use the same economy, loot, co-op, and failure rules; it may not introduce hidden rules or a separate balance economy.
- Difficulty presets:
  - **Recruit:** 0.85× enemy HP, 0.85× enemy damage, 0.9× threat budget; marks ×0.75.
  - **Mercenary:** 1.0× HP, 1.0× damage, 1.0× budget; marks ×1.0.
  - **Veteran:** 1.2× HP, 1.15× damage, 1.15× budget; marks ×1.25.
  - **Nightmare:** 1.5× HP, 1.35× damage, 1.35× budget, 10% shorter telegraphs; marks ×1.6.
- Difficulty scaling is applied after base enemy stats and before player mitigation; no hidden difficulty-only enemy roles. Player count scaling is separate and must be published with the wave budget.
- Victory grants the full victory mark bonus and unlock-check evaluation. Endless never grants a victory bonus, only completed-wave rewards.

---

## 10. Cross-system dependency and implementation order

1. **Contracts/state first:** credits, inventory, offers, RNG streams, pity, run-level XP, down/revive, pursuer state, and reward ledger must be serializable.
2. **Content tables second:** immutable weapon/enemy/item/skill definitions with version IDs; no magic numbers in systems.
3. **Wave/director third:** composition groups, caps, unlocks, pacing, boss mutation, pursuer schedule, and threat telemetry.
4. **Economy/shop fourth:** intermission boundary, offer generation, purchases, rerolls, salvage, and rejection events.
5. **Combat/build fifth:** weapon firing, modifiers, level/evolution, automatic/manual timing, and fixed stat-order evaluation.
6. **Co-op sixth:** down/revive, disconnect/resume, late join, personal reward ownership, and party-end rules.
7. **UI/network seventh:** expose authoritative offers, timers, ownership, telegraphs, and error reasons; never infer purchase success locally.
8. **Verification last:** deterministic replay, snapshot suffix equivalence, economy invariants, loot distribution, 1–4 player balance matrix, and interactive feel gates.

### Required event/error vocabulary

`shopOpened`, `shopClosed`, `offerGenerated`, `purchaseAccepted`, `purchaseRejected`, `rerollAccepted`, `rerollRejected`, `lootRolled`, `lootCollected`, `lootExpired`, `playerDowned`, `reviveStarted`, `reviveCompleted`, `reviveInterrupted`, `playerDied`, `pursuerSpawned`, `largeEnemyDowned`, `bossMutated`, `waveRewardGranted`, `runDefeated`, `runVictory`.

Every rejection includes a stable reason code: `not_intermission`, `insufficient_credits`, `offer_unavailable`, `inventory_full`, `already_owned`, `not_owner`, `out_of_range`, `downed`, `duplicate_command`, or `invalid_state`.

---

## 11. Sign-off checklist

Before implementation is declared unblocked, the owner must confirm or edit all proposed locks in sections 1–9, especially:

- [ ] Currency scope and carryover
- [ ] Exact wave/shop/re-roll income and pricing
- [ ] Role list, tier mechanics, caps, and unlock waves
- [ ] Loot ownership, rates, pity, and inventory limits
- [ ] Weapon roster and manual/automatic split
- [ ] Run build limits and duplicate/evolution behavior
- [ ] Skill-tree branches and meta power ceiling
- [ ] Large-enemy down/re-entry/pursuer schedule
- [ ] Revive, death, reconnect, and late-join rules
- [ ] Failure persistence and checkpoint policy
- [ ] Mode durations, victory, Endless, Classic, and difficulty multipliers
- [ ] Determinism/replay version bump for the new content contract

**Implementation rule:** if an unchecked item remains, code may implement only the state/serialization scaffolding and tests around it. It must not choose a gameplay behavior by guesswork.
