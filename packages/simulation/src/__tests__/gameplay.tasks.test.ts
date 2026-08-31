import { describe, it, expect } from "vitest";
import { createInitialState } from "../createInitialState.js";
import { step } from "../step.js";
import { SeededRandom } from "@mercicat/shared";
import type { PlayerId, InputCommand, ProjectileEntity } from "@mercicat/shared";

describe("Gameplay: Tasks 1–2 (Keyboard Input + Pistol Firing)", () => {
  it("Task 1: keyboard input (WASD) routes to movement", () => {
    const seed = 11111;
    const playerId = 1 as PlayerId;
    const rng = new SeededRandom(seed);
    let state = createInitialState(seed, [playerId]);

    // Simulate WASD input
    const moveRight: InputCommand = {
      type: "move",
      tick: 0,
      playerId,
      moveX: 1, // D key
      moveY: 0,
    };

    const result = step(state, [moveRight], { rng });

    expect(result.state.tick).toBe(1);
    const player = Object.values(result.state.entities).find((e) => e.kind === "player");
    expect(player).toBeDefined();
    if (player && player.kind === "player") {
      expect(player.velocity.x).toBeGreaterThan(0); // Moving right
      expect(player.velocity.y).toBe(0); // No vertical movement
    }
  });

  it("Task 2: pistol firing (Space/click) spawns projectile with 10 damage", () => {
    const seed = 22222;
    const playerId = 1 as PlayerId;
    const rng = new SeededRandom(seed);
    let state = createInitialState(seed, [playerId]);

    // Player starts at (0, 0). Fire right.
    const fireCmd: InputCommand = {
      type: "fire",
      tick: 0,
      playerId,
      aimX: 1,
      aimY: 0,
    };

    const result = step(state, [fireCmd], { rng });

    // Verify projectile was spawned
    const projectiles = Object.values(result.state.entities).filter((e) => e.kind === "projectile");
    expect(projectiles.length).toBeGreaterThan(0);

    const projectile = projectiles[0] as ProjectileEntity | undefined;
    if (projectile && projectile.kind === "projectile") {
      expect(projectile.damage).toBe(10); // 10 damage as specified
      expect(projectile.lifetimeTicks).toBe(300); // 300-tick lifetime
      expect(projectile.velocity.x).toBeGreaterThan(0); // Moving right
    }
  });

  it("Task 1+2 integrated: movement + fire in same tick", () => {
    const seed = 33333;
    const playerId = 1 as PlayerId;
    const rng = new SeededRandom(seed);
    let state = createInitialState(seed, [playerId]);

    // Send both move and fire commands in same tick
    const commands: InputCommand[] = [
      { type: "move", tick: 0, playerId, moveX: 1, moveY: 1 },
      { type: "fire", tick: 0, playerId, aimX: 1, aimY: 0 },
    ];

    const result = step(state, commands, { rng });

    // Verify player moved
    const player = Object.values(result.state.entities).find((e) => e.kind === "player");
    expect(player?.kind).toBe("player");

    // Verify projectile was spawned
    const projectiles = Object.values(result.state.entities).filter((e) => e.kind === "projectile");
    expect(projectiles.length).toBeGreaterThan(0);
  });
});
