import type { APIRoute } from "astro";
import { Resend } from "resend";
import { createEmailTemplate } from "../../lib/emailTemplates";
import { supabaseAdmin } from "../../lib/supabase";
import crypto from "crypto";

export const prerender = false;
export const maxDuration = 60;

const resend = new Resend(import.meta.env.RESEND_API_KEY);

const CAMPAIGN_FROM =
  import.meta.env.CAMPAIGN_FROM_EMAIL ?? "JTAPS Bar & Grill <info@jtapsbarandgrill.com>";
const CAMPAIGN_REPLY_TO =
  import.meta.env.CAMPAIGN_REPLY_TO_EMAIL ?? "info@jtapsbarandgrill.com";

const DEFAULT_BATCH_SIZE = 40;
const MAX_BATCH_SIZE = 50;
const SEND_DELAY_MS = 400;

interface Subscriber {
  email: string;
  name?: string | null;
}

interface RequestBody {
  action?: "send" | "status" | "reset";
  subject: string;
  message: string;
  subscribers?: Subscriber[];
  useProgress?: boolean;
  batchSize?: number;
}

interface CampaignProgress {
  id: number;
  campaign_id: number | null;
  next_offset: number;
  total_recipients: number;
  completed_at: string | null;
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

function getCampaignKey(subject: string, message: string): string {
  return crypto.createHash("sha256").update(`${subject}|${message}`).digest("hex");
}

async function loadAllSubscribers(): Promise<Subscriber[]> {
  const PAGE_SIZE = 1000;
  const all: Subscriber[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from("newsletter_subscribers")
      .select("email, name")
      .eq("email_opt_in", true)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data?.length) break;

    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
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

async function sendToSubscribers(
  subject: string,
  message: string,
  subscribers: Subscriber[],
  onSent?: (sentSoFar: number) => Promise<void>
) {
  let sent = 0;
  let failed = 0;
  const failedEmails: string[] = [];

  for (const subscriber of subscribers) {
    let attempts = 0;
    let delivered = false;

    while (attempts < 3 && !delivered) {
      attempts++;
      try {
        await sendOneEmail(subject, message, subscriber);
        sent++;
        delivered = true;
        if (onSent && sent % 5 === 0) {
          await onSent(sent);
        }
      } catch (err) {
        const retryable = Boolean((err as { retryable?: boolean }).retryable);
        if (retryable && attempts < 3) {
          await new Promise((resolve) => setTimeout(resolve, 1200 * attempts));
          continue;
        }
        console.error("Failed to send to " + subscriber.email, err);
        failed++;
        if (failedEmails.length < 20) failedEmails.push(subscriber.email);
        break;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, SEND_DELAY_MS));
  }

  return { sent, failed, failedEmails };
}

async function ensureCampaign(subject: string, message: string, campaignId?: number | null) {
  if (campaignId) {
    const { data } = await supabaseAdmin
      .from("email_campaigns")
      .select("id, sent_count")
      .eq("id", campaignId)
      .maybeSingle();
    if (data) return data;
  }

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

async function bumpCampaignSentCount(campaignId: number, increment: number) {
  const { data } = await supabaseAdmin
    .from("email_campaigns")
    .select("sent_count")
    .eq("id", campaignId)
    .single();

  const nextCount = (data?.sent_count || 0) + increment;
  await supabaseAdmin
    .from("email_campaigns")
    .update({
      sent_count: nextCount,
      sent_at: new Date().toISOString(),
    })
    .eq("id", campaignId);

  return nextCount;
}

function progressPayload(
  progress: CampaignProgress | null,
  extras: Record<string, unknown> = {}
) {
  const nextOffset = progress?.next_offset || 0;
  const total = progress?.total_recipients || 0;
  return {
    success: true,
    sent: nextOffset,
    remaining: Math.max(total - nextOffset, 0),
    total,
    nextOffset,
    completed: Boolean(progress?.completed_at) || (total > 0 && nextOffset >= total),
    ...extras,
  };
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
    const { action = "send", subject, message, subscribers, useProgress } = body;

    if (!subject?.trim() || !message?.trim()) {
      return json({ error: "Subject and message are required" }, 400);
    }

    const campaignKey = getCampaignKey(subject, message);
    const requestedBatch = Number(body.batchSize) || DEFAULT_BATCH_SIZE;
    const batchSize = Math.min(MAX_BATCH_SIZE, Math.max(1, requestedBatch));

    if (action === "status" || action === "reset") {
      if (action === "reset") {
        await supabaseAdmin.from("email_campaign_progress").delete().eq("campaign_key", campaignKey);
        return json({
          success: true,
          sent: 0,
          remaining: 0,
          total: 0,
          nextOffset: 0,
        });
      }

      const { data: progress } = await supabaseAdmin
        .from("email_campaign_progress")
        .select("id, campaign_id, next_offset, total_recipients, completed_at")
        .eq("campaign_key", campaignKey)
        .maybeSingle();

      return json(progressPayload(progress as CampaignProgress | null));
    }

    const recordHistory = !isTestSubject(subject);

    if (useProgress) {
      const allSubscribers = await loadAllSubscribers();
      const { data: existingProgress } = await supabaseAdmin
        .from("email_campaign_progress")
        .select("id, campaign_id, next_offset, total_recipients, completed_at")
        .eq("campaign_key", campaignKey)
        .maybeSingle();

      let progress = existingProgress as CampaignProgress | null;
      const offset = progress?.next_offset || 0;

      if (offset >= allSubscribers.length) {
        if (progress) {
          await supabaseAdmin
            .from("email_campaign_progress")
            .update({
              total_recipients: allSubscribers.length,
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", progress.id);
        }
        return json(
          progressPayload(
            {
              id: progress?.id || 0,
              campaign_id: progress?.campaign_id || null,
              next_offset: allSubscribers.length,
              total_recipients: allSubscribers.length,
              completed_at: new Date().toISOString(),
            },
            { failed: 0 }
          )
        );
      }

      const campaign = recordHistory
        ? await ensureCampaign(subject, message, progress?.campaign_id)
        : null;

      const batch = allSubscribers.slice(offset, offset + batchSize);
      let recorded = 0;
      const { sent, failed, failedEmails } = await sendToSubscribers(subject, message, batch, async (sentSoFar) => {
        if (!campaign) return;
        const delta = sentSoFar - recorded;
        if (delta > 0) {
          await bumpCampaignSentCount(campaign.id, delta);
          recorded = sentSoFar;
        }
      });
      const nextOffset = offset + batch.length;
      const completed = nextOffset >= allSubscribers.length;

      if (campaign && sent > recorded) {
        await bumpCampaignSentCount(campaign.id, sent - recorded);
      }

      const progressFields = {
        campaign_key: campaignKey,
        campaign_id: campaign?.id ?? progress?.campaign_id ?? null,
        batch_size: batchSize,
        next_offset: nextOffset,
        total_recipients: allSubscribers.length,
        last_sent_at: new Date().toISOString(),
        completed_at: completed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      if (progress?.id) {
        await supabaseAdmin.from("email_campaign_progress").update(progressFields).eq("id", progress.id);
      } else {
        await supabaseAdmin.from("email_campaign_progress").insert(progressFields);
      }

      return json({
        success: true,
        sent: nextOffset,
        failed,
        failedEmails,
        remaining: Math.max(allSubscribers.length - nextOffset, 0),
        total: allSubscribers.length,
        nextOffset,
        batchSent: sent,
      });
    }

    if (!subscribers || subscribers.length === 0) {
      return json({ error: "Subject, message, and subscribers are required" }, 400);
    }

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
    let recorded = 0;
    const { sent, failed, failedEmails } = await sendToSubscribers(
      subject,
      message,
      recipients,
      async (sentSoFar) => {
        if (!campaign) return;
        const delta = sentSoFar - recorded;
        if (delta > 0) {
          await bumpCampaignSentCount(campaign.id, delta);
          recorded = sentSoFar;
        }
      }
    );

    if (campaign && sent > recorded) {
      await bumpCampaignSentCount(campaign.id, sent - recorded);
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
