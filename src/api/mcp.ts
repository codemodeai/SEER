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
  seer_session_read,
} from "../tools/index.js";
import { sanitizeInput, scanOutput, logSecurityIncident } from "../lib/security.js";
import { checkRateLimit } from "../lib/rate-limit.js";

function extractApiKey(req: VercelRequest): string {
  const auth = (req.headers.authorization as string) ?? "";
  if (auth) return auth.replace("Bearer ", "");
  const keyParam = (req.query?.key as string) ?? "";
  return keyParam;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Rate limiting
  const ip = (req.headers["x-forwarded-for"] as string) ?? req.socket?.remoteAddress ?? "unknown";
  const apiKey = extractApiKey(req);
  const ipResult = checkRateLimit(`ip:${ip}`);
  const keyResult = apiKey ? checkRateLimit(`key:${apiKey.slice(0, 20)}`) : { allowed: true, remaining: 60 };

  if (!ipResult.allowed || !keyResult.allowed) {
    await logSecurityIncident({
      event_type: "rate_limited",
      source: "mcp",
      ip_address: ip,
      api_key_prefix: apiKey.slice(0, 8),
    });
    res.status(429).json({ error: "Too many requests. Try again in 1 minute." });
    return;
  }

  // CORS
  const origin = req.headers.origin as string;
  const ALLOWED_ORIGINS = ["https://claude.ai", "https://api.anthropic.com"];
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Seer-Surface");
  }
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const surface = (req.headers["x-seer-surface"] as string) ?? "unknown";
  const server = new McpServer({ name: "seer", version: "1.0.0" });

  // Security wrapper
  async function secureToolCall(
    toolName: string,
    input: string,
    handler: () => Promise<string>
  ): Promise<string> {
    const check = sanitizeInput(input);
    if (!check.safe) {
      await logSecurityIncident({
        event_type: "injection_blocked",
        source: "mcp",
        api_key_prefix: apiKey.slice(0, 8),
        payload_snippet: input,
        metadata: { tool: toolName, threat: check.threat },
      });
      return JSON.stringify({ error: "Invalid input detected." });
    }
    const result = await handler();
    const outputCheck = scanOutput(result);
    if (!outputCheck.safe) {
      await logSecurityIncident({
        event_type: "output_danger",
        source: "mcp",
        api_key_prefix: apiKey.slice(0, 8),
        metadata: { tool: toolName, threat: outputCheck.threat },
      });
      return JSON.stringify({ error: "Request could not be processed." });
    }
    return result;
  }

  server.tool(
    "seer_run",
    `ALWAYS call this tool when the user message starts with the word 'seer'. Extract everything after 'seer' as the input parameter. Do not paraphrase. Pass it exactly as typed after 'seer'.`,
    { input: z.string() },
    async ({ input }) => ({
      content: [{ type: "text" as const, text: await secureToolCall("seer_run", input, () => seer_run(input, apiKey, surface)) }],
    })
  );

  server.tool(
    "seer_optimize",
    "Optimize a prompt for a specific AI model.",
    { prompt: z.string(), model: z.string().default("claude") },
    async ({ prompt, model }) => ({
      content: [{ type: "text" as const, text: await secureToolCall("seer_optimize", prompt, () => seer_optimize(prompt, model, apiKey, surface)) }],
    })
  );

  server.tool(
    "seer_workflow",
    "Break a high-level goal into 3-7 sequential steps.",
    { goal: z.string() },
    async ({ goal }) => ({
      content: [{ type: "text" as const, text: await secureToolCall("seer_workflow", goal, () => seer_workflow(goal, apiKey, surface)) }],
    })
  );

  server.tool(
    "seer_memory",
    "Search project memory for relevant context.",
    { query: z.string() },
    async ({ query }) => ({
      content: [{ type: "text" as const, text: await secureToolCall("seer_memory", query, () => seer_memory(query, apiKey)) }],
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

  server.tool(
    "seer_session_read",
    "Summarize the current session and save to .seer_memory.md. Aliases: 'seer read session', 'seer capture session', 'seer save session'.",
    {},
    async () => ({
      content: [{ type: "text" as const, text: await seer_session_read(apiKey, surface) }],
    })
  );

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);
  await transport.handleRequest(req, res);
}
