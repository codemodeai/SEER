const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { detectModeAndModel } = require("../dist/lib/mode-switch.js");
const { formatRunResult, formatOptimizeResult, formatWorkflowResult, buildFooterLine } = require("../dist/lib/formatter.js");

// --- E2E: mode detection → model instruction → footer display ---
// Verifies the full chain from user input → mode → recommended model → footer string

describe("E2E: model switch → footer display", () => {
  // Helper: simulate what seer_run does when parsed JSON is available
  function simulateRunFooter(input, complexityScore) {
    const modeSwitch = detectModeAndModel(input, complexityScore);
    const result = formatRunResult({
      optimized: "test output",
      _meta: {
        raw_tokens: 100,
        optimized_tokens: 60,
        tokens_saved: 40,
        pct_saved: 40,
        usage: "5/unlimited",
        complexity_score: complexityScore,
        token_budget: 2048,
        mode: modeSwitch.mode,
        recommended_model: modeSwitch.recommendedModel,
      },
    });
    return { result, modeSwitch };
  }

  it("quick mode shows quick→haiku in footer", () => {
    const { result } = simulateRunFooter("status", 1);
    assert.ok(result.includes("quick→haiku"), `Expected quick→haiku in: ${result}`);
  });

  it("compress mode shows compress→haiku in footer", () => {
    const { result } = simulateRunFooter("optimize this long complex prompt about software architecture", 3);
    assert.ok(result.includes("compress→haiku"), `Expected compress→haiku in: ${result}`);
  });

  it("build mode shows build→user-preferred in footer", () => {
    const { result } = simulateRunFooter("build a complete authentication system with OAuth", 6);
    assert.ok(result.includes("build→user-preferred"), `Expected build→user-preferred in: ${result}`);
  });

  it("low-complexity analyze shows analyze→haiku in footer", () => {
    const { result } = simulateRunFooter("explain what this function does in the codebase", 3);
    assert.ok(result.includes("analyze→haiku"), `Expected analyze→haiku in: ${result}`);
  });

  it("high-complexity analyze shows analyze→sonnet in footer", () => {
    const { result } = simulateRunFooter("investigate why production database has intermittent connection failures", 7);
    assert.ok(result.includes("analyze→sonnet"), `Expected analyze→sonnet in: ${result}`);
  });

  it("low-complexity plan shows plan→haiku in footer", () => {
    const { result } = simulateRunFooter("plan a simple REST API endpoint for users", 4);
    assert.ok(result.includes("plan→haiku"), `Expected plan→haiku in: ${result}`);
  });

  it("high-complexity plan shows plan→sonnet in footer", () => {
    const { result } = simulateRunFooter("plan the full migration from Express to Hono with database schema changes", 8);
    assert.ok(result.includes("plan→sonnet"), `Expected plan→sonnet in: ${result}`);
  });

  it("footer includes complexity score and token budget", () => {
    const { result } = simulateRunFooter("debug why the login page crashes", 5);
    assert.ok(result.includes("complexity:5/10"), `Expected complexity:5/10 in: ${result}`);
    assert.ok(result.includes("budget:2048"), `Expected budget:2048 in: ${result}`);
  });

  it("footer includes token stats", () => {
    const { result } = simulateRunFooter("optimize this prompt", 2);
    assert.ok(result.includes("100→60 tokens"), `Expected 100→60 tokens in: ${result}`);
    assert.ok(result.includes("-40%"), `Expected -40% in: ${result}`);
  });

  it("footer includes usage counter", () => {
    const { result } = simulateRunFooter("status", 1);
    assert.ok(result.includes("5/unlimited"), `Expected 5/unlimited in: ${result}`);
  });
});

// --- E2E: optimize tool footer ---

describe("E2E: optimize tool footer", () => {
  it("shows mode→model in optimize footer", () => {
    const modeSwitch = detectModeAndModel("optimize this complex multi-service architecture prompt", 4);
    const result = formatOptimizeResult({
      optimized: "test",
      tokens_before: 200,
      tokens_after: 120,
      pct_saved: 40,
      complexity_score: 4,
      token_budget: 2048,
      mode: modeSwitch.mode,
      recommended_model: modeSwitch.recommendedModel,
    });
    assert.ok(result.includes("compress→haiku"), `Expected compress→haiku in: ${result}`);
  });
});

// --- E2E: workflow tool footer ---

describe("E2E: workflow tool footer", () => {
  it("shows mode→model in workflow footer", () => {
    const modeSwitch = detectModeAndModel("plan the full CI/CD pipeline setup with staging and production", 7);
    const result = formatWorkflowResult({
      goal: "CI/CD setup",
      steps: [{ step: 1, title: "Configure build", prompt: "set up build" }],
      _meta: {
        total_steps: 1,
        usage: "10/200",
        complexity_score: 7,
        token_budget: 4096,
        mode: modeSwitch.mode,
        recommended_model: modeSwitch.recommendedModel,
      },
    });
    assert.ok(result.includes("plan→sonnet"), `Expected plan→sonnet in: ${result}`);
  });
});

// --- buildFooterLine (fallback for unparseable Haiku output) ---

