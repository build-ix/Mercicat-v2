import { createServer } from "http";
import { Server } from "socket.io";
import {
  createGameWorld,
  stepSimulation,
  GameWorld,
  PlayerInput,
  PlayerState,
} from "@mercicat/simulation";
import { createDefaultRegistry } from "@mercicat/content";
import { brandPlayerId } from "@mercicat/shared";

const PORT = 3001;
const TICK_RATE = 30;
const TICK_DURATION = 1 / TICK_RATE;

const io = new Server({
  cors: { origin: "*" },
});

interface Match {
  id: string;
  world: GameWorld;
  players: Map<string, string>; // socket ID -> player ID
  startTime: number;
}

const matches: Map<string, Match> = new Map();
const playerSockets: Map<string, string> = new Map(); // player ID -> socket ID
const socketPlayers: Map<string, string> = new Map(); // socket ID -> player ID
const content = createDefaultRegistry();

io.on("connection", (socket) => {
  console.log(`[CONNECT] ${socket.id}`);

  socket.on("join_match", (data) => {
    const matchId = data.matchId || "default";
    let match = matches.get(matchId);

    if (!match) {
      console.log(`[MATCH] Creating new match: ${matchId}`);
      match = {
        id: matchId,
        world: createGameWorld(Math.floor(Math.random() * 1000000)),
        players: new Map(),
        startTime: Date.now(),
      };
      matches.set(matchId, match);

      // Start server loop for this match
      startMatchLoop(match);
    }

    const playerId = `player_${socket.id.slice(0, 8)}`;
    const brandedPlayerId = brandPlayerId(playerId);

    match.players.set(socket.id, playerId);
    playerSockets.set(playerId, socket.id);
    socketPlayers.set(socket.id, playerId);

    // Spawn player in world
    match.world.players.set(brandedPlayerId, {
      id: brandedPlayerId,
      position: { x: 960, y: 640 },
      velocity: { x: 0, y: 0 },
      health: 100,
      maxHealth: 100,
      character: "player_cat",
      attackCooldown: 0,
      lastAttackDirection: { x: 1, y: 0 },
      alive: true,
    });

    socket.join(matchId);
    socket.emit("joined", { playerId, matchId });
    io.to(matchId).emit("player_joined", { playerId, count: match.players.size });

    console.log(`[JOIN] ${playerId} joined match ${matchId}`);
  });

  socket.on("input", (data) => {
    const playerId = socketPlayers.get(socket.id);
    if (!playerId) return;

    const matchId = Array.from(matches.values()).find((m) =>
      m.players.has(socket.id)
    )?.id;
    if (!matchId) return;

    const match = matches.get(matchId);
    if (!match) return;

    // Store input for next tick
    if (!match.world.players) match.world.players = new Map();

    const brandedPlayerId = brandPlayerId(playerId);
    const player = match.world.players.get(brandedPlayerId);
    if (!player) return;

    // Parse input
    const moveDir = data.moveDirection || { x: 0, y: 0 };
    const attackDir = data.attackDirection || { x: 0, y: 0 };

    // Store for next simulation step
    (match as any).pendingInputs = (match as any).pendingInputs || [];
    (match as any).pendingInputs.push({
      playerId: brandedPlayerId,
      moveDirection: moveDir,
      attackDirection: attackDir,
    });
  });

  socket.on("disconnect", () => {
    const playerId = socketPlayers.get(socket.id);
    if (playerId) {
      playerSockets.delete(playerId);
      socketPlayers.delete(socket.id);

      // Remove from all matches
      for (const match of matches.values()) {
        match.players.delete(socket.id);
        match.world.players.delete(brandPlayerId(playerId));
      }

      console.log(`[DISCONNECT] ${playerId}`);
    }
  });
});

function startMatchLoop(match: Match) {
  let lastTick = Date.now();

  const interval = setInterval(() => {
    const now = Date.now();
    const elapsed = (now - lastTick) / 1000;
    lastTick = now;

    // Collect inputs for this tick
    const inputs: PlayerInput[] = ((match as any).pendingInputs || []);
    (match as any).pendingInputs = [];

    // Step simulation
    const result = stepSimulation(match.world, inputs, content);

    // Build snapshot
    const snapshot = {
      tick: match.world.tick,
      players: Array.from(match.world.players.values()).map((p) => ({
        id: p.id,
        position: p.position,
        health: p.health,
        maxHealth: p.maxHealth,
        alive: p.alive,
      })),
      enemies: Array.from(match.world.enemies.values()).map((e) => ({
        id: e.id,
        position: e.position,
        health: e.health,
        maxHealth: e.maxHealth,
        enemyType: e.enemyType,
        alive: e.alive,
      })),
      projectiles: Array.from(match.world.projectiles.values()).map((p) => ({
        id: p.id,
        position: p.position,
        radius: p.radius,
      })),
      events: result.events,
      wave: match.world.waveNumber,
      waveElapsed: match.world.waveElapsed,
    };

    // Broadcast to all players in match
    io.to(match.id).emit("snapshot", snapshot);

    // Clean up empty matches
    if (match.players.size === 0) {
      clearInterval(interval);
      matches.delete(match.id);
      console.log(`[CLEANUP] Match ${match.id} removed`);
    }
  }, 1000 / TICK_RATE);
}

const server = createServer();
io.attach(server, {
  cors: { origin: "*" },
});

server.listen(PORT, () => {
  console.log(`Mercicat server running on port ${PORT}`);
  console.log(`TICK_RATE: ${TICK_RATE} Hz`);
});
