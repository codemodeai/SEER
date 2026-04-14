const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { detectModeAndModel } = require("../dist/lib/mode-switch.js");

// --- Mode detection ---

describe("mode detection", () => {
  it("detects quick mode for short inputs", () => {
    const r = detectModeAndModel("status", 1);
    assert.equal(r.mode, "quick");
  });

  it("detects quick mode for very short inputs (≤20 chars)", () => {
    const r = detectModeAndModel("fix typo", 1);
    assert.equal(r.mode, "quick");
  });

  it("detects plan mode for workflow keywords", () => {
    const r = detectModeAndModel("plan the authentication migration step by step", 5);
    assert.equal(r.mode, "plan");
  });

  it("detects analyze mode for debugging", () => {
    const r = detectModeAndModel("debug why the login page crashes on Safari", 4);
    assert.equal(r.mode, "analyze");
  });

  it("detects analyze mode for review", () => {
    const r = detectModeAndModel("review the auth middleware for security issues", 5);
    assert.equal(r.mode, "analyze");
  });

  it("detects build mode for feature creation", () => {
    const r = detectModeAndModel("build a user dashboard with analytics charts and export", 6);
    assert.equal(r.mode, "build");
  });

  it("detects compress mode for optimization keywords", () => {
    const r = detectModeAndModel("optimize this prompt to be shorter and more precise", 3);
    assert.equal(r.mode, "compress");
  });

  it("defaults to compress for unrecognized long input", () => {
    const r = detectModeAndModel("make the sidebar look better on mobile with a hamburger menu toggle", 3);
    assert.equal(r.mode, "compress");
  });
});

// --- Model instruction for Claude Code ---

describe("model instruction (Claude Code side)", () => {
  it("quick mode → haiku instruction", () => {
    const r = detectModeAndModel("status", 1);
    assert.ok(r.modelInstruction.includes("haiku"));
  });

  it("compress mode → haiku instruction", () => {
    const r = detectModeAndModel("optimize this long complex prompt about architecture", 9);
    assert.ok(r.modelInstruction.includes("haiku"));
  });

  it("build mode → no model instruction (user's preferred model)", () => {
    const r = detectModeAndModel("build a complete auth system with OAuth integration", 8);
    assert.equal(r.modelInstruction, "");
  });

  it("low-complexity analyze → haiku instruction", () => {
    const r = detectModeAndModel("explain what this function does", 3);
    assert.ok(r.modelInstruction.includes("haiku"));
  });

  it("high-complexity analyze (≥6) → sonnet instruction", () => {
    const r = detectModeAndModel("investigate why production database has intermittent failures across services", 7);
    assert.ok(r.modelInstruction.includes("sonnet"));
  });

  it("low-complexity plan → haiku instruction", () => {
    const r = detectModeAndModel("plan a simple API endpoint", 4);
    assert.ok(r.modelInstruction.includes("haiku"));
  });

  it("high-complexity plan (≥6) → sonnet instruction", () => {
    const r = detectModeAndModel("plan the full migration from Express to Hono with database schema changes", 7);
    assert.ok(r.modelInstruction.includes("sonnet"));
  });
});

// --- Snap-back (per-call, stateless) ---

describe("snap-back behavior", () => {
  it("instructions are independent between calls", () => {
    // High complexity plan → sonnet instruction
    const r1 = detectModeAndModel("plan a complete multi-tenant SaaS platform with billing and auth", 9);
    assert.ok(r1.modelInstruction.includes("sonnet"));

    // Quick → haiku instruction (snapped back)
    const r2 = detectModeAndModel("status", 1);
    assert.ok(r2.modelInstruction.includes("haiku"));

    // Build → no instruction (user model)
    const r3 = detectModeAndModel("build a complete user dashboard with analytics charts and data export", 6);
    assert.equal(r3.modelInstruction, "");
  });
});

// --- Reason string ---

describe("reason output", () => {
  it("build mode says no override", () => {
    const r = detectModeAndModel("build a complete user dashboard with analytics", 6);
    assert.ok(r.reason.includes("no override"));
  });

  it("high-complexity analyze mentions sonnet", () => {
    const r = detectModeAndModel("investigate the race condition in the distributed queue", 8);
    assert.ok(r.reason.includes("sonnet"));
  });
});
