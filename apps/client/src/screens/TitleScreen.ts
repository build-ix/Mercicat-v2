// Title Screen - Entry point with "PLAY" button

export class TitleScreen {
  private container: HTMLElement;
  private onPlay: () => void;

  constructor(container: HTMLElement, onPlay: () => void) {
    this.container = container;
    this.onPlay = onPlay;
  }

  show(): void {
    this.container.innerHTML = `
      <div class="menu-screen title-screen">
        <div class="title-content">
          <div class="mercicat-logo">
            <div class="logo-text">MERCICAT</div>
            <div class="logo-subtitle">v2</div>
          </div>
          <div class="logo-glitch"></div>
          <button id="play-button" class="menu-button play-button">
            <span class="button-text">▶ PLAY</span>
          </button>
          <div class="logo-flavor">Multiplayer • Single Player • Waves of Chaos</div>
        </div>
      </div>
    `;

    const playButton = this.container.querySelector("#play-button") as HTMLButtonElement;
    playButton.addEventListener("click", () => {
      this.fadeOut(() => this.onPlay());
    });
  }

  private fadeOut(callback: () => void): void {
    const screen = this.container.querySelector(".title-screen") as HTMLElement;
    if (screen) {
      screen.classList.add("fade-out");
      setTimeout(callback, 300);
    } else {
      callback();
    }
  }
}
