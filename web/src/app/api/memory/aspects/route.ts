import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import crypto from "crypto";

const ASPECTS = [
  "project_overview",
  "architecture",
  "features",
  "decisions",
  "errors_fixes",
  "session_log",
] as const;
type Aspect = typeof ASPECTS[number];

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

function isValidAspect(v: unknown): v is Aspect {
  return typeof v === "string" && (ASPECTS as readonly string[]).includes(v);
}

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

async function resolveScope(
  scope: string,
  userId: string
): Promise<
  | { ok: true; agencyId: string | null; canWrite: boolean; canDelete: boolean }
  | { ok: false; status: number; error: string }
> {
  if (scope === "personal" || !scope) {
    return { ok: true, agencyId: null, canWrite: true, canDelete: true };
  }
  const admin = getSupabaseAdmin();
  const { data: agency } = await admin
    .from("agencies")
    .select("id, owner_id")
    .eq("slug", scope)
    .single();
  if (!agency) return { ok: false, status: 404, error: "Agency not found" };

  const isOwner = agency.owner_id === userId;
  if (isOwner) return { ok: true, agencyId: agency.id, canWrite: true, canDelete: true };

  const { data: membership } = await admin
    .from("agency_users")
    .select("role")
    .eq("agency_id", agency.id)
    .eq("user_id", userId)
    .single();
  if (!membership) return { ok: false, status: 403, error: "Access denied" };

  return {
    ok: true,
    agencyId: agency.id,
    canWrite: true,
    canDelete: membership.role === "admin",
  };
}

// GET ?scope=personal|<agency-slug> [&project=NAME]
// - no project: list distinct project names with latest updated_at + total size
// - with project: return all 6 aspects
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const url = new URL(req.url);
    const scope = (url.searchParams.get("scope") ?? "personal").trim();
    const projectName = url.searchParams.get("project");

    const resolved = await resolveScope(scope, user.id);
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });

    const admin = getSupabaseAdmin();

    if (projectName) {
      const q = admin
        .from("project_memory_files")
        .select("aspect_type, content, content_hash, version, size_bytes, updated_at, updated_by")
        .eq("project_name", projectName);

      const { data, error } = resolved.agencyId
        ? await q.eq("agency_id", resolved.agencyId)
        : await q.eq("user_id", user.id).is("agency_id", null);

      if (error) {
        console.error("aspects GET error:", error);
        return NextResponse.json({ error: "Failed to load" }, { status: 500 });
      }

      const byAspect: Record<string, any> = {};
      for (const a of ASPECTS) {
        byAspect[a] = { aspect_type: a, content: "", version: 0, size_bytes: 0, updated_at: null };
      }
      for (const row of data ?? []) {
        byAspect[row.aspect_type] = {
          ...row,
          integrityOk: sha256(row.content) === row.content_hash,
        };
      }
      return NextResponse.json({
        project: projectName,
        scope: resolved.agencyId ? "agency" : "personal",
        canWrite: resolved.canWrite,
        canDelete: resolved.canDelete,
        aspects: ASPECTS.map(a => byAspect[a]),
      });
    }

    // List projects
    const q = admin
      .from("project_memory_files")
      .select("project_name, aspect_type, size_bytes, updated_at, version");
    const { data, error } = resolved.agencyId
      ? await q.eq("agency_id", resolved.agencyId)
      : await q.eq("user_id", user.id).is("agency_id", null);

    if (error) {
      console.error("aspects GET list error:", error);
      return NextResponse.json({ error: "Failed to list" }, { status: 500 });
    }

    const map = new Map<string, { name: string; aspectCount: number; totalBytes: number; updatedAt: string }>();
    for (const row of data ?? []) {
      const curr = map.get(row.project_name) ?? { name: row.project_name, aspectCount: 0, totalBytes: 0, updatedAt: row.updated_at };
      curr.aspectCount += 1;
      curr.totalBytes += row.size_bytes ?? 0;
      if (row.updated_at > curr.updatedAt) curr.updatedAt = row.updated_at;
      map.set(row.project_name, curr);
    }
    const projects = Array.from(map.values()).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

    return NextResponse.json({
      scope: resolved.agencyId ? "agency" : "personal",
      canWrite: resolved.canWrite,
      canDelete: resolved.canDelete,
      projects,
    });
  } catch (err) {
    console.error("aspects GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST body: { scope, project_name, aspect, content }
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await req.json();
    const scope = String(body.scope ?? "personal");
    const projectName = String(body.project_name ?? "").trim();
    const aspect = body.aspect;
    const content = String(body.content ?? "");

    if (!projectName) return NextResponse.json({ error: "project_name required" }, { status: 400 });
    if (!isValidAspect(aspect)) return NextResponse.json({ error: "invalid aspect" }, { status: 400 });
    if (content.length > 512_000) return NextResponse.json({ error: "content too large" }, { status: 400 });

    const resolved = await resolveScope(scope, user.id);
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    if (!resolved.canWrite) return NextResponse.json({ error: "Write denied" }, { status: 403 });

    const admin = getSupabaseAdmin();
    const hash = sha256(content);

    const sel = admin
      .from("project_memory_files")
      .select("id, version, content_hash")
      .eq("project_name", projectName)
      .eq("aspect_type", aspect);
    const { data: existing } = resolved.agencyId
      ? await sel.eq("agency_id", resolved.agencyId).maybeSingle()
      : await sel.eq("user_id", user.id).is("agency_id", null).maybeSingle();

    if (existing) {
      if (existing.content_hash === hash) {
        return NextResponse.json({ success: true, action: "unchanged", version: existing.version });
      }
      const newVersion = existing.version + 1;
      const { error } = await admin
        .from("project_memory_files")
        .update({ content, content_hash: hash, version: newVersion, updated_by: user.id })
        .eq("id", existing.id);
      if (error) {
        console.error("aspects POST update:", error);
        return NextResponse.json({ error: "Failed to update" }, { status: 500 });
      }
      return NextResponse.json({ success: true, action: "updated", version: newVersion });
    }

    const { error } = await admin.from("project_memory_files").insert({
      user_id: user.id,
      agency_id: resolved.agencyId,
      project_name: projectName,
      aspect_type: aspect,
      content,
      content_hash: hash,
      version: 1,
      updated_by: user.id,
    });
    if (error) {
      console.error("aspects POST insert:", error);
      return NextResponse.json({ error: "Failed to create" }, { status: 500 });
    }
    return NextResponse.json({ success: true, action: "created", version: 1 });
  } catch (err) {
    console.error("aspects POST error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE ?scope=...&project=NAME
export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const url = new URL(req.url);
    const scope = (url.searchParams.get("scope") ?? "personal").trim();
    const projectName = url.searchParams.get("project");
    if (!projectName) return NextResponse.json({ error: "project required" }, { status: 400 });

    const resolved = await resolveScope(scope, user.id);
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    if (!resolved.canDelete) return NextResponse.json({ error: "Delete denied" }, { status: 403 });

    const admin = getSupabaseAdmin();
    const del = admin.from("project_memory_files").delete().eq("project_name", projectName);
    const { error } = resolved.agencyId
      ? await del.eq("agency_id", resolved.agencyId)
      : await del.eq("user_id", user.id).is("agency_id", null);

    if (error) {
      console.error("aspects DELETE error:", error);
      return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("aspects DELETE error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
