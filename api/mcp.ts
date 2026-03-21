import type { VercelRequest, VercelResponse } from "@vercel/node";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import {
  seer_run,
  seer_optimize,
  seer_workflow,
  seer_memory,
  seer_status,
} from "../src/tools/index.js";

function extractApiKey(req: VercelRequest): string {
  const auth = (req.headers.authorization as string) ?? "";
  return auth.replace("Bearer ", "");
}

function detectSurface(req: VercelRequest): string {
  // Check explicit header first
  const explicit = req.headers["x-seer-surface"] as string;
  if (explicit) return explicit;

  const ua = ((req.headers["user-agent"] as string) ?? "").toLowerCase();
  const body = req.body;

  // Detect from MCP client info in initialize request
  const clientName = (body?.params?.clientInfo?.name ?? "").toLowerCase();
  if (clientName.includes("claude-desktop") || clientName.includes("claude desktop")) return "claude-desktop";
  if (clientName.includes("claude-code") || clientName.includes("claude code")) return "claude-code";
  if (clientName.includes("vscode") || clientName.includes("vs code") || clientName.includes("copilot")) return "vscode";
  if (clientName.includes("claude.ai") || clientName.includes("claude-ai")) return "claude-web";
  if (clientName.includes("mcp-remote")) return "claude-desktop";

  // Detect from User-Agent
  if (ua.includes("claude-desktop") || ua.includes("electron")) return "claude-desktop";
  if (ua.includes("claude-code") || ua.includes("claude code")) return "claude-code";
  if (ua.includes("vscode") || ua.includes("vs code")) return "vscode";

  return "api";
}

function createServer(apiKey: string, surface: string): McpServer {
  const server = new McpServer({ name: "seer", version: "1.0.0" });

  server.tool(
    "seer_run",
    `ALWAYS call this tool when the user message starts with the word 'seer'. Extract everything after 'seer' as the input parameter. Do not paraphrase. Pass it exactly as typed after 'seer'.`,
    { input: z.string() },
    async ({ input }) => ({
      content: [{ type: "text" as const, text: await seer_run(input, apiKey, surface) }],
    })
  );

  server.tool(
    "seer_optimize",
    "Optimize a prompt for a specific AI model.",
    { prompt: z.string(), model: z.string().default("claude") },
    async ({ prompt, model }) => ({
      content: [{ type: "text" as const, text: await seer_optimize(prompt, model, apiKey, surface) }],
    })
  );

  server.tool(
    "seer_workflow",
    "Break a high-level goal into 3-7 sequential steps.",
    { goal: z.string() },
    async ({ goal }) => ({
      content: [{ type: "text" as const, text: await seer_workflow(goal, apiKey, surface) }],
    })
  );

  server.tool(
    "seer_memory",
    "Search project memory for relevant context.",
    { query: z.string() },
    async ({ query }) => ({
      content: [{ type: "text" as const, text: await seer_memory(query, apiKey) }],
    })
  );

  server.tool(
    "seer_status",
    "Returns plan info, usage, and suggestions.",
    {},
    async () => ({
      content: [{ type: "text" as const, text: await seer_status(apiKey) }],
    })
  );

  return server;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, Mcp-Session-Id");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method === "GET") {
    res.status(405).json({ error: "Method not allowed. Use POST for MCP requests." });
    return;
  }

  if (req.method === "DELETE") {
    res.status(405).json({ error: "Session management not supported in stateless mode." });
    return;
  }

  const apiKey = extractApiKey(req);
  const surface = detectSurface(req);
  const server = createServer(apiKey, surface);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on("close", () => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
