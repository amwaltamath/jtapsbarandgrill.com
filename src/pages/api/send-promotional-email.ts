import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../lib/supabase";
import { getResend } from "../../lib/resend";

export const POST: APIRoute = async ({ request }) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { subject, message, subscribers: bodySubscribers } = await request.json();

    if (!subject || !message) {
      return new Response(JSON.stringify({ error: "Missing subject or message" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const resend = getResend();
    if (!resend) {
      return new Response(JSON.stringify({ error: "Resend not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const isTest = typeof subject === "string" && subject.trim().startsWith("[TEST]");
    let emails: string[] = [];

    if (Array.isArray(bodySubscribers) && bodySubscribers.length > 0) {
      emails = bodySubscribers
        .map((subscriber: { email?: string }) => subscriber?.email)
        .filter((email: string | undefined): email is string => Boolean(email));
    } else {
      if (!supabaseAdmin) {
        return new Response(JSON.stringify({ error: "Supabase not configured" }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Get all email subscribers
      const { data: subscribers, error: fetchError } = await supabaseAdmin
        .from("newsletter_subscribers")
        .select("email")
        .eq("email_opt_in", true);

      if (fetchError || !subscribers) {
        return new Response(JSON.stringify({ error: "Failed to fetch subscribers" }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }

      emails = subscribers.map(s => s.email).filter(Boolean);
    }

    if (emails.length === 0) {
      return new Response(JSON.stringify({ error: "No valid recipients" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Send in batches (Resend max 50 recipients per request)
    const batchSize = 50;
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    let sentCount = 0;
    let lastMessageId: string | undefined;

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      let emailResult = await resend.emails.send({
        from: "JTAPS <noreply@jtapsbarandgrill.com>",
        to: batch,
        subject: subject,
        html: `<p>${message}</p>`
      });

      if (emailResult.error) {
        const messageText = emailResult.error.message || "";
        if (messageText.includes("Too many requests")) {
          await sleep(1000);
          emailResult = await resend.emails.send({
            from: "JTAPS <noreply@jtapsbarandgrill.com>",
            to: batch,
            subject: subject,
            html: `<p>${message}</p>`
          });
        }
      }

      if (emailResult.error) {
        return new Response(JSON.stringify({ error: emailResult.error.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }

      sentCount += batch.length;
      lastMessageId = emailResult.data?.id;

      // Respect Resend rate limits (max 2 requests/sec)
      await sleep(600);
    }

    if (!isTest) {
      if (!supabaseAdmin) {
        return new Response(JSON.stringify({ error: "Supabase not configured" }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Record campaign in database
      await supabaseAdmin.from("email_campaigns").insert({
        subject: subject,
        message: message,
        sent_count: sentCount,
        sent_at: new Date().toISOString()
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        failed: 0,
        messageId: lastMessageId
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Email campaign error:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};