describe("buildFooterLine fallback", () => {
  it("produces a complete footer line", () => {
    const footer = buildFooterLine({
      rawTokens: 50,
      optimizedTokens: 30,
      pctSaved: 40,
      complexityScore: 3,
      tokenBudget: 1500,
      mode: "compress",
      recommendedModel: "haiku",
      usage: "10/unlimited",
    });
    assert.ok(footer.includes("50→30 tokens"), `Expected token stats in: ${footer}`);
    assert.ok(footer.includes("-40%"), `Expected pct in: ${footer}`);
    assert.ok(footer.includes("complexity:3/10"), `Expected complexity in: ${footer}`);
    assert.ok(footer.includes("budget:1500"), `Expected budget in: ${footer}`);
    assert.ok(footer.includes("compress→haiku"), `Expected mode→model in: ${footer}`);
    assert.ok(footer.includes("10/unlimited"), `Expected usage in: ${footer}`);
  });

  it("works with build→user-preferred", () => {
    const footer = buildFooterLine({
      rawTokens: 100,
      optimizedTokens: 100,
      pctSaved: 0,
      complexityScore: 6,
      tokenBudget: 3000,
      mode: "build",
      recommendedModel: "user-preferred",
      usage: "5/200",
    });
    assert.ok(footer.includes("build→user-preferred"), `Expected build→user-preferred in: ${footer}`);
  });

  it("works with analyze→sonnet", () => {
    const footer = buildFooterLine({
      rawTokens: 80,
      optimizedTokens: 80,
      pctSaved: 0,
      complexityScore: 8,
      tokenBudget: 5000,
      mode: "analyze",
      recommendedModel: "sonnet",
      usage: "50/1000",
    });
    assert.ok(footer.includes("analyze→sonnet"), `Expected analyze→sonnet in: ${footer}`);
    assert.ok(footer.includes("complexity:8/10"), `Expected complexity in: ${footer}`);
  });
});

// --- Model instruction content verification ---

describe("E2E: model instruction content", () => {
  it("haiku instruction contains exact switch text", () => {
    const r = detectModeAndModel("status", 1);
    assert.equal(r.modelInstruction, "switch to haiku now. this entire response uses haiku only.");
  });

  it("sonnet instruction contains exact switch text", () => {
    const r = detectModeAndModel("investigate complex distributed system failure across multiple microservices", 8);
    assert.equal(r.modelInstruction, "switch to sonnet now. this entire response uses sonnet only.");
  });

  it("build mode has empty instruction (no model override)", () => {
    const r = detectModeAndModel("build a complete user registration system with email verification", 7);
    assert.equal(r.modelInstruction, "");
  });
});

// --- Complexity threshold boundary tests ---

describe("E2E: complexity threshold boundaries", () => {
  it("analyze at complexity 5 → haiku", () => {
    const r = detectModeAndModel("debug why the API returns 500 errors on certain requests", 5);
    assert.equal(r.recommendedModel, "haiku");
    assert.ok(r.modelInstruction.includes("haiku"));
  });

  it("analyze at complexity 6 → sonnet", () => {
    const r = detectModeAndModel("debug why the API returns 500 errors on certain requests", 6);
    assert.equal(r.recommendedModel, "sonnet");
    assert.ok(r.modelInstruction.includes("sonnet"));
  });

  it("plan at complexity 5 → haiku", () => {
    const r = detectModeAndModel("plan the database migration for the new user schema", 5);
    assert.equal(r.recommendedModel, "haiku");
  });

  it("plan at complexity 6 → sonnet", () => {
    const r = detectModeAndModel("plan the database migration for the new user schema", 6);
    assert.equal(r.recommendedModel, "sonnet");
  });
});

// --- Full chain: mode + model + footer all consistent ---

describe("E2E: full chain consistency", () => {
  const testCases = [
    { input: "status", complexity: 1, expectedMode: "quick", expectedModel: "haiku" },
    { input: "optimize this prompt to be more concise and targeted", complexity: 3, expectedMode: "compress", expectedModel: "haiku" },
    { input: "build a complete payment processing system with Stripe", complexity: 7, expectedMode: "build", expectedModel: "user-preferred" },
    { input: "explain how the authentication middleware handles JWT tokens", complexity: 4, expectedMode: "analyze", expectedModel: "haiku" },
    { input: "investigate the race condition in distributed queue processing across services", complexity: 8, expectedMode: "analyze", expectedModel: "sonnet" },
    { input: "plan a simple API endpoint for health checks", complexity: 2, expectedMode: "plan", expectedModel: "haiku" },
    { input: "plan the full migration from monolith to microservices with data partitioning", complexity: 9, expectedMode: "plan", expectedModel: "sonnet" },
  ];

  for (const tc of testCases) {
    it(`${tc.input.slice(0, 40)}... → ${tc.expectedMode}→${tc.expectedModel}`, () => {
      const ms = detectModeAndModel(tc.input, tc.complexity);
      assert.equal(ms.mode, tc.expectedMode, `Mode mismatch for: ${tc.input}`);
      assert.equal(ms.recommendedModel, tc.expectedModel, `Model mismatch for: ${tc.input}`);

      // Verify footer consistency
      const footer = buildFooterLine({
        rawTokens: 50, optimizedTokens: 30, pctSaved: 40,
        complexityScore: tc.complexity, tokenBudget: 2048,
        mode: ms.mode, recommendedModel: ms.recommendedModel,
        usage: "1/100",
      });
      assert.ok(footer.includes(`${tc.expectedMode}→${tc.expectedModel}`),
        `Footer should contain ${tc.expectedMode}→${tc.expectedModel}, got: ${footer}`);
    });
  }
});
