import { createInitialState } from "@mercicat/simulation";
import { SeededRandom, MAX_PLAYERS, PlayerSlot, PlayerId, RoomLifecycleEvent } from "@mercicat/shared";
import { PlayerInputBuffer } from "./inputBuffer.js";

export class Room {
  readonly slots = new Map<PlayerId, PlayerSlot>();
  readonly inputs = new Map<PlayerId, PlayerInputBuffer>();
  state;
  readonly rng: SeededRandom;
  readonly lifecycleEvents: RoomLifecycleEvent[] = [];
  constructor(readonly id: string, seed: number | string = 1) { this.rng = new SeededRandom(seed); this.state = createInitialState(seed, []); }
  join(socketId: string): PlayerSlot | null {
    const existing = [...this.slots.values()].find((s) => s.socketId === socketId);
    if (existing) return existing;
    const disconnected = [...this.slots.values()].find((s) => !s.connected);
    if (!disconnected && this.connectedCount() >= MAX_PLAYERS) return null;
    if (disconnected) {
      disconnected.connected = true; disconnected.socketId = socketId; disconnected.ready = false;
      this.lifecycleEvents.push({ type: "reconnected", tick: this.state.tick, playerId: disconnected.playerId });
      return disconnected;
    }
    const playerId = this.slots.size + 1; const entityId = this.state.nextEntityId++;
    const slot: PlayerSlot = { playerId, entityId, connected: true, ready: false, socketId };
    this.slots.set(playerId, slot); this.inputs.set(playerId, new PlayerInputBuffer(playerId));
    this.state.players[playerId] = entityId;
    this.state.entities[entityId] = { id: entityId, kind: "player", lifecycle: "active", playerId, position: { x: playerId * 30, y: 0 }, velocity: { x: 0, y: 0 }, radius: 12, health: 100, maxHealth: 100, spawnTick: this.state.tick, despawnTick: null, fireCooldownTicks: 0 };
    this.lifecycleEvents.push({ type: "joined", tick: this.state.tick, playerId });
    return slot;
  }
  ready(playerId: PlayerId, value = true): boolean { const slot = this.slots.get(playerId); if (!slot || !slot.connected) return false; slot.ready = value; return true; }
  disconnect(socketId: string): void { const slot = [...this.slots.values()].find((s) => s.socketId === socketId); if (slot) { slot.connected = false; slot.socketId = null; slot.ready = false; this.lifecycleEvents.push({ type: "disconnected", tick: this.state.tick, playerId: slot.playerId }); } }
  drainLifecycleEvents(): RoomLifecycleEvent[] { return this.lifecycleEvents.splice(0); }
  connectedCount(): number { return [...this.slots.values()].filter((s) => s.connected).length; }
  allReady(): boolean { const connected = [...this.slots.values()].filter((s) => s.connected); return connected.length > 0 && connected.every((s) => s.ready); }
}
export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  getOrCreate(id: string, seed: number | string = 1): Room { let room = this.rooms.get(id); if (!room) { room = new Room(id, seed); this.rooms.set(id, room); } return room; }
  get(id: string): Room | undefined { return this.rooms.get(id); }
  remove(id: string): void { this.rooms.delete(id); }
}
