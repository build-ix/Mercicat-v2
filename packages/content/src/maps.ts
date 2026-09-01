export interface MapNodeMetadata { id: string; kind: "spawn" | "shop" | "objective"; x: number; y: number; reachableFrom: string[]; safeInteractionRadius: number; hasLineOfSight: boolean; distanceTo: Record<string, number>; tags: string[]; }
export const DEFAULT_MAP_NODES: Record<string, MapNodeMetadata> = {
  spawn_1: { id: "spawn_1", kind: "spawn", x: 100, y: 100, reachableFrom: ["arena_center", "corridor_north"], safeInteractionRadius: 50, hasLineOfSight: true, distanceTo: { arena_center: 80, corridor_north: 60 }, tags: ["player_spawn"] },
  shop_cafe: { id: "shop_cafe", kind: "shop", x: 400, y: 300, reachableFrom: ["arena_center", "corridor_east"], safeInteractionRadius: 40, hasLineOfSight: true, distanceTo: { arena_center: 120, corridor_east: 90, spawn_1: 180 }, tags: ["safe_zone", "central"] },
  shop_armory: { id: "shop_armory", kind: "shop", x: 200, y: 500, reachableFrom: ["arena_south", "corridor_west"], safeInteractionRadius: 35, hasLineOfSight: true, distanceTo: { arena_south: 100, corridor_west: 75, spawn_1: 220 }, tags: ["defensive", "south"] }
};
export function getShopCandidates(previousShopId: string | null, mapNodes: Record<string, MapNodeMetadata>): string[] { return Object.values(mapNodes).filter(node => node.kind === "shop" && node.id !== previousShopId && node.reachableFrom.length >= 1 && node.hasLineOfSight).map(node => node.id); }
