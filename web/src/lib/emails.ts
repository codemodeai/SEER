import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.RESEND_FROM_EMAIL ?? "SEER <noreply@seermcp.com>";
const APP = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/* ─── Shared layout ─── */

function wrap(body: string): string {
  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 20px; color: #2C2520;">
  <div style="text-align: center; margin-bottom: 32px;">
    <a href="${APP}" style="text-decoration: none;">
      <div style="display: inline-block; width: 48px; height: 48px; border-radius: 12px; background: #C75B3F; line-height: 48px; text-align: center;">
        <span style="color: white; font-weight: bold; font-size: 20px;">S</span>
      </div>
    </a>
  </div>
  ${body}
  <hr style="border: none; border-top: 1px solid #E8E0D8; margin: 32px 0 16px;" />
  <p style="color: #A39890; font-size: 11px; text-align: center; margin: 0;">
    SEER — AI prompt intelligence for Claude Code<br/>
    <a href="${APP}" style="color: #C75B3F; text-decoration: none;">seermcp.com</a>
  </p>
</div>`;
}

function btn(href: string, label: string): string {
  return `<div style="text-align: center; margin: 28px 0;">
  <a href="${href}" style="display: inline-block; background: #C75B3F; color: white; text-decoration: none; padding: 12px 32px; border-radius: 12px; font-size: 14px; font-weight: 600;">${label}</a>
</div>`;
}

function heading(text: string): string {
  return `<h1 style="font-size: 22px; color: #2C2520; text-align: center; margin: 0 0 12px;">${text}</h1>`;
}

function subtext(text: string): string {
  return `<p style="color: #7A6F68; font-size: 14px; text-align: center; margin: 0 0 24px; line-height: 1.5;">${text}</p>`;
}

function detail(label: string, value: string): string {
  return `<div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #F0EBE6;">
  <span style="color: #7A6F68; font-size: 13px;">${label}</span>
  <span style="color: #2C2520; font-size: 13px; font-weight: 600;">${value}</span>
</div>`;
}

/* ─── Send helper ─── */

async function send(to: string, subject: string, html: string): Promise<boolean> {
  if (!resend) {
    console.log(`[Email] Resend not configured — would send "${subject}" to ${to}`);
    return false;
  }
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
    console.log(`[Email] Sent "${subject}" to ${to}`);
    return true;
  } catch (err) {
    console.error(`[Email] Failed "${subject}" to ${to}:`, err);
    return false;
  }
}

/* ═══════════════════════════════════════════
   1. Welcome — new user signup
   ═══════════════════════════════════════════ */

export async function sendWelcomeEmail(to: string, plan: string): Promise<boolean> {
  const planLabel = plan === "free" ? "Free" : plan.charAt(0).toUpperCase() + plan.slice(1);
  return send(to, "Welcome to SEER!", wrap(`
    ${heading("Welcome to SEER!")}
    ${subtext(`You're on the <strong>${planLabel}</strong> plan. SEER optimizes your Claude Code prompts so they work on the first try.`)}
    <div style="background: #FAF7F4; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <p style="color: #2C2520; font-size: 14px; font-weight: 600; margin: 0 0 12px;">Quick start:</p>
      <ol style="color: #7A6F68; font-size: 13px; margin: 0; padding-left: 20px; line-height: 1.8;">
        <li>Add SEER to Claude Code MCP settings</li>
        <li>Prefix any prompt with <code style="background: #E8E0D8; padding: 2px 6px; border-radius: 4px; font-size: 12px;">seer</code></li>
        <li>Watch your prompts work on the first try</li>
      </ol>
    </div>
    ${btn(APP + "/docs", "Read the setup guide")}
    ${subtext("Need help? Reply to this email or visit our docs.")}
  `));
}

/* ═══════════════════════════════════════════
   2. Payment confirmation — subscription activated
   ═══════════════════════════════════════════ */

export async function sendPaymentConfirmationEmail(params: {
  to: string;
  plan: string;
  amountUsd: number;
  billing: "monthly" | "annual";
  provider: string;
  paymentId?: string;
}): Promise<boolean> {
  const { to, plan, amountUsd, billing, provider, paymentId } = params;
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
  const billingLabel = billing === "annual" ? "Annual" : "Monthly";
  const periodLabel = billing === "annual" ? "/year" : "/month";

  return send(to, `Payment confirmed — SEER ${planLabel}`, wrap(`
    ${heading("Payment confirmed!")}
    ${subtext(`Your <strong>${planLabel}</strong> plan is now active. Here's your receipt:`)}
    <div style="background: #FAF7F4; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      ${detail("Plan", planLabel)}
      ${detail("Amount", `$${amountUsd}${periodLabel}`)}
      ${detail("Billing", billingLabel)}
      ${detail("Provider", provider === "razorpay" ? "Razorpay" : "Dodo Payments")}
      ${paymentId ? detail("Payment ID", paymentId) : ""}
    </div>
    ${btn(APP + "/dashboard", "Go to dashboard")}
    <p style="color: #A39890; font-size: 12px; text-align: center; margin: 0;">
      You can manage your subscription anytime from <a href="${APP}/dashboard/billing" style="color: #C75B3F;">billing settings</a>.
    </p>
  `));
}

/* ═══════════════════════════════════════════
   3. Plan upgrade — user upgraded plan
   ═══════════════════════════════════════════ */

export async function sendPlanUpgradeEmail(params: {
  to: string;
  oldPlan: string;
  newPlan: string;
}): Promise<boolean> {
  const { to, oldPlan, newPlan } = params;
  const oldLabel = oldPlan.charAt(0).toUpperCase() + oldPlan.slice(1);
  const newLabel = newPlan.charAt(0).toUpperCase() + newPlan.slice(1);

  return send(to, `Plan upgraded to ${newLabel}!`, wrap(`
    ${heading(`Upgraded to ${newLabel}!`)}
    ${subtext(`You've been upgraded from <strong>${oldLabel}</strong> to <strong>${newLabel}</strong>. Your new features are ready.`)}
    ${btn(APP + "/dashboard", "Explore your new features")}
  `));
}

/* ═══════════════════════════════════════════
   4. Payment failed — subscription past_due
   ═══════════════════════════════════════════ */

export async function sendPaymentFailedEmail(params: {
  to: string;
  plan: string;
}): Promise<boolean> {
  const { to, plan } = params;
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);

  return send(to, "Action needed — payment failed", wrap(`
    ${heading("Payment failed")}
    ${subtext(`We couldn't process your payment for the <strong>${planLabel}</strong> plan. Please update your payment method to keep your account active.`)}
    <div style="background: #FEF2F2; border-radius: 12px; padding: 16px; margin-bottom: 24px; border: 1px solid #FECACA;">
      <p style="color: #991B1B; font-size: 13px; margin: 0; text-align: center;">
        Your features will be limited if payment isn't resolved within 7 days.
      </p>
    </div>
    ${btn(APP + "/dashboard/billing", "Update payment method")}
  `));
}

/* ═══════════════════════════════════════════
   5. Subscription cancelled
   ═══════════════════════════════════════════ */

export async function sendCancellationEmail(params: {
  to: string;
  plan: string;
}): Promise<boolean> {
  const { to, plan } = params;
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);

  return send(to, `Your ${planLabel} plan has been cancelled`, wrap(`
    ${heading("Subscription cancelled")}
    ${subtext(`Your <strong>${planLabel}</strong> plan has been cancelled. You've been moved to the Free plan with 50 calls/month.`)}
    <div style="background: #FAF7F4; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
      <p style="color: #7A6F68; font-size: 13px; margin: 0; text-align: center;">
        Your data is safe. You can resubscribe anytime to regain access to all features.
      </p>
    </div>
    ${btn(APP + "/pricing", "View plans")}
  `));
}

/* ═══════════════════════════════════════════
   6. Agency member added
   ═══════════════════════════════════════════ */

export async function sendAgencyMemberAddedEmail(params: {
  to: string;
  agencyName: string;
  role: string;
}): Promise<boolean> {
  const { to, agencyName, role } = params;

  return send(to, `You've joined ${agencyName} on SEER`, wrap(`
    ${heading(`Welcome to ${agencyName}!`)}
    ${subtext(`You've been added as ${role === "admin" ? "an <strong>admin</strong>" : "a <strong>member</strong>"} of <strong>${agencyName}</strong>.`)}
    <div style="background: #FAF7F4; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <p style="color: #2C2520; font-size: 14px; font-weight: 600; margin: 0 0 12px;">What you get:</p>
      <ul style="color: #7A6F68; font-size: 13px; margin: 0; padding-left: 20px; line-height: 1.8;">
        <li>Shared project memory with your team</li>
        <li>Real-time activity tracking</li>
        <li>Team conflict detection</li>
        <li>Founder's Space team vault</li>
      </ul>
    </div>
    ${btn(APP + "/dashboard", "Open dashboard")}
  `));
}

/* ═══════════════════════════════════════════
   7. Agency member removed
   ═══════════════════════════════════════════ */

export async function sendAgencyMemberRemovedEmail(params: {
  to: string;
  agencyName: string;
}): Promise<boolean> {
  const { to, agencyName } = params;

  return send(to, `Removed from ${agencyName}`, wrap(`
    ${heading("Team membership ended")}
    ${subtext(`You've been removed from <strong>${agencyName}</strong>. Your personal SEER account is still active on the Free plan.`)}
    ${btn(APP + "/pricing", "Upgrade your personal plan")}
  `));
}

/* ═══════════════════════════════════════════
   8. Usage alert — approaching call limit
   ═══════════════════════════════════════════ */

export async function sendUsageAlertEmail(params: {
  to: string;
  plan: string;
  used: number;
  limit: number;
  percent: number;
}): Promise<boolean> {
  const { to, plan, used, limit, percent } = params;
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);

  return send(to, `${percent}% of your SEER calls used`, wrap(`
    ${heading("Usage alert")}
    ${subtext(`You've used <strong>${percent}%</strong> of your monthly calls on the <strong>${planLabel}</strong> plan.`)}
    <div style="background: #FAF7F4; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      ${detail("Used", `${used} calls`)}
      ${detail("Limit", `${limit} calls`)}
      ${detail("Remaining", `${limit - used} calls`)}
      <div style="margin-top: 12px; background: #E8E0D8; border-radius: 6px; height: 8px; overflow: hidden;">
        <div style="background: ${percent >= 90 ? "#DC2626" : "#C75B3F"}; height: 100%; width: ${Math.min(percent, 100)}%; border-radius: 6px;"></div>
      </div>
    </div>
    ${btn(APP + "/pricing", "Upgrade for more calls")}
  `));
}

/* ═══════════════════════════════════════════
   9. Payment reminder — renewal upcoming
   ═══════════════════════════════════════════ */

export async function sendRenewalReminderEmail(params: {
  to: string;
  plan: string;
  amountUsd: number;
  billing: "monthly" | "annual";
  renewalDate: string;
}): Promise<boolean> {
  const { to, plan, amountUsd, billing, renewalDate } = params;
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
  const periodLabel = billing === "annual" ? "/year" : "/month";

  return send(to, `Upcoming renewal — SEER ${planLabel}`, wrap(`
    ${heading("Renewal reminder")}
    ${subtext(`Your <strong>${planLabel}</strong> plan renews on <strong>${renewalDate}</strong>.`)}
    <div style="background: #FAF7F4; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      ${detail("Plan", planLabel)}
      ${detail("Amount", `$${amountUsd}${periodLabel}`)}
      ${detail("Renewal date", renewalDate)}
    </div>
    <p style="color: #7A6F68; font-size: 13px; text-align: center; margin: 0 0 24px;">
      No action needed — your subscription will auto-renew. To make changes:
    </p>
    ${btn(APP + "/dashboard/billing", "Manage subscription")}
  `));
}

/* ═══════════════════════════════════════════
   10. Agency announcement notification
   ═══════════════════════════════════════════ */

export async function sendAnnouncementEmail(params: {
  to: string;
  agencyName: string;
  title: string;
  body: string;
  postedBy: string;
}): Promise<boolean> {
  const { to, agencyName, title, body: announcementBody, postedBy } = params;

  return send(to, `[${agencyName}] ${title}`, wrap(`
    ${heading(title)}
    ${subtext(`New announcement from <strong>${agencyName}</strong>`)}
    <div style="background: #FAF7F4; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <p style="color: #2C2520; font-size: 14px; margin: 0; line-height: 1.6;">${announcementBody}</p>
      <p style="color: #A39890; font-size: 12px; margin: 12px 0 0; text-align: right;">— ${postedBy}</p>
    </div>
    ${btn(APP + "/dashboard", "View in dashboard")}
  `));
}
