import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase-server";

function generateSeerApiKey(): string {
  return `sk-seer-${crypto.randomBytes(24).toString("hex")}`;
}

export async function POST(req: NextRequest) {
  try {
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

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    // Get display name from auth metadata
    const displayName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "User";

    // Check if user record already exists
    const { data: existing } = await admin
      .from("users")
      .select("id, seer_api_key, plan, mfa_verified, prompt_count, created_at, suggestion_skin, auto_suggest")
      .eq("id", user.id)
      .single();

    // Get usage count for current month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { count: usageCount } = await admin
      .from("seer_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("timestamp", monthStart);

    if (existing) {
      let currentPlan = existing.plan;

      // Self-heal: check if user has an active subscription but wrong plan
      if (currentPlan === "free") {
        const { data: activeSub } = await admin
          .from("subscriptions")
          .select("plan")
          .eq("user_id", user.id)
          .eq("status", "active")
          .single();

        if (activeSub && activeSub.plan !== "free") {
          console.warn(`Self-healing: User ${user.id} has active ${activeSub.plan} subscription but plan is "free". Fixing.`);
          await admin
            .from("users")
            .update({ plan: activeSub.plan })
            .eq("id", user.id);
          currentPlan = activeSub.plan;
        } else {
          // Also check paid invoices as fallback
          const { data: latestInvoice } = await admin
            .from("invoices")
            .select("plan")
            .eq("user_id", user.id)
            .eq("status", "paid")
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          if (latestInvoice && latestInvoice.plan !== "free") {
            console.warn(`Self-healing: User ${user.id} has paid ${latestInvoice.plan} invoice but plan is "free". Fixing.`);
            await admin
              .from("users")
              .update({ plan: latestInvoice.plan })
              .eq("id", user.id);
            currentPlan = latestInvoice.plan;
          }
        }
      }

      // Look up agency slug (owner or member)
      let agencySlug: string | null = null;
      let agencyName: string | null = null;
      let agencyRole: string | null = null;
      const { data: ownedAgency } = await admin
        .from("agencies")
        .select("slug, name")
        .eq("owner_id", user.id)
        .eq("status", "active")
        .limit(1)
        .single();

      if (ownedAgency) {
        agencySlug = ownedAgency.slug;
        agencyName = ownedAgency.name;
        agencyRole = "owner";
      } else {
        const { data: membership } = await admin
          .from("agency_users")
          .select("role, agency_id, agencies!agency_users_agency_id_fkey(slug, name)")
          .eq("user_id", user.id)
          .limit(1)
          .single();

        if (membership) {
          const role = (membership as any).role ?? "member";
          agencyName = (membership as any).agencies?.name ?? null;
          agencyRole = role;
          // Only owner/admin can access the agency portal — members see their own dashboard only
          if (role === "admin") {
            agencySlug = (membership as any).agencies?.slug ?? null;
          }
          // All agency members get unlimited access (agency plan)
          if (currentPlan !== "agency") {
            currentPlan = "agency";
            await admin.from("users").update({ plan: "agency" }).eq("id", user.id);
          }
        }
      }

      return NextResponse.json({
        userId: user.id,
        userName: displayName,
        email: user.email,
        avatar: user.user_metadata?.avatar_url || "",
        provider: user.app_metadata?.provider || "email",
        plan: currentPlan,
        usage: usageCount ?? 0,
        mfaVerified: existing.mfa_verified ?? false,
        promptCount: existing.prompt_count ?? 0,
        seerApiKey: existing.seer_api_key,
        createdAt: existing.created_at,
        suggestionSkin: existing.suggestion_skin || "default",
        autoSuggest: existing.auto_suggest ?? true,
        agencySlug,
        agencyName,
        agencyRole,
      });
    }

    // Create user record with SEER API key
    const plan = user.user_metadata?.plan ?? "free";
    const seerApiKey = generateSeerApiKey();

    const { error } = await admin.from("users").insert({
      id: user.id,
      email: user.email,
      seer_api_key: seerApiKey,
      plan,
      usage_this_month: 0,
      ai_preference: "claude",
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("User creation error:", error);
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }

    return NextResponse.json({
      userId: user.id,
      userName: displayName,
      email: user.email,
      avatar: user.user_metadata?.avatar_url || "",
      provider: user.app_metadata?.provider || "email",
      plan,
      usage: usageCount ?? 0,
      mfaVerified: false,
      promptCount: 0,
      seerApiKey,
      createdAt: new Date().toISOString(),
      suggestionSkin: "default",
      autoSuggest: true,
      agencySlug: null,
    });
  } catch (err) {
    console.error("Setup user error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
