import { io, type Socket } from "socket.io-client";
import type { InputCommand, NetworkSnapshot, PlayerId } from "@mercicat/shared";
import { EVENTS, PROTOCOL_VERSION } from "@mercicat/protocol";
import { InputHistory } from "./prediction";
import { SnapshotBuffer } from "./snapshotBuffer";

export interface NetworkSessionOptions { url: string; roomId: string; onSnapshot?: (snapshot: NetworkSnapshot) => void; }
export class NetworkSession {
  socket: Socket | null = null; playerId: PlayerId | null = null; serverTick = 0; readonly history = new InputHistory(); readonly snapshots = new SnapshotBuffer();
  constructor(private readonly options: NetworkSessionOptions) {}
  connect(): void {
    this.socket = io(this.options.url, { autoConnect: true });
    this.socket.on(EVENTS.hello, (hello: { protocol: number; serverTick: number }) => { if (hello.protocol !== PROTOCOL_VERSION) throw new Error("Protocol mismatch"); this.serverTick = hello.serverTick; this.socket?.emit(EVENTS.joinRoom, { roomId: this.options.roomId }); });
    this.socket.on(EVENTS.joinedRoom, (message: { playerId: PlayerId }) => { this.playerId = message.playerId; this.socket?.emit(EVENTS.ready, { ready: true }); });
    this.socket.on(EVENTS.initialState, (snapshot: NetworkSnapshot) => { if (this.snapshots.push(snapshot)) this.options.onSnapshot?.(snapshot); });
    this.socket.on(EVENTS.snapshot, (snapshot: NetworkSnapshot) => { if (this.snapshots.push(snapshot)) this.options.onSnapshot?.(snapshot); });
  }
  send(command: Omit<InputCommand, "playerId" | "tick">, tick: number): void { if (!this.socket || this.playerId === null) return; const full = { ...command, playerId: this.playerId, tick } as InputCommand; const record = this.history.record(tick, full); this.socket.emit(EVENTS.input, record); }
  disconnect(): void { this.socket?.disconnect(); this.socket = null; }
}
