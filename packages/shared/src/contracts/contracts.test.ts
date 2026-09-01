import {
  CONTENT_VERSION,
  REPLAY_VERSION,
  assertReplayVersion,
  type ReplayRecord,
  type SimulationEvent,
} from "../index.js";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}
function assertThrows(action: () => void, message: string): void {
  try { action(); } catch (error) {
    assert(error instanceof Error && error.message === message, `unexpected error: ${String(error)}`);
    return;
  }
  throw new Error(`expected error: ${message}`);
}

const command = { commandId: "cmd-1", type: "move" as const, tick: 0, playerId: 1, moveX: 1, moveY: 0 };
const replay: ReplayRecord = {
  replayVersion: REPLAY_VERSION, contentVersion: CONTENT_VERSION, seed: "contracts",
  playerIds: [1, 2], mode: "co-op", difficulty: 2, commands: [command],
  tickHashes: ["abc"], finalHash: "def",
};
const decoded = JSON.parse(JSON.stringify(replay)) as ReplayRecord;
assert(JSON.stringify(decoded) === JSON.stringify(replay), "replay JSON round-trip failed");
assertReplayVersion(decoded);
assertThrows(() => assertReplayVersion({ ...replay, replayVersion: 99 }), "Unsupported replay version: 99");
assertThrows(() => assertReplayVersion({ ...replay, contentVersion: 99 }), "Unsupported content version: 99");

const events: SimulationEvent[] = [
  { type: "entitySpawned", tick: 1, entityId: 3, kind: "enemy" },
  { type: "creditsAwarded", tick: 2, playerId: 1, amount: 10 },
  { type: "playerDowned", tick: 3, playerId: 2 },
  { type: "shopClosed", tick: 4, nodeId: "shop-a" },
];
assert(events.map((event) => event.type).join(",") === "entitySpawned,creditsAwarded,playerDowned,shopClosed", "event literals changed");
