import { describe, expect, it } from "vitest";
import { Room } from "./roomManager.js";

describe("room lifecycle and slot allocation", () => {
  it("stamps joins/disconnects and reuses disconnected slots", () => {
    const room = new Room("test", 1);
    const first = room.join("socket-a")!;
    expect(first.playerId).toBe(1);
    expect(room.drainLifecycleEvents()).toEqual([{ type: "joined", tick: 0, playerId: 1 }]);
    room.disconnect("socket-a");
    expect(room.connectedCount()).toBe(0);
    expect(room.drainLifecycleEvents()).toEqual([{ type: "disconnected", tick: 0, playerId: 1 }]);
    const reconnect = room.join("socket-b")!;
    expect(reconnect.playerId).toBe(1);
    expect(room.connectedCount()).toBe(1);
    expect(room.drainLifecycleEvents()).toEqual([{ type: "reconnected", tick: 0, playerId: 1 }]);
  });
});
