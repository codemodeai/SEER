import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import crypto from "crypto";

const ALL_ASPECTS = [
  "project_overview",
  "architecture",
  "features",
  "decisions",
  "errors_fixes",
  "session_log",
] as const;
type AspectType = typeof ALL_ASPECTS[number];

const MAX_CONTENT_BYTES = 512_000;
const MAX_SESSION_LOG_ENTRIES = 500;
const SESSION_LOG_WINDOW_DAYS = 30;

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

async function authAndScope(
  apiKey: string
): Promise<
  | { ok: true; userId: string; agencyId: string | null; plan: string }
  | { ok: false; status: number; error: string }
> {
  const admin = getSupabaseAdmin();
  const { data: user } = await admin
    .from("users")
    .select("id, plan")
    .eq("seer_api_key", apiKey)
    .single();
  if (!user) return { ok: false, status: 401, error: "Invalid API key" };

  let agencyId: string | null = null;
  const { data: membership } = await admin
    .from("agency_users")
    .select("agency_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (membership?.agency_id) {
    agencyId = membership.agency_id;
  } else {
    const { data: owned } = await admin
      .from("agencies")
      .select("id")
      .eq("owner_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (owned?.id) agencyId = owned.id;
  }

  return { ok: true, userId: user.id, agencyId, plan: user.plan };
}

function extractApiKey(req: NextRequest, body: any): string {
  const authHeader = req.headers.get("authorization") ?? "";
  const fromHeader = authHeader.replace(/^Bearer\s+/i, "").trim();
  return fromHeader || String(body?.api_key ?? "").trim();
}

function trimSessionLog(content: string): string {
  const lines = content.split("\n").filter(l => l.trim().length > 0);
  const cutoff = Date.now() - SESSION_LOG_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const kept = lines.filter(line => {
    const m = line.match(/^\[(\d{4}-\d{2}-\d{2}T[\d:]+Z?)\]/);
    if (!m) return true;
    const t = Date.parse(m[1]);
    return isNaN(t) ? true : t >= cutoff;
  });
  return kept.slice(-MAX_SESSION_LOG_ENTRIES).join("\n");
}

function isValidAspect(v: unknown): v is AspectType {
  return typeof v === "string" && (ALL_ASPECTS as readonly string[]).includes(v);
}

// GET — load aspects by project + types
// Query: ?project=NAME&aspects=overview,architecture  (defaults: all)
export async function GET(req: NextRequest) {
  try {
    const apiKey = extractApiKey(req, null);
    if (!apiKey || !apiKey.startsWith("sk-seer-")) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }
    const auth = await authAndScope(apiKey);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const url = new URL(req.url);
    const projectName = (url.searchParams.get("project") ?? "").trim();
    if (!projectName) {
      return NextResponse.json({ error: "project is required" }, { status: 400 });
    }
    const aspectParam = url.searchParams.get("aspects");
    const aspects: AspectType[] = aspectParam
      ? aspectParam.split(",").map(s => s.trim()).filter(isValidAspect)
      : [...ALL_ASPECTS];

    const admin = getSupabaseAdmin();
    const query = admin
      .from("project_memory_files")
      .select("aspect_type, content, updated_at, size_bytes, version")
      .eq("project_name", projectName)
      .in("aspect_type", aspects);

    const { data, error } = auth.agencyId
      ? await query.eq("agency_id", auth.agencyId)
      : await query.eq("user_id", auth.userId).is("agency_id", null);

    if (error) {
      console.error("memory-aspect GET error:", error);
      return NextResponse.json({ error: "Failed to load" }, { status: 500 });
    }

    return NextResponse.json({
      project: projectName,
      scope: auth.agencyId ? "agency" : "personal",
      aspects: data ?? [],
    });
  } catch (err) {
    console.error("memory-aspect GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST — upsert or append a single aspect
// Body: { project_name, aspect, content, mode: "replace"|"append", api_key? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const apiKey = extractApiKey(req, body);
    if (!apiKey || !apiKey.startsWith("sk-seer-")) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }
    const auth = await authAndScope(apiKey);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const projectName = String(body.project_name ?? "").trim();
    const aspect = body.aspect;
    const content = String(body.content ?? "");
    const mode: "replace" | "append" = body.mode === "append" ? "append" : "replace";

    if (!projectName || projectName.length > 100) {
      return NextResponse.json({ error: "invalid project_name" }, { status: 400 });
    }
    if (!isValidAspect(aspect)) {
      return NextResponse.json({ error: "invalid aspect" }, { status: 400 });
    }
    if (content.length > MAX_CONTENT_BYTES) {
      return NextResponse.json({ error: "content too large" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Load existing row
    const selectQuery = admin
      .from("project_memory_files")
      .select("id, version, content, content_hash")
      .eq("project_name", projectName)
      .eq("aspect_type", aspect);

    const { data: existing } = auth.agencyId
      ? await selectQuery.eq("agency_id", auth.agencyId).maybeSingle()
      : await selectQuery.eq("user_id", auth.userId).is("agency_id", null).maybeSingle();

    let finalContent = content;
    if (mode === "append" && existing?.content) {
      finalContent = existing.content.trimEnd() + "\n" + content.trimStart();
    }
    if (aspect === "session_log") {
      finalContent = trimSessionLog(finalContent);
    }

    const contentHash = sha256(finalContent);

    if (existing) {
      if (existing.content_hash === contentHash) {
        return NextResponse.json({ success: true, action: "unchanged", version: existing.version });
      }
      const newVersion = existing.version + 1;
      const { error } = await admin
        .from("project_memory_files")
        .update({
          content: finalContent,
          content_hash: contentHash,
          version: newVersion,
          updated_by: auth.userId,
        })
        .eq("id", existing.id);
      if (error) {
        console.error("memory-aspect update error:", error);
        return NextResponse.json({ error: "Failed to update" }, { status: 500 });
      }
      return NextResponse.json({ success: true, action: "updated", version: newVersion });
    }

    const { error } = await admin.from("project_memory_files").insert({
      user_id: auth.userId,
      agency_id: auth.agencyId,
      project_name: projectName,
      aspect_type: aspect,
      content: finalContent,
      content_hash: contentHash,
      version: 1,
      updated_by: auth.userId,
    });
    if (error) {
      console.error("memory-aspect insert error:", error);
      return NextResponse.json({ error: "Failed to create" }, { status: 500 });
    }
    return NextResponse.json({ success: true, action: "created", version: 1 });
  } catch (err) {
    console.error("memory-aspect POST error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
