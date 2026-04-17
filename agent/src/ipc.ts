/**
 * Tauri IPC Bridge — bidirectional JSON-RPC over stdin/stdout.
 * Tauri sidecar protocol: each message is a newline-delimited JSON object.
 */

import { EventEmitter } from "events";
import type { IPCMessage, IPCResponse } from "./types.js";

class IPCBridge extends EventEmitter {
  private buffer = "";

  constructor() {
    super();
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string) => this.onData(chunk));
    process.stdin.on("end", () => {
      process.exit(0);
    });
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed) as IPCMessage;
        this.emit("message", msg);
      } catch {
        // Malformed line — ignore
      }
    }
  }

  send(response: IPCResponse): void {
    process.stdout.write(JSON.stringify(response) + "\n");
  }

  sendProgress(id: string, text: string): void {
    this.send({ id, type: "progress", payload: { text } });
  }

  sendOutput(id: string, text: string, nextSteps: string[]): void {
    this.send({ id, type: "output", payload: { text, nextSteps } });
  }

  sendError(id: string, message: string): void {
    this.send({ id, type: "error", payload: { message } });
  }

  sendStatus(id: string, status: Record<string, unknown>): void {
    this.send({ id, type: "status", payload: status });
  }

  sendNetworkStatus(online: boolean): void {
    this.send({ id: "system", type: "network-status", payload: { online } });
  }

  sendUpdateAvailable(version: string, url: string): void {
    this.send({ id: "system", type: "update-available", payload: { version, url } });
  }
}

export const ipc = new IPCBridge();
