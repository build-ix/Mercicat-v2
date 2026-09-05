# 🎮 Mercicat v2 — Quick Start

## Play Right Now

```
Double-click this file:
C:\Users\alfr\Documents\GitHub\Mercicat-v2\release\mercicat-v2-windows.exe

Game launches in 2 seconds → Full 3D arena → WASD + Mouse to play
```

## Controls

```
WASD        → Move around arena
MOUSE       → Aim at enemies
LEFT CLICK  → Fire weapon
SPACE       → Alternative fire
```

## What You'll See

**Your Character (Blue Cat)**
- Spawns in center of arena
- 100 HP at start
- Get near enemies to fight

**Enemies (Red Rats)**
- Spawn around the arena
- Come in 3 sizes: Small, Medium, Large
- Each wave gets harder

**Arena**
- Glowing center (blue)
- Red danger zones at corners
- Walls to keep combat contained
- Beautiful lighting + shadows

## Gameplay

1. **Wave 1:** 5 basic rats
2. **Wave 2:** Mix of basic + giant + swift rats
3. **Wave 3:** Harder variants

Kill enemies → survive the wave → victory!

## Features

✅ Full 3D graphics (Three.js)  
✅ Smooth combat mechanics  
✅ Real-time HUD (health, score, wave)  
✅ Modern sci-fi UI  
✅ Deterministic (same seed = same game)  
✅ Ready for multiplayer (coming soon)  

## Troubleshooting

**Game won't launch?**
- Make sure no other instance is running
- Check Windows Defender (first-run scan)

**Lag or low FPS?**
- Update GPU drivers
- Close other apps

**Want to rebuild from source?**
```bash
cd C:\Users\alfr\Documents\GitHub\Mercicat-v2
pnpm run build
node dist-electron/server.cjs  # or double-click .exe
```

## Architecture

- **Engine:** Node.js (server) + Three.js (client) + Electron (app)
- **Network:** Socket.io (ready for multiplayer)
- **Replay:** Fully deterministic (seed-based)
- **Physics:** Collision radius + velocity-based movement
- **AI:** Enemy pathfinding + attack patterns

## What's New (2026-09-04)

✅ **Phase 3B Balance Fix** — Can now spawn way more enemies per wave (was bottlenecked at 20% budget utilization, now 100%)  
✅ **3D Arena** — Full 1000×1000 playable environment with walls and lighting  
✅ **Character Models** — Blue player cat + red enemy rats (3D mesh)  
✅ **Modern UI** — Gradient borders, glow effects, smooth animations  
✅ **Weapon Variety** — 3 attack types with different fire rates  
✅ **Enemy Variants** — Small/medium/large rats with different behaviors  

## Performance

- **FPS:** 60 stable
- **Startup:** 2 seconds
- **Memory:** ~150 MB
- **File Size:** 96 MB (portable)

## Next

- 20-wave campaign (currently: 3 waves)
- Economy system (shop/upgrades)
- Multiplayer (2-4 players)
- Sound effects
- Procedural difficulty scaling

---

## Keyboard Shortcut

Want to run it from anywhere?

```powershell
# Add to PATH or create shortcut:
"C:\Users\alfr\Documents\GitHub\Mercicat-v2\release\mercicat-v2-windows.exe"
```

---

**Enjoy!** 🎮  
Built: 2026-09-04 23:29  
Status: ✅ Playable, ready to extend
