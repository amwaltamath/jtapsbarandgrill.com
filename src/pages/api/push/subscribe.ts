import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabase";
import { isPushConfigured } from "../../../lib/push";

async function getUserFromAuthHeader(authHeader?: string) {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }

  return data.user;
}

export const POST: APIRoute = async ({ request }) => {
  const headers = { "Content-Type": "application/json" };

  try {
    if (!isPushConfigured()) {
      return new Response(
        JSON.stringify({ error: "Push notifications are not configured yet." }),
        { status: 503, headers }
      );
    }

    const user = await getUserFromAuthHeader(request.headers.get("Authorization") ?? "");
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    }

    const body = await request.json();
    const subscription = body?.subscription;

    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return new Response(
        JSON.stringify({ error: "Invalid push subscription payload." }),
        { status: 400, headers }
      );
    }

    const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
        platform: body?.platform ?? "web",
        user_agent: request.headers.get("user-agent"),
        active: true,
        last_seen_at: new Date().toISOString()
      },
      { onConflict: "endpoint" }
    );

    if (error) {
      console.error("Failed to save push subscription:", error);
      return new Response(
        JSON.stringify({ error: "Could not save push subscription." }),
        { status: 500, headers }
      );
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (err) {
    console.error("Push subscribe error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Failed to subscribe." }),
      { status: 500, headers }
    );
  }
};
