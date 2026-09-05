// Type definitions for menu screens

export type MenuScreen = "title" | "modeSelect" | "characterManager" | "lobby" | "game";

export type GameMode = "singlePlayer" | "multiplayer";

export interface Character {
  id: string;
  name: string;
  model: CharacterModel;
  createdAt: number;
}

export type CharacterModel = "mercicat" | "tigerstrike" | "shadowpounce";

export interface LobbyPlayer {
  id: string;
  name: string;
  ready: boolean;
  isHost: boolean;
}

export interface LobbyState {
  code: string;
  players: LobbyPlayer[];
  maxPlayers: number;
  isHost: boolean;
  allReady: boolean;
  gameStarting: boolean;
}

export interface MenuContextType {
  currentScreen: MenuScreen;
  character: Character | null;
  mode: GameMode | null;
  lobbyState: LobbyState | null;
  errors: string[];
  isLoading: boolean;
}
