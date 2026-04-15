const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const { checkRateLimit, checkDualRateLimit, checkPlanRateLimit, PLAN_RPM, _resetAll } = require("../dist/lib/rate-limit.js");

// Reset state before each test to avoid cross-test contamination
beforeEach(() => {
  _resetAll();
});

// --- Sliding window core ---

describe("sliding window: checkRateLimit", () => {
  it("allows first request", () => {
    const r = checkRateLimit("test:a", 10);
    assert.equal(r.allowed, true);
    assert.equal(r.remaining, 9);
    assert.equal(r.retryAfterMs, 0);
  });

  it("counts down remaining correctly", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("test:b", 10);
    }
    const r = checkRateLimit("test:b", 10);
    assert.equal(r.allowed, true);
    assert.equal(r.remaining, 4); // 10 - 6 = 4
  });

  it("blocks when limit reached", () => {
    for (let i = 0; i < 10; i++) {
      const r = checkRateLimit("test:c", 10);
      assert.equal(r.allowed, true);
    }
    const blocked = checkRateLimit("test:c", 10);
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.remaining, 0);
    assert.ok(blocked.retryAfterMs > 0, "retryAfterMs should be positive");
    assert.ok(blocked.retryAfterMs <= 60000, "retryAfterMs should be <=60s");
  });

  it("different keys are independent", () => {
    for (let i = 0; i < 10; i++) {
      checkRateLimit("test:d1", 10);
    }
    const blockedD1 = checkRateLimit("test:d1", 10);
    assert.equal(blockedD1.allowed, false);

    // Different key should still be allowed
    const r = checkRateLimit("test:d2", 10);
    assert.equal(r.allowed, true);
    assert.equal(r.remaining, 9);
  });

  it("uses default IP limit of 60 when no limit specified", () => {
    for (let i = 0; i < 59; i++) {
      checkRateLimit("test:default");
    }
    const r = checkRateLimit("test:default");
    assert.equal(r.allowed, true);
    assert.equal(r.remaining, 0);

    const blocked = checkRateLimit("test:default");
    assert.equal(blocked.allowed, false);
  });
});

// --- Plan-aware limits ---

describe("plan RPM limits", () => {
  it("free plan allows 10 rpm", () => {
    assert.equal(PLAN_RPM.free, 10);
  });

  it("starter plan allows 30 rpm", () => {
    assert.equal(PLAN_RPM.starter, 30);
  });

  it("pro plan allows 60 rpm", () => {
    assert.equal(PLAN_RPM.pro, 60);
  });

  it("agency plan allows 120 rpm", () => {
    assert.equal(PLAN_RPM.agency, 120);
  });
});

// --- Dual rate limit ---

describe("checkDualRateLimit", () => {
  it("passes when both IP and key are under limits", () => {
    const r = checkDualRateLimit("1.2.3.4", "sk-seer-abc", "pro");
    assert.equal(r.allowed, true);
  });

  it("blocks when IP limit exceeded", () => {
    // Exhaust IP limit (60)
    for (let i = 0; i < 60; i++) {
      checkRateLimit("ip:5.6.7.8");
    }
    const r = checkDualRateLimit("5.6.7.8", "sk-seer-xyz", "agency");
    assert.equal(r.allowed, false);
  });

  it("blocks when key limit exceeded for free plan", () => {
    // Exhaust free plan key limit (10)
    for (let i = 0; i < 10; i++) {
      checkRateLimit("key:sk-seer-free", 10);
    }
    const r = checkDualRateLimit("9.9.9.9", "sk-seer-free", "free");
    assert.equal(r.allowed, false);
  });

  it("returns lower remaining of the two", () => {
    // Use up 5 on IP, 2 on key (agency = 120 limit)
    for (let i = 0; i < 5; i++) {
      checkRateLimit("ip:10.0.0.1");
    }
    for (let i = 0; i < 2; i++) {
      checkRateLimit("key:sk-seer-agency", 120);
    }
    const r = checkDualRateLimit("10.0.0.1", "sk-seer-agency", "agency");
    // IP: 60-6=54 remaining, Key: 120-3=117 remaining → returns IP (lower)
    assert.equal(r.allowed, true);
    assert.ok(r.remaining <= 54, `Expected remaining <=54, got ${r.remaining}`);
  });

  it("skips key check when no apiKeyPrefix", () => {
    const r = checkDualRateLimit("11.0.0.1", "", "free");
    assert.equal(r.allowed, true);
  });

  it("defaults to free plan limits for unknown plan", () => {
    // Exhaust free limit (10)
    for (let i = 0; i < 10; i++) {
      checkRateLimit("key:sk-seer-unknown", 10);
    }
    const r = checkDualRateLimit("12.0.0.1", "sk-seer-unknown", "mythical");
    assert.equal(r.allowed, false);
  });
});

