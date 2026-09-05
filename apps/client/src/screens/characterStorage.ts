// Character persistence layer - handles localStorage

import type { Character, CharacterModel } from "./types.js";

const STORAGE_KEY = "mercicat_character";

export class CharacterStorage {
  static saveCharacter(character: Character): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(character));
    } catch (error) {
      console.error("Failed to save character:", error);
    }
  }

  static loadCharacter(): Character | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error("Failed to load character:", error);
      return null;
    }
  }

  static deleteCharacter(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Failed to delete character:", error);
    }
  }

  static createCharacter(name: string, model: CharacterModel): Character {
    return {
      id: `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      model,
      createdAt: Date.now(),
    };
  }
}
