import type { Server, Socket } from "socket.io";
import type { RoomManager } from "../roomManager.js";
export function registerConnectionHandlers(_io: Server, _rooms: RoomManager, _socket: Socket): void { /* wired by serverLifecycle */ }
