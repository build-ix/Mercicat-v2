import { describe, expect, it } from "vitest";
import { createInitialState, spawnEnemies } from "@mercicat/simulation";
import { SeededRandom } from "@mercicat/shared";
import { gameStateToRender, validateRenderContext } from "./renderAdapter";
describe("snapshot render adapter",()=>{it("extracts entities and HUD",()=>{const s=createInitialState(1,[1]);spawnEnemies(s,new SeededRandom(1));const r=gameStateToRender(s,1);expect(r.enemies).toHaveLength(3);expect(r.localPlayer?.type).toBe("player");expect(r.hud.wave).toBe(1);});it("handles missing local player",()=>{const s=createInitialState(1,[]);expect(gameStateToRender(s,1).localPlayer).toBeNull();});it("rejects incomplete render data",()=>{const s=gameStateToRender(createInitialState(1,[]));s.hud.wave=NaN;expect(()=>validateRenderContext(s)).toThrow();});});
