// Menu State Machine - Orchestrates all menu screens and transitions

import type { Character, GameMode, MenuScreen } from "./types.js";
import { TitleScreen } from "./TitleScreen.js";
import { ModeSelectScreen } from "./ModeSelectScreen.js";
import { CharacterManagerScreen } from "./CharacterManagerScreen.js";
import { LobbyScreen } from "./LobbyScreen.js";

export interface MenuStateMachineConfig {
  containerElement: HTMLElement;
  serverUrl: string;
  onGameStart: (config: GameStartConfig) => void;
}

export interface GameStartConfig {
  character: Character;
  mode: GameMode;
  lobbyCode?: string;
  serverUrl: string;
}

export class MenuStateMachine {
  private container: HTMLElement;
  private serverUrl: string;
  private onGameStart: (config: GameStartConfig) => void;

  private currentScreen: MenuScreen = "title";
  private selectedMode: GameMode | null = null;
  private selectedCharacter: Character | null = null;
  private currentLobbyScreen: LobbyScreen | null = null;

  private titleScreen: TitleScreen;
  private modeSelectScreen: ModeSelectScreen;
  private characterManagerScreen: CharacterManagerScreen;

  constructor(config: MenuStateMachineConfig) {
    this.container = config.containerElement;
    this.serverUrl = config.serverUrl;
    this.onGameStart = config.onGameStart;

    this.titleScreen = new TitleScreen(this.container, () => this.transitionTo("modeSelect"));
    this.modeSelectScreen = new ModeSelectScreen(this.container, (mode) => this.handleModeSelect(mode));
    this.characterManagerScreen = new CharacterManagerScreen(this.container, (char) =>
      this.handleCharacterReady(char)
    );
  }

  start(): void {
    this.transitionTo("title");
  }

  private transitionTo(screen: MenuScreen): void {
    this.currentScreen = screen;

    switch (screen) {
      case "title":
        this.titleScreen.show();
        break;
      case "modeSelect":
        this.modeSelectScreen.show();
        break;
      case "characterManager":
        this.characterManagerScreen.show();
        break;
      case "lobby":
        this.showLobbyScreen();
        break;
      case "game":
        this.startGame();
        break;
    }
  }

  private handleModeSelect(mode: GameMode): void {
    this.selectedMode = mode;
    this.transitionTo("characterManager");
  }

  private handleCharacterReady(character: Character): void {
    this.selectedCharacter = character;

    if (this.selectedMode === "singlePlayer") {
      // Skip lobby for single player
      this.startGame();
    } else {
      // Show lobby for multiplayer
      this.transitionTo("lobby");
    }
  }

  private async showLobbyScreen(): Promise<void> {
    if (!this.selectedCharacter) return;

    if (this.currentLobbyScreen) {
      this.currentLobbyScreen.destroy();
    }

    // Check if URL has join code
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get("join");

    this.currentLobbyScreen = new LobbyScreen(
      this.container,
      this.selectedCharacter,
      this.serverUrl,
      (lobbyCode) => {
        this.startGameWithLobby(lobbyCode);
      },
      () => {
        // Back to mode select
        this.selectedMode = null;
        this.transitionTo("modeSelect");
      }
    );

    await this.currentLobbyScreen.show(joinCode ?? undefined);
  }

  private startGameWithLobby(lobbyCode: string): void {
    if (this.currentLobbyScreen) {
      this.currentLobbyScreen.destroy();
    }

    if (!this.selectedCharacter) return;

    this.onGameStart({
      character: this.selectedCharacter,
      mode: "multiplayer",
      lobbyCode,
      serverUrl: this.serverUrl,
    });
  }

  private startGame(): void {
    if (!this.selectedCharacter || !this.selectedMode) return;

    this.onGameStart({
      character: this.selectedCharacter,
      mode: this.selectedMode,
      serverUrl: this.serverUrl,
    });
  }
}
