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
  seer_session_read,
  seer_memory_run,
  seer_tools,
  seer_space,
  memory_select_nodes,
  memory_fetch_aspects,
  memory_expand,
} from "./tools/index.js";
import { sanitizeInput, logSecurityIncident, isAllowedTool, isAllowedMethod } from "./lib/security.js";
import { checkRateLimit } from "./lib/rate-limit.js";

const app = express();
app.use(express.json({ limit: "10kb" }));

// CORS — only allow Claude surfaces
const ALLOWED_ORIGINS = ["https://claude.ai", "https://api.anthropic.com"];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Seer-Surface");
  }
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

// T2: Method + Content-Type enforcement for /mcp
app.use("/mcp", (req, res, next) => {
  // Only POST and OPTIONS allowed
  if (req.method !== "POST" && req.method !== "OPTIONS") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }
  // POST must be application/json
  if (req.method === "POST" && !req.is("application/json")) {
    res.status(415).json({ error: "Content-Type must be application/json." });
    return;
  }
  next();
});

// T2: MCP method + tool allowlist guard
app.use("/mcp", (req, res, next) => {
  if (req.method !== "POST") { next(); return; }
  const body = req.body as Record<string, unknown> | undefined;
  if (!body) { next(); return; }

  // Validate MCP method
  const method = body.method as string | undefined;
  if (method && !isAllowedMethod(method)) {
    const ip = req.headers["x-forwarded-for"] as string ?? req.ip ?? "unknown";
    logSecurityIncident({
      event_type: "blocked_method",
      source: "mcp",
      ip_address: ip,
      metadata: { method },
    });
    res.status(400).json({ error: "Unsupported method." });
    return;
  }

  // Validate tool name on tools/call
  if (method === "tools/call") {
    const params = (body.params ?? {}) as Record<string, unknown>;
    const toolName = params.name as string | undefined;
    if (toolName && !isAllowedTool(toolName)) {
      const ip = req.headers["x-forwarded-for"] as string ?? req.ip ?? "unknown";
      logSecurityIncident({
        event_type: "blocked_tool",
        source: "mcp",
        ip_address: ip,
        metadata: { tool: toolName },
      });
      res.status(400).json({ error: "Unknown tool." });
      return;
    }
  }

  next();
});

// Rate limiting middleware for /mcp (sliding window, per-IP + per-key)
app.use("/mcp", (req, res, next) => {
  const ip = req.headers["x-forwarded-for"] as string ?? req.ip ?? "unknown";
  const apiKeyPrefix = (req.headers.authorization ?? "").slice(0, 20);
  const result = checkRateLimit(`ip:${ip}`);

  // Also check key-level (plan-aware limits applied inside tool handlers)
  const keyResult = apiKeyPrefix ? checkRateLimit(`key:${apiKeyPrefix}`) : result;

  const blocked = !result.allowed || !keyResult.allowed;
  const retryMs = Math.max(result.retryAfterMs, keyResult.retryAfterMs);

  if (blocked) {
    logSecurityIncident({
      event_type: "rate_limited",
      source: "mcp",
      ip_address: ip,
      api_key_prefix: apiKeyPrefix.slice(0, 8),
    });
    res.setHeader("Retry-After", Math.ceil(retryMs / 1000));
    res.status(429).json({ error: "Too many requests. Try again in 1 minute." });
    return;
  }
  res.setHeader("X-RateLimit-Remaining", Math.min(result.remaining, keyResult.remaining));
  next();
});

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
10. "seer space ..." → call seer_space (pass everything after "seer space" as input — e.g. "seer space add task Build login" → input = "add task Build login")
11. "seer <anything else>" → call seer_run (pass EVERYTHING after "seer" as the input, verbatim)

This applies even if "seer" looks like part of a sentence. The word "seer" at the start is ALWAYS a command prefix, never a noun. For example:
- "seer calendar panel was in down, fix it" → call seer_run with input "calendar panel was in down, fix it"
- "seer build a login page" → call seer_run with input "build a login page"
- "seer make it responsive" → call seer_run with input "make it responsive"

