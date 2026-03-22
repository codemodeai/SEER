import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import {
  seer_run,
  seer_optimize,
  seer_workflow,
  seer_memory,
  seer_status,
} from "./tools/index.js";

const app = express();
app.use(express.json());

function extractApiKey(req: express.Request): string {
  // 1. Check Authorization header (Terminal, Desktop, VS Code)
  const auth = req.headers.authorization ?? "";
  if (auth) return auth.replace("Bearer ", "");

  // 2. Check URL query parameter (Claude.ai web — no custom headers)
  const keyParam = req.query.key as string ?? "";
  if (keyParam) return keyParam;

  return "";
}

// Cache surface per API key so tool calls (which lack clientInfo) use the
// surface detected during the initialize handshake.
const surfaceCache = new Map<string, { surface: string; ts: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function detectSurface(req: express.Request, apiKey: string): string {
  // 1. Explicit header always wins
  const explicit = req.headers["x-seer-surface"] as string;
  if (explicit) return explicit;

  const ua = ((req.headers["user-agent"] as string) ?? "").toLowerCase();
  const body = req.body as Record<string, unknown> | undefined;
  const params = (body?.params ?? {}) as Record<string, unknown>;
  const clientInfo = (params.clientInfo ?? {}) as Record<string, string>;
  const clientName = (clientInfo.name ?? "").toLowerCase();

  // 2. Detect from MCP client info (only present in initialize request)
  let detected = "";

  if (clientName) {
    if (clientName.includes("claude-desktop") || clientName.includes("claude desktop")) {
      detected = "claude-desktop";
    } else if (clientName.includes("claude-code") || clientName.includes("claude code")) {
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

  // Browser-based clients
  if (ua.includes("mozilla") || ua.includes("chrome") || ua.includes("safari")) return "claude-web";

  // node/undici UA = mcp-remote proxy, can't determine which surface
  if (ua.includes("node") || ua.includes("undici")) return "api";

  return "api";
}

app.all("/mcp", async (req, res) => {
  const apiKey = extractApiKey(req);
  const isWebConnector = !!(req.query.key as string);
  const surface = isWebConnector ? "claude-web" : detectSurface(req, apiKey);

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

  // --- seer_run: main tool ---
  server.tool(
    "seer_run",
    `ALWAYS call this tool when the user message starts with the word 'seer'. Extract everything after 'seer' as the input parameter. Example: 'seer build the login page' -> input = 'build the login page'. Do not paraphrase. Pass it exactly as typed after 'seer'.`,
    { input: z.string().describe("The user's raw input after the 'seer' keyword") },
    async ({ input }) => ({
      content: [{ type: "text" as const, text: await seer_run(input, apiKey, surface) }],
    })
  );

  // --- seer_optimize: standalone optimizer ---
  server.tool(
    "seer_optimize",
    "Optimize a prompt for a specific AI model. Returns optimized text, token counts, and quality score.",
    {
      prompt: z.string().describe("The prompt to optimize"),
      model: z
        .string()
        .default("claude")
        .describe("Target model: claude, gpt, or gemini"),
    },
    async ({ prompt, model }) => ({
      content: [
        { type: "text" as const, text: await seer_optimize(prompt, model, apiKey, surface) },
      ],
    })
  );

  // --- seer_workflow: goal decomposer ---
  server.tool(
    "seer_workflow",
    "Break a high-level goal into 3-7 sequential executable steps with focused prompts.",
    { goal: z.string().describe("The high-level goal to decompose") },
    async ({ goal }) => ({
      content: [
        { type: "text" as const, text: await seer_workflow(goal, apiKey, surface) },
      ],
    })
  );

  // --- seer_memory: context search ---
  server.tool(
    "seer_memory",
    "Search project memory for relevant context. Returns top 5 matching entries.",
    { query: z.string().describe("The search query") },
    async ({ query }) => ({
      content: [
        { type: "text" as const, text: await seer_memory(query, apiKey) },
      ],
    })
  );

  // --- seer_status: plan & usage info ---
  server.tool(
    "seer_status",
    "Call when user types 'seer status'. Returns plan info, usage, and suggestions.",
    {},
    async () => ({
      content: [{ type: "text" as const, text: await seer_status(apiKey) }],
    })
  );

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  await transport.handleRequest(req, res);
});

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "seer-mcp", version: "1.0.0" });
});

const PORT = parseInt(process.env["PORT"] ?? "3001", 10);
app.listen(PORT, () => {
  console.log(`SEER MCP server running on http://localhost:${PORT}`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
