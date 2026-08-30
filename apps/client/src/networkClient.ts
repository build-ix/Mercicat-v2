import { io, type Socket } from "socket.io-client";
import type { InputCommand, NetworkSnapshot, PlayerId } from "@mercicat/shared";
import { EVENTS } from "@mercicat/protocol";
export class NetworkClient { socket: Socket; playerId: PlayerId | null = null; constructor(url: string, readonly roomId: string, playerId?: PlayerId) { this.socket = io(`${url.replace(/\/$/, "")}/game`, { autoConnect: false, auth: { playerId } }); }
 connect(): void { this.socket.connect(); this.socket.once("connect", () => this.socket.emit(EVENTS.joinRoom, { roomId: this.roomId, playerId: (this.socket.auth as { playerId?: number }).playerId })); this.socket.on(EVENTS.joinedRoom, (m: { playerId: PlayerId }) => { this.playerId = m.playerId; }); }
 sendInput(command: Omit<InputCommand, "playerId" | "tick">, tick: number, sequence = tick): void { if (this.playerId !== null) this.socket.emit(EVENTS.input, { sequence, tick, playerId: this.playerId, command: { ...command, tick, playerId: this.playerId } }); }
 onSnapshot(handler: (snapshot: NetworkSnapshot) => void): this { this.socket.on(EVENTS.snapshot, handler); return this; } disconnect(): void { this.socket.disconnect(); }
}