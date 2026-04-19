/**
 * Online/Offline Detection.
 * Pings the SEER MCP health endpoint every 30 seconds.
 * Emits network status changes via IPC so the Desktop App can reflect connectivity.
 */

import { ipc } from "./ipc.js";

const HEALTH_URL = `${process.env["SEER_MCP_BASE"] ?? "https://mcp.seermcp.com"}/health`;
const INTERVAL_MS = 30_000;
const TIMEOUT_MS = 5_000;

let isOnline = true;
let intervalId: ReturnType<typeof setInterval> | null = null;

export function getIsOnline(): boolean {
  return isOnline;
}

async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(HEALTH_URL, {
      method: "GET",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function startNetworkMonitor(): void {
  // Run immediately on start
  checkHealth().then((online) => {
    isOnline = online;
    ipc.sendNetworkStatus(online);
  });

  intervalId = setInterval(async () => {
    const online = await checkHealth();
    if (online !== isOnline) {
      isOnline = online;
      ipc.sendNetworkStatus(online);
    }
  }, INTERVAL_MS);
}

export function stopNetworkMonitor(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
