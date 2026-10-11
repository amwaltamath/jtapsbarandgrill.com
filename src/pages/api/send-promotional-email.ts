import type { APIRoute } from "astro";
import { Resend } from "resend";
import { createEmailTemplate } from "../../lib/emailTemplates";
import { supabaseAdmin } from "../../lib/supabase";

export const prerender = false;
export const maxDuration = 60;

const resend = new Resend(import.meta.env.RESEND_API_KEY);

const CAMPAIGN_FROM =
  import.meta.env.CAMPAIGN_FROM_EMAIL ?? "JTAPS Bar & Grill <info@jtapsbarandgrill.com>";
const CAMPAIGN_REPLY_TO =
  import.meta.env.CAMPAIGN_REPLY_TO_EMAIL ?? "info@jtapsbarandgrill.com";

const SEND_CONCURRENCY = 10;

interface Subscriber {
  email: string;
  name?: string | null;
}

interface RequestBody {
  subject: string;
  message: string;
  subscribers?: Subscriber[];
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isTestSubject(subject: string) {
  return subject.trim().toUpperCase().startsWith("[TEST]");
}

async function validateAdminAccess(authHeader?: string): Promise<{ ok: true; email?: string } | { ok: false }> {
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false };
  }
  const token = authHeader.slice(7);
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return { ok: false };
    const { data: adminRow } = await supabaseAdmin
      .from("admin_users")
      .select("id")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (!adminRow) return { ok: false };
    return { ok: true, email: data.user.email };
  } catch {
    return { ok: false };
  }
}

async function sendOneEmail(subject: string, message: string, subscriber: Subscriber) {
  const emailHtml = createEmailTemplate({
    recipientName: subscriber.name || undefined,
    content: message,
    preheader: subject,
  });

  const { data, error } = await resend.emails.send({
    from: CAMPAIGN_FROM,
    to: subscriber.email,
    replyTo: CAMPAIGN_REPLY_TO,
    subject,
    html: emailHtml,
    text: message.replace(/<[^>]+>/g, " "),
    headers: {
      "List-Unsubscribe": `<mailto:${CAMPAIGN_REPLY_TO}?subject=unsubscribe>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });

  if (error || !data?.id) {
    const err = error as { statusCode?: number; name?: string; message?: string } | null;
    const retryable =
      err?.statusCode === 429 ||
      err?.name === "rate_limit_exceeded" ||
      /rate limit/i.test(err?.message || "");
    throw Object.assign(new Error(err?.message || "Resend did not accept this email"), {
      retryable,
    });
  }

  return data.id;
}

async function sendWithRetry(subject: string, message: string, subscriber: Subscriber) {
  for (let attempts = 1; attempts <= 3; attempts++) {
    try {
      await sendOneEmail(subject, message, subscriber);
      return;
    } catch (err) {
      const retryable = Boolean((err as { retryable?: boolean }).retryable);
      if (retryable && attempts < 3) {
        await new Promise((resolve) => setTimeout(resolve, 1200 * attempts));
        continue;
      }
      throw err;
    }
  }
}

async function sendToSubscribers(
  subject: string,
  message: string,
  subscribers: Subscriber[],
  onSent?: (sentSoFar: number) => Promise<void>
) {
  let sent = 0;
  let failed = 0;
  const failedEmails: string[] = [];

  for (let i = 0; i < subscribers.length; i += SEND_CONCURRENCY) {
    const chunk = subscribers.slice(i, i + SEND_CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map((subscriber) => sendWithRetry(subject, message, subscriber))
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === "fulfilled") {
        sent++;
      } else {
        failed++;
        const email = chunk[j]?.email;
        console.error("Failed to send to " + email, result.reason);
        if (email && failedEmails.length < 20) failedEmails.push(email);
      }
    }

    if (onSent && sent > 0) {
      await onSent(sent);
    }
  }

  return { sent, failed, failedEmails };
}

async function ensureCampaign(subject: string, message: string) {
  const { data, error } = await supabaseAdmin
    .from("email_campaigns")
    .insert({
      subject,
      message,
      sent_count: 0,
      sent_at: new Date().toISOString(),
    })
    .select("id, sent_count")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to record campaign");
  }

  return data;
}

async function setCampaignSentCount(campaignId: number, sentCount: number) {
  await supabaseAdmin
    .from("email_campaigns")
    .update({
      sent_count: sentCount,
      sent_at: new Date().toISOString(),
    })
    .eq("id", campaignId);
}

export const POST: APIRoute = async ({ request }) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const admin = await validateAdminAccess(request.headers.get("Authorization") ?? "");
    if (!admin.ok) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = (await request.json()) as RequestBody;
    const { subject, message, subscribers } = body;

    if (!subject?.trim() || !message?.trim() || !subscribers || subscribers.length === 0) {
      return json({ error: "Subject, message, and subscribers are required" }, 400);
    }

    const recordHistory = !isTestSubject(subject);
    const recipients = [...subscribers];
    if (recordHistory && admin.email) {
      const alreadyIncluded = recipients.some(
        (s) => s.email.toLowerCase() === admin.email!.toLowerCase()
      );
      if (!alreadyIncluded) {
        recipients.unshift({ email: admin.email, name: "JTAPS Admin" });
      }
    }

    const campaign = recordHistory ? await ensureCampaign(subject, message) : null;
    const { sent, failed, failedEmails } = await sendToSubscribers(
      subject,
      message,
      recipients,
      async (sentSoFar) => {
        if (campaign) {
          await setCampaignSentCount(campaign.id, sentSoFar);
        }
      }
    );

    if (campaign) {
      await setCampaignSentCount(campaign.id, sent);
    }

    return json({
      success: true,
      sent,
      failed,
      failedEmails,
      total: recipients.length,
    });
  } catch (err) {
    console.error("Email campaign error:", err);
    return json(
      {
        error: err instanceof Error ? err.message : "Failed to send emails",
      },
      500
    );
  }
};
