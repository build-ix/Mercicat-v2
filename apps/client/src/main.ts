import * as THREE from "three";
import { createInitialState, step as stepSimulation } from "@mercicat/simulation";
import { SeededRandom, TICK_RATE } from "@mercicat/shared";
import type { GameState, InputCommand } from "@mercicat/shared";

// Canvas setup
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x1a1a1e);

// Camera (top-down orthographic for arena)
const camera = new THREE.OrthographicCamera(
  -window.innerWidth / 2,
  window.innerWidth / 2,
  window.innerHeight / 2,
  -window.innerHeight / 2,
  0.1,
  1000
);
camera.position.z = 10;

// Scene
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

// Game state
const rng = new SeededRandom(12345); // Deterministic for local testing
let gameState: GameState = createInitialState(12345, [1]); // Seed 1 = player 1

// Render primitives
const meshes = new Map<number, THREE.Mesh>();

// Input state (sampled at tick boundary)
const keys = new Set<string>();
let mouseWorldPos = { x: 0, y: 0 }; // Relative to arena center

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

  // Convert screen coords to world coords (orthographic camera)
  const worldX = (screenX / rect.width) * window.innerWidth - window.innerWidth / 2;
  const worldY = (screenY / rect.height) * window.innerHeight - window.innerHeight / 2;

  mouseWorldPos = { x: worldX, y: worldY };
});

// Game loop parameters
const FRAME_TIME = 1000 / TICK_RATE; // ms

let accumulator = 0;
let lastTime = performance.now();

/**
 * Create or update visual representation of game state.
 */
function renderGameState() {
  // Clear previous meshes
  meshes.forEach((mesh) => {
    scene.remove(mesh);
  });
  meshes.clear();

  // Render entities
  for (const [entityId, entity] of Object.entries(gameState.entities)) {
    const eid = parseInt(entityId);
    let geometry: THREE.BufferGeometry;
    let color: number;

    if (entity.kind === "player") {
      geometry = new THREE.CircleGeometry(entity.radius, 16);
      color = 0xff6b35; // Orange
    } else if (entity.kind === "enemy") {
      geometry = new THREE.CircleGeometry(entity.radius, 16);
      color = 0xf72585; // Pink
    } else if (entity.kind === "projectile") {
      geometry = new THREE.CircleGeometry(entity.radius, 8);
      color = 0xffd700; // Gold
    } else {
      continue; // Skip other entity types for now
    }

    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: entity.lifecycle === "dead" ? 0xff0000 : 0x000000,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.x = entity.position.x;
    mesh.position.y = entity.position.y;
    mesh.position.z = entity.kind === "projectile" ? 0.5 : 0; // Projectiles on top

    scene.add(mesh);
    meshes.set(eid, mesh);
  }
}

/**
 * Sample input at tick boundary (not every frame).
 * Returns input commands for the current tick.
 */
function sampleInput(): InputCommand[] {
  const commands: InputCommand[] = [];

  // Find player entity ID (for now assume first player at playerId 1)
  const playerEntityId = gameState.players[1]; // Player 1's entity ID
  if (playerEntityId === undefined) return commands;

  // WASD movement
  let moveX = 0;
  let moveY = 0;

  if (keys.has("w")) moveY += 1;
  if (keys.has("s")) moveY -= 1;
  if (keys.has("a")) moveX -= 1;
  if (keys.has("d")) moveX += 1;

  // Normalize diagonal movement
  const moveLen = Math.sqrt(moveX * moveX + moveY * moveY);
  if (moveLen > 0) {
    moveX /= moveLen;
    moveY /= moveLen;
  }

  // Apply movement if any
  if (moveX !== 0 || moveY !== 0) {
    commands.push({
      tick: gameState.tick,
      playerId: 1,
      entityId: playerEntityId,
      action: "move",
      data: { x: moveX, y: moveY },
    } as any); // TODO: proper type
  }

  // Fire direction (toward mouse)
  const player = gameState.entities[playerEntityId];
  if (player) {
    const dx = mouseWorldPos.x - player.position.x;
    const dy = mouseWorldPos.y - player.position.y;
    const fireAngle = Math.atan2(dy, dx);

    // Fire on space
    if (keys.has(" ")) {
      commands.push({
        tick: gameState.tick,
        playerId: 1,
        entityId: playerEntityId,
        action: "fire",
        data: { angle: fireAngle },
      } as any); // TODO: proper type
    }
  }

  return commands;
}

/**
 * Main animation loop.
 */
function animate(currentTime: number) {
  const deltaTime = Math.min(currentTime - lastTime, 50); // Cap at 50ms to avoid spiral of death
  lastTime = currentTime;

  accumulator += deltaTime;

  // Fixed timestep game updates
  while (accumulator >= FRAME_TIME) {
    const input = sampleInput();

    // Step the simulation
    const result = stepSimulation(gameState, input, { rng });
    gameState = result.state;

    accumulator -= FRAME_TIME;
  }

  // Render
  renderGameState();

  // Update camera to follow player
  const playerEntityId = gameState.players[1];
  if (playerEntityId !== undefined) {
    const player = gameState.entities[playerEntityId];
    if (player) {
      camera.position.x = player.position.x;
      camera.position.y = player.position.y;
    }
  }

  renderer.render(scene, camera);

  requestAnimationFrame(animate);
}

// Handle window resize
window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.left = -window.innerWidth / 2;
  camera.right = window.innerWidth / 2;
  camera.top = window.innerHeight / 2;
  camera.bottom = -window.innerHeight / 2;
  camera.updateProjectionMatrix();
});

// Start the game loop
requestAnimationFrame(animate);

console.log("✓ Local game initialized. Controls: WASD to move, Space to fire");
