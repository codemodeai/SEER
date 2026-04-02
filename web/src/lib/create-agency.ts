import { SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const short = crypto.randomBytes(3).toString("hex");
  const slug = base ? `${base}-${short}` : `agency-${short}`;
  // Ensure minimum length of 3
  return slug.length < 3 ? `agency-${short}` : slug;
}

export async function createAgencyForUser(
  admin: SupabaseClient,
  userId: string,
  email: string,
  maxUsers?: number
): Promise<{ slug: string; id: string } | null> {
  // Check if user already owns an agency
  const { data: existing } = await admin
    .from("agencies")
    .select("id, slug")
    .eq("owner_id", userId)
    .limit(1)
    .single();

  if (existing) {
    return { slug: existing.slug, id: existing.id };
  }

  // Generate agency name from email
  const namePart = email.split("@")[0] || "my";
  const defaultName =
    namePart.charAt(0).toUpperCase() + namePart.slice(1) + "'s Agency";
  const slug = generateSlug(namePart);

  // Create agency
  const { data: agency, error: agencyErr } = await admin
    .from("agencies")
    .insert({
      name: defaultName,
      slug,
      owner_id: userId,
      plan: "agency",
      max_users: maxUsers ?? 5,
      status: "active",
    })
    .select("id, slug")
    .single();

  if (agencyErr) {
    console.error("Agency creation error:", agencyErr);
    return null;
  }

  return { slug: agency.slug, id: agency.id };
}
