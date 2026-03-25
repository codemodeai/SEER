import { supabase } from "./supabase.js";

export interface SeerUser {
  id: string;
  email: string;
  plan: "free" | "starter" | "pro" | "agency";
  usage_this_month: number;
  ai_preference: string;
  last_nudge_at: string | null;
  auto_suggest: boolean;
  suggestion_skin: "default" | "compact" | "focused";
  mfa_verified: boolean;
  prompt_count: number;
}

export async function authenticateUser(
  apiKey: string
): Promise<SeerUser | null> {
  if (!apiKey) return null;

  const { data, error } = await supabase
    .from("users")
    .select("id, email, plan, usage_this_month, ai_preference, last_nudge_at, auto_suggest, suggestion_skin, mfa_verified, prompt_count")
    .eq("seer_api_key", apiKey)
    .single();

  if (error || !data) return null;
  return data as SeerUser;
}

export const PLAN_LIMITS: Record<string, number> = {
  free: 50,
  starter: 200,
  pro: 1000,
  agency: Infinity,
};
