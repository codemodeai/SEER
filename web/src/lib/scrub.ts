const SCRUB_PATTERNS: [RegExp, string][] = [
  [/sk-seer-[a-zA-Z0-9-]+/g, "sk-seer-***REDACTED***"],
  [/sk-ant-[a-zA-Z0-9-]+/g, "sk-ant-***REDACTED***"],
  [/sk-proj-[a-zA-Z0-9-]+/g, "sk-proj-***REDACTED***"],
  [/supabase_service_role_key\s*[:=]\s*\S+/gi, "REDACTED"],
  [/Bearer\s+\S+/g, "Bearer ***REDACTED***"],
];

export function scrubSensitive(text: string): string {
  let result = text;
  for (const [pattern, replacement] of SCRUB_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

export function sanitizeForLog(
  obj: Record<string, unknown>
): Record<string, unknown> {
  const SCRUB_KEYS = [
    "authorization",
    "password",
    "seer_api_key",
    "token",
    "secret",
  ];
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) =>
      SCRUB_KEYS.some((s) => k.toLowerCase().includes(s))
        ? [k, "[REDACTED]"]
        : [k, v]
    )
  );
}
