import { createServer } from "http";
import { Server } from "socket.io";

const PORT = 3001;
const io = new Server({
  cors: { origin: "*" },
});

interface GameState {
  tick: number;
  players: Map<string, any>;
}

const gameState: GameState = {
  tick: 0,
  players: new Map(),
};

io.on("connection", (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on("join", (playerData) => {
    gameState.players.set(socket.id, {
      id: socket.id,
      character: playerData.character || "default",
      position: { x: 0, y: 0 },
      health: 100,
    });
    socket.emit("joined", { playerId: socket.id });
    io.emit("playerJoined", { playerId: socket.id });
  });

  socket.on("disconnect", () => {
    gameState.players.delete(socket.id);
    io.emit("playerLeft", { playerId: socket.id });
    console.log(`Player disconnected: ${socket.id}`);
  });
});

const server = createServer();
io.attach(server, {
  cors: { origin: "*" },
});

server.listen(PORT, () => {
  console.log(`Mercicat server running on port ${PORT}`);
});

// Game loop: 30 Hz
setInterval(() => {
  gameState.tick++;
  io.emit("snapshot", {
    tick: gameState.tick,
    players: Array.from(gameState.players.values()),
  });
}, 1000 / 30);
