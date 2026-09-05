// Character Manager Screen - Create or continue with existing character

import type { Character, CharacterModel } from "./types.js";
import { CharacterStorage } from "./characterStorage.js";

export class CharacterManagerScreen {
  private container: HTMLElement;
  private onCharacterReady: (character: Character) => void;
  private existingCharacter: Character | null;

  constructor(container: HTMLElement, onCharacterReady: (character: Character) => void) {
    this.container = container;
    this.onCharacterReady = onCharacterReady;
    this.existingCharacter = CharacterStorage.loadCharacter();
  }

  show(): void {
    if (this.existingCharacter) {
      this.showExistingCharacter();
    } else {
      this.showCreator();
    }
  }

  private showExistingCharacter(): void {
    const char = this.existingCharacter!;
    this.container.innerHTML = `
      <div class="menu-screen character-screen slide-in">
        <div class="character-content">
          <h1 class="menu-title">CHARACTER</h1>
          <div class="existing-character">
            <div class="character-card">
              <div class="character-model model-${char.model}">
                <div class="model-icon">${this.getModelIcon(char.model)}</div>
              </div>
              <div class="character-info">
                <div class="character-name">${char.name}</div>
                <div class="character-model-name">${this.getModelDisplayName(char.model)}</div>
                <div class="character-created">Created ${new Date(char.createdAt).toLocaleDateString()}</div>
              </div>
            </div>
            <div class="character-actions">
              <button id="continue-btn" class="menu-button action-button primary">
                → CONTINUE WITH THIS CHARACTER
              </button>
              <button id="create-new-btn" class="menu-button action-button secondary">
                + CREATE NEW CHARACTER
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const continueBtn = this.container.querySelector("#continue-btn") as HTMLButtonElement;
    const createNewBtn = this.container.querySelector("#create-new-btn") as HTMLButtonElement;

    continueBtn.addEventListener("click", () => {
      this.fadeOut(() => this.onCharacterReady(this.existingCharacter!));
    });

    createNewBtn.addEventListener("click", () => {
      this.showCreator();
    });
  }

  private showCreator(): void {
    this.container.innerHTML = `
      <div class="menu-screen character-screen slide-in">
        <div class="character-content">
          <h1 class="menu-title">CREATE CHARACTER</h1>
          <div class="character-creator">
            <div class="creator-section">
              <label for="char-name" class="creator-label">Character Name</label>
              <input 
                type="text" 
                id="char-name" 
                class="creator-input" 
                placeholder="Enter your name..."
                maxlength="32"
              />
            </div>
            <div class="creator-section">
              <label class="creator-label">Select Model</label>
              <div class="model-grid">
                <button class="model-option" data-model="mercicat">
                  <div class="model-preview mercicat">🐱</div>
                  <div class="model-title">Mercicat</div>
                  <div class="model-desc">Balanced fighter</div>
                </button>
                <button class="model-option" data-model="tigerstrike">
                  <div class="model-preview tigerstrike">🐯</div>
                  <div class="model-title">Tigerstrike</div>
                  <div class="model-desc">Aggressive & fast</div>
                </button>
                <button class="model-option" data-model="shadowpounce">
                  <div class="model-preview shadowpounce">🐆</div>
                  <div class="model-title">Shadowpounce</div>
                  <div class="model-desc">Stealthy & agile</div>
                </button>
              </div>
            </div>
            <div class="creator-actions">
              <button id="create-char-btn" class="menu-button action-button primary" disabled>
                → CREATE CHARACTER
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    let selectedModel: CharacterModel = "mercicat";
    const nameInput = this.container.querySelector("#char-name") as HTMLInputElement;
    const createBtn = this.container.querySelector("#create-char-btn") as HTMLButtonElement;
    const modelOptions = this.container.querySelectorAll(".model-option") as NodeListOf<HTMLButtonElement>;

    const updateCreateBtn = () => {
      createBtn.disabled = nameInput.value.trim().length === 0;
    };

    nameInput.addEventListener("input", updateCreateBtn);
    nameInput.focus();

    modelOptions.forEach((btn) => {
      btn.addEventListener("click", () => {
        modelOptions.forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        selectedModel = btn.dataset.model as CharacterModel;
      });
    });

    // Select first model by default
    modelOptions[0].classList.add("selected");

    createBtn.addEventListener("click", () => {
      const name = nameInput.value.trim();
      if (name) {
        const newChar = CharacterStorage.createCharacter(name, selectedModel);
        CharacterStorage.saveCharacter(newChar);
        this.fadeOut(() => this.onCharacterReady(newChar));
      }
    });
  }

  private getModelIcon(model: CharacterModel): string {
    const icons: Record<CharacterModel, string> = {
      mercicat: "🐱",
      tigerstrike: "🐯",
      shadowpounce: "🐆",
    };
    return icons[model];
  }

  private getModelDisplayName(model: CharacterModel): string {
    const names: Record<CharacterModel, string> = {
      mercicat: "Mercicat",
      tigerstrike: "Tigerstrike",
      shadowpounce: "Shadowpounce",
    };
    return names[model];
  }

  private fadeOut(callback: () => void): void {
    const screen = this.container.querySelector(".character-screen") as HTMLElement;
    if (screen) {
      screen.classList.remove("slide-in");
      screen.classList.add("slide-out");
      setTimeout(callback, 300);
    } else {
      callback();
    }
  }
}
