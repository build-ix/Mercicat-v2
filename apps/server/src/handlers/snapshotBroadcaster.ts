import type { Server } from "socket.io";
import type { FixedTickLoop } from "../tickLoop.js";
export function broadcastSnapshots(_io: Server, _loop: FixedTickLoop): void { /* per-room broadcaster hook */ }
