import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env["VITE_SUPABASE_URL"] as string;
const SUPABASE_ANON_KEY = import.meta.env["VITE_SUPABASE_ANON_KEY"] as string;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: "pkce",
  },
});

// Fetch the user's SEER API key directly via REST, using the access token
// we just received. Bypassing the supabase-js client avoids any hangs from
// concurrent auth locks while the session is still being installed.
export async function getApiKey(userId: string, accessToken?: string): Promise<string | null> {
  if (accessToken) {
    const url = `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(userId)}&select=seer_api_key`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      console.error("[SEER] getApiKey REST failed:", res.status, await res.text());
      return null;
    }
    const rows = (await res.json()) as Array<{ seer_api_key: string | null }>;
    return rows[0]?.seer_api_key ?? null;
  }

  const { data } = await supabase
    .from("users")
    .select("seer_api_key")
    .eq("id", userId)
    .single();
  return (data?.seer_api_key as string | null) ?? null;
}