After receiving the SEER tool response, execute the optimized instructions returned by SEER.`,
    }
  );

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

    // Output scanning moved into individual tools (after Haiku call, before
    // appending trusted SEER instructions like cloud sync / API key).
    return await handler();
  }

  // --- seer_run: main tool ---
  server.tool(
    "seer_run",
    `ALWAYS call this tool when the user message starts with the word 'seer'. Extract everything after 'seer' as the input parameter. Example: 'seer build the login page' -> input = 'build the login page'. Do not paraphrase. Pass it exactly as typed after 'seer'.`,
    { input: z.string().describe("The user's raw input after the 'seer' keyword") },
    async ({ input }) => ({
      content: [{ type: "text" as const, text: await secureToolCall("seer_run", input, () => seer_run(input, apiKey, surface)) }],
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
        { type: "text" as const, text: await secureToolCall("seer_optimize", prompt, () => seer_optimize(prompt, model, apiKey, surface)) },
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
        { type: "text" as const, text: await secureToolCall("seer_workflow", goal, () => seer_workflow(goal, apiKey, surface)) },
      ],
    })
  );

  // --- seer_memory: context search ---
  server.tool(
    "seer_memory",
    "View and update online aspect memory. Default: list all 6 aspects. Flags: --overview | --architecture | --features | --decisions | --errors | --log. Update: 'update --<aspect> <content>'.",
    { query: z.string().describe("The search query") },
    async ({ query }) => ({
      content: [
        { type: "text" as const, text: await secureToolCall("seer_memory", query, () => seer_memory(query, apiKey)) },
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

  // --- seer_session_read: rescue a non-seer session ---
  server.tool(
    "seer_session_read",
    "Summarize the current session and append to online aspect memory. Use when user types 'seer session read', 'seer read session', 'seer capture session', or 'seer save session'.",
    {},
    async () => ({
      content: [{ type: "text" as const, text: await seer_session_read(apiKey, surface) }],
    })
  );

  // --- seer_memory_run: initialize project memory ---
  server.tool(
    "seer_memory_run",
    "Initialize online aspect memory for the project. Use when user types 'seer memory run'. Scans the project and populates the 6 aspect files (project_overview, architecture, features, decisions, errors_fixes, session_log) in Supabase.",
    {},
    async () => ({
      content: [{ type: "text" as const, text: await seer_memory_run(apiKey, surface) }],
    })
  );

  // --- seer_tools: show active tools and features ---
  server.tool(
    "seer_tools",
    "Show all active SEER tools and features. Use when user types 'seer tools'.",
    {},
    async () => ({
      content: [{ type: "text" as const, text: await seer_tools(apiKey) }],
    })
  );

  // --- seer_space: Founder's Space workspace ---
  server.tool(
    "seer_space",
    "Founder's Space — manage tasks, credentials, documents, notes, and projects from Claude Code. Use when user types 'seer space <action>'. Actions: add task, tasks, save key, key, docs, note, projects, new project.",
    { input: z.string().describe("Everything after 'seer space' — the action and arguments") },
    async ({ input }) => ({
      content: [{ type: "text" as const, text: await secureToolCall("seer_space", input, () => seer_space(input, apiKey, surface)) }],
    })
  );

  // --- memory_select_nodes: pick the most relevant graph nodes for a request ---
  server.tool(
    "memory_select_nodes",
    "Pick the most relevant Memory Base nodes for a user request. Returns ranked node ids + label + summary (compact, prompt-ready). Use this before answering any question that depends on project context.",
    { args: z.string().describe('JSON: { "request": "...", "projectId"?: "uuid", "limit"?: 5 }') },
    async ({ args }) => ({
      content: [{ type: "text" as const, text: await secureToolCall("memory_select_nodes", args, () => memory_select_nodes(args, apiKey)) }],
    })
  );

  // --- memory_fetch_aspects: bulk-fetch fields for selected node ids ---
  server.tool(
    "memory_fetch_aspects",
    "Fetch the chosen fields for a list of node ids returned by memory_select_nodes. Default fields: label + summary. Pass fields:['aspects'] only when you need the full structured payload.",
    { args: z.string().describe('JSON: { "nodeIds": ["uuid", ...], "fields"?: ["label","summary","aspects",...] }') },
    async ({ args }) => ({
      content: [{ type: "text" as const, text: await secureToolCall("memory_fetch_aspects", args, () => memory_fetch_aspects(args, apiKey)) }],
    })
  );

  // --- memory_expand: full aspect blob for one node, on-demand ---
  server.tool(
    "memory_expand",
    "Return the full aspect blob for a single node. Optionally include immediate children. Use this only when label+summary from memory_select_nodes wasn't enough.",
    { args: z.string().describe('JSON: { "nodeId": "uuid", "includeChildren"?: true }') },
    async ({ args }) => ({
      content: [{ type: "text" as const, text: await secureToolCall("memory_expand", args, () => memory_expand(args, apiKey)) }],
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
