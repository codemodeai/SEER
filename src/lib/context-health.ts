// Spec §07 — Smart Context Management
//
// Monitors 5 health signals per session (keyed by API key).
// Runs silently on every seer_run call. Appends a warning when
// health score reaches 6 or above.

const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour session window

/** One entry per seer call in the session. */
interface SessionEntry {
  ts: number;
  inputHash: string;
  topic: string; // first 3 significant words (lowercased)
  pctSaved: number; // quality proxy — token savings %
}

interface SessionState {
  entries: SessionEntry[];
  expiresAt: number;
}

const sessions = new Map<string, SessionState>();

/** Evict stale sessions every 10 minutes. */
setInterval(() => {
  const now = Date.now();
  for (const [key, state] of sessions) {
    if (state.expiresAt < now) sessions.delete(key);
  }
}, 10 * 60_000).unref?.();

/** Simple hash: first 32 chars of lowercased trimmed input. */
function hashInput(input: string): string {
  return input.trim().toLowerCase().slice(0, 64);
}

/** Extract topic: first 3 non-stopword words. */
const STOP_WORDS = new Set(["the", "a", "an", "is", "are", "to", "for", "and", "or", "of", "in", "on", "it", "this", "that", "with", "from", "my", "i", "me", "we", "our", "seer", "please", "can", "you", "do", "be"]);

function extractTopic(input: string): string {
  const words = input.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
  return words.slice(0, 3).join(" ");
}

/** Jaccard similarity between two topic strings. */
function topicSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(" ").filter(Boolean));
  const setB = new Set(b.split(" ").filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const w of setA) {
    if (setB.has(w)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

export interface HealthSignals {
  messageCount: number;
  hasConflictingInstructions: boolean;
  qualityDropPct: number; // % drop from session start
  repeatedRetries: number; // count of duplicate inputs
  topicShiftCount: number; // number of major topic shifts
}

export interface HealthResult {
  score: number; // 0-10 (0=healthy, 10=critical)
  signals: HealthSignals;
  warning: string | null; // null when score < 6
}

/**
 * Record a call and compute context health.
 *
 * @param apiKey  - User's API key (session key)
 * @param input   - Raw user input
 * @param pctSaved - Token savings % from this call (quality proxy)
 */
export function checkContextHealth(
  apiKey: string,
  input: string,
  pctSaved: number
): HealthResult {
  const now = Date.now();

  // Get or create session
  let state = sessions.get(apiKey);
  if (!state || state.expiresAt < now) {
    state = { entries: [], expiresAt: now + SESSION_TTL_MS };
    sessions.set(apiKey, state);
  }

  // Evict entries older than session window
  state.entries = state.entries.filter(e => e.ts > now - SESSION_TTL_MS);

  // Record this call
  const entry: SessionEntry = {
    ts: now,
    inputHash: hashInput(input),
    topic: extractTopic(input),
    pctSaved,
  };
  state.entries.push(entry);
  state.expiresAt = now + SESSION_TTL_MS;

  // --- Compute 5 signals ---

  const entries = state.entries;

  // 1. Context length (message count)
  const messageCount = entries.length;

  // 2. Conflicting instructions — detect if same topic appears with very different
  //    inputs (same topic, different hash = potential contradiction)
  let hasConflictingInstructions = false;
  if (entries.length >= 3) {
    const topicGroups = new Map<string, string[]>();
    for (const e of entries) {
      if (!e.topic) continue;
      const group = topicGroups.get(e.topic) ?? [];
      group.push(e.inputHash);
      topicGroups.set(e.topic, group);
    }
    for (const [, hashes] of topicGroups) {
      if (hashes.length >= 2) {
        const unique = new Set(hashes);
        if (unique.size >= 2) {
          hasConflictingInstructions = true;
          break;
        }
      }
    }
  }

  // 3. Quality drop — compare current pctSaved with first 3 entries average
  let qualityDropPct = 0;
  if (entries.length >= 5) {
    const earlyAvg = entries.slice(0, 3).reduce((s, e) => s + e.pctSaved, 0) / 3;
    const recentAvg = entries.slice(-3).reduce((s, e) => s + e.pctSaved, 0) / 3;
    if (earlyAvg > 0 && recentAvg < earlyAvg) {
      qualityDropPct = Math.round(((earlyAvg - recentAvg) / earlyAvg) * 100);
    }
  }

  // 4. Repeated retries — count duplicate input hashes
  let repeatedRetries = 0;
  const hashCounts = new Map<string, number>();
  for (const e of entries) {
    hashCounts.set(e.inputHash, (hashCounts.get(e.inputHash) ?? 0) + 1);
  }
  for (const count of hashCounts.values()) {
    if (count >= 2) repeatedRetries += count - 1;
  }

  // 5. Topic shift — count transitions where Jaccard similarity < 0.2
  let topicShiftCount = 0;
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].topic && entries[i - 1].topic) {
      const sim = topicSimilarity(entries[i].topic, entries[i - 1].topic);
      if (sim < 0.2) topicShiftCount++;
    }
  }

  const signals: HealthSignals = {
    messageCount,
    hasConflictingInstructions,
    qualityDropPct,
    repeatedRetries,
    topicShiftCount,
  };

  // --- Compute health score (0-10) ---
  let score = 0;

  // Message count: 0-20 = 0, 20-30 = +1, 30-40 = +2, 40+ = +3
  if (messageCount > 40) score += 3;
  else if (messageCount > 30) score += 2;
  else if (messageCount > 20) score += 1;

  // Conflicting instructions: +2
  if (hasConflictingInstructions) score += 2;

  // Quality drop: >10% = +1, >25% = +2, >40% = +3
  if (qualityDropPct > 40) score += 3;
  else if (qualityDropPct > 25) score += 2;
  else if (qualityDropPct > 10) score += 1;

  // Repeated retries: 1 = +1, 2+ = +2
  if (repeatedRetries >= 2) score += 2;
  else if (repeatedRetries >= 1) score += 1;

  // Topic shifts: 3+ = +1, 5+ = +2
  if (topicShiftCount >= 5) score += 2;
  else if (topicShiftCount >= 3) score += 1;

  score = Math.min(10, score);

  // --- Build warning (only if score >= 6) ---
  let warning: string | null = null;
  if (score >= 6) {
    const issues: string[] = [];
    if (messageCount > 20) issues.push(`your session has ${messageCount} messages`);
    if (hasConflictingInstructions) issues.push("conflicting instructions detected");
    if (qualityDropPct > 10) issues.push(`output quality dropped ${qualityDropPct}%`);
    if (repeatedRetries >= 1) issues.push(`${repeatedRetries} repeated retries detected`);
    if (topicShiftCount >= 3) issues.push(`${topicShiftCount} topic shifts`);

    warning = `\n\n---\n[SEER] context warning\n\n${issues.join(". ")}.\n\nclaude is carrying dead weight — your next prompts\nwill cost more and produce worse results.\n\ntype /clear to reset.\nthen type seer resume — seer will instantly restore\nyour full project memory into the clean session so\nclaude knows your stack, decisions, and past errors\nwithout you re-explaining anything.\n\ncontext health: ${score}/10 (${score >= 8 ? "critical" : "degraded"})\n---`;
  }

  return { score, signals, warning };
}

/** Reset session for a key — used after seer resume or for testing. */
export function resetSession(apiKey: string): void {
  sessions.delete(apiKey);
}

/** Reset all sessions — for testing. */
export function _resetAllSessions(): void {
  sessions.clear();
}
