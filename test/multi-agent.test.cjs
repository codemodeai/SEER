const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const {
  shouldUseMultiAgent,
  buildStepPlan,
  buildStepInstruction,
  buildAutoInstruction,
  storePipelineState,
  getPipelineState,
  clearPipelineState,
  _resetAllPipelines,
} = require("../dist/lib/multi-agent.js");

beforeEach(() => {
  _resetAllPipelines();
});

// --- Routing gate ---

describe("shouldUseMultiAgent: routing gate", () => {
  it("returns false when complexity < 7", () => {
    const r = shouldUseMultiAgent(5, "build a login page");
    assert.equal(r.shouldUse, false);
    assert.equal(r.pipeline, null);
  });

  it("returns false at complexity 6", () => {
    const r = shouldUseMultiAgent(6, "implement full auth system");
    assert.equal(r.shouldUse, false);
  });

  it("selects research pipeline for analysis questions", () => {
    const r = shouldUseMultiAgent(8, "how should we structure our database schema");
    assert.equal(r.shouldUse, true);
    assert.equal(r.pipeline, "research");
  });

  it("selects research for compare/evaluate queries", () => {
    const r = shouldUseMultiAgent(7, "compare React vs Vue for our frontend");
    assert.equal(r.shouldUse, true);
    assert.equal(r.pipeline, "research");
  });

  it("selects build pipeline for implementation tasks", () => {
    const r = shouldUseMultiAgent(8, "build the full payment checkout system");
    assert.equal(r.shouldUse, true);
    assert.equal(r.pipeline, "build");
  });

  it("selects build when both research and build keywords present", () => {
    const r = shouldUseMultiAgent(7, "build and analyze the auth system");
    assert.equal(r.shouldUse, true);
    assert.equal(r.pipeline, "build");
  });

  it("selects build as default for high complexity", () => {
    const r = shouldUseMultiAgent(9, "full e-commerce platform with payments");
    assert.equal(r.shouldUse, true);
    assert.equal(r.pipeline, "build");
  });

  it("includes complexity score in reason", () => {
    const r = shouldUseMultiAgent(8, "build something complex");
    assert.ok(r.reason.includes("8/10"));
  });
});

// --- Step plan display ---

describe("buildStepPlan", () => {
  it("shows 4 steps for research pipeline", () => {
    const plan = buildStepPlan("research", "how should we design the API");
    assert.ok(plan.includes("4 steps"));
    assert.ok(plan.includes("step 1"));
    assert.ok(plan.includes("step 2"));
    assert.ok(plan.includes("step 3"));
    assert.ok(plan.includes("step 4"));
    assert.ok(plan.includes("seer auto"));
  });

  it("shows 3 steps for build pipeline", () => {
    const plan = buildStepPlan("build", "build the dashboard");
    assert.ok(plan.includes("3 steps"));
    assert.ok(plan.includes("step 1"));
    assert.ok(plan.includes("step 2"));
    assert.ok(plan.includes("step 3"));
    assert.ok(plan.includes("seer auto"));
  });

  it("research plan mentions haiku and sonnet models", () => {
    const plan = buildStepPlan("research", "analyze performance");
    assert.ok(plan.includes("haiku"));
    assert.ok(plan.includes("sonnet"));
  });

  it("build plan mentions parallel build in step 2", () => {
    const plan = buildStepPlan("build", "build full feature");
    assert.ok(plan.includes("simultaneously") || plan.includes("parallel"));
  });
});

// --- Pipeline state management ---

describe("pipeline state", () => {
  it("stores and retrieves pipeline state", () => {
    const state = {
      pipeline: "build",
      input: "build the thing",
      currentStep: 1,
      totalSteps: 3,
      completedSteps: [],
      apiKey: "key-a",
      createdAt: 0,
    };
    storePipelineState("key-a", state);
    const retrieved = getPipelineState("key-a");
    assert.ok(retrieved);
    assert.equal(retrieved.pipeline, "build");
    assert.equal(retrieved.currentStep, 1);
  });

  it("returns null for missing key", () => {
    assert.equal(getPipelineState("nonexistent"), null);
  });

  it("clears pipeline state", () => {
    storePipelineState("key-b", {
      pipeline: "research", input: "test", currentStep: 1,
      totalSteps: 4, completedSteps: [], apiKey: "key-b", createdAt: 0,
    });
    clearPipelineState("key-b");
    assert.equal(getPipelineState("key-b"), null);
  });

  it("different keys have independent states", () => {
    storePipelineState("key-c", {
      pipeline: "build", input: "build X", currentStep: 1,
      totalSteps: 3, completedSteps: [], apiKey: "key-c", createdAt: 0,
    });
    storePipelineState("key-d", {
      pipeline: "research", input: "research Y", currentStep: 2,
      totalSteps: 4, completedSteps: ["step 1"], apiKey: "key-d", createdAt: 0,
    });
    assert.equal(getPipelineState("key-c").pipeline, "build");
    assert.equal(getPipelineState("key-d").pipeline, "research");
  });
});

