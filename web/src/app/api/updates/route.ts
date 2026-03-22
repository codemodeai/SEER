import { NextResponse } from "next/server";

// Changelog — add new entries at the TOP
// This is the single source of truth for all SEER updates.
// Since SEER is a cloud MCP server, updates are instant for all users.
const UPDATES = [
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
      "Smart tool routing across all surfaces",
      "Global VS Code install — persists across restarts",
      "Self-healing billing system",
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
