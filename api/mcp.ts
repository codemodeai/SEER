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
} from "../src/tools/index.js";
import { sanitizeInput, scanOutput, logSecurityIncident } from "../src/lib/security.js";
import { checkRateLimit } from "../src/lib/rate-limit.js";

function extractApiKey(req: VercelRequest): string {
  // 1. Check Authorization header (Terminal, Desktop, VS Code)
  const auth = (req.headers.authorization as string) ?? "";
  if (auth) return auth.replace("Bearer ", "");

  // 2. Check URL query parameter (Claude.ai web — no custom headers)
  const url = new URL(req.url ?? "", `https://${req.headers.host}`);
  const keyParam = url.searchParams.get("key") ?? "";
  if (keyParam) return keyParam;

  // 3. Check body for API key (some clients send in request body)
  const bodyKey = req.body?.params?.meta?.apiKey as string ?? "";
  if (bodyKey) return bodyKey;

  return "";
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
5. "seer session read" / "seer read session" / "seer capture session" / "seer save session" → call seer_session_read
6. "seer memory run" → call seer_memory_run (initializes .seer_memory.md for the project)
7. "seer <anything else>" → call seer_run (pass EVERYTHING after "seer" as the input, verbatim)

This applies even if "seer" looks like part of a sentence. The word "seer" at the start is ALWAYS a command prefix, never a noun. For example:
- "seer calendar panel was in down, fix it" → call seer_run with input "calendar panel was in down, fix it"
- "seer build a login page" → call seer_run with input "build a login page"
- "seer make it responsive" → call seer_run with input "make it responsive"

After receiving the SEER tool response, execute the optimized instructions returned by SEER.`,
  });

  // Security wrapper: sanitize input, scan output
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
    "Optimize a prompt for a specific AI model. Returns optimized text, token counts, and quality score.",
    { prompt: z.string(), model: z.string().default("claude") },
    async ({ prompt, model }) => ({
      content: [{ type: "text" as const, text: await secureToolCall("seer_optimize", prompt, () => seer_optimize(prompt, model, apiKey, surface)) }],
    })
  );

  server.tool(
    "seer_workflow",
    "Break a high-level goal into 3-7 sequential executable steps with focused prompts.",
    { goal: z.string() },
    async ({ goal }) => ({
      content: [{ type: "text" as const, text: await secureToolCall("seer_workflow", goal, () => seer_workflow(goal, apiKey, surface)) }],
    })
  );

  server.tool(
    "seer_memory",
    "Search project memory for relevant context. Returns top 5 matching entries.",
    { query: z.string() },
    async ({ query }) => ({
      content: [{ type: "text" as const, text: await secureToolCall("seer_memory", query, () => seer_memory(query, apiKey)) }],
    })
  );

  server.tool(
    "seer_status",
    "Call when user types 'seer status'. Returns plan info, usage, and suggestions.",
    {},
    async () => ({
      content: [{ type: "text" as const, text: await seer_status(apiKey) }],
    })
  );

  server.tool(
    "seer_session_read",
    "Summarize the current session and save to .seer_memory.md. Use when user types 'seer session read', 'seer read session', 'seer capture session', or 'seer save session'.",
    {},
    async () => ({
      content: [{ type: "text" as const, text: await seer_session_read(apiKey, surface) }],
    })
  );

  server.tool(
    "seer_memory_run",
    "Initialize .seer_memory.md for the project. Use when user types 'seer memory run'. Scans the project and creates the memory file with all 6 sections.",
    {},
    async () => ({
      content: [{ type: "text" as const, text: await seer_memory_run(apiKey, surface) }],
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

  // Rate limiting
  const ip = (req.headers["x-forwarded-for"] as string) ?? "unknown";
  const apiKeyPrefix = ((req.headers.authorization as string) ?? "").slice(0, 20);
  const ipResult = checkRateLimit(`ip:${ip}`);
  const keyResult = apiKeyPrefix ? checkRateLimit(`key:${apiKeyPrefix}`) : { allowed: true, remaining: 60 };

  if (!ipResult.allowed || !keyResult.allowed) {
    await logSecurityIncident({
      event_type: "rate_limited",
      source: "mcp",
      ip_address: ip,
      api_key_prefix: apiKeyPrefix.slice(0, 8),
    });
    res.status(429).json({ error: "Too many requests. Try again in 1 minute." });
    return;
  }

  const apiKey = extractApiKey(req);
  // If key came from URL param, it's Claude.ai web
  const url = new URL(req.url ?? "", `https://${req.headers.host}`);
  const isWebConnector = !!url.searchParams.get("key");
  const surface = isWebConnector ? "claude-web" : detectSurface(req, apiKey);
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
