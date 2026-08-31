import { describe, expect, it, afterEach } from "vitest";
import { io as connect, type Socket } from "socket.io-client";
import { EVENTS } from "@mercicat/protocol";
import { server, shutdown } from "./main.js";

const waitFor = <T>(socket: Socket, event: string, predicate: (value: T) => boolean = () => true): Promise<T> => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), 3000);
  socket.on(event, (value: T) => { if (predicate(value)) { clearTimeout(timer); resolve(value); } });
});

describe("authoritative two-client room", () => {
  let clients: Socket[] = [];
  afterEach(() => { for (const client of clients) client.disconnect(); clients = []; shutdown(); });

  it("broadcasts one authoritative state, verifies identity, and reconnects a slot", async () => {
    await new Promise<void>((resolve) => server.listen(0, () => resolve()));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("test server did not bind");
    const url = `http://localhost:${address.port}`;
    const a = connect(url); const b = connect(url); clients = [a, b];
    const joinedA = waitFor<{ playerId: number; reconnectToken: string }>(a, EVENTS.joinedRoom);
    const joinedB = waitFor<{ playerId: number; reconnectToken: string }>(b, EVENTS.joinedRoom);
    // Wait for initial state from both clients that contains both players (predicate waits for player 2 to exist)
    const initialAPromise = waitFor<{ state: { players: Record<number, number> }; tick: number }>(a, EVENTS.initialState, (m) => Object.keys(m.state.players).length === 2);
    const initialBPromise = waitFor<{ state: { players: Record<number, number> }; tick: number }>(b, EVENTS.initialState, (m) => Object.keys(m.state.players).length === 2);
    a.emit(EVENTS.joinRoom, { roomId: "integration" }); b.emit(EVENTS.joinRoom, { roomId: "integration" });
    const [slotA, slotB] = await Promise.all([joinedA, joinedB]);
    expect(slotA.playerId).toBe(1); expect(slotB.playerId).toBe(2);
    const [initialA, initialB] = await Promise.all([initialAPromise, initialBPromise]);
    expect(Object.keys(initialA.state.players)).toEqual(["1", "2"]);
    expect(Object.keys(initialB.state.players)).toEqual(["1", "2"]);
    const nextA = waitFor<{ state: { entities: Record<number, { position: { x: number; y: number } }> }; tick: number }>(a, EVENTS.snapshot, (s) => s.tick > initialA.tick);
    const nextB = waitFor<{ state: { entities: Record<number, { position: { x: number; y: number } }> }; tick: number }>(b, EVENTS.snapshot, (s) => s.tick > initialB.tick);
    a.emit(EVENTS.input, { sequence: 0, tick: initialA.tick, command: { type: "move", tick: initialA.tick, playerId: 999, direction: { x: 1, y: 0 } } });
    // The server must overwrite the command identity from the authenticated slot.
    a.emit(EVENTS.input, { sequence: 1, tick: initialA.tick, command: { type: "move", tick: initialA.tick, playerId: 999, direction: { x: 1, y: 0 } } });
    const [snapshotA, snapshotB] = await Promise.all([nextA, nextB]);
    expect(snapshotA.tick).toBe(snapshotB.tick);
    expect(snapshotA.state.entities[2].position.x).toBe(snapshotB.state.entities[2].position.x);
    expect((snapshotA as { acknowledgedThrough?: number }).acknowledgedThrough).toBeGreaterThanOrEqual(-1);
    b.disconnect();
    const roomEvent = await waitFor<{ event: { type: string; playerId: number } }>(a, EVENTS.room, (m) => m.event.type === "disconnected");
    expect(roomEvent.event.playerId).toBe(2);
    const c = connect(url); clients.push(c);
    const rejoined = waitFor<{ playerId: number }>(c, EVENTS.joinedRoom);
    c.emit(EVENTS.joinRoom, { roomId: "integration", reconnectToken: slotB.reconnectToken });
    expect((await rejoined).playerId).toBe(2);
  });
});