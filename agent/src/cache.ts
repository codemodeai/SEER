/**
 * Local Instruction Cache.
 * SHA-256 hashes the normalized user intent, stores the MCP instruction JSON
 * in ~/.seer/cache/ with a 7-day TTL. Eliminates repeat MCP calls for identical tasks.
 */

import { createHash } from "crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  unlinkSync,
} from "fs";
import { join } from "path";
import { homedir } from "os";
import type { CacheEntry, MCPInstruction } from "./types.js";

const CACHE_DIR = join(homedir(), ".seer", "cache");
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function intentHash(text: string): string {
  const normalized = text.toLowerCase().trim().replace(/\s+/g, " ");
  return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}

function cachePath(hash: string): string {
  return join(CACHE_DIR, `${hash}.json`);
}

export function getCached(intentText: string): MCPInstruction | null {
  ensureCacheDir();
  const hash = intentHash(intentText);
  const path = cachePath(hash);

  if (!existsSync(path)) return null;

  try {
    const entry = JSON.parse(readFileSync(path, "utf8")) as CacheEntry;
    const age = Date.now() - entry.createdAt;
    if (age > entry.ttlMs) {
      unlinkSync(path);
      return null;
    }
    return entry.instruction;
  } catch {
    return null;
  }
}

export function setCached(intentText: string, instruction: MCPInstruction): void {
  ensureCacheDir();
  const hash = intentHash(intentText);
  const entry: CacheEntry = {
    instruction,
    createdAt: Date.now(),
    ttlMs: TTL_MS,
  };
  writeFileSync(cachePath(hash), JSON.stringify(entry), "utf8");
}

/** Invalidate all cache entries — called when user runs seer memory update */
export function invalidateAll(): void {
  ensureCacheDir();
  for (const file of readdirSync(CACHE_DIR)) {
    if (file.endsWith(".json")) {
      try { unlinkSync(join(CACHE_DIR, file)); } catch { /* ignore */ }
    }
  }
}

/** Remove expired entries — run on startup */
export function pruneExpired(): void {
  ensureCacheDir();
  for (const file of readdirSync(CACHE_DIR)) {
    if (!file.endsWith(".json")) continue;
    const path = join(CACHE_DIR, file);
    try {
      const entry = JSON.parse(readFileSync(path, "utf8")) as CacheEntry;
      if (Date.now() - entry.createdAt > entry.ttlMs) {
        unlinkSync(path);
      }
    } catch {
      unlinkSync(path);
    }
  }
}
