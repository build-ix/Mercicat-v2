import type { GameState, InputCommand, PlayerEntity, SimulationEvent } from "@mercicat/shared";

export const PLAYER_SPEED_PER_TICK = 5;

/** Pure command ordering/validation and movement application. */
export function applyCommands(state: GameState, commands: readonly InputCommand[], events: SimulationEvent[], onFire: (state: GameState, player: PlayerEntity, direction: { x: number; y: number }, events: SimulationEvent[]) => void): void {
  for (const entityId of Object.values(state.players)) {
    const player = state.entities[entityId];
    const typedPlayer = player as PlayerEntity;
    if (player?.kind === "player" && player.lifecycle === "active" && !typedPlayer.downed) player.velocity = { x: 0, y: 0 };
  }
  for (const command of commands) {
    const id = state.players[command.playerId];
    const player = state.entities[id];
    if (!player || player.lifecycle !== "active" || player.kind !== "player" || (player as PlayerEntity).downed || player.health <= 0) continue;
    const typedPlayer = player as PlayerEntity;
    const direction = commandDirection(command);
    if (command.type === "move") typedPlayer.velocity = { x: clamp(direction.x, -1, 1) * PLAYER_SPEED_PER_TICK, y: clamp(direction.y, -1, 1) * PLAYER_SPEED_PER_TICK };
    if (command.type === "fire") onFire(state, typedPlayer, direction, events);
  }
}

export function compareCommands(a: InputCommand, b: InputCommand): number { return a.playerId - b.playerId || a.type.localeCompare(b.type); }
export function commandDirection(command: InputCommand): { x: number; y: number } { return command.direction ?? { x: command.aimX ?? command.moveX ?? 0, y: command.aimY ?? command.moveY ?? 0 }; }
export function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
