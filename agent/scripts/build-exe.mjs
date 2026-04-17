/**
 * Build seer-agent as a standalone Windows .exe using Node.js SEA
 * (Single Executable Application — no Node.js required on user machine).
 *
 * Run: node agent/scripts/build-exe.mjs
 * Output: agent/seer-agent.exe (placed into desktop/src-tauri/binaries/ as sidecar)
 *
 * Requires: Node.js 20+, Windows x64 (run in CI on windows-latest runner)
 */

import { execSync } from "child_process";
import { copyFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const DIST = join(ROOT, "dist");
const SEA_CONFIG = join(ROOT, "sea-config.json");
const BLOB = join(ROOT, "sea-prep.blob");
const OUT_EXE = join(ROOT, "seer-agent.exe");

// Tauri sidecar directory: named per target triple convention
// Windows x64: seer-agent-x86_64-pc-windows-msvc.exe
const SIDECAR_DIR = resolve(ROOT, "..", "desktop", "src-tauri", "binaries");
const SIDECAR_EXE = join(SIDECAR_DIR, "seer-agent-x86_64-pc-windows-msvc.exe");

function run(cmd, opts = {}) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: "inherit", ...opts });
}

// 1. Build TypeScript → dist/
console.log("\n=== Step 1: Build TypeScript ===");
run("npm run build", { cwd: ROOT });

// 2. Write SEA config
console.log("\n=== Step 2: Configure SEA ===");
writeFileSync(SEA_CONFIG, JSON.stringify({
  main: join(DIST, "index.js"),
  output: BLOB,
  disableExperimentalSEAWarning: true,
  useSnapshot: false,
  useCodeCache: true,
}, null, 2));

// 3. Generate SEA blob
console.log("\n=== Step 3: Generate SEA blob ===");
run(`node --experimental-sea-config "${SEA_CONFIG}"`);

// 4. Copy node.exe and inject blob
console.log("\n=== Step 4: Inject blob into node.exe ===");
copyFileSync(process.execPath, OUT_EXE);

// Remove existing signature (Windows only)
try {
  run(`signtool remove /s "${OUT_EXE}"`);
} catch {
  // signtool not available in CI — skip
}

run(
  `npx postject "${OUT_EXE}" NODE_SEA_BLOB "${BLOB}" ` +
  `--sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 ` +
  `--macho-segment-name NODE_SEA`
);

// 5. Copy to Tauri sidecar directory
console.log("\n=== Step 5: Place sidecar ===");
if (!existsSync(SIDECAR_DIR)) {
  mkdirSync(SIDECAR_DIR, { recursive: true });
}
copyFileSync(OUT_EXE, SIDECAR_EXE);

console.log(`\n✓ Agent exe built: ${OUT_EXE}`);
console.log(`✓ Sidecar placed:  ${SIDECAR_EXE}`);
