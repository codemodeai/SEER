import { NextResponse } from "next/server";

// Changelog — add new entries at the TOP
// This is the single source of truth for all SEER updates.
// Since SEER is a cloud MCP server, updates are instant for all users.
const UPDATES = [
  {
    version: "1.2.0",
    date: "2026-03-22",
    title: "Clean Output & Slash Commands",
    type: "improvement",
    changes: [
      "SEER output now renders as clean, structured markdown instead of raw JSON",
      "Added /seer slash command for 100% reliable tool routing in VS Code",
      "Additional commands: /seer-optimize, /seer-workflow, /seer-memory, /seer-status",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-03-22",
    title: "VS Code Reliability & Surface Detection",
    type: "fix",
    changes: [
      "Fixed SEER not persisting across VS Code restarts",
      "Fixed all surfaces showing as 'claude-desktop' — now accurately tracks Terminal, Desktop, VS Code, and Claude.ai",
      "Added global CLAUDE.md for reliable 'seer' keyword routing in VS Code",
      "Fixed payment not updating user plan after successful Razorpay payment",
      "Added self-healing billing: auto-corrects plan if invoice exists but plan is stale",
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
