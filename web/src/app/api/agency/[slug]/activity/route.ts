import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase-server";

const IDLE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

async function getAuthUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

async function getAgencyAccess(slug: string, userId: string) {
  const admin = getSupabaseAdmin();

  const { data: agency } = await admin
    .from("agencies")
    .select("id, owner_id")
    .eq("slug", slug)
    .single();

  if (!agency) return null;

  const isOwner = agency.owner_id === userId;
  if (!isOwner) {
    const { data: membership } = await admin
      .from("agency_users")
      .select("role")
      .eq("agency_id", agency.id)
      .eq("user_id", userId)
      .single();

    if (!membership) return null;
  }

  return agency;
}

// GET /api/agency/[slug]/activity — fetch activity feed + smart suggestions
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const agency = await getAgencyAccess(slug, user.id);
    if (!agency) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const admin = getSupabaseAdmin();
    const now = new Date();
    const idleCutoff = new Date(now.getTime() - IDLE_THRESHOLD_MS).toISOString();

    // Mark stale entries as idle
    await admin
      .from("agency_activity")
      .update({ status: "idle" })
      .eq("agency_id", agency.id)
      .eq("status", "active")
      .lt("last_seen", idleCutoff);

    // Fetch all activity with user emails
    const { data: activities, error } = await admin
      .from("agency_activity")
      .select("id, user_id, project_name, feature_label, status, last_seen, created_at, users!agency_activity_user_id_fkey(email)")
      .eq("agency_id", agency.id)
      .order("last_seen", { ascending: false });

    if (error) {
      console.error("Fetch activity error:", error);
      return NextResponse.json({ error: "Failed to fetch activity" }, { status: 500 });
    }

    const formatted = (activities ?? []).map((a: any) => ({
      id: a.id,
      userId: a.user_id,
      email: a.users?.email ?? null,
      projectName: a.project_name,
      featureLabel: a.feature_label,
      status: a.status,
      lastSeen: a.last_seen,
      createdAt: a.created_at,
    }));

    // --- Smart suggestions ---
    const activeEntries = formatted.filter((a) => a.status === "active");
    const suggestions = generateSuggestions(activeEntries, user.id);

    return NextResponse.json({ activities: formatted, suggestions });
  } catch (err) {
    console.error("Agency activity GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST /api/agency/[slug]/activity — heartbeat (create or update activity)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const agency = await getAgencyAccess(slug, user.id);
    if (!agency) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await req.json();
    const projectName = String(body.project_name ?? "").trim();
    const featureLabel = String(body.feature_label ?? "").trim();

    if (!projectName) {
      return NextResponse.json({ error: "project_name is required" }, { status: 400 });
    }

    if (projectName.length > 100) {
      return NextResponse.json({ error: "project_name must be under 100 characters" }, { status: 400 });
    }

    if (featureLabel.length > 200) {
      return NextResponse.json({ error: "feature_label must be under 200 characters" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Upsert: update if exists, insert if new
    const { data: existing } = await admin
      .from("agency_activity")
      .select("id")
      .eq("agency_id", agency.id)
      .eq("user_id", user.id)
      .eq("project_name", projectName)
      .single();

    if (existing) {
      const { error: updateErr } = await admin
        .from("agency_activity")
        .update({
          feature_label: featureLabel,
          status: "active",
          last_seen: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (updateErr) {
        console.error("Update activity error:", updateErr);
        return NextResponse.json({ error: "Failed to update activity" }, { status: 500 });
      }

      return NextResponse.json({ success: true, action: "updated" });
    } else {
      const { error: insertErr } = await admin
        .from("agency_activity")
        .insert({
          agency_id: agency.id,
          user_id: user.id,
          project_name: projectName,
          feature_label: featureLabel,
          status: "active",
          last_seen: new Date().toISOString(),
        });

      if (insertErr) {
        console.error("Insert activity error:", insertErr);
        return NextResponse.json({ error: "Failed to create activity" }, { status: 500 });
      }

      return NextResponse.json({ success: true, action: "created" });
    }
  } catch (err) {
    console.error("Agency activity POST error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE /api/agency/[slug]/activity — clear own activity or admin clears any
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    const { data: agency } = await admin
      .from("agencies")
      .select("id, owner_id")
      .eq("slug", slug)
      .single();

    if (!agency) {
      return NextResponse.json({ error: "Agency not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const activityId = searchParams.get("activity_id");

    if (!activityId) {
      return NextResponse.json({ error: "activity_id query param is required" }, { status: 400 });
    }

    // Check ownership or admin role
    const isOwner = agency.owner_id === user.id;
    if (!isOwner) {
      const { data: activity } = await admin
        .from("agency_activity")
        .select("user_id")
        .eq("id", activityId)
        .eq("agency_id", agency.id)
        .single();

      if (!activity) {
        return NextResponse.json({ error: "Activity not found" }, { status: 404 });
      }

      // Members can only clear their own activity
      if (activity.user_id !== user.id) {
        const { data: membership } = await admin
          .from("agency_users")
          .select("role")
          .eq("agency_id", agency.id)
          .eq("user_id", user.id)
          .single();

        if (!membership || membership.role !== "admin") {
          return NextResponse.json({ error: "Can only clear your own activity" }, { status: 403 });
        }
      }
    }

    const { error: deleteErr } = await admin
      .from("agency_activity")
      .delete()
      .eq("id", activityId)
      .eq("agency_id", agency.id);

    if (deleteErr) {
      console.error("Delete activity error:", deleteErr);
      return NextResponse.json({ error: "Failed to delete activity" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Agency activity DELETE error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// --- Smart Suggestion Engine ---
interface ActivityEntry {
  userId: string;
  email: string | null;
  projectName: string;
  featureLabel: string;
  status: string;
}

interface Suggestion {
  type: "conflict" | "available" | "idle";
  message: string;
  featureLabel?: string;
  projectName?: string;
}

function generateSuggestions(
  activeEntries: ActivityEntry[],
  currentUserId: string
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // Group active entries by project + feature
  const featureWorkers = new Map<string, ActivityEntry[]>();
  for (const entry of activeEntries) {
    if (!entry.featureLabel) continue;
    const key = `${entry.projectName}::${entry.featureLabel.toLowerCase()}`;
    const existing = featureWorkers.get(key) ?? [];
    existing.push(entry);
    featureWorkers.set(key, existing);
  }

  // Detect conflicts: multiple people on the same feature
  for (const [, workers] of featureWorkers) {
    if (workers.length > 1) {
      const currentUserInvolved = workers.some((w) => w.userId === currentUserId);
      const names = workers.map((w) => w.email?.split("@")[0] ?? "someone");

      if (currentUserInvolved) {
        const others = workers
          .filter((w) => w.userId !== currentUserId)
          .map((w) => w.email?.split("@")[0] ?? "someone");
        suggestions.push({
          type: "conflict",
          message: `${others.join(", ")} is also working on "${workers[0].featureLabel}" in ${workers[0].projectName}. Consider coordinating or switching to a different feature.`,
          featureLabel: workers[0].featureLabel,
          projectName: workers[0].projectName,
        });
      } else {
        suggestions.push({
          type: "conflict",
          message: `${names.join(" & ")} are both working on "${workers[0].featureLabel}" in ${workers[0].projectName}. Potential overlap detected.`,
          featureLabel: workers[0].featureLabel,
          projectName: workers[0].projectName,
        });
      }
    }
  }

  // Suggest available features: projects where user isn't active yet
  const userProjects = new Set(
    activeEntries
      .filter((a) => a.userId === currentUserId)
      .map((a) => a.projectName)
  );

  const otherProjects = new Set(
    activeEntries
      .filter((a) => a.userId !== currentUserId)
      .map((a) => a.projectName)
  );

  for (const proj of otherProjects) {
    if (!userProjects.has(proj)) {
      const workers = activeEntries.filter(
        (a) => a.projectName === proj && a.userId !== currentUserId
      );
      const busyFeatures = workers
        .filter((w) => w.featureLabel)
        .map((w) => w.featureLabel);

      if (busyFeatures.length > 0) {
        suggestions.push({
          type: "available",
          message: `${proj} has active work on ${busyFeatures.map((f) => `"${f}"`).join(", ")}. Consider picking up a different feature in this project.`,
          projectName: proj,
        });
      }
    }
  }

  return suggestions;
}
