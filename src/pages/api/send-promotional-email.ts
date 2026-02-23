import type { APIRoute } from "astro";
import { Resend } from "resend";
import { createEmailTemplate } from "../../lib/emailTemplates";
import { supabaseAdmin } from "../../lib/supabase";
import crypto from "crypto";

const resend = new Resend(import.meta.env.RESEND_API_KEY);

interface Subscriber {
  email: string;
  name?: string;
}

interface RequestBody {
  action?: "send" | "status" | "reset";
  subject: string;
  message: string;
  subscribers: Subscriber[];
  useProgress?: boolean;
  batchSize?: number;
}

async function validateAdminAccess(authHeader?: string): Promise<boolean> {
  if (!authHeader?.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.slice(7);
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return false;
    const { data: adminRow } = await supabaseAdmin
      .from("admin_users")
      .select("id")
      .eq("user_id", data.user.id)
      .maybeSingle();
    return Boolean(adminRow);
  } catch {
    return false;
  }
}

function getCampaignKey(subject: string, message: string): string {
  const key = subject + "|" + message;
  return crypto.createHash("sha256").update(key).digest("hex");
}

export const POST: APIRoute = async ({ request }) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const isAdmin = await validateAdminAccess(request.headers.get("Authorization") ?? "");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = (await request.json()) as RequestBody;
    const { action = "send", subject, message, subscribers } = body;

    if (!subject || !message || !subscribers || subscribers.length === 0) {
      return new Response(
        JSON.stringify({ error: "Subject, message, and subscribers are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    let sent = 0;
    let failed = 0;

    for (const subscriber of subscribers) {
      try {
        const emailHtml = createEmailTemplate({
          recipientName: subscriber.name,
          content: message,
          preheader: subject
        });

        await resend.emails.send({
          from: "JTAPS Bar & Grill <noreply@jtapsbarandgrill.com>",
          to: subscriber.email,
          subject: subject,
          html: emailHtml
        });

        sent++;
        await new Promise(resolve => setTimeout(resolve, 600));
      } catch (err) {
        console.error("Failed to send to " + subscriber.email, err);
        failed++;
      }
    }

    await supabaseAdmin
      .from("email_campaigns")
      .insert({
        subject,
        message,
        sent_count: sent,
        sent_at: new Date().toISOString()
      });

    return new Response(
      JSON.stringify({
        success: true,
        sent,
        failed,
        total: subscribers.length
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Email campaign error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Failed to send emails"
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
