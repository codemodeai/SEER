const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { STRICT_RULES, classifyTaskType } = require("../dist/lib/strict-rules.js");

// --- STRICT_RULES constant ---

describe("STRICT_RULES", () => {
  it("contains exactly 10 numbered rules", () => {
    const ruleLines = STRICT_RULES.match(/^\d+\.\s/gm);
    assert.equal(ruleLines.length, 10);
  });

  it("starts with the header line", () => {
    assert.ok(STRICT_RULES.startsWith("STRICT RULES — FOLLOW EXACTLY:"));
  });

  it("includes chunk-complete instruction in rule 10", () => {
    assert.ok(STRICT_RULES.includes("[SEER: chunk complete. Run seer continue.]"));
  });

  it("includes key prohibitions", () => {
    assert.ok(STRICT_RULES.includes("Do NOT add features"));
    assert.ok(STRICT_RULES.includes("Do NOT rewrite or refactor"));
    assert.ok(STRICT_RULES.includes("no placeholders, no TODOs"));
  });
});

// --- classifyTaskType ---

describe("classifyTaskType", () => {
  it("returns full_feature for complexity >= 8", () => {
    assert.equal(classifyTaskType("build a simple button", 8), "full_feature");
    assert.equal(classifyTaskType("fix a typo", 9), "full_feature");
    assert.equal(classifyTaskType("hello", 10), "full_feature");
  });

  it("detects security tasks", () => {
    assert.equal(classifyTaskType("add CSRF protection to forms", 5), "security");
    assert.equal(classifyTaskType("implement JWT token refresh", 4), "security");
    assert.equal(classifyTaskType("fix XSS vulnerability in comments", 3), "security");
    assert.equal(classifyTaskType("add MFA enrollment flow", 6), "security");
    assert.equal(classifyTaskType("sanitize user input on the endpoint", 3), "security");
  });

  it("detects payment/auth tasks", () => {
    assert.equal(classifyTaskType("integrate Razorpay checkout", 5), "payment_auth");
    assert.equal(classifyTaskType("add billing subscription page", 4), "payment_auth");
    assert.equal(classifyTaskType("build authentication login page", 5), "payment_auth");
  });

  it("detects bug fixes", () => {
    assert.equal(classifyTaskType("fix the broken dashboard layout", 3), "bug_fix");
    assert.equal(classifyTaskType("debug the crash on startup", 4), "bug_fix");
    assert.equal(classifyTaskType("patch the regression in API", 2), "bug_fix");
  });

  it("detects research/plan tasks", () => {
    assert.equal(classifyTaskType("how does the caching work", 3), "research");
    assert.equal(classifyTaskType("what is the best approach for scaling", 4), "research");
    assert.equal(classifyTaskType("should we use Redis or Postgres for this", 3), "research");
    assert.equal(classifyTaskType("plan the migration strategy", 5), "research");
  });

  it("detects feature builds (complexity >= 4)", () => {
    assert.equal(classifyTaskType("build a new dashboard page", 5), "feature_build");
    assert.equal(classifyTaskType("create an API endpoint for users", 4), "feature_build");
    assert.equal(classifyTaskType("implement the notification module", 6), "feature_build");
  });

  it("returns simple_build for low-complexity build tasks", () => {
    assert.equal(classifyTaskType("build a button", 2), "simple_build");
    assert.equal(classifyTaskType("add a tooltip", 1), "simple_build");
  });

  it("returns simple_build for generic inputs", () => {
    assert.equal(classifyTaskType("hello world", 1), "simple_build");
    assert.equal(classifyTaskType("run the tests", 2), "simple_build");
  });

  it("security takes priority over feature keywords", () => {
    // "build authentication" has both security and feature keywords
    assert.equal(classifyTaskType("build authentication guard", 5), "security");
  });

  it("bug fix does not fire when feature keywords present", () => {
    // "fix" is present but "build" also present — should be feature_build
    assert.equal(classifyTaskType("build a fix for the missing component", 5), "feature_build");
  });

  it("research does not fire when feature keywords present", () => {
    // "how" + "build" → feature_build at complexity 4+
    assert.equal(classifyTaskType("build and analyze the dashboard", 5), "feature_build");
  });
});
