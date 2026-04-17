/**
 * Supabase Auth Integration.
 * Validates user session/API key passed from the Desktop App via IPC on startup.
 * Reuses the same `users` table + `seer_api_key` validation as the MCP server.
 */

import { createClient } from "@supabase/supabase-js";
import type { AgentSession } from "./types.js";

const SUPABASE_URL = process.env["SUPABASE_URL"] ?? "";
const SUPABASE_SERVICE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const SEER_API_BASE = process.env["SEER_API_BASE"] ?? "https://www.seermcp.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export async function validateSession(apiKey: string): Promise<AgentSession> {
  if (!apiKey || !apiKey.startsWith("sk-seer-")) {
    throw new Error("Invalid SEER API key format");
  }

  const { data: user, error } = await supabase
    .from("users")
    .select("id, email, plan, seer_api_key")
    .eq("seer_api_key", apiKey)
    .single();

  if (error || !user) {
    throw new Error("Invalid or expired SEER API key");
  }

  return {
    userId: user.id as string,
    apiKey,
    plan: user.plan as string,
    email: user.email as string,
  };
}

export async function exchangeSupabaseToken(accessToken: string): Promise<string> {
  // Called when Desktop App logs in via Supabase session (email/password or OAuth).
  // Exchanges the Supabase JWT for the user's SEER API key.
  const res = await fetch(`${SEER_API_BASE}/api/auth/api-key`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to exchange token: ${res.status}`);
  }

  const body = (await res.json()) as { apiKey: string };
  return body.apiKey;
}
