import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase-server";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "support@codemodeai.com").split(",").map(e => e.trim().toLowerCase());

async function getAuthUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

function isAdmin(email: string | undefined) {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

// GET all tickets (admin only)
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user || !isAdmin(user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const admin = getSupabaseAdmin();
    const { data: tickets } = await admin
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false });

    return NextResponse.json({ tickets: tickets ?? [] });
  } catch (err) {
    console.error("Admin tickets error:", err);
    return NextResponse.json({ error: "Failed to fetch tickets" }, { status: 500 });
  }
}

// PATCH update ticket status
export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || !isAdmin(user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { ticketId, status } = body as { ticketId: string; status: string };

    if (!ticketId || !status) {
      return NextResponse.json({ error: "Missing ticketId or status" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    await admin
      .from("support_tickets")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", ticketId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Admin ticket update error:", err);
    return NextResponse.json({ error: "Failed to update ticket" }, { status: 500 });
  }
}
