# Mercicat-v2 Playable Vertical Slice - Sept 14, 2026 Target

## Milestone: 1-Player Local Game Demo

**Start date:** August 30, 2026 (Evening)
**Target date:** September 14, 2026
**Status:** IN PROGRESS (Steps 2-8 being implemented)

## Completed Work

### Option 2: Code Consolidation (7 commits)
- ✅ Deleted gameServer.ts, gameRoom.ts (duplicate server)
- ✅ Deleted gameOverScene.ts, lobbyScene.ts (stubs)
- ✅ Deleted networkClient.ts (obsolete)
- ✅ Deleted gameMessages.ts (legacy protocol)
- ✅ Repo consolidated to single canonical architecture

### Option 1: Client Rewrite (3 commits)
- ✅ Step 1: Local game loop (createInitialState + step + requestAnimationFrame)
- ✅ Input sampling (WASD + mouse aiming, space to fire)
- ✅ Fixed 30 Hz tick rate with frame accumulation
- ✅ Basic Three.js rendering (circles for entities)
- ✅ Camera follows player

### Build & Package Fixes (1 commit)
- ✅ Added @mercicat/client to apps/client dependencies
- ✅ Added Vite alias for package resolution
- ✅ Build passes: 135 kB app + 500 kB Three.js
- ✅ Tests pass: 18 tests

### Architecture Decision (Fable Review)
- ✅ Preserve @mercicat/simulation (sound, tested, deterministic)
- ✅ Preserve @mercicat/shared (correct contracts)
- ✅ Preserve @mercicat/protocol (needs hardening, not rewrite)
- ✅ P0 blockers identified (RNG state, join events, socket verification)

## In Progress (Subagent)

### Steps 2-8 (Expected completion: ~45 min)
- [ ] Step 2: Unit scale fixes (velocity, collision radius)
- [ ] Step 3: Enemy AI (pursuit + firing)
- [ ] Step 4: Defeat rule (1 life, game-over gate)
- [ ] Step 5: Score system (increment on kills)
- [ ] Step 6: HUD (health, score, wave, phase)
- [ ] Step 7: Victory/Defeat/Restart UI
- [ ] Step 8: Window resize handling

## Success Criteria

### Code Quality
- [ ] Build: `pnpm build` passes
- [ ] Tests: `pnpm test` passes (18/18)
- [ ] TypeScript: `pnpm typecheck` passes
- [ ] No console errors

### Gameplay (Manual Testing)
- [ ] Player renders and moves with WASD
- [ ] Player fires projectiles toward mouse
- [ ] Enemies spawn and move toward player
- [ ] Enemies attempt to fire at player
- [ ] Player takes damage and dies
- [ ] Game ends on player death (no infinite respawn)
- [ ] Score increments on enemy kill
- [ ] HUD displays health, score, wave, phase
- [ ] Victory screen after 5 waves
- [ ] Restart button works
- [ ] Window resize doesn't break gameplay

### Architecture
- [ ] No network requests (fully local)
- [ ] No Math.random() (deterministic RNG only)
- [ ] Uses canonical @mercicat/* packages
- [ ] All P0 blockers identified (defer to Phase 2)

## Timeline

| Phase | Task | Duration | Target Date | Status |
|-------|------|----------|-------------|--------|
| 1 | Code cleanup + Client rewrite | 1 day | Aug 31 | ✅ Complete |
| 2 | Steps 2-8 (AI, UI, mechanics) | 1 day | Sept 1 | 🔄 In Progress |
| 3 | Testing & bug fixes | 2 days | Sept 3 | ⏳ Pending |
| 4 | P0 multiplayer blockers | 2 days | Sept 5 | ⏳ Pending |
| 5 | Networking foundation | 2 weeks | Sept 19 | ⏳ Pending |
| 6 | Buffer / contingency | 5 days | Sept 24 | ⏳ Pending |

**Sept 14 Checkpoint:** 1-player playable, no network, ready for Phase 4

## Commits This Session

```
55af30c Fix: add Vite alias for @mercicat/client package resolution
62c430a Stride 1 (Option 1): Rewrite client for local-only gameplay
3eeccf3 Remove gameMessages export from protocol index
37bdf94 Delete dead: gameMessages.ts (incompatible legacy protocol)
1c63287 Delete dead: networkClient.ts (obsolete network wrapper)
9564553 Delete dead: lobbyScene.ts (uninstantiated stub)
ae1d391 Delete dead: gameOverScene.ts (uninstantiated stub)
7604884 Delete dead: gameRoom.ts (duplicate room management)
9a6fa07 Delete dead: gameServer.ts (duplicate server implementation)
```

(+ 8 more expected from Steps 2-8)

## Known P0 Blockers (for Phase 2)

Before multiplayer:
1. Include RNG state in initial state snapshot
2. Make room join/leave tick-stamped events
3. Verify socket ID overrides wire playerId
4. Add strict Zod command schemas
5. Implement real snapshot validation
6. Define join/reconnect checkpoint contract

## Next Session

- [ ] Integrate Steps 2-8 commits
- [ ] Run manual smoke test
- [ ] Fix any post-implementation bugs
- [ ] Commit comprehensive final state
- [ ] Begin Phase 3 (testing & bug fixes)
- [ ] Prepare for multiplayer foundation work

---

**Milestone Status:** On track for Sept 14 playable demo.