// --- Reset helpers ---

describe("reset helpers", () => {
  it("_resetAll clears all windows", () => {
    checkRateLimit("test:reset1", 1);
    checkRateLimit("test:reset2", 1);

    // Both should be blocked
    assert.equal(checkRateLimit("test:reset1", 1).allowed, false);
    assert.equal(checkRateLimit("test:reset2", 1).allowed, false);

    _resetAll();

    // After reset, both should be allowed
    assert.equal(checkRateLimit("test:reset1", 1).allowed, true);
    assert.equal(checkRateLimit("test:reset2", 1).allowed, true);
  });
});

// --- checkPlanRateLimit (tool handler integration) ---

describe("checkPlanRateLimit", () => {
  it("returns null when under limit", () => {
    const result = checkPlanRateLimit("sk-seer-test-abc", "pro");
    assert.equal(result, null);
  });

  it("returns error JSON when free plan limit exceeded", () => {
    // Exhaust free plan limit (10 RPM)
    for (let i = 0; i < 10; i++) {
      checkPlanRateLimit("sk-seer-free-key", "free");
    }
    const result = checkPlanRateLimit("sk-seer-free-key", "free");
    assert.notEqual(result, null);
    const parsed = JSON.parse(result);
    assert.ok(parsed.error.includes("Rate limit exceeded"));
    assert.ok(parsed.error.includes("10 requests/min"));
    assert.ok(parsed.error.includes("free plan"));
    assert.ok(parsed.retry_after > 0);
  });

  it("applies correct limit per plan tier", () => {
    // Agency gets 120 RPM — 11 requests should pass
    for (let i = 0; i < 11; i++) {
      const r = checkPlanRateLimit("sk-seer-agency-key", "agency");
      assert.equal(r, null, `Request ${i + 1} should be allowed for agency`);
    }
  });

  it("uses free limit for unknown plans", () => {
    for (let i = 0; i < 10; i++) {
      checkPlanRateLimit("sk-seer-unknown-key", "mythical");
    }
    const result = checkPlanRateLimit("sk-seer-unknown-key", "mythical");
    assert.notEqual(result, null);
    const parsed = JSON.parse(result);
    assert.ok(parsed.error.includes("10 requests/min"));
  });

  it("uses plan: namespace to avoid colliding with ip:/key: namespaces", () => {
    // Fill up key: namespace for same key
    for (let i = 0; i < 60; i++) {
      checkRateLimit("key:sk-seer-ns-test", 60);
    }
    // plan: namespace should still be clean
    const result = checkPlanRateLimit("sk-seer-ns-test", "pro");
    assert.equal(result, null);
  });

  it("returns retry_after in seconds", () => {
    for (let i = 0; i < 10; i++) {
      checkPlanRateLimit("sk-seer-retry-test", "free");
    }
    const result = checkPlanRateLimit("sk-seer-retry-test", "free");
    const parsed = JSON.parse(result);
    assert.ok(parsed.retry_after >= 1, "retry_after should be at least 1 second");
    assert.ok(parsed.retry_after <= 60, "retry_after should be at most 60 seconds");
  });
});

// --- Retry-After accuracy ---

describe("retryAfterMs", () => {
  it("is 0 when allowed", () => {
    const r = checkRateLimit("test:retry-ok", 10);
    assert.equal(r.retryAfterMs, 0);
  });

  it("is positive and bounded when blocked", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("test:retry-block", 5);
    }
    const r = checkRateLimit("test:retry-block", 5);
    assert.equal(r.allowed, false);
    assert.ok(r.retryAfterMs > 0);
    assert.ok(r.retryAfterMs <= 60000);
  });
});
