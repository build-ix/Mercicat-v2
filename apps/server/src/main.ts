import { createServer } from "node:http";
import { Server } from "socket.io";
import { SeededRandom } from "@mercicat/shared";
import { createInitialState, step } from "@mercicat/simulation";
import type { GameState, InputCommand, PlayerId } from "@mercicat/shared";

const PORT = 3001;
const TICK_RATE = 30;
interface Match { id: string; state: GameState; rng: SeededRandom; pending: InputCommand[]; players: Map<string, PlayerId>; }
const matches = new Map<string, Match>();
const io = new Server({ cors: { origin: "*" } });

io.on("connection", (socket) => {
  socket.on("join_match", (data: { matchId?: string }) => {
    const matchId = data.matchId || "default";
    let match = matches.get(matchId);
    if (!match) {
      const seed = `match:${matchId}`;
      match = { id: matchId, state: createInitialState(seed, []), rng: new SeededRandom(seed), pending: [], players: new Map() };
      matches.set(matchId, match); startMatchLoop(match);
    }
    const playerId = `player_${socket.id.slice(0, 8)}` as unknown as PlayerId;
    match.players.set(socket.id, playerId);
    if (match.state.players[playerId] === undefined) {
      const id = match.state.nextEntityId++;
      match.state.players[playerId] = id;
      match.state.entities[id] = { id, kind: "player", lifecycle: "active", playerId,
        position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, radius: 12, health: 100, maxHealth: 100,
        spawnTick: match.state.tick, despawnTick: null, fireCooldownTicks: 0 };
    }
    socket.join(matchId); socket.emit("joined", { playerId: String(playerId), matchId });
  });
  socket.on("input", (data: { moveDirection?: {x:number;y:number}; attackDirection?: {x:number;y:number} }) => {
    for (const match of matches.values()) {
      const playerId = match.players.get(socket.id); if (playerId === undefined) continue;
      const move = data.moveDirection ?? { x: 0, y: 0 };
      match.pending.push({ type: "move", tick: match.state.tick, playerId, direction: move });
      const attack = data.attackDirection ?? { x: 0, y: 0 };
      if (attack.x !== 0 || attack.y !== 0) match.pending.push({ type: "fire", tick: match.state.tick, playerId, direction: attack });
    }
  });
  socket.on("disconnect", () => { for (const match of matches.values()) match.players.delete(socket.id); });
});
function startMatchLoop(match: Match): void {
  const interval = setInterval(() => {
    const result = step(match.state, match.pending, { rng: match.rng }); match.pending = []; match.state = result.state;
    io.to(match.id).emit("snapshot", { tick: match.state.tick, entities: match.state.entities, players: match.state.players, wave: match.state.wave, events: result.events, stateHash: result.stateHash });
    if (match.players.size === 0) { clearInterval(interval); matches.delete(match.id); }
  }, 1000 / TICK_RATE);
}
const server = createServer(); io.attach(server, { cors: { origin: "*" } });
server.listen(PORT, () => console.log(`Mercicat server running on port ${PORT}`));
