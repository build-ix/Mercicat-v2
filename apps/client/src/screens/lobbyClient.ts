// Lobby API client for connecting to multiplayer server

import type { LobbyState, LobbyPlayer } from "./types.js";

export interface LobbyResponse {
  code: string;
  players: LobbyPlayer[];
  maxPlayers: number;
}

export class LobbyClient {
  private serverUrl: string;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }

  async createLobby(characterName: string): Promise<LobbyState> {
    try {
      const response = await fetch(`${this.serverUrl}/api/lobby/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterName }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = (await response.json()) as LobbyResponse;
      return {
        code: data.code,
        players: data.players,
        maxPlayers: data.maxPlayers,
        isHost: true,
        allReady: false,
        gameStarting: false,
      };
    } catch (error) {
      console.error("Failed to create lobby:", error);
      throw error;
    }
  }

  async joinLobby(code: string, characterName: string): Promise<LobbyState> {
    try {
      const response = await fetch(`${this.serverUrl}/api/lobby/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, characterName }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = (await response.json()) as LobbyResponse;
      return {
        code: data.code,
        players: data.players,
        maxPlayers: data.maxPlayers,
        isHost: false,
        allReady: false,
        gameStarting: false,
      };
    } catch (error) {
      console.error("Failed to join lobby:", error);
      throw error;
    }
  }

  async getLobbyStatus(code: string): Promise<LobbyState> {
    try {
      const response = await fetch(`${this.serverUrl}/api/lobby/${code}`, {
        method: "GET",
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = (await response.json()) as LobbyResponse;
      return {
        code: data.code,
        players: data.players,
        maxPlayers: data.maxPlayers,
        isHost: false,
        allReady: data.players.every((p) => p.ready),
        gameStarting: false,
      };
    } catch (error) {
      console.error("Failed to get lobby status:", error);
      throw error;
    }
  }

  async setReady(code: string, ready: boolean): Promise<void> {
    try {
      const response = await fetch(`${this.serverUrl}/api/lobby/${code}/ready`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ready }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      console.error("Failed to set ready status:", error);
      throw error;
    }
  }

  async startGame(code: string): Promise<void> {
    try {
      const response = await fetch(`${this.serverUrl}/api/lobby/${code}/start`, {
        method: "POST",
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      console.error("Failed to start game:", error);
      throw error;
    }
  }
}
