import type { GameState, SimulationEvent, Vec2 } from "@mercicat/shared";
import { SeededRandom } from "@mercicat/shared";
import { getShopCandidates } from "@mercicat/content";

const SHOP_RADIUS = 35;
const PLAYER_CLEARANCE = 12;

function distance(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x; const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Place one static, non-solid shop at a reachable, collision-free node. */
export function placeShop(state: GameState, rng: SeededRandom, events: SimulationEvent[]): void {
  if (state.shop.currentNodeId !== null) return;
  const nodes = Object.values(state.mapNodes).filter((node) => node.kind === "shop");
  const metadata = Object.fromEntries(nodes.map((node) => [node.id, {
    id: node.id, kind: node.kind, x: node.x, y: node.y, reachableFrom: ["arena_center"],
    safeInteractionRadius: SHOP_RADIUS, hasLineOfSight: true,
    distanceTo: node.navigationDistance ?? {}, tags: []
  }]));
  const candidates = getShopCandidates(null, metadata).filter((id) => {
    const node = state.mapNodes[id];
    const occupants = Object.values(state.entities).filter((e) => e.lifecycle === "active" && (e.kind === "player" || e.kind === "enemy"));
    return Number.isFinite(node.x) && Number.isFinite(node.y) && occupants.every((e) =>
      distance(e.position, node) >= SHOP_RADIUS + e.radius + PLAYER_CLEARANCE);
  }).sort();
  if (!candidates.length) {
    events.push({ type: "shopUnavailable", tick: state.tick, reason: "no valid reachable shop node" });
    return;
  }
  // Farthest safe node creates a meaningful regroup/split decision. Stable sort
  // and seeded tie-breaking keep placement reproducible across servers.
  const players = Object.values(state.entities).filter((e) => e.kind === "player");
  const centroid = players.reduce((p, e) => ({ x: p.x + e.position.x, y: p.y + e.position.y }), { x: 0, y: 0 });
  if (players.length) { centroid.x /= players.length; centroid.y /= players.length; }
  const scores = candidates.map((id) => distance(state.mapNodes[id], centroid));
  const best = Math.max(...scores);
  const tied = candidates.filter((_, i) => scores[i] === best);
  state.shop.currentNodeId = tied[rng.nextInt(0, tied.length - 1)];
  state.shop.accessible = true;
  state.shop.used = false;
  state.shop.telegraphStartTick = state.tick;
  events.push({ type: "shopTelegraphStarted", tick: state.tick, nodeId: state.shop.currentNodeId });
  events.push({ type: "shopOpened", tick: state.tick, nodeId: state.shop.currentNodeId });
}

export function advanceShop(state: GameState, rng: SeededRandom, events: SimulationEvent[]): void {
  // Static once placed: later waves preserve the location and therefore the
  // learned tactical geography. A future dynamic variant can reset currentNodeId
  // explicitly at intermission, rather than silently moving it mid-wave.
  if (state.wavePhase === "waveActive") placeShop(state, rng, events);
}
