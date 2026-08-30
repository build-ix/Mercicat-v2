# Client bundle size decision

The Week 4 client bundle may exceed Vite's 500 kB warning threshold because the
Three.js renderer and Socket.IO client are intentionally shipped in the initial
entry path. This is an advisory warning, not a runtime failure. We accept the
warning for Week 4 and will move Three.js/renderer and networking behind lazy
routes/manual Rollup chunks in Week 5, when rendering integration is scheduled.

Verify with `pnpm --filter @mercicat/client build` and inspect
`apps/client/dist/assets/index-*.js`.