// --- Step instruction builders ---

describe("buildStepInstruction", () => {
  it("builds research step 1 with haiku instruction", () => {
    const inst = buildStepInstruction("research", 1, "analyze our API design", "test-key");
    assert.ok(inst.includes("haiku"));
    assert.ok(inst.includes("Step 1 of 4"));
    assert.ok(inst.includes("Memory Scanner"));
    assert.ok(inst.includes("analyze our API design"));
  });

  it("builds research step 2 with sonnet instruction", () => {
    const inst = buildStepInstruction("research", 2, "analyze X", "test-key");
    assert.ok(inst.includes("sonnet"));
    assert.ok(inst.includes("Step 2 of 4"));
    assert.ok(inst.includes("Research Agent"));
  });

  it("builds research step 3 — fact checker", () => {
    const inst = buildStepInstruction("research", 3, "analyze X", "test-key");
    assert.ok(inst.includes("Fact Checker"));
    assert.ok(inst.includes("STEP 3 COMPLETE"));
  });

  it("builds research step 4 — coordinator", () => {
    const inst = buildStepInstruction("research", 4, "analyze X", "test-key");
    assert.ok(inst.includes("Coordinator"));
    assert.ok(inst.includes("STEP 4 COMPLETE"));
  });

  it("returns error for invalid research step", () => {
    const inst = buildStepInstruction("research", 5, "x", "k");
    assert.ok(inst.includes("Error"));
  });

  it("builds build step 1 with haiku instruction", () => {
    const inst = buildStepInstruction("build", 1, "build dashboard", "test-key");
    assert.ok(inst.includes("haiku"));
    assert.ok(inst.includes("Step 1 of 3"));
    assert.ok(inst.includes("Project Scanner"));
  });

  it("builds build step 2 — parallel build", () => {
    const inst = buildStepInstruction("build", 2, "build dashboard", "test-key");
    assert.ok(inst.includes("Parallel Build"));
    assert.ok(inst.includes("SLICE A"));
    assert.ok(inst.includes("SLICE B"));
  });

  it("builds build step 3 — coordinator", () => {
    const inst = buildStepInstruction("build", 3, "build dashboard", "test-key");
    assert.ok(inst.includes("Build Coordinator"));
    assert.ok(inst.includes("BUILD COMPLETE"));
  });

  it("returns error for invalid build step", () => {
    const inst = buildStepInstruction("build", 4, "x", "k");
    assert.ok(inst.includes("Error"));
  });

  it("includes API base URL in step 1 instructions", () => {
    const inst = buildStepInstruction("research", 1, "test", "test-key");
    assert.ok(inst.includes("/api/seer/memory-aspect"));
  });

  it("includes STRICT_RULES in step instructions", () => {
    const inst = buildStepInstruction("research", 1, "test", "test-key");
    assert.ok(inst.includes("STRICT RULES"));
  });
});

// --- Auto instruction ---

describe("buildAutoInstruction", () => {
  it("combines all 4 research steps", () => {
    const inst = buildAutoInstruction("research", "analyze something", "test-key");
    assert.ok(inst.includes("4 steps automatically"));
    assert.ok(inst.includes("Step 1 of 4"));
    assert.ok(inst.includes("Step 2 of 4"));
    assert.ok(inst.includes("Step 3 of 4"));
    assert.ok(inst.includes("Step 4 of 4"));
  });

  it("combines all 3 build steps", () => {
    const inst = buildAutoInstruction("build", "build something", "test-key");
    assert.ok(inst.includes("3 steps automatically"));
    assert.ok(inst.includes("Step 1 of 3"));
    assert.ok(inst.includes("Step 2 of 3"));
    assert.ok(inst.includes("Step 3 of 3"));
  });

  it("separates steps with dividers", () => {
    const inst = buildAutoInstruction("build", "build X", "test-key");
    assert.ok(inst.includes("---"));
  });

  it("includes execute-in-order instruction", () => {
    const inst = buildAutoInstruction("research", "test", "key");
    assert.ok(inst.includes("Execute each step in order"));
  });
});
