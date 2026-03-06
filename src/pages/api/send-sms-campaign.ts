import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../lib/supabase";
import { sendSMS } from "../../lib/twilio";

interface SMSSubscriber {
  id: number;
  phone: string;
  name: string | null;
}

async function validateAdminAccess(authHeader?: string): Promise<boolean> {
  if (!authHeader?.startsWith("Bearer ")) return false;
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

export const POST: APIRoute = async ({ request }) => {
  const headers = { "Content-Type": "application/json" };

  try {
    const isAdmin = await validateAdminAccess(request.headers.get("Authorization") ?? "");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    }

    const body = await request.json();
    const { message, subscribers } = body as { message: string; subscribers: SMSSubscriber[] };

    if (!message || !subscribers || subscribers.length === 0) {
      return new Response(
        JSON.stringify({ error: "Message and subscribers are required" }),
        { status: 400, headers }
      );
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const sub of subscribers) {
      try {
        await sendSMS(sub.phone, message);
        sent++;
      } catch (err) {
        failed++;
        errors.push(sub.phone);
        console.error("SMS failed for " + sub.phone + ":", err);
      }
    }

    try {
      await supabaseAdmin.from("sms_campaigns").insert({
        message,
        sent_count: sent,
        sent_at: new Date().toISOString()
      });
    } catch (dbErr) {
      console.error("Failed to record SMS campaign:", dbErr);
    }

    return new Response(
      JSON.stringify({ sent, failed, errors, total: subscribers.length }),
      { status: 200, headers }
    );
  } catch (err) {
    console.error("SMS campaign error:", err);
    return new Response(
      JSON.stringify({ error: "Something went wrong. Please try again." }),
      { status: 500, headers }
    );
  }
};