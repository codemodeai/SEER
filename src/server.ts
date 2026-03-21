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

app.all("/mcp", async (req, res) => {
  const apiKey = extractApiKey(req);
  const surface = (req.headers["x-seer-surface"] as string) ?? "unknown";

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
