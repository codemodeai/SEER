import { getSupabaseAdmin } from "./supabase-server";

/** Check if a user has Founder's Space access (fs_access=true OR plan is pro/agency) */
export async function checkFsAccess(userId: string): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("users")
    .select("fs_access, plan")
    .eq("id", userId)
    .single();
  if (!data) return false;
  return data.fs_access === true || data.plan === "pro" || data.plan === "agency";
}
