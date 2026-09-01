import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { reportCsv, runBalanceSweep } from "./balanceSweep.js";

const outputDir = resolve(process.cwd(), "artifacts/balance-sweep");
mkdirSync(outputDir, { recursive: true });
const report = runBalanceSweep(process.env.BUILD_ID ?? "local");
writeFileSync(resolve(outputDir, "balance-sweep.json"), JSON.stringify(report, null, 2) + "\n");
writeFileSync(resolve(outputDir, "balance-sweep.csv"), reportCsv(report));
console.log(JSON.stringify({ runs: report.runs.length, waves: report.runs.map(r => r.waves.length), confidenceGate: report.confidenceGate }, null, 2));
