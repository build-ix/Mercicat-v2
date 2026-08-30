import { createServer } from "node:http";
import { Server } from "socket.io";
import { hashGameState } from "@mercicat/simulation";
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
  socket.on(EVENTS.joinRoom, (data: { roomId?: string }) => {
    const roomId = data?.roomId || "default"; const room = rooms.getOrCreate(roomId, `match:${roomId}`); const slot = room.join(socket.id);
    if (!slot) { socket.emit(EVENTS.error, { code: "ROOM_FULL" }); return; }
    socketRooms.set(socket.id, roomId); socket.join(roomId); socket.emit(EVENTS.joinedRoom, { roomId, playerId: slot.playerId, slot: slot.playerId - 1 });
    socket.emit(EVENTS.initialState, { state: room.state, stateHash: hashGameState(room.state) });
    if (!loops.has(roomId)) { const loop = new FixedTickLoop(room, { onSnapshot: (r, snapshot) => io.to(r.id).emit(EVENTS.snapshot, snapshot) }); loops.set(roomId, loop); loop.start(); }
  });
  socket.on(EVENTS.ready, (data: { ready?: boolean }) => { const room = rooms.get(socketRooms.get(socket.id) ?? ""); const slot = room && [...room.slots.values()].find((s) => s.socketId === socket.id); if (room && slot) room.ready(slot.playerId, data?.ready !== false); });
  socket.on(EVENTS.input, (data: unknown) => { const room = rooms.get(socketRooms.get(socket.id) ?? ""); const slot = room && [...room.slots.values()].find((s) => s.socketId === socket.id); if (!room || !slot) return; try { room.inputs.get(slot.playerId)?.enqueue(data, room.state.tick); } catch { socket.emit(EVENTS.error, { code: "INVALID_INPUT" }); } });
  socket.on("disconnect", () => { const id = socketRooms.get(socket.id); if (id) rooms.get(id)?.disconnect(socket.id); socketRooms.delete(socket.id); });
});

const server = createServer(); io.attach(server, { cors: { origin: "*" } });
if (process.env.NODE_ENV !== "test") server.listen(Number(process.env.PORT ?? 3001), () => console.log("Mercicat server running"));
