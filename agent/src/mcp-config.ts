/**
 * MCP Auto-Config Writer.
 * Writes the SEER MCP URL + Bearer token into each AI tool's config file.
 * Called when the user clicks a "Connect" button in the Desktop App Settings tab.
 */

import { existsSync, readFileSync, mkdirSync } from "fs";
import { writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { AITool } from "./types.js";

const MCP_URL = process.env["SEER_MCP_BASE"] ?? "https://www.seermcp.com";
const MCP_ENDPOINT = `${MCP_URL}/api/mcp`;

function writeJson(path: string, data: unknown): void {
  const dir = path.substring(0, path.lastIndexOf("/") || path.lastIndexOf("\\"));
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2), "utf8");
}

function readJsonSafe(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try { return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>; }
  catch { return {}; }
}

const SEER_MCP_BLOCK = (apiKey: string) => ({
  command: "node",
  args: [],
  url: MCP_ENDPOINT,
  env: { SEER_API_KEY: apiKey },
  transportType: "http",
  headers: { Authorization: `Bearer ${apiKey}` },
});

export function connectTool(tool: AITool, apiKey: string): string {
  const home = homedir();

  switch (tool) {
    case "claude-cli": {
      // Claude Code CLI: ~/.claude/mcp.json
      const path = join(home, ".claude", "mcp.json");
      const existing = readJsonSafe(path);
      const mcpServers = (existing["mcpServers"] as Record<string, unknown>) ?? {};
      mcpServers["seer"] = SEER_MCP_BLOCK(apiKey);
      writeJson(path, { ...existing, mcpServers });
      return path;
    }

    case "claude-desktop": {
      // Claude Desktop: platform-specific config path
      const configPath = process.platform === "darwin"
        ? join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json")
        : process.platform === "win32"
        ? join(home, "AppData", "Roaming", "Claude", "claude_desktop_config.json")
        : join(home, ".config", "Claude", "claude_desktop_config.json");
      const existing = readJsonSafe(configPath);
      const mcpServers = (existing["mcpServers"] as Record<string, unknown>) ?? {};
      mcpServers["seer"] = SEER_MCP_BLOCK(apiKey);
      writeJson(configPath, { ...existing, mcpServers });
      return configPath;
    }

    case "vscode": {
      // VS Code: .mcp.json in home or workspace root
      const path = join(home, ".mcp.json");
      const existing = readJsonSafe(path);
      const mcpServers = (existing["mcpServers"] as Record<string, unknown>) ?? {};
      mcpServers["seer"] = SEER_MCP_BLOCK(apiKey);
      writeJson(path, { ...existing, mcpServers });
      return path;
    }

    case "codex": {
      // OpenAI Codex: ~/.codex/config.toml
      const path = join(home, ".codex", "config.toml");
      const dir = join(home, ".codex");
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const block = `\n[mcp_servers.seer]\nurl = "${MCP_ENDPOINT}"\nbearer_token_env_var = "SEER_API_KEY"\n`;
      const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
      const updated = existing.includes("[mcp_servers.seer]")
        ? existing.replace(/\[mcp_servers\.seer\][\s\S]*?(?=\[|\s*$)/, block)
        : existing + block;
      writeFileSync(path, updated, "utf8");
      return path;
    }

    case "cursor": {
      // Cursor: .cursor/mcp.json (project root first, fallback to home)
      const path = join(home, ".cursor", "mcp.json");
      const existing = readJsonSafe(path);
      const mcpServers = (existing["mcpServers"] as Record<string, unknown>) ?? {};
      mcpServers["seer"] = SEER_MCP_BLOCK(apiKey);
      writeJson(path, { ...existing, mcpServers });
      return path;
    }

    case "windsurf": {
      // Windsurf: Cascade MCP JSON (~/.codeium/windsurf/mcp_config.json)
      const path = join(home, ".codeium", "windsurf", "mcp_config.json");
      const existing = readJsonSafe(path);
      const mcpServers = (existing["mcpServers"] as Record<string, unknown>) ?? {};
      mcpServers["seer"] = SEER_MCP_BLOCK(apiKey);
      writeJson(path, { ...existing, mcpServers });
      return path;
    }

    case "antigravity": {
      // Antigravity: mcp_config.json in home
      const path = join(home, "mcp_config.json");
      const existing = readJsonSafe(path);
      const mcpServers = (existing["mcpServers"] as Record<string, unknown>) ?? {};
      mcpServers["seer"] = { ...SEER_MCP_BLOCK(apiKey), serverUrl: MCP_ENDPOINT };
      writeJson(path, { ...existing, mcpServers });
      return path;
    }

    case "lovable": {
      // Lovable: .lovable/mcp.json
      const path = join(home, ".lovable", "mcp.json");
      const existing = readJsonSafe(path);
      const mcpServers = (existing["mcpServers"] as Record<string, unknown>) ?? {};
      mcpServers["seer"] = SEER_MCP_BLOCK(apiKey);
      writeJson(path, { ...existing, mcpServers });
      return path;
    }

    default: {
      const _: never = tool;
      throw new Error(`Unknown tool: ${String(_)}`);
    }
  }
}
