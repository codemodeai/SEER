/**
 * SEER MCP Client.
 * POSTs user task to the SEER MCP Server and parses the structured JSON response:
 * { model, mode, tokens, instruction, steps }
 */

import type { MCPInstruction } from "./types.js";

const MCP_BASE = process.env["SEER_MCP_BASE"] ?? "https://mcp.seermcp.com";
const MCP_TOOL_ENDPOINT = `${MCP_BASE}/mcp`;

interface MCPToolRequest {
  jsonrpc: "2.0";
  id: number;
  method: "tools/call";
  params: {
    name: "seer_run";
    arguments: { input: string };
  };
}

interface MCPToolResult {
  jsonrpc: "2.0";
  id: number;
  result?: {
    content: Array<{ type: "text"; text: string }>;
  };
  error?: { message: string };
}

export async function fetchInstruction(
  taskText: string,
  apiKey: string
): Promise<MCPInstruction> {
  const body: MCPToolRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "seer_run",
      arguments: { input: taskText },
    },
  };

  const res = await fetch(MCP_TOOL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`MCP server error: ${res.status}`);
  }

  const data = (await res.json()) as MCPToolResult;

  if (data.error) {
    throw new Error(data.error.message);
  }

  const text = data.result?.content?.[0]?.text ?? "";

  // Extract the structured JSON envelope from the response text.
  // The MCP server wraps the instruction in a ```json ... ``` block or plain JSON.
  const jsonMatch = text.match(/```json\s*([\s\S]+?)\s*```/) ??
    text.match(/(\{[\s\S]*"model"[\s\S]*"instruction"[\s\S]*\})/);

  if (jsonMatch?.[1]) {
    try {
      return JSON.parse(jsonMatch[1]) as MCPInstruction;
    } catch {
      // Fall through to plain text fallback
    }
  }

  // Fallback: wrap raw instruction text in a default envelope
  return {
    model: "claude-haiku-4-5-20251001",
    mode: "build",
    tokens: 800,
    instruction: text,
    steps: [],
  };
}
