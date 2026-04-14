// Smart Token Allocation — Complexity scoring and dynamic token budget.
// Scores every prompt 1-10 and assigns minimum sufficient max_tokens.

export interface ComplexityResult {
  score: number;        // 1-10
  maxTokens: number;    // dynamic token budget for Haiku
  signals: string[];    // which signals fired (for debugging/logging)
}

// --- Complexity scoring signals ---

const SIGNAL_PATTERNS: Array<{ name: string; pattern: RegExp; weight: number }> = [
  // High complexity signals (+2 each)
  { name: "multi-file",       pattern: /\b(multiple files|across files|all files|every file|refactor|restructure|reorganize)\b/i, weight: 2 },
  { name: "architecture",     pattern: /\b(architect|design system|database schema|migration|infrastructure|deploy|ci\/cd|pipeline)\b/i, weight: 2 },
  { name: "full-feature",     pattern: /\b(build|create|implement|develop|add feature|new feature|full|complete|end.to.end|e2e)\b/i, weight: 2 },
  { name: "multi-step",       pattern: /\b(step[s ]|phase[s ]|stage[s ]|then |after that|first .* then|workflow|pipeline|sequence)\b/i, weight: 2 },

  // Medium complexity signals (+1 each)
  { name: "integration",      pattern: /\b(integrate|connect|hook up|wire|api|endpoint|webhook|third.party|external)\b/i, weight: 1 },
  { name: "debugging",        pattern: /\b(debug|fix|bug|error|broken|not working|crash|fail|issue|investigate)\b/i, weight: 1 },
  { name: "testing",          pattern: /\b(test|spec|assert|expect|mock|coverage|unit test|integration test)\b/i, weight: 1 },
  { name: "security",         pattern: /\b(security|auth|encrypt|token|permission|role|rls|injection|xss|csrf)\b/i, weight: 1 },
  { name: "data-processing",  pattern: /\b(parse|transform|convert|map|filter|reduce|aggregate|batch|bulk|stream)\b/i, weight: 1 },
  { name: "config",           pattern: /\b(config|setup|install|environment|env|settings|initialize)\b/i, weight: 1 },

  // Low complexity signals (+0.5 each — minor additions)
  { name: "single-change",    pattern: /\b(rename|move|update|change|modify|tweak|adjust|swap)\b/i, weight: 0.5 },
  { name: "documentation",    pattern: /\b(document|comment|readme|explain|describe|jsdoc)\b/i, weight: 0.5 },
  { name: "styling",          pattern: /\b(style|css|tailwind|color|font|layout|margin|padding|responsive)\b/i, weight: 0.5 },
];

// Length-based complexity boost
function lengthSignal(input: string): { weight: number; name: string } | null {
  const wordCount = input.split(/\s+/).filter(Boolean).length;
  if (wordCount > 100) return { name: "long-prompt", weight: 2 };
  if (wordCount > 50)  return { name: "medium-prompt", weight: 1 };
  return null;
}

// Code presence boost — if the prompt contains code blocks
function codeSignal(input: string): { weight: number; name: string } | null {
  const codeBlocks = (input.match(/```/g) || []).length;
  if (codeBlocks >= 2) return { name: "code-blocks", weight: 1.5 };
  return null;
}

// List/enumeration boost — numbered or bulleted lists suggest multi-part work
function listSignal(input: string): { weight: number; name: string } | null {
  const listItems = (input.match(/^[\s]*[-*•]\s|^\s*\d+[.)]\s/gm) || []).length;
  if (listItems >= 4) return { name: "long-list", weight: 2 };
  if (listItems >= 2) return { name: "short-list", weight: 1 };
  return null;
}

// --- Token allocation formula ---
// Score 1-2:  300 tokens (simple renames, one-liners)
// Score 3-4:  500 tokens (single fixes, small changes)
// Score 5-6:  800 tokens (medium features, integrations)
// Score 7-8:  1200 tokens (full features, multi-step work)
// Score 9-10: 1600 tokens (architecture, multi-file refactors)

const TOKEN_TIERS: Array<{ maxScore: number; tokens: number }> = [
  { maxScore: 2,  tokens: 300 },
  { maxScore: 4,  tokens: 500 },
  { maxScore: 6,  tokens: 800 },
  { maxScore: 8,  tokens: 1200 },
  { maxScore: 10, tokens: 1600 },
];

function scoreToTokens(score: number): number {
  for (const tier of TOKEN_TIERS) {
    if (score <= tier.maxScore) return tier.tokens;
  }
  return 1600; // fallback max
}

// --- Main scoring function ---

export function scoreComplexity(input: string): ComplexityResult {
  let rawScore = 1; // base score
  const signals: string[] = [];

  // Pattern-based signals
  for (const signal of SIGNAL_PATTERNS) {
    if (signal.pattern.test(input)) {
      rawScore += signal.weight;
      signals.push(signal.name);
    }
  }

  // Length signal
  const len = lengthSignal(input);
  if (len) {
    rawScore += len.weight;
    signals.push(len.name);
  }

  // Code signal
  const code = codeSignal(input);
  if (code) {
    rawScore += code.weight;
    signals.push(code.name);
  }

  // List signal
  const list = listSignal(input);
  if (list) {
    rawScore += list.weight;
    signals.push(list.name);
  }

  // Clamp to 1-10
  const score = Math.min(10, Math.max(1, Math.round(rawScore)));
  const maxTokens = scoreToTokens(score);

  return { score, maxTokens, signals };
}
