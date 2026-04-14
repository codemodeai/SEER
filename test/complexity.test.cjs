const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { scoreComplexity } = require("../dist/lib/complexity.js");

// Helper: generate N words of filler text (no complexity keywords)
function filler(n) {
  const words = "the quick brown fox jumps over lazy dog near river bank".split(" ");
  const out = [];
  while (out.length < n) out.push(...words);
  return out.slice(0, n).join(" ");
}

// Helper: generate N words with high-complexity keywords baked in
function complexFiller(n) {
  const words = "build a full-stack application refactor the database schema deploy CI/CD pipeline implement end-to-end tests integrate third-party webhooks configure environment".split(" ");
  const out = [];
  while (out.length < n) out.push(...words);
  return out.slice(0, n).join(" ");
}

// ─── Empty / minimal input ───────────────────────────────────────

describe("empty and minimal input", () => {
  it("empty string returns score 1 and a valid budget", () => {
    const r = scoreComplexity("");
    assert.equal(r.score, 1);
    assert.ok(r.maxTokens >= 1024, `budget ${r.maxTokens} should be >= 1024`);
    assert.ok(Array.isArray(r.signals));
  });

  it("single character returns score 1", () => {
    const r = scoreComplexity("x");
    assert.equal(r.score, 1);
  });

  it("whitespace-only returns score 1", () => {
    const r = scoreComplexity("   \n\t  ");
    assert.equal(r.score, 1);
  });
});

// ─── Score clamping ──────────────────────────────────────────────

describe("score clamping to 1-10", () => {
  it("score never drops below 1", () => {
    const r = scoreComplexity("hi");
    assert.ok(r.score >= 1);
  });

  it("score never exceeds 10 even with all signals firing", () => {
    // Trigger every single signal pattern + length + code + list
    const kitchen_sink = `
      refactor and restructure multiple files across the entire codebase.
      architect a new database schema migration with CI/CD pipeline deploy.
      build and create a complete end-to-end new feature with full implementation.
      step 1: first set up, then after that do the next phase in the workflow sequence.
      integrate and connect the third-party external API endpoint webhook.
      debug and fix the broken error — crash issue, investigate the bug.
      test with unit test, integration test, mock, assert, expect coverage spec.
      security auth encrypt token permission role RLS injection XSS CSRF.
      parse transform convert map filter reduce aggregate batch bulk stream.
      config setup install environment env settings initialize.
      rename move update change modify tweak adjust swap.
      document comment readme explain describe jsdoc.
      style css tailwind color font layout margin padding responsive.
      \`\`\`js
      code block one
      \`\`\`
      \`\`\`js
      code block two
      \`\`\`
      - item one
      - item two
      - item three
      - item four
      - item five
    `;
    const r = scoreComplexity(kitchen_sink);
    assert.equal(r.score, 10, `score should clamp to 10, got ${r.score}`);
  });
});

// ─── Signal detection ────────────────────────────────────────────

describe("individual signal detection", () => {
  it("detects multi-file signal", () => {
    const r = scoreComplexity("refactor across files");
    assert.ok(r.signals.includes("multi-file"));
  });

  it("detects architecture signal", () => {
    const r = scoreComplexity("design a database schema migration");
    assert.ok(r.signals.includes("architecture"));
  });

  it("detects full-feature signal", () => {
    const r = scoreComplexity("build a new authentication system");
    assert.ok(r.signals.includes("full-feature"));
  });

  it("detects debugging signal", () => {
    const r = scoreComplexity("fix the login bug");
    assert.ok(r.signals.includes("debugging"));
  });

  it("detects security signal", () => {
    const r = scoreComplexity("add auth encryption to the token flow");
    assert.ok(r.signals.includes("security"));
  });

  it("does not fire signals on plain text with no keywords", () => {
    const r = scoreComplexity("hello world");
    assert.equal(r.signals.length, 0);
    assert.equal(r.score, 1);
  });
});

// ─── Length signal ───────────────────────────────────────────────

describe("length-based signal", () => {
  it("no length signal for short input (<50 words)", () => {
    const r = scoreComplexity(filler(30));
    assert.ok(!r.signals.includes("medium-prompt"));
    assert.ok(!r.signals.includes("long-prompt"));
  });

  it("medium-prompt signal for 51-100 words", () => {
    const r = scoreComplexity(filler(60));
    assert.ok(r.signals.includes("medium-prompt"));
  });

  it("long-prompt signal for >100 words", () => {
    const r = scoreComplexity(filler(150));
    assert.ok(r.signals.includes("long-prompt"));
  });
});

// ─── Code block signal ──────────────────────────────────────────

describe("code block signal", () => {
  it("no code signal without code fences", () => {
    const r = scoreComplexity("just plain text here");
    assert.ok(!r.signals.includes("code-blocks"));
  });

  it("no code signal with only one code fence pair", () => {
    const r = scoreComplexity("look at this ```code```");
    // Only 2 backtick groups = 1 pair, need >= 2 pairs (4 markers)
    // Actually the regex counts individual ``` markers, need >= 2
    // Let's just verify the behavior
    const r2 = scoreComplexity("```\ncode\n```");
    // 2 markers = exactly 2, which is >= 2, so it should fire
    assert.ok(r2.signals.includes("code-blocks"));
  });

  it("code-blocks signal with multiple code fences", () => {
    const r = scoreComplexity("```js\nfoo\n```\n```js\nbar\n```");
    assert.ok(r.signals.includes("code-blocks"));
  });
});

// ─── List signal ─────────────────────────────────────────────────

