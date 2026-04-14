import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env["ANTHROPIC_API_KEY"] ?? "",
});

const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_MAX_TOKENS = 800;

export interface HaikuCallOptions {
  systemPrompt: string;
  userInput: string;
  maxTokens?: number; // Smart Token Allocation — dynamic budget from complexity scoring
}

export async function callHaiku({
  systemPrompt,
  userInput,
  maxTokens,
}: HaikuCallOptions): Promise<string> {
  const response = await anthropic.messages.create({
    model: HAIKU_MODEL,
    max_tokens: maxTokens ?? DEFAULT_MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: "user", content: userInput }],
  });

  const block = response.content[0];
  return block && block.type === "text" ? block.text : "{}";
}

/** Rough token estimate: ~1.3 tokens per word */
export function estimateTokens(text: string): number {
  return Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.3);
}

/** Strip markdown code fences from Haiku response and parse JSON */
export function parseHaikuJson(text: string): Record<string, unknown> | null {
  // Remove ```json ... ``` or ``` ... ``` wrappers
  const stripped = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  try {
    return JSON.parse(stripped);
  } catch {
    // Try parsing original text as fallback
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
}
