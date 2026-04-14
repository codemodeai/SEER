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
  seer_space,
} from "../tools/index.js";
import { sanitizeInput, logSecurityIncident, isAllowedTool, isAllowedMethod, checkBodySize } from "../lib/security.js";
import { checkRateLimit } from "../lib/rate-limit.js";

function extractApiKey(req: VercelRequest): string {
  const auth = (req.headers.authorization as string) ?? "";
  if (auth) return auth.replace("Bearer ", "");
  const keyParam = (req.query?.key as string) ?? "";
  return keyParam;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // T2: Method enforcement
  if (req.method !== "POST" && req.method !== "OPTIONS") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  // T2: Body size guard (10KB cap — Express has express.json({limit}), Vercel doesn't)
  if (req.method === "POST" && !checkBodySize(req.body)) {
    res.status(413).json({ error: "Request body too large." });
    return;
  }

  // T2: MCP method + tool allowlist
  if (req.method === "POST" && req.body) {
    const body = req.body as Record<string, unknown>;
    const method = body.method as string | undefined;
    if (method && !isAllowedMethod(method)) {
      await logSecurityIncident({
        event_type: "blocked_method",
        source: "mcp",
        ip_address: (req.headers["x-forwarded-for"] as string) ?? "unknown",
        metadata: { method },
      });
      res.status(400).json({ error: "Unsupported method." });
      return;
    }
    if (method === "tools/call") {
      const params = (body.params ?? {}) as Record<string, unknown>;
      const toolName = params.name as string | undefined;
      if (toolName && !isAllowedTool(toolName)) {
        await logSecurityIncident({
          event_type: "blocked_tool",
          source: "mcp",
          ip_address: (req.headers["x-forwarded-for"] as string) ?? "unknown",
          metadata: { tool: toolName },
        });
        res.status(400).json({ error: "Unknown tool." });
        return;
      }
    }
  }

  // Rate limiting (sliding window, per-IP + per-key)
  const ip = (req.headers["x-forwarded-for"] as string) ?? req.socket?.remoteAddress ?? "unknown";
  const apiKey = extractApiKey(req);
  const ipResult = checkRateLimit(`ip:${ip}`);
  const keyResult = apiKey ? checkRateLimit(`key:${apiKey.slice(0, 20)}`) : ipResult;

  const blocked = !ipResult.allowed || !keyResult.allowed;
  const retryMs = Math.max(ipResult.retryAfterMs, keyResult.retryAfterMs);

  if (blocked) {
    await logSecurityIncident({
      event_type: "rate_limited",
      source: "mcp",
      ip_address: ip,
      api_key_prefix: apiKey.slice(0, 8),
    });
    res.setHeader("Retry-After", Math.ceil(retryMs / 1000));
    res.status(429).json({ error: "Too many requests. Try again in 1 minute." });
    return;
  }
  res.setHeader("X-RateLimit-Remaining", Math.min(ipResult.remaining, keyResult.remaining));

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
6. "seer memory run" → call seer_memory_run (initializes online aspect memory for the project)
7. "seer continue" / "seer resume" / "seer where was i" / "seer what's next" → call seer_run with the keyword (e.g. input = "continue"). This triggers a session resume from online aspect memory.
8. "seer what did i do" / "seer recall" / "seer recap" / "seer history" / "seer show tasks" / "seer what's left" → call seer_run with the phrase (e.g. input = "what did i do"). This triggers callback memory recall from online aspect memory.
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
    // Output scanning moved into individual tools (after Haiku call, before
    // appending trusted SEER instructions like cloud sync / API key).
    return await handler();
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
    "View and update online aspect memory. Default lists all 6 aspects. Flags: --overview | --architecture | --features | --decisions | --errors | --log.",
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
    "Summarize the current session and append to online aspect memory. Aliases: 'seer read session', 'seer capture session', 'seer save session'.",
    {},
    async () => ({
      content: [{ type: "text" as const, text: await seer_session_read(apiKey, surface) }],
    })
  );

  server.tool(
    "seer_memory_run",
    "Initialize online aspect memory for the project. Scans the project and populates 6 aspect files (project_overview, architecture, features, decisions, errors_fixes, session_log) in Supabase.",
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

  server.tool(
    "seer_space",
    "Founder's Space — manage tasks, credentials, documents, notes, and projects from Claude Code. Use when user types 'seer space <action>'.",
    { input: z.string().describe("Everything after 'seer space' — the action and arguments") },
    async ({ input }) => ({
      content: [{ type: "text" as const, text: await secureToolCall("seer_space", input, () => seer_space(input, apiKey, surface)) }],
    })
  );

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);
  await transport.handleRequest(req, res);
}
