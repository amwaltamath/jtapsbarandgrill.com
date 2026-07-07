import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabase";

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
    const user = await getUserFromAuthHeader(request.headers.get("Authorization") ?? "");
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    }

    const body = await request.json();
    const endpoint = body?.endpoint;

    if (!endpoint) {
      return new Response(JSON.stringify({ error: "Endpoint is required." }), {
        status: 400,
        headers
      });
    }

    const { error } = await supabaseAdmin
      .from("push_subscriptions")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("endpoint", endpoint);

    if (error) {
      console.error("Failed to unsubscribe endpoint:", error);
      return new Response(
        JSON.stringify({ error: "Failed to unsubscribe from notifications." }),
        { status: 500, headers }
      );
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (err) {
    console.error("Push unsubscribe error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Failed to unsubscribe." }),
      { status: 500, headers }
    );
  }
};
