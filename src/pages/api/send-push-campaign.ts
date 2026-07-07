import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../lib/supabase";
import { isPushConfigured, sendPushNotification } from "../../lib/push";

interface PushRequestBody {
  title: string;
  message: string;
  url?: string;
}

interface PushSubscriptionRow {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
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

export const POST: APIRoute = async ({ request }) => {
  const headers = { "Content-Type": "application/json" };

  try {
    const isAdmin = await validateAdminAccess(request.headers.get("Authorization") ?? "");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    }

    if (!isPushConfigured()) {
      return new Response(
        JSON.stringify({ error: "Push notifications are not configured yet." }),
        { status: 503, headers }
      );
    }

    const body = (await request.json()) as PushRequestBody;
    const { title, message, url } = body;

    if (!title || !message) {
      return new Response(JSON.stringify({ error: "Title and message are required." }), {
        status: 400,
        headers
      });
    }

    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("active", true);

    if (subError) {
      console.error("Failed to fetch push subscriptions:", subError);
      return new Response(
        JSON.stringify({ error: "Failed to load push subscribers." }),
        { status: 500, headers }
      );
    }

    const targets = (subscriptions ?? []) as PushSubscriptionRow[];

    if (targets.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, failed: 0, total: 0, message: "No active push subscribers." }),
        { status: 200, headers }
      );
    }

    let sent = 0;
    let failed = 0;

    for (const subscription of targets) {
      try {
        await sendPushNotification(subscription, {
          title,
          body: message,
          url,
          tag: "jtaps-campaign"
        });
        sent++;
      } catch (err) {
        failed++;

        const statusCode =
          err && typeof err === "object" && "statusCode" in err
            ? Number((err as { statusCode?: number }).statusCode)
            : 0;

        if (statusCode === 404 || statusCode === 410) {
          await supabaseAdmin
            .from("push_subscriptions")
            .update({ active: false, updated_at: new Date().toISOString() })
            .eq("id", subscription.id);
        }

        console.error("Push send failed for subscription", subscription.id, err);
      }
    }

    await supabaseAdmin.from("push_campaigns").insert({
      title,
      message,
      target_count: targets.length,
      sent_count: sent,
      failed_count: failed,
      sent_at: new Date().toISOString()
    });

    return new Response(JSON.stringify({ sent, failed, total: targets.length }), {
      status: 200,
      headers
    });
  } catch (err) {
    console.error("Push campaign error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Failed to send push campaign." }),
      { status: 500, headers }
    );
  }
};
