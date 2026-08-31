import * as THREE from "three";
import { createInitialState, step, hashGameState } from "@mercicat/simulation";
import { SeededRandom, TICK_RATE } from "@mercicat/shared";
import type { InputCommand } from "@mercicat/shared";
import { GameRenderer, gameStateToRender } from "@mercicat/client";
import type { GameState } from "@mercicat/shared";

// ============================================================================
// SETUP
// ============================================================================

const LOCAL_PLAYER_ID = 1;
const SEED = 12345;

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x1a1a1e);

const camera = new THREE.OrthographicCamera(
  -window.innerWidth / 2,
  window.innerWidth / 2,
  window.innerHeight / 2,
  -window.innerHeight / 2,
  0.1,
  1000
);
camera.position.z = 10;

const scene = new THREE.Scene();

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
directionalLight.position.set(10, 10, 10);
scene.add(directionalLight);

// Ground
const groundGeometry = new THREE.PlaneGeometry(2000, 2000);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2a30 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
scene.add(ground);

// Game state (canonical initialization)
const rng = new SeededRandom(SEED);
let state: GameState = createInitialState(SEED, [LOCAL_PLAYER_ID]);

// Renderer
const gameRenderer = new GameRenderer(scene);

// ============================================================================
// INPUT HANDLING
// ============================================================================

const keys = new Set<string>();
let mouseWorldPos = { x: 0, y: 0 };

window.addEventListener("keydown", (e) => {
  keys.add(e.key.toLowerCase());
});

window.addEventListener("keyup", (e) => {
  keys.delete(e.key.toLowerCase());
});

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const screenX = e.clientX - rect.left;
  const screenY = e.clientY - rect.top;

  mouseWorldPos = {
    x: (screenX / rect.width) * window.innerWidth - window.innerWidth / 2,
    y: (screenY / rect.height) * window.innerHeight - window.innerHeight / 2,
  };
});

/**
 * Sample input at tick boundary.
 * Returns commands to apply this tick.
 */
function sampleInput(): InputCommand[] {
  const commands: InputCommand[] = [];

  // Movement
  let dx = 0;
  let dy = 0;

  if (keys.has("w")) dy += 1;
  if (keys.has("s")) dy -= 1;
  if (keys.has("a")) dx -= 1;
  if (keys.has("d")) dx += 1;

  // Normalize
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len > 0) {
    dx /= len;
    dy /= len;

    commands.push({
      type: "move",
      tick: state.tick,
      playerId: LOCAL_PLAYER_ID,
      direction: { x: dx, y: dy },
    } as any); // TODO: proper InputCommand type
  }

  // Fire (space bar)
  if (keys.has(" ")) {
    const playerEntityId = state.players[LOCAL_PLAYER_ID];
    if (playerEntityId !== undefined) {
      const player = state.entities[playerEntityId];
      if (player) {
        const fx = mouseWorldPos.x - player.position.x;
        const fy = mouseWorldPos.y - player.position.y;
        const angle = Math.atan2(fy, fx);

        commands.push({
          type: "fire",
          tick: state.tick,
          playerId: LOCAL_PLAYER_ID,
          direction: { x: Math.cos(angle), y: Math.sin(angle) },
        } as any); // TODO: proper InputCommand type
      }
    }
  }

  return commands;
}

// ============================================================================
// GAME LOOP
// ============================================================================

const TICK_DURATION = 1000 / TICK_RATE;
let accumulator = 0;
let previousTime = performance.now();

function frame(now: number) {
  const delta = Math.min(now - previousTime, TICK_DURATION * 5); // Clamp to 5 ticks max
  previousTime = now;
  accumulator += delta;

  // Fixed timestep simulation
  while (accumulator >= TICK_DURATION) {
    const commands = sampleInput();
    const result = step(state, commands, { rng });
    state = result.state;

    accumulator -= TICK_DURATION;
  }

  // Render
  const context = gameStateToRender(state, LOCAL_PLAYER_ID);
  gameRenderer.render(context);

  // Update camera to follow player
  const playerEntityId = state.players[LOCAL_PLAYER_ID];
  if (playerEntityId !== undefined) {
    const player = state.entities[playerEntityId];
    if (player) {
      camera.position.x = player.position.x;
      camera.position.y = player.position.y;
    }
  }

  renderer.render(scene, camera);

  requestAnimationFrame(frame);
}

// ============================================================================
// RESIZE HANDLING
// ============================================================================

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.left = -window.innerWidth / 2;
  camera.right = window.innerWidth / 2;
  camera.top = window.innerHeight / 2;
  camera.bottom = -window.innerHeight / 2;
  camera.updateProjectionMatrix();
});

// ============================================================================
// START
// ============================================================================

requestAnimationFrame(frame);

console.log("✓ Local game initialized");
console.log(`  Seed: ${SEED}`);
console.log(`  Player ID: ${LOCAL_PLAYER_ID}`);
console.log(`  Tick rate: ${TICK_RATE} Hz`);
console.log("Controls: WASD to move, Space to fire, Mouse to aim");
