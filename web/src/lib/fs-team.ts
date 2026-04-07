// Founder's Space — Agency team helper
// Resolves the user's agency membership for shared vault operations

import { getSupabaseAdmin } from "./supabase-server";

export interface AgencyMembership {
  agencyId: string;
  role: "admin" | "member";
  isOwner: boolean;
  canWrite: boolean; // owner or admin
}

/**
 * Get the user's agency membership (if any).
 * Returns null if the user is not part of any agency.
 */
export async function getAgencyMembership(userId: string): Promise<AgencyMembership | null> {
  const admin = getSupabaseAdmin();

  // Check if user owns an agency
  const { data: ownedAgency } = await admin
    .from("agencies")
    .select("id")
    .eq("owner_id", userId)
    .eq("status", "active")
    .limit(1)
    .single();

  if (ownedAgency) {
    return {
      agencyId: ownedAgency.id,
      role: "admin",
      isOwner: true,
      canWrite: true,
    };
  }

  // Check if user is a member of an agency
  const { data: membership } = await admin
    .from("agency_users")
    .select("agency_id, role")
    .eq("user_id", userId)
    .limit(1)
    .single();

  if (membership) {
    return {
      agencyId: membership.agency_id,
      role: membership.role as "admin" | "member",
      isOwner: false,
      canWrite: membership.role === "admin",
    };
  }

  return null;
}
