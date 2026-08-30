# Mercicat v2 — Vertical Slice

A deterministic, server-authoritative multiplayer arena game built with TypeScript, Three.js, Node.js, and Socket.IO.

## Stack

- **Language:** TypeScript (monorepo)
- **Rendering:** Three.js (WebGL, orthographic camera)
- **Networking:** Socket.IO (30 Hz server ticks)
- **Build:** Vite (client), ts-node (server)
- **Package Manager:** pnpm (monorepo workspaces)

## Project Structure

```
packages/
  shared/          # Branded types, vectors, RNG, constants
  content/         # Character/enemy/attack/wave definitions
  simulation/      # Deterministic game rules (no I/O)
  protocol/        # Network message schemas (Zod)

apps/
  server/          # Node.js + Socket.IO authoritative server
  client/          # Vite + Three.js browser client
```

## What Works

✓ Deterministic simulation (player movement, enemy AI, projectiles, waves)
✓ Authoritative server at 30 Hz
✓ Client receives snapshots and renders them
✓ WASD movement, mouse aim/attack
✓ Enemy spawning and wave progression
✓ Collision detection and damage
✓ Multiplayer networking

## What's Placeholder

- 3D models (using colored boxes; Higgsfield models pending)
- UI (monospace debug overlay; final design pending)
- Visual effects (basic; particle/animation systems pending)
- Audio (none yet)
- Menus and progression screens (pending game mode design)

## Game Modes (Planned)

1. **Endless Waves** — survive infinite waves, score-based, Brotato-inspired
2. **Adventure** — (design in progress) maze-like progression with combat and exploration

## Getting Started

```bash
git clone https://github.com/build-ix/Mercicat-v2.git
cd Mercicat-v2
pnpm install
pnpm run dev
```

Server: http://localhost:3001 (Socket.IO)
Client: http://localhost:5173 (Vite dev server)

## Controls

- **WASD** — move
- **Mouse** — aim & attack
- Center of screen = reference point for aim direction

## Next Steps

1. Test vertical slice locally (verify gameplay loop works)
2. Generate character models (Higgsfield integration)
3. Implement game mode selection and progression
4. Build adventure mode design
5. Polish UI and visual design

## Architecture Notes

- **Simulation is pure:** no I/O, no dependencies on rendering or networking
- **Server is authoritative:** clients predict presentation but can't affect game state
- **Content is data-driven:** new enemies/weapons are defined in JSON-like objects, not code
- **Rendering is replaceable:** models can swap without changing gameplay
- **Tests verify determinism:** same seed + same inputs = identical state

See individual package READMEs for details.
