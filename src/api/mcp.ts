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
  seer_memory_run,
  seer_tools,
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
  const server = new McpServer(
    { name: "seer", version: "1.0.0" },
    {
      instructions: `You are connected to SEER, an AI prompt optimization service.

CRITICAL RULE — You MUST follow this for every user message:
If the user's message begins with the word "seer" (case-insensitive), you MUST call a SEER tool. Do NOT interpret the message yourself. Do NOT handle it directly. Route it to the correct tool:

1. "seer tools" → call seer_tools (shows all active tools and features)
2. "seer status" → call seer_status
2. "seer optimize ..." → call seer_optimize (pass the text after "optimize" as the prompt)
3. "seer workflow ..." → call seer_workflow (pass the text after "workflow" as the goal)
4. "seer memory ..." → call seer_memory (pass the text after "memory" as the query)
5. "seer session read" / "seer read session" / "seer capture session" / "seer save session" → call seer_session_read
6. "seer memory run" → call seer_memory_run (initializes .seer_memory.md for the project)
7. "seer continue" / "seer resume" / "seer where was i" / "seer what's next" → call seer_run with the keyword (e.g. input = "continue"). This triggers a session resume from .seer_memory.md.
8. "seer what did i do" / "seer recall" / "seer recap" / "seer history" / "seer show tasks" / "seer what's left" → call seer_run with the phrase (e.g. input = "what did i do"). This triggers callback memory recall from .seer_memory.md.
10. "seer <anything else>" → call seer_run (pass EVERYTHING after "seer" as the input, verbatim)

This applies even if "seer" looks like part of a sentence. The word "seer" at the start is ALWAYS a command prefix, never a noun.`,
    }
  );

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

  server.tool(
    "seer_memory_run",
    "Initialize .seer_memory.md for the project. Scans project and creates memory file with all 6 sections.",
    {},
    async () => ({
      content: [{ type: "text" as const, text: await seer_memory_run(apiKey, surface) }],
    })
  );

  server.tool(
    "seer_tools",
    "Show all active SEER tools and features. Use when user types 'seer tools'.",
    {},
    async () => ({
      content: [{ type: "text" as const, text: await seer_tools(apiKey) }],
    })
  );

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);
  await transport.handleRequest(req, res);
}
