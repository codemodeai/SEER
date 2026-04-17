/**
 * Agent Auto-Update Checker.
 * On startup, checks GitHub releases for a newer agent binary version.
 * If an update is available, emits an event to the Desktop App via IPC.
 * The Desktop App then downloads and swaps the binary via Tauri's updater plugin.
 */

import { ipc } from "./ipc.js";

const GITHUB_RELEASES_URL =
  "https://api.github.com/repos/codemodeai/seer/releases/latest";

// Injected at build time by the CI pipeline
const CURRENT_VERSION = process.env["AGENT_VERSION"] ?? "1.0.0";

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  assets: Array<{ name: string; browser_download_url: string }>;
}

function semverGt(a: string, b: string): boolean {
  const parse = (v: string) => v.replace(/^v/, "").split(".").map(Number);
  const [aMajor = 0, aMinor = 0, aPatch = 0] = parse(a);
  const [bMajor = 0, bMinor = 0, bPatch = 0] = parse(b);
  if (aMajor !== bMajor) return aMajor > bMajor;
  if (aMinor !== bMinor) return aMinor > bMinor;
  return aPatch > bPatch;
}

export async function checkForUpdates(): Promise<void> {
  try {
    const res = await fetch(GITHUB_RELEASES_URL, {
      headers: { "User-Agent": "seer-agent" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return;

    const release = (await res.json()) as GitHubRelease;
    const latestVersion = release.tag_name.replace(/^v/, "");

    if (semverGt(latestVersion, CURRENT_VERSION)) {
      ipc.sendUpdateAvailable(latestVersion, release.html_url);
    }
  } catch {
    // Network unavailable or rate-limited — silently skip
  }
}
