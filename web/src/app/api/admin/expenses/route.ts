import { NextRequest, NextResponse } from "next/server";
import { getAdminUser, isAdmin } from "@/lib/admin-api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";

// GET all expenses
export async function GET() {
  try {
    const user = await getAdminUser();
    if (!user || !isAdmin(user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const admin = getSupabaseAdmin();
    const { data: expenses } = await admin
      .from("admin_expenses")
      .select("*")
      .order("is_active", { ascending: false })
      .order("category")
      .order("name");

    // Calculate totals
    const active = (expenses ?? []).filter(e => e.is_active);
    let totalMonthly = 0;
    let totalAnnual = 0;
    for (const e of active) {
      if (e.frequency === "monthly") {
        totalMonthly += Number(e.amount_usd);
        totalAnnual += Number(e.amount_usd) * 12;
      } else if (e.frequency === "annual") {
        totalMonthly += Number(e.amount_usd) / 12;
        totalAnnual += Number(e.amount_usd);
      } else {
        // one-time — don't add to recurring
      }
    }

    // Group by category
    const byCategory: Record<string, number> = {};
    for (const e of active) {
      const monthly = e.frequency === "monthly" ? Number(e.amount_usd) : e.frequency === "annual" ? Number(e.amount_usd) / 12 : 0;
      byCategory[e.category] = (byCategory[e.category] ?? 0) + monthly;
    }

    return NextResponse.json({
      expenses: expenses ?? [],
      totalMonthly: Math.round(totalMonthly * 100) / 100,
      totalAnnual: Math.round(totalAnnual * 100) / 100,
      byCategory,
    });
  } catch (err) {
    console.error("Admin expenses error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST create new expense
export async function POST(req: NextRequest) {
  try {
    const user = await getAdminUser();
    if (!user || !isAdmin(user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { name, category, amount_usd, frequency, provider, notes, due_date } = body;

    if (!name || !amount_usd) {
      return NextResponse.json({ error: "Name and amount are required" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("admin_expenses")
      .insert({
        name,
        category: category ?? "other",
        amount_usd,
        frequency: frequency ?? "monthly",
        provider: provider ?? null,
        notes: notes ?? null,
        due_date: due_date ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ expense: data });
  } catch (err) {
    console.error("Admin expense create error:", err);
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 });
  }
}

// PATCH update expense
export async function PATCH(req: NextRequest) {
  try {
    const user = await getAdminUser();
    if (!user || !isAdmin(user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing expense id" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    updates.updated_at = new Date().toISOString();

    const { error } = await admin
      .from("admin_expenses")
      .update(updates)
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Admin expense update error:", err);
    return NextResponse.json({ error: "Failed to update expense" }, { status: 500 });
  }
}

// DELETE expense
export async function DELETE(req: NextRequest) {
  try {
    const user = await getAdminUser();
    if (!user || !isAdmin(user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Missing expense id" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { error } = await admin.from("admin_expenses").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Admin expense delete error:", err);
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 });
  }
}
