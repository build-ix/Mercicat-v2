import { createServer } from "node:http";
import { Server } from "socket.io";
import { EVENTS, PROTOCOL_VERSION, validateWireInput } from "@mercicat/protocol";
import { TICK_RATE } from "@mercicat/shared";
import { RoomManager } from "./roomManager.js";
import { FixedTickLoop } from "./tickLoop.js";
import { serializeCanonicalSnapshot } from "./snapshot.js";

export const rooms = new RoomManager();
export const io = new Server({ cors: { origin: "*" } });
const loops = new Map<string, FixedTickLoop>();
const socketRooms = new Map<string, string>();

io.on("connection", (socket) => {
  socket.emit(EVENTS.hello, { protocol: PROTOCOL_VERSION, serverTick: 0, tickRate: TICK_RATE });
  socket.on(EVENTS.joinRoom, (data: { roomId?: string; reconnectToken?: string }) => {
    const roomId = data?.roomId || "default"; const room = rooms.getOrCreate(roomId, `match:${roomId}`); const slot = room.join(socket.id, data?.reconnectToken);
    if (!slot) { socket.emit(EVENTS.error, { code: "ROOM_FULL" }); return; }
    socketRooms.set(socket.id, roomId); socket.join(roomId); socket.emit(EVENTS.joinedRoom, { roomId, playerId: slot.playerId, slot: slot.playerId - 1, reconnectToken: slot.reconnectToken });
    // Broadcast updated initial state to all clients in the room (includes new player and existing players)
    io.to(roomId).emit(EVENTS.initialState, serializeCanonicalSnapshot(room.state, room.rng, true));
    if (!loops.has(roomId)) {
      const loop = new FixedTickLoop(room, {
        onSnapshot: (r, snapshot) => {
          // State is shared, but input acknowledgements are per socket.
          // Resolve the socket from the server-owned slot, never client data.
          for (const slot of r.slots.values()) {
            if (!slot.connected || !slot.socketId) continue;
            const acknowledgedThrough = r.inputs.get(slot.playerId)?.lastAcceptedSequence ?? -1;
            io.sockets.sockets.get(slot.socketId)?.emit(EVENTS.snapshot, { ...snapshot, acknowledgedThrough });
          }
        },
        onRoomEvent: (r, event) => io.to(r.id).emit(EVENTS.room, { roomId: r.id, event })
      });
      loops.set(roomId, loop); loop.start();
    }
  });
  socket.on(EVENTS.ready, (data: { ready?: boolean }) => { const room = rooms.get(socketRooms.get(socket.id) ?? ""); const slot = room && [...room.slots.values()].find((s) => s.socketId === socket.id); if (room && slot) room.ready(slot.playerId, data?.ready !== false); });
  socket.on(EVENTS.input, (data: unknown) => { const room = rooms.get(socketRooms.get(socket.id) ?? ""); const slot = room && [...room.slots.values()].find((s) => s.socketId === socket.id); if (!room || !slot) return; try { const wire = validateWireInput(data); room.inputs.get(slot.playerId)?.enqueue({ ...wire, command: { ...wire.command, playerId: slot.playerId } }, room.state.tick); } catch { socket.emit(EVENTS.error, { code: "INVALID_INPUT" }); } });
  socket.on("disconnect", () => { const id = socketRooms.get(socket.id); if (id) rooms.get(id)?.disconnect(socket.id); socketRooms.delete(socket.id); });
});

export const server = createServer(); io.attach(server, { cors: { origin: "*" } });
export function shutdown(): void { for (const loop of loops.values()) loop.stop(); loops.clear(); io.close(); }
if (process.env.NODE_ENV !== "test") server.listen(Number(process.env.PORT ?? 3001), () => console.log("Mercicat server running"));