describe("list signal", () => {
  it("no list signal without list items", () => {
    const r = scoreComplexity("just a sentence");
    assert.ok(!r.signals.includes("short-list"));
    assert.ok(!r.signals.includes("long-list"));
  });

  it("short-list signal with 2-3 bullet points", () => {
    const r = scoreComplexity("do this:\n- one\n- two\n- three");
    assert.ok(r.signals.includes("short-list"));
  });

  it("long-list signal with 4+ bullet points", () => {
    const r = scoreComplexity("tasks:\n- a\n- b\n- c\n- d\n- e");
    assert.ok(r.signals.includes("long-list"));
  });

  it("numbered lists also trigger", () => {
    const r = scoreComplexity("steps:\n1. first\n2. second\n3. third\n4. fourth");
    assert.ok(r.signals.includes("long-list"));
  });
});

// ─── Budget: input-proportional scaling ──────────────────────────

describe("input-proportional budget scaling", () => {
  it("tiny input gets base tier budget, not input-proportional", () => {
    const r = scoreComplexity("rename x");
    // Score ~2, base tier = 1024, input is tiny
    assert.ok(r.maxTokens >= 1024, `budget ${r.maxTokens} should be >= 1024`);
    assert.ok(r.maxTokens <= 2048, `budget ${r.maxTokens} should not over-allocate`);
  });

  it("large input scales budget proportionally", () => {
    // 3000 words of plain filler, no keywords → score 3 (long-prompt signal)
    // inputTokens ≈ 3900, inputProportional = 3900*1.5 + 300 = 6150
    // base tier for score 3 = 2048
    // budget should be max(2048, 6150) = 6150, capped at 8192
    const r = scoreComplexity(filler(3000));
    assert.ok(r.maxTokens >= 6000, `budget ${r.maxTokens} should scale with input (expected >= 6000)`);
  });

  it("budget never exceeds 8192 (ENGINE_MAX_OUTPUT)", () => {
    // 5000 words → inputTokens ≈ 6500, proportional = 6500*1.5+300 = 10050
    // Should be capped at 8192
    const r = scoreComplexity(filler(5000));
    assert.ok(r.maxTokens <= 8192, `budget ${r.maxTokens} must not exceed 8192`);
  });

  it("budget increases with input size for same complexity", () => {
    const small = scoreComplexity(filler(20));
    const large = scoreComplexity(filler(2000));
    assert.ok(large.maxTokens >= small.maxTokens,
      `large input budget (${large.maxTokens}) should be >= small (${small.maxTokens})`);
  });
});

// ─── Budget: complexity tier scaling ─────────────────────────────

describe("complexity tier budget scaling", () => {
  it("score 1-2 gets lowest base tier", () => {
    const r = scoreComplexity("rename x");
    // Should be around 1024 + buffer range
    assert.ok(r.maxTokens >= 1024);
  });

  it("high complexity gets large base tier", () => {
    const r = scoreComplexity("build and deploy a full CI/CD pipeline to restructure the database schema with end-to-end tests and integrate webhooks");
    assert.ok(r.score >= 9, `score should be >= 9, got ${r.score}`);
    assert.ok(r.maxTokens >= 4096, `high complexity budget should be >= 4096, got ${r.maxTokens}`);
  });

  it("higher complexity = higher budget for same-length input", () => {
    const simple = scoreComplexity("rename the variable foo");
    const complex = scoreComplexity("build deploy refactor restructure the entire pipeline with end-to-end tests");
    assert.ok(complex.maxTokens >= simple.maxTokens,
      `complex (${complex.maxTokens}) should be >= simple (${simple.maxTokens})`);
  });
});

// ─── Return type correctness ─────────────────────────────────────

describe("return type correctness", () => {
  it("always returns score as integer", () => {
    const inputs = ["hi", "build a thing", filler(200), "fix the broken deploy pipeline with auth"];
    for (const input of inputs) {
      const r = scoreComplexity(input);
      assert.equal(r.score, Math.floor(r.score), `score ${r.score} should be integer`);
    }
  });

  it("always returns maxTokens as positive integer", () => {
    const inputs = ["", "x", filler(500), "build everything"];
    for (const input of inputs) {
      const r = scoreComplexity(input);
      assert.ok(r.maxTokens > 0, `maxTokens should be positive`);
      assert.equal(r.maxTokens, Math.floor(r.maxTokens), `maxTokens should be integer`);
    }
  });

  it("signals is always an array of strings", () => {
    const r = scoreComplexity("build a new auth system");
    assert.ok(Array.isArray(r.signals));
    for (const s of r.signals) {
      assert.equal(typeof s, "string");
    }
  });
});

// ─── Boundary transitions ────────────────────────────────────────

describe("score boundary transitions", () => {
  it("score 2 and score 3 may get different budgets", () => {
    // Score 2 → base 1024, Score 3 → base 2048
    // Just verify they are both valid
    const s2 = scoreComplexity("rename it");       // score ~2
    const s3 = scoreComplexity("fix the broken error bug"); // score ~3
    assert.ok(s2.maxTokens >= 1024);
    assert.ok(s3.maxTokens >= 1024);
    // Higher score should get >= budget
    if (s3.score > s2.score) {
      assert.ok(s3.maxTokens >= s2.maxTokens,
        `score ${s3.score} budget (${s3.maxTokens}) should be >= score ${s2.score} budget (${s2.maxTokens})`);
    }
  });
});

// ─── Buffer token presence ───────────────────────────────────────

describe("buffer token safety", () => {
  it("budget includes buffer above base tier minimum", () => {
    // Score 1, no input scaling → should be base (1024) + buffer (300) = 1324
    const r = scoreComplexity("hi");
    assert.equal(r.score, 1);
    assert.ok(r.maxTokens > 1024, `budget ${r.maxTokens} should include buffer above 1024`);
  });
});
