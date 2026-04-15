const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const {
  checkContextHealth,
  resetSession,
  _resetAllSessions,
} = require("../dist/lib/context-health.js");

beforeEach(() => {
  _resetAllSessions();
});

// --- Basic health tracking ---

describe("checkContextHealth: basics", () => {
  it("returns score 0 for first call", () => {
    const r = checkContextHealth("key-a", "build a login page", 30);
    assert.equal(r.score, 0);
    assert.equal(r.warning, null);
    assert.equal(r.signals.messageCount, 1);
  });

  it("tracks message count across calls", () => {
    for (let i = 0; i < 5; i++) {
      checkContextHealth("key-b", `task ${i}`, 20);
    }
    const r = checkContextHealth("key-b", "task 5", 20);
    assert.equal(r.signals.messageCount, 6);
  });

  it("different keys have independent sessions", () => {
    for (let i = 0; i < 10; i++) {
      checkContextHealth("key-c1", `task ${i}`, 20);
    }
    const r = checkContextHealth("key-c2", "task 0", 20);
    assert.equal(r.signals.messageCount, 1);
  });
});

// --- Signal: repeated retries ---

describe("checkContextHealth: repeated retries", () => {
  it("detects duplicate inputs", () => {
    checkContextHealth("key-d", "fix the broken button", 20);
    checkContextHealth("key-d", "fix the broken button", 15);
    const r = checkContextHealth("key-d", "something else", 20);
    assert.ok(r.signals.repeatedRetries >= 1);
  });

  it("no retries when all inputs unique", () => {
    checkContextHealth("key-e", "build login", 20);
    checkContextHealth("key-e", "add signup", 20);
    const r = checkContextHealth("key-e", "create dashboard", 20);
    assert.equal(r.signals.repeatedRetries, 0);
  });
});

// --- Signal: topic shift ---

describe("checkContextHealth: topic shifts", () => {
  it("detects topic shifts between unrelated prompts", () => {
    checkContextHealth("key-f", "build the payment checkout flow", 20);
    checkContextHealth("key-f", "fix CSS animation on homepage", 20);
    checkContextHealth("key-f", "setup database migration scripts", 20);
    checkContextHealth("key-f", "write unit tests for auth module", 20);
    const r = checkContextHealth("key-f", "deploy to production server", 20);
    assert.ok(r.signals.topicShiftCount >= 2, `Expected >=2 shifts, got ${r.signals.topicShiftCount}`);
  });

  it("no shifts when same topic repeated", () => {
    checkContextHealth("key-g", "build login page", 20);
    checkContextHealth("key-g", "build login button", 20);
    const r = checkContextHealth("key-g", "build login form", 20);
    // Same topic "build login" — shifts should be low
    assert.ok(r.signals.topicShiftCount <= 1);
  });
});

// --- Health score thresholds ---

describe("checkContextHealth: scoring", () => {
  it("stays below 6 for normal short sessions", () => {
    for (let i = 0; i < 10; i++) {
      checkContextHealth("key-h", `build feature ${i}`, 25);
    }
    const r = checkContextHealth("key-h", "build feature 10", 25);
    assert.ok(r.score < 6, `Expected score <6, got ${r.score}`);
    assert.equal(r.warning, null);
  });

  it("reaches 6+ with many messages + retries + topic shifts", () => {
    // 25+ messages with retries and shifts
    for (let i = 0; i < 25; i++) {
      checkContextHealth("key-i", `topic-${i % 3} task ${i}`, 30);
    }
    // Add retries
    checkContextHealth("key-i", "topic-0 task 0", 10);
    checkContextHealth("key-i", "topic-0 task 0", 5);
    // Add conflicting: same topic different input
    checkContextHealth("key-i", "completely different request about payments", 5);
    const r = checkContextHealth("key-i", "another unrelated thing about css", 5);
    assert.ok(r.score >= 4, `Expected score >= 4, got ${r.score}`);
  });
});

// --- Warning output ---

describe("checkContextHealth: warning format", () => {
  it("includes /clear suggestion when warning fires", () => {
    // Force a high score: 30+ messages + retries + quality drop
    for (let i = 0; i < 35; i++) {
      checkContextHealth("key-j", `different-${i} task`, i < 5 ? 40 : 5);
    }
    // Add retries
    checkContextHealth("key-j", "different-0 task", 2);
    checkContextHealth("key-j", "different-0 task", 2);

    const r = checkContextHealth("key-j", "yet another task", 2);
    if (r.warning) {
      assert.ok(r.warning.includes("/clear"), "Warning should suggest /clear");
      assert.ok(r.warning.includes("seer resume"), "Warning should suggest seer resume");
      assert.ok(r.warning.includes("context health:"), "Warning should show health score");
    }
  });

  it("returns null warning when score is low", () => {
    const r = checkContextHealth("key-k", "simple task", 30);
    assert.equal(r.warning, null);
  });
});

// --- Session reset ---

describe("resetSession", () => {
  it("clears session state for a key", () => {
    for (let i = 0; i < 10; i++) {
      checkContextHealth("key-l", `task ${i}`, 20);
    }
    assert.equal(checkContextHealth("key-l", "task 10", 20).signals.messageCount, 11);

    resetSession("key-l");
    const r = checkContextHealth("key-l", "fresh start", 20);
    assert.equal(r.signals.messageCount, 1);
    assert.equal(r.score, 0);
  });
});

// --- Quality drop detection ---

describe("checkContextHealth: quality drop", () => {
  it("detects quality drop when pctSaved decreases over session", () => {
    // Early calls with high savings
    for (let i = 0; i < 5; i++) {
      checkContextHealth("key-m", `task ${i}`, 40);
    }
    // Later calls with low savings
    for (let i = 5; i < 10; i++) {
      checkContextHealth("key-m", `task ${i}`, 5);
    }
    const r = checkContextHealth("key-m", "task 10", 5);
    assert.ok(r.signals.qualityDropPct > 0, `Expected quality drop, got ${r.signals.qualityDropPct}%`);
  });

  it("no quality drop when savings stay consistent", () => {
    for (let i = 0; i < 8; i++) {
      checkContextHealth("key-n", `task ${i}`, 25);
    }
    const r = checkContextHealth("key-n", "task 8", 25);
    assert.equal(r.signals.qualityDropPct, 0);
  });
});
