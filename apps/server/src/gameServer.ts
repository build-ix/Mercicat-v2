import { type Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { EVENTS, PROTOCOL_VERSION, validatePlayerInput } from "@mercicat/protocol";
import { GameRoom } from "./gameRoom";

export function createGameServer(httpServer?: HttpServer) {
  const io = new Server(httpServer, { cors: { origin: "*" } });
  const game = io.of("/game");
  const rooms = new Map<string, GameRoom>();
  const sockets = new Map<string, { room: GameRoom; playerId: number }>();
  const loops = new Map<string, ReturnType<typeof setInterval>>();
  game.on("connection", (socket) => {
    socket.emit(EVENTS.hello, { protocol: PROTOCOL_VERSION, serverTick: 0, tickRate: 30 });
    socket.on(EVENTS.joinRoom, (data: { roomId?: string; playerId?: number }) => {
      const roomId = data?.roomId ?? "default"; const playerId = data?.playerId ?? 0;
      if (!Number.isInteger(playerId) || playerId < 1) { socket.emit(EVENTS.error, { code: "AUTH_REQUIRED" }); return; }
      const room = rooms.get(roomId) ?? new GameRoom(roomId, `match:${roomId}`); rooms.set(roomId, room);
      if (!room.join(playerId, socket.id)) { socket.emit(EVENTS.error, { code: "ROOM_FULL" }); return; }
      sockets.set(socket.id, { room, playerId }); socket.join(roomId);
      socket.emit(EVENTS.joinedRoom, { roomId, playerId, slot: playerId - 1 });
      socket.emit(EVENTS.initialState, { state: room.state, stateHash: room.snapshot().stateHash });
      game.to(roomId).emit("playerJoined", { playerId, initialState: room.state });
      if (!loops.has(roomId)) loops.set(roomId, setInterval(() => { const result = room.tick(); game.to(roomId).emit(EVENTS.snapshot, result.snapshot); if (result.gameOver) game.to(roomId).emit("gameOver", { victor: null }); }, 1000 / 30));
    });
    socket.on(EVENTS.ready, (d: { ready?: boolean }) => { const s = sockets.get(socket.id); if (s) s.room.ready(s.playerId, d?.ready !== false); });
    socket.on(EVENTS.input, (d: unknown) => { const s = sockets.get(socket.id); if (!s) return; try { validatePlayerInput(d, s.playerId, s.room.state.tick); if (!s.room.receiveInput(s.playerId, d)) throw new Error("INVALID_INPUT"); } catch (e) { socket.emit(EVENTS.error, { code: e instanceof Error ? e.message : "INVALID_INPUT" }); } });
    socket.on("disconnect", () => { const s = sockets.get(socket.id); if (s) { s.room.leave(s.playerId); game.to(s.room.id).emit("playerLeft", { playerId: s.playerId }); } sockets.delete(socket.id); });
  });
  return { io, namespace: game, rooms, close: async () => { for (const timer of loops.values()) clearInterval(timer); await io.close(); } };
}
