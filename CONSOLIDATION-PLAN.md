# Mercicat-v2 Code Consolidation & Client Rewrite Plan

**Goal:** Remove duplicate code, consolidate to single architecture, rewrite client for local-first gameplay.

**Date:** Aug 30, 2026
**Target completion:** Sept 14, 2026 (1-player playable)

## Phase 1: Code Cleanup (Option 2)

### Server cleanup
- **DELETE:** `apps/server/src/gameServer.ts` (duplicate)
- **DELETE:** `apps/server/src/gameRoom.ts` (duplicate)
- **KEEP:** `apps/server/src/main.ts` (canonical server entry)
- **KEEP:** `apps/server/src/roomManager.ts` (active room management)
- **KEEP:** `apps/server/src/tickLoop.ts` (active tick loop)
- **KEEP:** `apps/server/src/inputBuffer.ts` (active input handling)
- **KEEP:** `apps/server/src/snapshot.ts` (active snapshot generation)

### Client cleanup
- **DELETE:** `apps/client/src/gameOverScene.ts` (stub, uninstantiated)
- **DELETE:** `apps/client/src/lobbyScene.ts` (stub, uninstantiated)
- **DELETE:** `apps/client/src/networkClient.ts` (obsolete network wrapper)
- **REWRITE:** `apps/client/src/main.ts` (→ local game loop first)
- **KEEP:** `apps/client/src/networkSession.ts` (compatible with live server, used later)
- **KEEP:** `apps/client/src/prediction.ts` (client-side prediction, used in Phase 2)
- **KEEP:** `apps/client/src/snapshotBuffer.ts` (snapshot buffering, used in Phase 2)

### Protocol cleanup
- **DELETE:** `packages/protocol/gameMessages.ts` (legacy, incompatible)
- **KEEP:** `packages/protocol/networkProtocol.ts` (canonical protocol used by live server)

### Content cleanup
- **KEEP:** `packages/content/` (loaded but unused; integrate later in Phase 3)

## Phase 2: Client Rewrite (Option 1)

### Step 1: Local game loop (no server)
- Import `@mercicat/simulation/GameState`, `step()`, `SeededRNG`
- Create local `GameState` instance with deterministic RNG
- Create `requestAnimationFrame` loop calling `step()` each frame
- Wire keyboard input (WASD → move, mouse → fire) via tick-boundary sampling
- **Gate:** Game state advances 30 Hz, input reads cleanly, no errors

### Step 2: Renderer integration
- Import `@mercicat/client/GameRenderer`, `gameStateToRender()`
- Convert `GameState` to renderable entities
- Render player, enemies, projectiles, UI
- **Gate:** Player mesh appears on screen, enemies spawn, projectiles visible

### Step 3: Input handler
- WASD → `{ x, y }` move vector (sampled at tick boundary)
- Mouse position → world coords → fire direction
- Space/click → fire command
- **Gate:** Player moves with WASD, fires toward mouse, no input lag

### Step 4: Unit scale fixes
- Verify player/enemy velocity units align
- Fix projectile speed to match world scale
- Adjust collision radii
- **Gate:** Movement feels responsive, projectiles travel at realistic speed

### Step 5: Enemy AI
- Implement pursuit logic (move toward player)
- Add firing behavior (shoot at player)
- **Gate:** Enemies move toward player, attempt to damage

### Step 6: Defeat rule
- Replace infinite respawn with single life (or 3 lives)
- End game on health ≤ 0
- **Gate:** Game resets/ends when player dies

### Step 7: Score system
- Track kills, waves cleared
- Update UI each frame
- **Gate:** Score increments on enemy death

### Step 8: HUD + Victory/Defeat UI
- Display health, score, wave counter
- Victory screen after 5 waves cleared
- Defeat screen on death
- Restart button
- **Gate:** Full UI is visible and functional

### Step 9: Asset integration
- Load `tabby-protagonist.glb` (once Higgsfield delivers real model)
- Wire animations (Idle, Walk, Run, Fire, Hurt, Death)
- **Gate:** Character animations play smoothly

## Commit Strategy

- Commit after each Phase 1 deletion (one commit per deleted file, message: "Delete dead: filename.ts")
- Commit Phase 2 steps incrementally (after each gate passes)
- Never commit broken state
- Keep main branch always buildable

## Testing Gates

| Step | Test | Pass Criteria |
|------|------|---------------|
| 1 | `pnpm build && pnpm test` | TypeScript compiles, tests pass |
| 2 | Manual: Load app, verify ground renders | Gray arena appears, no errors |
| 3 | Manual: Press WASD, move mouse | Player mesh moves, tracks mouse |
| 4 | Manual: Click to fire | Projectile appears, travels, collides |
| 5 | Manual: Kill enemy in wave 1 | Enemy dies, new enemies spawn |
| 6 | Manual: Take damage, die | Game ends, restart button appears |
| 7 | Manual: Complete 5 waves | Score increments, victory screen |
| 8 | Full 1-player demo | All above + UI visible + responsive |
| 9 | Asset load test | GLB loads, animations play (when ready) |

## Success Criteria (Sept 14)

- [ ] Playable 1-player demo (local, no server)
- [ ] Player moves, fires, takes damage, dies
- [ ] Enemies spawn, move, attempt to kill player
- [ ] Waves progress (5 waves to victory)
- [ ] Score tracking and HUD
- [ ] Victory/Defeat/Restart UI
- [ ] No duplicate code in repo
- [ ] All tests passing
- [ ] Build under 3s

---

## Appendix: Files to Delete (with verification)

Before deletion, verify no imports reference these files:

```bash
# Check for imports
grep -r "gameServer" /home/alfr/mercicat-rebuild/apps/
grep -r "gameRoom" /home/alfr/mercicat-rebuild/apps/
grep -r "gameMessages" /home/alfr/mercicat-rebuild/packages/
```

If grep returns nothing (no matches), safe to delete.
