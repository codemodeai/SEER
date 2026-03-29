import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import crypto from "crypto";

function sha256(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
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

// GET /api/agency/[slug]/memory — list all projects or pull a specific project
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
    const { searchParams } = new URL(req.url);
    const projectName = searchParams.get("project");

    if (projectName) {
      // Pull specific project
      const { data: project } = await admin
        .from("agency_projects")
        .select("id, project_name, cloud_memory, content_hash, version, updated_by, updated_at, users!agency_projects_updated_by_fkey(email)")
        .eq("agency_id", agency.id)
        .eq("project_name", projectName)
        .single();

      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      // Verify integrity
      const computedHash = sha256(project.cloud_memory);
      const integrityOk = computedHash === project.content_hash;

      return NextResponse.json({
        project: {
          id: project.id,
          name: project.project_name,
          content: project.cloud_memory,
          hash: project.content_hash,
          version: project.version,
          updatedBy: (project as any).users?.email ?? null,
          updatedAt: project.updated_at,
          integrityOk,
        },
      });
    } else {
      // List all projects
      const { data: projects, error } = await admin
        .from("agency_projects")
        .select("id, project_name, content_hash, version, updated_by, updated_at, users!agency_projects_updated_by_fkey(email)")
        .eq("agency_id", agency.id)
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("List projects error:", error);
        return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
      }

      const formatted = (projects ?? []).map((p: any) => ({
        id: p.id,
        name: p.project_name,
        hash: p.content_hash,
        version: p.version,
        updatedBy: p.users?.email ?? null,
        updatedAt: p.updated_at,
      }));

      return NextResponse.json({ projects: formatted });
    }
  } catch (err) {
    console.error("Agency memory GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST /api/agency/[slug]/memory — push (create or update) a project's cloud memory
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
    const content = String(body.content ?? "");
    const expectedVersion = body.expected_version as number | undefined;

    if (!projectName) {
      return NextResponse.json({ error: "project_name is required" }, { status: 400 });
    }

    if (projectName.length > 100) {
      return NextResponse.json({ error: "project_name must be under 100 characters" }, { status: 400 });
    }

    // 500KB max for memory content
    if (content.length > 512000) {
      return NextResponse.json({ error: "Content exceeds 500KB limit" }, { status: 400 });
    }

    const contentHash = sha256(content);
    const admin = getSupabaseAdmin();

    // Check if project exists
    const { data: existing } = await admin
      .from("agency_projects")
      .select("id, version, content_hash")
      .eq("agency_id", agency.id)
      .eq("project_name", projectName)
      .single();

    if (existing) {
      // Version conflict detection
      if (expectedVersion !== undefined && expectedVersion !== existing.version) {
        return NextResponse.json({
          error: "Version conflict",
          conflict: true,
          serverVersion: existing.version,
          clientVersion: expectedVersion,
          serverHash: existing.content_hash,
        }, { status: 409 });
      }

      // Skip update if content unchanged
      if (existing.content_hash === contentHash) {
        return NextResponse.json({
          success: true,
          action: "unchanged",
          version: existing.version,
          hash: contentHash,
        });
      }

      // Update
      const newVersion = existing.version + 1;
      const { error: updateErr } = await admin
        .from("agency_projects")
        .update({
          cloud_memory: content,
          content_hash: contentHash,
          version: newVersion,
          updated_by: user.id,
        })
        .eq("id", existing.id);

      if (updateErr) {
        console.error("Update memory error:", updateErr);
        return NextResponse.json({ error: "Failed to update memory" }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        action: "updated",
        version: newVersion,
        hash: contentHash,
      });
    } else {
      // Create new project
      const { error: insertErr } = await admin
        .from("agency_projects")
        .insert({
          agency_id: agency.id,
          project_name: projectName,
          cloud_memory: content,
          content_hash: contentHash,
          version: 1,
          updated_by: user.id,
        });

      if (insertErr) {
        console.error("Insert memory error:", insertErr);
        return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        action: "created",
        version: 1,
        hash: contentHash,
      });
    }
  } catch (err) {
    console.error("Agency memory POST error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE /api/agency/[slug]/memory — delete a project (owner/admin only)
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

    // Only owner or admin can delete
    const isOwner = agency.owner_id === user.id;
    if (!isOwner) {
      const { data: membership } = await admin
        .from("agency_users")
        .select("role")
        .eq("agency_id", agency.id)
        .eq("user_id", user.id)
        .single();

      if (!membership || membership.role !== "admin") {
        return NextResponse.json({ error: "Only owner or admin can delete projects" }, { status: 403 });
      }
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("project_id");

    if (!projectId) {
      return NextResponse.json({ error: "project_id query param is required" }, { status: 400 });
    }

    const { error: deleteErr } = await admin
      .from("agency_projects")
      .delete()
      .eq("id", projectId)
      .eq("agency_id", agency.id);

    if (deleteErr) {
      console.error("Delete project error:", deleteErr);
      return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Agency memory DELETE error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
