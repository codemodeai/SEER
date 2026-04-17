/**
 * Build seer-agent as a standalone Windows .exe using Node.js SEA
 * (Single Executable Application — no Node.js required on user machine).
 *
 * Run: node agent/scripts/build-exe.mjs
 * Output: agent/seer-agent.exe  →  copied to desktop/src-tauri/binaries/ as sidecar
 *
 * Fix: esbuild bundles TypeScript → single CommonJS file first.
 * Node.js SEA requires CJS. The agent uses ESM ("type":"module") so we
 * cannot use tsc output directly — esbuild handles the conversion.
 */

import { execSync } from "child_process";
import { copyFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT       = resolve(__dirname, "..");
const BUNDLE     = join(ROOT, "dist", "bundle.cjs");   // CJS bundle for SEA
const SEA_CONFIG = join(ROOT, "sea-config.json");
const BLOB       = join(ROOT, "sea-prep.blob");
const OUT_EXE    = join(ROOT, "seer-agent.exe");

// Tauri sidecar: must be named {name}-{target-triple}.exe
const SIDECAR_DIR = resolve(ROOT, "..", "desktop", "src-tauri", "binaries");
const SIDECAR_EXE = join(SIDECAR_DIR, "seer-agent-x86_64-pc-windows-msvc.exe");

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit", ...opts });
}

// ── Step 1: Bundle TypeScript → single CJS file via esbuild ───────────────
// esbuild inlines all dependencies (supabase, node-fetch, etc.) into one file.
// --format=cjs is required — Node.js SEA does NOT support ES modules.
// --platform=node keeps built-in modules (fs, crypto, child_process) external.
console.log("\n=== Step 1: Bundle with esbuild (TypeScript → CJS) ===");
mkdirSync(join(ROOT, "dist"), { recursive: true });
run(
  `npx esbuild src/index.ts` +
  ` --bundle` +
  ` --platform=node` +
  ` --target=node22` +
  ` --format=cjs` +
  ` --outfile="${BUNDLE}"` +
  ` --log-level=info`,
  { cwd: ROOT }
);

// ── Step 2: Write SEA config pointing at the CJS bundle ───────────────────
console.log("\n=== Step 2: Write SEA config ===");
writeFileSync(SEA_CONFIG, JSON.stringify({
  main: BUNDLE,
  output: BLOB,
  disableExperimentalSEAWarning: true,
  useSnapshot: false,
  useCodeCache: true,
}, null, 2));

// ── Step 3: Generate SEA blob ──────────────────────────────────────────────
console.log("\n=== Step 3: Generate SEA blob ===");
run(`node --experimental-sea-config "${SEA_CONFIG}"`);

// ── Step 4: Copy node.exe and inject blob ─────────────────────────────────
console.log("\n=== Step 4: Create exe + inject blob ===");
copyFileSync(process.execPath, OUT_EXE);

// Remove code signature on Windows (required before postject injection)
try {
  run(`signtool remove /s "${OUT_EXE}"`);
} catch {
  // signtool not in CI PATH — skip. The exe is unsigned; that's fine for now.
}

run(
  `npx postject "${OUT_EXE}" NODE_SEA_BLOB "${BLOB}"` +
  ` --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`
);

// ── Step 5: Place in Tauri sidecar directory ──────────────────────────────
console.log("\n=== Step 5: Copy sidecar ===");
mkdirSync(SIDECAR_DIR, { recursive: true });
copyFileSync(OUT_EXE, SIDECAR_EXE);

// ── Cleanup ───────────────────────────────────────────────────────────────
try { rmSync(BLOB); } catch { /* ignore */ }
try { rmSync(SEA_CONFIG); } catch { /* ignore */ }

console.log(`\n✓ seer-agent.exe  →  ${OUT_EXE}`);
console.log(`✓ Sidecar placed  →  ${SIDECAR_EXE}`);
