// Simulation entry point — pure game logic with no dependencies on renderer or network

export interface Vec2 {
  x: number;
  y: number;
}

export interface Player {
  id: string;
  position: Vec2;
  velocity: Vec2;
  health: number;
  maxHealth: number;
  character: string; // character ID
}

export interface World {
  players: Map<string, Player>;
  tick: number;
}

export function createWorld(): World {
  return {
    players: new Map(),
    tick: 0,
  };
}

export function advanceWorld(world: World, inputs: Map<string, any>, dt: number): void {
  world.tick++;
  // Simulation logic goes here
}
