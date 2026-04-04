import { getSupabaseAdmin } from "@/lib/supabase-server";
import crypto from "crypto";

/**
 * Supported webhook event types for agency integrations.
 */
export const WEBHOOK_EVENTS = {
  "member.joined": "A new member accepted an agency invite",
  "member.removed": "A member was removed from the agency",
  "announcement.created": "A new announcement was posted",
  "project.created": "A new project board was created",
  "task.updated": "A task status was changed",
  "memory.synced": "Cloud memory was pushed or updated",
} as const;

export type WebhookEvent = keyof typeof WEBHOOK_EVENTS;

interface WebhookPayload {
  event: WebhookEvent;
  agency_id: string;
  timestamp: string;
  data: Record<string, any>;
}

/**
 * Sign a payload with HMAC-SHA256 using the webhook's secret.
 */
function signPayload(payload: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(payload, "utf8")
    .digest("hex");
}

/**
 * Fire webhooks for a given agency + event.
 * Runs async (non-blocking) — logs delivery results to agency_webhook_deliveries.
 */
export async function fireWebhooks(
  agencyId: string,
  event: WebhookEvent,
  data: Record<string, any>
) {
  try {
    const admin = getSupabaseAdmin();

    // Get all active webhooks for this agency that subscribe to this event
    const { data: webhooks } = await admin
      .from("agency_webhooks")
      .select("id, url, secret, events")
      .eq("agency_id", agencyId)
      .eq("active", true);

    if (!webhooks || webhooks.length === 0) return;

    const matching = webhooks.filter((w: any) =>
      Array.isArray(w.events) && w.events.includes(event)
    );

    if (matching.length === 0) return;

    const payload: WebhookPayload = {
      event,
      agency_id: agencyId,
      timestamp: new Date().toISOString(),
      data,
    };

    const body = JSON.stringify(payload);

    // Deliver to all matching webhooks in parallel
    await Promise.allSettled(
      matching.map((webhook: any) => deliverWebhook(admin, webhook, event, body))
    );
  } catch (err) {
    console.error("fireWebhooks error:", err);
  }
}

async function deliverWebhook(
  admin: any,
  webhook: { id: string; url: string; secret: string },
  event: string,
  body: string
) {
  const signature = signPayload(body, webhook.secret);

  let statusCode = 0;
  let responseBody = "";
  let success = false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const res = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Seer-Signature": signature,
        "X-Seer-Event": event,
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    statusCode = res.status;
    responseBody = (await res.text()).slice(0, 1000); // Cap stored response
    success = res.ok;
  } catch (err: any) {
    responseBody = err.message ?? "Delivery failed";
  }

  // Log delivery attempt
  await admin.from("agency_webhook_deliveries").insert({
    webhook_id: webhook.id,
    event,
    payload: JSON.parse(body),
    status_code: statusCode || null,
    response_body: responseBody,
    success,
  });
}
