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

// Cache surface per API key so tool calls (which lack clientInfo) use the
// surface detected during the initialize handshake.
const surfaceCache = new Map<string, { surface: string; ts: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function detectSurface(req: VercelRequest, apiKey: string): string {
  // 1. Explicit header always wins
  const explicit = req.headers["x-seer-surface"] as string;
  if (explicit) return explicit;

  const ua = ((req.headers["user-agent"] as string) ?? "").toLowerCase();
  const body = req.body;

  // 2. Detect from MCP client info (only present in initialize request)
  const clientName = (body?.params?.clientInfo?.name ?? "").toLowerCase();
  let detected = "";

  if (clientName) {
    if (clientName.includes("claude-desktop") || clientName.includes("claude desktop")) {
      detected = "claude-desktop";
    } else if (clientName.includes("claude-code") || clientName.includes("claude code")) {
      // Claude Code can run in terminal or VS Code — check UA for specifics
      if (ua.includes("vscode") || ua.includes("vs code") || ua.includes("electron")) {
        detected = "vscode";
      } else {
        detected = "claude-code";
      }
    } else if (clientName.includes("vscode") || clientName.includes("vs code") || clientName.includes("copilot")) {
      detected = "vscode";
    } else if (clientName.includes("claude.ai") || clientName.includes("claude-ai")) {
      detected = "claude-web";
    }
  }

  // 3. If detected from clientInfo, cache it for this API key
  if (detected && apiKey) {
    surfaceCache.set(apiKey, { surface: detected, ts: Date.now() });
    return detected;
  }

  // 4. For tool calls (no clientInfo), check cache from earlier initialize
  if (!clientName && apiKey) {
    const cached = surfaceCache.get(apiKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return cached.surface;
    }
  }

  // 5. Fallback to User-Agent detection
  if (ua.includes("claude-desktop") || ua.includes("electron")) return "claude-desktop";
  if (ua.includes("claude-code") || ua.includes("claude code")) return "claude-code";
  if (ua.includes("vscode") || ua.includes("vs code")) return "vscode";

  // Browser-based clients (Claude.ai web)
  if (ua.includes("mozilla") || ua.includes("chrome") || ua.includes("safari")) return "claude-web";

  // node/undici UA = mcp-remote proxy, but we can't tell which surface without cache
  // Default to "api" instead of assuming claude-desktop
  if (ua.includes("node") || ua.includes("undici")) return "api";

  return "api";
}

function createServer(apiKey: string, surface: string): McpServer {
  const server = new McpServer({
    name: "seer",
    version: "1.0.0",
    instructions: `You are connected to SEER, an AI prompt optimization service.

CRITICAL RULE — You MUST follow this for every user message:
If the user's message begins with the word "seer" (case-insensitive), you MUST call a SEER tool. Do NOT interpret the message yourself. Do NOT handle it directly. Route it to the correct tool:

1. "seer status" → call seer_status
2. "seer optimize ..." → call seer_optimize (pass the text after "optimize" as the prompt)
3. "seer workflow ..." → call seer_workflow (pass the text after "workflow" as the goal)
4. "seer memory ..." → call seer_memory (pass the text after "memory" as the query)
5. "seer <anything else>" → call seer_run (pass EVERYTHING after "seer" as the input, verbatim)

This applies even if "seer" looks like part of a sentence. The word "seer" at the start is ALWAYS a command prefix, never a noun. For example:
- "seer calendar panel was in down, fix it" → call seer_run with input "calendar panel was in down, fix it"
- "seer build a login page" → call seer_run with input "build a login page"
- "seer make it responsive" → call seer_run with input "make it responsive"

After receiving the SEER tool response, execute the optimized instructions returned by SEER.`,
  });

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
  const surface = detectSurface(req, apiKey);
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
