import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { io } from "socket.io-client";

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

// Ground plane
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

// Placeholder character (will be replaced with Higgsfield model)
const charGeometry = new THREE.BoxGeometry(1, 2, 1);
const charMaterial = new THREE.MeshStandardMaterial({ color: 0xe89040 }); // Orange
const testChar = new THREE.Mesh(charGeometry, charMaterial);
scene.add(testChar);

// Network
const socket = io("http://localhost:3001");
let playerId: string | null = null;
let gameState: any = { players: [] };

socket.on("connect", () => {
  console.log("Connected to server");
  socket.emit("join", { character: "test_cat" });
  updateUI("status", "Connected");
});

socket.on("joined", (data) => {
  playerId = data.playerId;
  console.log(`Joined as ${playerId}`);
});

socket.on("snapshot", (snapshot) => {
  gameState = snapshot;
  updateUI("tick", String(snapshot.tick));
  updateUI("players", String(snapshot.players.length));
});

socket.on("disconnect", () => {
  updateUI("status", "Disconnected");
});

// FPS counter
let frameCount = 0;
let lastTime = Date.now();

function updateUI(id: string, text: string) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function animate() {
  requestAnimationFrame(animate);

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

animate();
