import type { InputCommand } from "../simulation/contracts.js";

export const CONTENT_VERSION = 1 as const;
export const REPLAY_VERSION = 1 as const;

export interface ReplayHeader {
  replayVersion: number;
  contentVersion: number;
  seed: number | string;
  playerIds: number[];
  mode: string;
  difficulty: number;
}

export interface ReplayRecord extends ReplayHeader {
  commands: InputCommand[];
  tickHashes: string[];
  finalHash: string;
}

export function assertReplayVersion(header: ReplayHeader): void {
  if (header.replayVersion !== REPLAY_VERSION) {
    throw new Error(`Unsupported replay version: ${header.replayVersion}`);
  }
  if (header.contentVersion !== CONTENT_VERSION) {
    throw new Error(`Unsupported content version: ${header.contentVersion}`);
  }
}
