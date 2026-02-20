import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../lib/supabase";
import { resend } from "../../lib/resend";

export const POST: APIRoute = async ({ request }) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { subject, message } = await request.json();

    if (!subject || !message) {
      return new Response(JSON.stringify({ error: "Missing subject or message" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

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

    const emails = subscribers.map(s => s.email).filter(Boolean);
    
    if (emails.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: "No subscribers" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Send email campaign via Resend
    const emailResult = await resend.emails.send({
      from: "JTAPS <noreply@jtapsbarandgrill.com>",
      to: emails,
      subject: subject,
      html: `<p>${message}</p>`
    });

    if (emailResult.error) {
      return new Response(JSON.stringify({ error: emailResult.error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Record campaign in database
    await supabaseAdmin.from("email_campaigns").insert({
      subject: subject,
      message: message,
      sent_count: emails.length,
      sent_at: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({
        success: true,
        sent: emails.length,
        messageId: emailResult.data?.id
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Email campaign error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};
