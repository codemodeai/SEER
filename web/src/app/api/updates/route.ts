import { NextResponse } from "next/server";

// Changelog — add new entries at the TOP
// This is the single source of truth for all SEER updates.
// Since SEER is a cloud MCP server, updates are instant for all users.
const UPDATES = [
  {
    version: "1.2.0",
    date: "2026-03-22",
    title: "VS Code Global Install",
    type: "improvement",
    changes: [
      "VS Code install now uses global 'claude mcp add' — persists across restarts",
      "No more per-project .mcp.json files or mcp-remote dependency",
      "One command install, works in every project forever",
    ],
  },
  {
    version: "1.1.1",
    date: "2026-03-22",
    title: "Payment & Billing Fix",
    type: "fix",
    changes: [
      "Fixed plan not updating after successful payment",
      "Added self-healing: auto-corrects plan if invoice exists but plan is stale",
      "Added missing database constraints for subscription upserts",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-03-22",
    title: "Smart Tool Routing for VS Code",
    type: "feature",
    changes: [
      "SEER tools now auto-trigger when your message starts with 'seer'",
      "Added MCP server-level instructions for reliable tool routing",
      "Works across all surfaces: Terminal, Desktop, VS Code, Claude.ai",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-03-21",
    title: "SEER Launch",
    type: "feature",
    changes: [
      "Prompt optimization with 30-50% token savings",
      "Workflow generator: break goals into executable steps",
      "Context memory with vector search",
      "4 surfaces: Terminal, Claude Desktop, VS Code, Claude.ai",
      "Dashboard with real-time analytics",
    ],
  },
];

const CURRENT_VERSION = UPDATES[0]?.version ?? "1.0.0";

export async function GET() {
  return NextResponse.json({
    currentVersion: CURRENT_VERSION,
    updates: UPDATES,
  });
}
