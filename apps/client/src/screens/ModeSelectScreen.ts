// Mode Select Screen - Choose Single Player or Multiplayer

import type { GameMode } from "./types.js";

export class ModeSelectScreen {
  private container: HTMLElement;
  private onModeSelect: (mode: GameMode) => void;

  constructor(container: HTMLElement, onModeSelect: (mode: GameMode) => void) {
    this.container = container;
    this.onModeSelect = onModeSelect;
  }

  show(): void {
    this.container.innerHTML = `
      <div class="menu-screen mode-select-screen slide-in">
        <div class="mode-content">
          <h1 class="menu-title">GAME MODE</h1>
          <div class="mode-buttons">
            <button id="singleplayer-btn" class="menu-button mode-button">
              <div class="button-icon">🐱</div>
              <div class="button-label">Single Player</div>
              <div class="button-desc">Challenge waves of enemies alone</div>
            </button>
            <button id="multiplayer-btn" class="menu-button mode-button">
              <div class="button-icon">👥</div>
              <div class="button-label">Multiplayer</div>
              <div class="button-desc">Team up with friends in lobbies</div>
            </button>
          </div>
        </div>
      </div>
    `;

    const singleplayerBtn = this.container.querySelector("#singleplayer-btn") as HTMLButtonElement;
    const multiplayerBtn = this.container.querySelector("#multiplayer-btn") as HTMLButtonElement;

    singleplayerBtn.addEventListener("click", () => {
      this.fadeOut(() => this.onModeSelect("singlePlayer"));
    });

    multiplayerBtn.addEventListener("click", () => {
      this.fadeOut(() => this.onModeSelect("multiplayer"));
    });
  }

  private fadeOut(callback: () => void): void {
    const screen = this.container.querySelector(".mode-select-screen") as HTMLElement;
    if (screen) {
      screen.classList.remove("slide-in");
      screen.classList.add("slide-out");
      setTimeout(callback, 300);
    } else {
      callback();
    }
  }
}
