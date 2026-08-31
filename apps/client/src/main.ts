import * as THREE from "three";
import { createInitialState, step } from "@mercicat/simulation";
import { SeededRandom, TICK_RATE } from "@mercicat/shared";
import type { GameState, InputCommand } from "@mercicat/shared";
import { GameRenderer, gameStateToRender } from "@mercicat/client";

const LOCAL_PLAYER_ID = 1;
const SEED = 12345;
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setClearColor(0x1a1a1e);

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
camera.position.z = 10;
const scene = new THREE.Scene();
scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
directionalLight.position.set(10, 10, 10);
scene.add(directionalLight);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshStandardMaterial({ color: 0x2a2a30 }));
scene.add(ground);

let rng = new SeededRandom(SEED);
let state: GameState = createInitialState(SEED, [LOCAL_PLAYER_ID]);
const gameRenderer = new GameRenderer(scene);
const keys = new Set<string>();
let mouseWorldPos = { x: 0, y: 0 };

const status = document.getElementById("status")!;
const tickValue = document.getElementById("tick")!;
const fpsValue = document.getElementById("fps")!;
const waveValue = document.getElementById("wave")!;
const playersValue = document.getElementById("players")!;
const enemiesValue = document.getElementById("enemies")!;
const healthValue = document.getElementById("health")!;
const scoreValue = document.getElementById("score")!;
const phaseValue = document.getElementById("phase")!;
const endScreen = document.getElementById("end-screen")!;
const endMessage = document.getElementById("end-message")!;
const restartButton = document.getElementById("restart") as HTMLButtonElement;

function updateMouseWorldPosition(event: MouseEvent): void {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  const screenX = event.clientX - rect.left;
  const screenY = event.clientY - rect.top;
  mouseWorldPos = {
    x: camera.position.x + (screenX / rect.width - 0.5) * (camera.right - camera.left),
    y: camera.position.y + (0.5 - screenY / rect.height) * (camera.top - camera.bottom),
  };
}
canvas.addEventListener("mousemove", updateMouseWorldPosition);
window.addEventListener("keydown", (event) => keys.add(event.key.toLowerCase()));
window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));

function sampleInput(): InputCommand[] {
  const commands: InputCommand[] = [];
  let dx = 0; let dy = 0;
  if (keys.has("w")) dy += 1;
  if (keys.has("s")) dy -= 1;
  if (keys.has("a")) dx -= 1;
  if (keys.has("d")) dx += 1;
  const length = Math.hypot(dx, dy);
  // Always send a movement state sample, including zero, so key release is
  // represented explicitly at the simulation tick.
  commands.push({ type: "move", tick: state.tick, playerId: LOCAL_PLAYER_ID, direction: length > 0 ? { x: dx / length, y: dy / length } : { x: 0, y: 0 } });
  if (keys.has(" ")) {
    const player = state.entities[state.players[LOCAL_PLAYER_ID]];
    if (player?.kind === "player") {
      const angle = Math.atan2(mouseWorldPos.y - player.position.y, mouseWorldPos.x - player.position.x);
      commands.push({ type: "fire", tick: state.tick, playerId: LOCAL_PLAYER_ID, direction: { x: Math.cos(angle), y: Math.sin(angle) } });
    }
  }
  return commands;
}

function updateHud(context: ReturnType<typeof gameStateToRender>): void {
  const health = context.localPlayer?.health ?? 0;
  tickValue.textContent = String(state.tick);
  status.textContent = context.hud.phase === "playing" ? "Playing" : context.hud.phase;
  status.style.color = context.hud.phase === "playing" ? "#00ff00" : "#ff8080";
  fpsValue.textContent = "60";
  waveValue.textContent = String(context.hud.wave);
  playersValue.textContent = context.localPlayer ? "1" : "0";
  enemiesValue.textContent = String(context.hud.enemiesRemaining);
  healthValue.textContent = `${Math.ceil(health)} / 100`;
  scoreValue.textContent = String(context.hud.score);
  phaseValue.textContent = context.hud.phase;
  if (context.hud.phase === "playing") {
    endScreen.classList.remove("visible");
  } else {
    endMessage.textContent = context.hud.phase === "victory" ? "Victory! Wave 5 Complete" : "Defeated! Enemies Won";
    endScreen.classList.add("visible");
  }
}

function restart(): void {
  state = createInitialState(SEED, [LOCAL_PLAYER_ID]);
  rng = new SeededRandom(SEED);
  accumulator = 0;
  previousTime = performance.now();
  keys.clear();
  camera.position.set(0, 0, 10);
  endScreen.classList.remove("visible");
}
restartButton.addEventListener("click", restart);

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);
  camera.left = -width / 2;
  camera.right = width / 2;
  camera.top = height / 2;
  camera.bottom = -height / 2;
  camera.updateProjectionMatrix();
  updateMouseWorldPosition(new MouseEvent("mousemove", { clientX: width / 2, clientY: height / 2 }));
}
window.addEventListener("resize", resize);
resize();

const tickDuration = 1000 / TICK_RATE;
let accumulator = 0;
let previousTime = performance.now();
function frame(now: number): void {
  const delta = Math.min(now - previousTime, tickDuration * 5);
  previousTime = now;
  accumulator += delta;
  while (accumulator >= tickDuration) {
    state = step(state, sampleInput(), { rng }).state;
    accumulator -= tickDuration;
  }
  const context = gameStateToRender(state, LOCAL_PLAYER_ID);
  gameRenderer.render(context);
  updateHud(context);
  const player = state.entities[state.players[LOCAL_PLAYER_ID]];
  if (player?.kind === "player") {
    camera.position.x = player.position.x;
    camera.position.y = player.position.y;
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
console.log("✓ Local game initialized", { seed: SEED, tickRate: TICK_RATE });
