// Lobby Screen - Multiplayer lobby with player list and ready state

import type { Character, LobbyState } from "./types.js";
import { LobbyClient } from "./lobbyClient.js";

export class LobbyScreen {
  private container: HTMLElement;
  private onGameStart: (lobbyCode: string) => void;
  private onBack: () => void;
  private character: Character;
  private lobbyClient: LobbyClient;
  private isHost: boolean;
  private lobbyCode: string = "";
  private pollInterval: number | null = null;
  private currentLobbyState: LobbyState | null = null;

  constructor(
    container: HTMLElement,
    character: Character,
    serverUrl: string,
    onGameStart: (lobbyCode: string) => void,
    onBack: () => void
  ) {
    this.container = container;
    this.character = character;
    this.lobbyClient = new LobbyClient(serverUrl);
    this.onGameStart = onGameStart;
    this.onBack = onBack;
    this.isHost = false;
  }

  async show(joinCode?: string): Promise<void> {
    this.showLoading("Initializing lobby...");

    try {
      if (joinCode) {
        const lobbyState = await this.lobbyClient.joinLobby(joinCode, this.character.name);
        this.currentLobbyState = lobbyState;
        this.isHost = false;
        this.lobbyCode = lobbyState.code;
      } else {
        const lobbyState = await this.lobbyClient.createLobby(this.character.name);
        this.currentLobbyState = lobbyState;
        this.isHost = true;
        this.lobbyCode = lobbyState.code;
      }

      this.render();
      this.startPolling();
    } catch (error) {
      this.showError(`Failed to initialize lobby: ${error}`);
    }
  }

  private render(): void {
    if (!this.currentLobbyState) return;

    const lobby = this.currentLobbyState;
    const playersList = lobby.players
      .map(
        (p) => `
      <div class="lobby-player ${p.ready ? "ready" : "waiting"}">
        <div class="player-status ${p.ready ? "ready" : "waiting"}">
          ${p.ready ? "✓" : "○"}
        </div>
        <div class="player-name">${p.name}</div>
        <div class="player-role">${p.isHost ? "(Host)" : ""}</div>
      </div>
    `
      )
      .join("");

    this.container.innerHTML = `
      <div class="menu-screen lobby-screen slide-in">
        <div class="lobby-content">
          <h1 class="menu-title">LOBBY</h1>
          
          <div class="lobby-info">
            <div class="lobby-code-section">
              <div class="code-label">Lobby Code</div>
              <div class="code-display">${lobby.code}</div>
              <button id="copy-code-btn" class="copy-btn" title="Copy code to clipboard">
                📋 Copy
              </button>
            </div>
            <div class="player-count">
              <span>${lobby.players.length} / ${lobby.maxPlayers}</span>
              Players in Lobby
            </div>
          </div>

          <div class="lobby-players">
            <h3 class="players-title">PLAYERS</h3>
            <div class="players-list">
              ${playersList}
            </div>
          </div>

          <div class="lobby-actions">
            ${
              this.isHost
                ? `
              <button id="start-game-btn" class="menu-button action-button primary" ${lobby.allReady && lobby.players.length > 0 ? "" : "disabled"}>
                ⚡ START GAME
              </button>
            `
                : `
              <button id="ready-btn" class="menu-button action-button primary">
                ✓ READY
              </button>
            `
            }
            <button id="leave-btn" class="menu-button action-button secondary">
              ← LEAVE LOBBY
            </button>
          </div>

          <div class="lobby-waiting">
            ${!lobby.allReady ? "<div class='waiting-message'>Waiting for all players to ready up...</div>" : ""}
            ${lobby.gameStarting ? "<div class='starting-message'>Game starting...</div>" : ""}
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    const copyBtn = this.container.querySelector("#copy-code-btn") as HTMLButtonElement | null;
    const startGameBtn = this.container.querySelector("#start-game-btn") as HTMLButtonElement | null;
    const readyBtn = this.container.querySelector("#ready-btn") as HTMLButtonElement | null;
    const leaveBtn = this.container.querySelector("#leave-btn") as HTMLButtonElement | null;

    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(this.lobbyCode);
        copyBtn.textContent = "✓ Copied!";
        setTimeout(() => {
          copyBtn.textContent = "📋 Copy";
        }, 2000);
      });
    }

    if (startGameBtn) {
      startGameBtn.addEventListener("click", async () => {
        try {
          startGameBtn.disabled = true;
          startGameBtn.textContent = "⚡ Starting...";
          await this.lobbyClient.startGame(this.lobbyCode);
          this.stopPolling();
          this.fadeOut(() => this.onGameStart(this.lobbyCode));
        } catch (error) {
          startGameBtn.disabled = false;
          startGameBtn.textContent = "⚡ START GAME";
          this.showError(`Failed to start game: ${error}`);
        }
      });
    }

    if (readyBtn) {
      const isCurrentlyReady = this.currentLobbyState?.players.some((p) => p.name === this.character.name && p.ready) ?? false;
      readyBtn.textContent = isCurrentlyReady ? "✓ READY (Click to unready)" : "✓ READY";

      readyBtn.addEventListener("click", async () => {
        try {
          const newReadyState = !isCurrentlyReady;
          await this.lobbyClient.setReady(this.lobbyCode, newReadyState);
          readyBtn.textContent = newReadyState ? "✓ READY (Click to unready)" : "✓ READY";
        } catch (error) {
          this.showError(`Failed to update ready status: ${error}`);
        }
      });
    }

    if (leaveBtn) {
      leaveBtn.addEventListener("click", () => {
        this.stopPolling();
        this.fadeOut(() => this.onBack());
      });
    }
  }

  private startPolling(): void {
    this.pollInterval = window.setInterval(async () => {
      try {
        const updatedLobby = await this.lobbyClient.getLobbyStatus(this.lobbyCode);
        this.currentLobbyState = updatedLobby;
        this.render();

        // If host and all ready, auto-start after a delay
        if (this.isHost && updatedLobby.allReady && updatedLobby.players.length > 1) {
          this.stopPolling();
          setTimeout(() => {
            this.tryAutoStart();
          }, 1000);
        }
      } catch (error) {
        console.error("Failed to poll lobby status:", error);
      }
    }, 1000);
  }

  private stopPolling(): void {
    if (this.pollInterval !== null) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private async tryAutoStart(): Promise<void> {
    try {
      if (this.isHost && this.currentLobbyState?.allReady) {
        await this.lobbyClient.startGame(this.lobbyCode);
        this.fadeOut(() => this.onGameStart(this.lobbyCode));
      }
    } catch (error) {
      console.error("Auto-start failed:", error);
      this.startPolling();
    }
  }

  private showLoading(message: string): void {
    this.container.innerHTML = `
      <div class="menu-screen lobby-screen slide-in">
        <div class="loading-screen">
          <div class="loading-spinner"></div>
          <div class="loading-text">${message}</div>
        </div>
      </div>
    `;
  }

  private showError(message: string): void {
    const errorDiv = document.createElement("div");
    errorDiv.className = "lobby-error";
    errorDiv.textContent = message;
    this.container.appendChild(errorDiv);

    setTimeout(() => {
      errorDiv.remove();
    }, 5000);
  }

  private fadeOut(callback: () => void): void {
    const screen = this.container.querySelector(".lobby-screen") as HTMLElement;
    if (screen) {
      screen.classList.remove("slide-in");
      screen.classList.add("slide-out");
      setTimeout(callback, 300);
    } else {
      callback();
    }
  }

  destroy(): void {
    this.stopPolling();
  }
}
