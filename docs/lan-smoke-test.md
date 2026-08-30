# Week 4 LAN smoke test

Manual smoke test (the project has no browser-to-browser integration runner yet):

1. On the host LAN machine, run `pnpm dev` and note its LAN address. The Vite
   client is on port 5173 and the Socket.IO server is on its configured port.
2. From a second machine on the same LAN, open `http://<host-lan-ip>:5173`.
3. Open the same URL on the host (or a second LAN client), join the same room,
   and confirm both clients receive the same tick progression and snapshots.
4. Hold movement and fire inputs on each client for at least 30 seconds. Confirm
   there are no disconnect/reconnect loops and both clients converge after a
   deliberately delayed snapshot.

This is intentionally manual until the Week 5 browser integration harness is
available; it exercises the real Vite + Socket.IO LAN path without mocking it.
