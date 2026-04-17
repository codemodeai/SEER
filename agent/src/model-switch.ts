/**
 * settings.json Model Switching.
 * Atomically writes the target model to ~/.claude/settings.json before Claude execution,
 * then restores the original model after. Handles crash recovery on startup.
 */

import { readFileSync, writeFileSync, existsSync, renameSync } from "fs";
import { homedir, tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";

const SETTINGS_PATH = join(homedir(), ".claude", "settings.json");
const SEER_STATE_PATH = join(homedir(), ".seer", "model-state.json");

interface ClaudeSettings {
  model?: string;
  [key: string]: unknown;
}

interface ModelState {
  originalModel: string;
  switchedAt: number;
}

function readSettings(): ClaudeSettings {
  if (!existsSync(SETTINGS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(SETTINGS_PATH, "utf8")) as ClaudeSettings;
  } catch {
    return {};
  }
}

function writeAtomic(path: string, content: string): void {
  const tmp = join(tmpdir(), `seer-${randomBytes(8).toString("hex")}.tmp`);
  writeFileSync(tmp, content, "utf8");
  renameSync(tmp, path);
}

export function getCurrentModel(): string {
  const settings = readSettings();
  return settings.model ?? "claude-opus-4";
}

export function switchModel(targetModel: string): void {
  const settings = readSettings();
  const original = settings.model ?? "claude-opus-4";

  // Persist original model so we can restore on crash
  writeAtomic(
    SEER_STATE_PATH,
    JSON.stringify({ originalModel: original, switchedAt: Date.now() } satisfies ModelState)
  );

  settings.model = targetModel;
  writeAtomic(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

export function restoreModel(): void {
  if (!existsSync(SEER_STATE_PATH)) return;

  try {
    const state = JSON.parse(readFileSync(SEER_STATE_PATH, "utf8")) as ModelState;
    const settings = readSettings();
    settings.model = state.originalModel;
    writeAtomic(SETTINGS_PATH, JSON.stringify(settings, null, 2));
  } finally {
    // Remove state file whether restore succeeded or not
    try {
      writeFileSync(SEER_STATE_PATH, "", "utf8");
    } catch {
      // ignore
    }
  }
}

/** Called on agent startup — detects if a previous run crashed mid-switch and restores. */
export function crashRecovery(): boolean {
  if (!existsSync(SEER_STATE_PATH)) return false;

  try {
    const raw = readFileSync(SEER_STATE_PATH, "utf8").trim();
    if (!raw) return false;

    const state = JSON.parse(raw) as ModelState;
    const ageMs = Date.now() - state.switchedAt;

    // If state file is older than 10 minutes, assume crash — restore
    if (ageMs > 10 * 60 * 1000) {
      restoreModel();
      return true;
    }
  } catch {
    // Corrupt state file — safe to ignore
  }
  return false;
}
