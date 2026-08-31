import { io, type Socket } from "socket.io-client";
import type { GameState, InputCommand, NetworkSnapshot, PlayerId } from "@mercicat/shared";
import { EVENTS, PROTOCOL_VERSION, deserializeSnapshot } from "@mercicat/protocol";
import { InputHistory } from "./prediction";
import { SnapshotBuffer } from "./snapshotBuffer";

export interface NetworkSessionOptions { url: string; roomId: string; onSnapshot?: (snapshot: NetworkSnapshot) => void; onStatus?: (status: NetworkSessionStatus) => void; }
export type NetworkSessionStatus = "disconnected" | "connecting" | "connected" | "joined";
export class NetworkSession {
  socket: Socket | null = null; playerId: PlayerId | null = null; serverTick = 0; status: NetworkSessionStatus = "disconnected"; private current: GameState | null = null; private reconnectToken: string | null = null;
  readonly history = new InputHistory(); readonly snapshots = new SnapshotBuffer();
  constructor(private readonly options: NetworkSessionOptions) {}
  get state(): GameState | null { return this.current; }
  private setStatus(status: NetworkSessionStatus): void { this.status = status; this.options.onStatus?.(status); }
  connect(): void {
    if (this.socket) return;
    this.setStatus("connecting"); this.socket = io(this.options.url, { autoConnect: true, reconnection: true });
    this.socket.on("connect", () => this.setStatus("connected"));
    this.socket.on(EVENTS.hello, (hello: { protocol: number; serverTick: number }) => {
      if (hello.protocol !== PROTOCOL_VERSION) { this.socket?.disconnect(); this.setStatus("disconnected"); return; }
      this.serverTick = hello.serverTick; this.socket?.emit(EVENTS.joinRoom, { roomId: this.options.roomId, ...(this.reconnectToken ? { reconnectToken: this.reconnectToken } : {}) });
    });
    this.socket.on(EVENTS.joinedRoom, (message: { playerId: PlayerId; reconnectToken: string }) => { this.playerId = message.playerId; this.reconnectToken = message.reconnectToken; this.setStatus("joined"); this.socket?.emit(EVENTS.ready, { ready: true }); });
    const accept = (value: unknown): void => { try { const snapshot = deserializeSnapshot(value); if (this.snapshots.push(snapshot)) { this.current = snapshot.state; this.options.onSnapshot?.(snapshot); } } catch { /* malformed network data is discarded */ } };
    this.socket.on(EVENTS.initialState, accept); this.socket.on(EVENTS.snapshot, accept);
    this.socket.on("disconnect", () => { this.playerId = null; this.setStatus("disconnected"); });
  }
  send(command: Omit<InputCommand, "playerId" | "tick">, tick: number): void { if (!this.socket || this.playerId === null) return; const full = { ...command, playerId: this.playerId, tick } as InputCommand; const record = this.history.record(tick, full); this.socket.emit(EVENTS.input, record); }
  disconnect(): void { this.socket?.disconnect(); this.socket = null; this.playerId = null; this.setStatus("disconnected"); }
}
