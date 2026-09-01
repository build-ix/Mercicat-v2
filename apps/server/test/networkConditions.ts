export interface NetworkConditions { latencyMs: number; jitterMs?: number; packetLoss?: number; }
export const DEFAULT_NETWORK_CONDITIONS: NetworkConditions = { latencyMs: 0 };
