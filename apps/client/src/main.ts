import * as THREE from "three";
import { TICK_RATE } from "@mercicat/shared";
import type { GameState, InputCommand } from "@mercicat/shared";
import { GameRenderer, gameStateToRender } from "@mercicat/client";
import { NetworkSession } from "./networkSession";

const LOCAL_PLAYER_ID = 1;
const SEED = 12345;
const MAX_FRAME_DELTA_MS = (1000 / TICK_RATE) * 5;
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

const session = new NetworkSession({
  url: `http://${window.location.hostname}:3001`,
  roomId: new URLSearchParams(window.location.search).get("room") ?? "default",
  onStatus: (value) => { status.textContent = value === "joined" ? "Playing" : value; },
  onError: (error) => console.warn("Network protocol error", error),
  useAuthoritativeOnly: true, // Phase 2A: render server state only
});
session.connect();
const gameRenderer = new GameRenderer(scene);
const keys = new Set<string>();
let mouseWorldPos = { x: 0, y: 0 };
let fireRequested = false;
let fps = 0;
let currentState: GameState | null = null;

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
window.addEventListener("keydown", (event) => { const key = event.key.toLowerCase(); if (key === " " && !event.repeat) fireRequested = true; keys.add(key); });
window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
canvas.addEventListener("pointerdown", () => { fireRequested = true; });

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
  const playerId = session.playerId ?? LOCAL_PLAYER_ID;
  commands.push({ type: "move", tick: currentState!.tick, playerId, direction: length > 0 ? { x: dx / length, y: dy / length } : { x: 0, y: 0 } });
  if (fireRequested) {
    const player = currentState!.entities[currentState!.players[playerId]];
    if (player?.kind === "player") {
      const angle = Math.atan2(mouseWorldPos.y - player.position.y, mouseWorldPos.x - player.position.x);
      commands.push({ type: "fire", tick: currentState!.tick, playerId, direction: { x: Math.cos(angle), y: Math.sin(angle) } });
    }
  }
  fireRequested = false;
  return commands;
}

function updateHud(context: ReturnType<typeof gameStateToRender>): void {
  const health = context.localPlayer?.health ?? 0;
  tickValue.textContent = String(currentState!.tick);
  status.textContent = context.hud.phase === "waveActive" ? "Playing" : context.hud.phase;
  status.style.color = context.hud.phase === "waveActive" ? "#00ff00" : "#ff8080";
  fpsValue.textContent = String(Math.round(fps));
  waveValue.textContent = String(context.hud.wave);
  playersValue.textContent = String(Object.keys(currentState?.players ?? {}).length);
  enemiesValue.textContent = String(context.hud.enemiesRemaining);
  healthValue.textContent = `${Math.ceil(health)} / 100`;
  scoreValue.textContent = String(context.hud.score);
  phaseValue.textContent = context.hud.phase;
  if (context.hud.phase === "waveActive") {
    endScreen.classList.remove("visible");
  } else {
    endMessage.textContent = context.hud.phase === "gameOver" ? "Game Over" : "Match starting...";
    endScreen.classList.add("visible");
  }
}

function restart(): void {
  session.reset();
  accumulator = 0;
  previousTime = performance.now();
  keys.clear();
  fireRequested = false;
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
  const delta = Math.min(now - previousTime, MAX_FRAME_DELTA_MS);
  previousTime = now;
  const instantFps = delta > 0 ? 1000 / delta : 0;
  fps = fps === 0 ? instantFps : fps * 0.9 + instantFps * 0.1;
  accumulator += delta;
  currentState = session.state;
  if (!currentState) {
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
    return;
  }
  while (accumulator >= tickDuration) {
    session.step(sampleInput());
    accumulator -= tickDuration;
  }
  // Phase 2A: render authoritative server state only (no prediction/interpolation).
  currentState = session.getRenderableState() ?? session.state;
  if (!currentState) { requestAnimationFrame(frame); return; }
  const localPlayerId = session.playerId ?? LOCAL_PLAYER_ID;
  const context = gameStateToRender(currentState, localPlayerId);
  gameRenderer.render(context);
  updateHud(context);
  const player = currentState.entities[currentState.players[localPlayerId]];
  if (player?.kind === "player") {
    camera.position.x = player.position.x;
    camera.position.y = player.position.y;
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
console.log("✓ Local game initialized", { seed: SEED, tickRate: TICK_RATE });
