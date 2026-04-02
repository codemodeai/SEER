import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "SEER <noreply@seermcp.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

interface InviteEmailParams {
  to: string;
  agencyName: string;
  role: string;
  inviterEmail: string;
  token: string;
}

export async function sendInviteEmail({
  to,
  agencyName,
  role,
  inviterEmail,
  token,
}: InviteEmailParams): Promise<{ sent: boolean; inviteUrl: string }> {
  const inviteUrl = `${APP_URL}/agency/invite?token=${token}`;

  if (!resend) {
    console.log("Resend not configured — invite link:", inviteUrl);
    return { sent: false, inviteUrl };
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `You've been invited to join ${agencyName} on SEER`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; width: 48px; height: 48px; border-radius: 12px; background: #C75B3F; line-height: 48px; text-align: center;">
              <span style="color: white; font-weight: bold; font-size: 20px;">S</span>
            </div>
          </div>

          <h1 style="font-size: 22px; color: #2C2520; text-align: center; margin: 0 0 8px;">
            You're invited to join <strong>${agencyName}</strong>
          </h1>

          <p style="color: #7A6F68; font-size: 14px; text-align: center; margin: 0 0 32px;">
            ${inviterEmail} has invited you as ${role === "admin" ? "an admin" : "a member"}.
          </p>

          <div style="text-align: center; margin-bottom: 32px;">
            <a href="${inviteUrl}"
               style="display: inline-block; background: #C75B3F; color: white; text-decoration: none; padding: 12px 32px; border-radius: 12px; font-size: 14px; font-weight: 600;">
              Accept Invitation
            </a>
          </div>

          <p style="color: #A39890; font-size: 12px; text-align: center; margin: 0 0 8px;">
            Or copy this link into your browser:
          </p>
          <p style="color: #7A6F68; font-size: 12px; text-align: center; word-break: break-all; margin: 0 0 32px;">
            ${inviteUrl}
          </p>

          <hr style="border: none; border-top: 1px solid #E8E0D8; margin: 0 0 16px;" />
          <p style="color: #A39890; font-size: 11px; text-align: center; margin: 0;">
            This invite expires in 7 days. If you didn't expect this, you can ignore this email.
          </p>
        </div>
      `,
    });

    return { sent: true, inviteUrl };
  } catch (err) {
    console.error("Failed to send invite email:", err);
    return { sent: false, inviteUrl };
  }
}
