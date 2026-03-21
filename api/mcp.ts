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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const apiKey = extractApiKey(req);
  const surface = (req.headers["x-seer-surface"] as string) ?? "unknown";
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

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);
  await transport.handleRequest(req, res);
}
