import * as THREE from "three";
import { io, Socket } from "socket.io-client";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x1a1a1e);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(
  -960 / 2,
  960 / 2,
  640 / 2,
  -640 / 2,
  0.1,
  1000
);
camera.position.z = 10;

// Ground
const groundGeometry = new THREE.PlaneGeometry(1920, 1280);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2a30 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
scene.add(ground);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
directionalLight.position.set(10, 10, 10);
scene.add(directionalLight);

// Game state
interface GameEntity {
  mesh: THREE.Mesh;
  health?: number;
  maxHealth?: number;
}

const entities: Map<string, GameEntity> = new Map();
let socket: Socket | null = null;
let playerId: string | null = null;
let matchId: string = "default";
let lastSnapshot: any = null;

// Input state
const keys = new Set<string>();
window.addEventListener("keydown", (e) => {
  keys.add(e.key.toLowerCase());
});
window.addEventListener("keyup", (e) => {
  keys.delete(e.key.toLowerCase());
});

// Mouse state for attack direction
let mouseX = 0;
let mouseY = 0;
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = (e.clientX - rect.left) / rect.width;
  mouseY = (e.clientY - rect.top) / rect.height;
});

// Connect to server
function connect() {
  socket = io("http://localhost:3001");

  socket.on("connect", () => {
    console.log("Connected to server");
    updateUI("status", "Connecting to match...");
    socket!.emit("join_match", { matchId });
  });

  socket.on("joined", (data) => {
    playerId = data.playerId;
    console.log(`Joined as ${playerId}`);
    updateUI("status", "Connected");
  });

  socket.on("player_joined", (data) => {
    console.log(`Player joined. Total: ${data.count}`);
  });

  socket.on("snapshot", (snapshot) => {
    lastSnapshot = snapshot;
    updateUI("tick", String(snapshot.tick));
    updateUI("wave", String(snapshot.wave));
    updateUI("players", String(snapshot.players.length));
    updateUI("enemies", String(snapshot.enemies.length));

    // Update entities
    renderSnapshot(snapshot);
  });

  socket.on("disconnect", () => {
    updateUI("status", "Disconnected");
  });
}

function renderSnapshot(snapshot: any) {
  // Update players
  for (const player of snapshot.players) {
    if (!entities.has(player.id)) {
      const geom = new THREE.BoxGeometry(30, 60, 30);
      const mat = new THREE.MeshStandardMaterial({
        color: player.id === playerId ? 0x4080f0 : 0xa0a0a0,
      });
      const mesh = new THREE.Mesh(geom, mat);
      scene.add(mesh);
      entities.set(player.id, { mesh, health: player.health, maxHealth: player.maxHealth });
    }

    const entity = entities.get(player.id)!;
    entity.mesh.position.set(player.position.x, player.position.y, 0);
    entity.mesh.visible = player.alive;
    entity.health = player.health;
  }

  // Update enemies
  for (const enemy of snapshot.enemies) {
    if (!entities.has(enemy.id)) {
      const geom = new THREE.BoxGeometry(25, 50, 25);
      const mat = new THREE.MeshStandardMaterial({ color: 0xff6040 });
      const mesh = new THREE.Mesh(geom, mat);
      scene.add(mesh);
      entities.set(enemy.id, { mesh, health: enemy.health, maxHealth: enemy.maxHealth });
    }

    const entity = entities.get(enemy.id)!;
    entity.mesh.position.set(enemy.position.x, enemy.position.y, 0);
    entity.mesh.visible = enemy.alive;
    entity.health = enemy.health;
  }

  // Draw projectiles as small spheres
  for (const projectile of snapshot.projectiles) {
    if (!entities.has(projectile.id)) {
      const geom = new THREE.SphereGeometry(projectile.radius, 8, 8);
      const mat = new THREE.MeshStandardMaterial({ color: 0xffff00 });
      const mesh = new THREE.Mesh(geom, mat);
      scene.add(mesh);
      entities.set(projectile.id, { mesh });
    }

    const entity = entities.get(projectile.id)!;
    entity.mesh.position.set(projectile.position.x, projectile.position.y, 1);
  }

  // Remove dead entities
  for (const [id, entity] of entities) {
    const exists =
      snapshot.players.find((p: any) => p.id === id) ||
      snapshot.enemies.find((e: any) => e.id === id) ||
      snapshot.projectiles.find((p: any) => p.id === id);

    if (!exists) {
      scene.remove(entity.mesh);
      entities.delete(id);
    }
  }
}

function updateUI(id: string, text: string) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// Main loop
let frameCount = 0;
let lastTime = Date.now();

function animate() {
  requestAnimationFrame(animate);

  // Send input every frame
  if (socket && playerId) {
    let moveDirection = { x: 0, y: 0 };

    if (keys.has("w") || keys.has("arrowup")) moveDirection.y += 1;
    if (keys.has("s") || keys.has("arrowdown")) moveDirection.y -= 1;
    if (keys.has("a") || keys.has("arrowleft")) moveDirection.x -= 1;
    if (keys.has("d") || keys.has("arrowright")) moveDirection.x += 1;

    // Normalize
    const len = Math.sqrt(moveDirection.x ** 2 + moveDirection.y ** 2);
    if (len > 0) {
      moveDirection.x /= len;
      moveDirection.y /= len;
    }

    // Attack towards mouse
    const centerX = 0.5;
    const centerY = 0.5;
    let attackDirection = { x: mouseX - centerX, y: centerY - mouseY };
    const alen = Math.sqrt(attackDirection.x ** 2 + attackDirection.y ** 2);
    if (alen > 0.1) {
      attackDirection.x /= alen;
      attackDirection.y /= alen;
    } else {
      attackDirection = { x: 0, y: 0 };
    }

    socket.emit("input", { moveDirection, attackDirection });
  }

  renderer.render(scene, camera);

  frameCount++;
  const now = Date.now();
  if (now - lastTime > 1000) {
    updateUI("fps", String(frameCount));
    frameCount = 0;
    lastTime = now;
  }
}

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start
connect();
animate();
