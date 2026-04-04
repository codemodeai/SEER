import { getSupabaseAdmin } from "@/lib/supabase-server";

/**
 * Check if a feature is enabled for an agency.
 * Returns the enabled_features object or null if agency not found.
 */
export async function checkAgencyFeature(
  agencyId: string,
  feature: string
): Promise<{ enabled: boolean; features: Record<string, boolean> }> {
  const admin = getSupabaseAdmin();
  const { data: agency } = await admin
    .from("agencies")
    .select("enabled_features")
    .eq("id", agencyId)
    .single();

  if (!agency) return { enabled: false, features: {} };

  const features = agency.enabled_features ?? { announcements: true, project_management: false };
  return { enabled: features[feature] === true, features };
}
