import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase-server";

function generateInvoiceHTML(invoice: Record<string, string | number>, user: { email: string; name: string }) {
  const date = new Date(invoice.created_at as string);
  const formattedDate = date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const invoiceNumber = `SEER-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}-${String(invoice.id).substring(0, 8).toUpperCase()}`;

  const periodStart = invoice.billing_period_start
    ? new Date(invoice.billing_period_start as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : formattedDate;
  const periodEnd = invoice.billing_period_end
    ? new Date(invoice.billing_period_end as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";

  const plan = String(invoice.plan).charAt(0).toUpperCase() + String(invoice.plan).slice(1);
  const amount = Number(invoice.amount_usd);
  const amountInr = Number(invoice.amount_inr || 0);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Invoice ${invoiceNumber}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'DM Sans', sans-serif; background: #F9F5EE; color: #2D2A26; padding: 40px; }
  .invoice-container { max-width: 700px; margin: 0 auto; background: #FFFCF7; border: 1px solid #E8DFD0; border-radius: 16px; overflow: hidden; }

  .header { background: #2D2A26; padding: 40px; display: flex; justify-content: space-between; align-items: flex-start; }
  .logo { display: flex; align-items: center; gap: 12px; }
  .logo-icon { width: 40px; height: 40px; background: #D97757; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-family: 'DM Serif Display', serif; font-size: 20px; font-weight: 700; }
  .logo-text { font-family: 'DM Serif Display', serif; font-size: 28px; color: white; letter-spacing: -0.5px; }
  .invoice-label { text-align: right; }
  .invoice-label h2 { font-family: 'DM Serif Display', serif; font-size: 24px; color: white; }
  .invoice-label p { color: rgba(255,255,255,0.5); font-size: 13px; margin-top: 4px; }

  .meta { padding: 32px 40px; display: flex; justify-content: space-between; border-bottom: 1px solid #E8DFD0; }
  .meta-block h4 { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #9B9389; margin-bottom: 6px; }
  .meta-block p { font-size: 14px; color: #2D2A26; line-height: 1.6; }

  .items { padding: 32px 40px; }
  .items-header { display: flex; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid #E8DFD0; }
  .items-header span { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #9B9389; }
  .item-row { display: flex; justify-content: space-between; align-items: center; padding: 16px 0; border-bottom: 1px solid #F0E9DD; }
  .item-name { font-size: 14px; font-weight: 500; }
  .item-desc { font-size: 12px; color: #9B9389; margin-top: 2px; }
  .item-amount { font-family: 'DM Serif Display', serif; font-size: 18px; text-align: right; }

  .total-section { padding: 24px 40px; background: #F9F5EE; }
  .total-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; }
  .total-row.main { padding-top: 16px; border-top: 2px solid #D97757; margin-top: 8px; }
  .total-label { font-size: 14px; color: #9B9389; }
  .total-label.main { font-size: 16px; font-weight: 600; color: #2D2A26; }
  .total-value { font-family: 'DM Serif Display', serif; font-size: 16px; }
  .total-value.main { font-size: 28px; color: #D97757; }

  .footer { padding: 24px 40px; text-align: center; border-top: 1px solid #E8DFD0; }
  .footer p { font-size: 11px; color: #9B9389; line-height: 1.8; }
  .footer a { color: #D97757; text-decoration: none; }

  .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  .badge-paid { background: rgba(143,166,138,0.15); color: #5a7a55; }

  @media print {
    body { padding: 0; background: white; }
    .invoice-container { border: none; border-radius: 0; }
  }
</style>
</head>
<body>
<div class="invoice-container">
  <div class="header">
    <div class="logo">
      <div class="logo-icon">S</div>
      <span class="logo-text">SEER</span>
    </div>
    <div class="invoice-label">
      <h2>Invoice</h2>
      <p>${invoiceNumber}</p>
    </div>
  </div>

  <div class="meta">
    <div class="meta-block">
      <h4>Billed To</h4>
      <p>${user.name}<br>${user.email}</p>
    </div>
    <div class="meta-block" style="text-align: right;">
      <h4>Invoice Date</h4>
      <p>${formattedDate}</p>
      ${periodEnd ? `<h4 style="margin-top: 12px;">Billing Period</h4><p>${periodStart} — ${periodEnd}</p>` : ""}
      <div style="margin-top: 12px;"><span class="badge badge-paid">Paid</span></div>
    </div>
  </div>

  <div class="items">
    <div class="items-header">
      <span>Description</span>
      <span>Amount</span>
    </div>
    <div class="item-row">
      <div>
        <div class="item-name">SEER ${plan} Plan — Monthly</div>
        <div class="item-desc">AI Prompt Intelligence • ${periodStart}${periodEnd ? ` to ${periodEnd}` : ""}</div>
      </div>
      <div class="item-amount">$${amount.toFixed(2)}</div>
    </div>
  </div>

  <div class="total-section">
    <div class="total-row">
      <span class="total-label">Subtotal</span>
      <span class="total-value">$${amount.toFixed(2)}</span>
    </div>
    <div class="total-row">
      <span class="total-label">Tax</span>
      <span class="total-value">$0.00</span>
    </div>
    ${amountInr > 0 ? `<div class="total-row"><span class="total-label">Amount (INR)</span><span class="total-value">₹${amountInr.toLocaleString()}</span></div>` : ""}
    <div class="total-row main">
      <span class="total-label main">Total</span>
      <span class="total-value main">$${amount.toFixed(2)}</span>
    </div>
  </div>

  <div class="footer">
    <p>
      SEER — AI Prompt Intelligence by CodeMode AI<br>
      <a href="https://seermcp.com">seermcp.com</a> • support@codemodeai.com<br>
      Thank you for your business!
    </p>
  </div>
</div>
</body>
</html>`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const { data: invoice } = await admin
      .from("invoices")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const userName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "Customer";

    const html = generateInvoiceHTML(invoice, {
      email: user.email || "",
      name: userName,
    });

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (err) {
    console.error("Invoice download error:", err);
    return NextResponse.json({ error: "Failed to generate invoice" }, { status: 500 });
  }
}
