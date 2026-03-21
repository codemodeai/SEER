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
  const auth = req.headers.authorization ?? "";
  return auth.replace("Bearer ", "");
}

function detectSurface(req: express.Request): string {
  const explicit = req.headers["x-seer-surface"] as string;
  if (explicit) return explicit;

  const ua = ((req.headers["user-agent"] as string) ?? "").toLowerCase();
  const body = req.body as Record<string, unknown> | undefined;
  const params = (body?.params ?? {}) as Record<string, unknown>;
  const clientInfo = (params.clientInfo ?? {}) as Record<string, string>;
  const clientName = (clientInfo.name ?? "").toLowerCase();

  if (clientName.includes("claude-desktop") || clientName.includes("claude desktop")) return "claude-desktop";
  if (clientName.includes("claude-code") || clientName.includes("claude code")) return "claude-code";
  if (clientName.includes("vscode") || clientName.includes("vs code") || clientName.includes("copilot")) return "vscode";
  if (clientName.includes("claude.ai") || clientName.includes("claude-ai")) return "claude-web";
  if (clientName.includes("mcp-remote")) return "claude-desktop";

  if (ua.includes("claude-desktop") || ua.includes("electron")) return "claude-desktop";
  if (ua.includes("claude-code") || ua.includes("claude code")) return "claude-code";
  if (ua.includes("vscode") || ua.includes("vs code")) return "vscode";

  // mcp-remote (used by Claude Desktop) sends node-fetch or undici UA
  if (ua.includes("node") || ua.includes("undici")) return "claude-desktop";

  // Browser-based clients (Claude.ai web)
  if (ua.includes("mozilla") || ua.includes("chrome") || ua.includes("safari")) return "claude-web";

  return "api";
}

app.all("/mcp", async (req, res) => {
  const apiKey = extractApiKey(req);
  const surface = detectSurface(req);

  const server = new McpServer({ name: "seer", version: "1.0.0" });

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
