import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../lib/supabase";
import { getResend } from "../../lib/resend";
import { createEmailTemplate } from "../../lib/emailTemplates";

export const POST: APIRoute = async ({ request }) => {
  const headers = { "Content-Type": "application/json" };

  try {
    const body = await request.json();
    const email = body?.email?.trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: "Please enter a valid email address." }),
        { status: 400, headers }
      );
    }

    // Check if already subscribed
    const { data: existing } = await supabaseAdmin
      .from("newsletter_subscribers")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ error: "You're already subscribed!" }),
        { status: 409, headers }
      );
    }

    // Insert subscriber
    const { error: insertError } = await supabaseAdmin
      .from("newsletter_subscribers")
      .insert({ email });

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to subscribe. Please try again." }),
        { status: 500, headers }
      );
    }

    // Send welcome email (non-blocking — don't fail the request if email fails)
    try {
      const resend = getResend();
      if (resend) {
        const html = createEmailTemplate({
          content: 
            <h2 style="color: #b8860b; margin: 0 0 16px;">Welcome to the JTAPS Family!</h2>
            <p style="font-size: 16px; line-height: 1.6; color: #333;">
              Thanks for subscribing! You'll now receive exclusive deals, event updates,
              and the latest news from JTAPS Bar &amp; Grill.
            </p>
            <p style="font-size: 16px; line-height: 1.6; color: #333;">
              Stay tuned — great things are coming your way. ??
            </p>
          ,
          preheader: "Welcome to the JTAPS family!",
        });

        await resend.emails.send({
          from: "JTAPS Bar & Grill <no-reply@jtapsbarandgrill.com>",
          to: email,
          subject: "Welcome to JTAPS Bar & Grill!",
          html,
        });
      }
    } catch (emailErr) {
      console.error("Welcome email failed:", emailErr);
      // Don't fail the subscription if email sending fails
    }

    return new Response(
      JSON.stringify({ message: "Successfully subscribed!" }),
      { status: 200, headers }
    );
  } catch (err) {
    console.error("Subscribe error:", err);
    return new Response(
      JSON.stringify({ error: "Something went wrong. Please try again." }),
      { status: 500, headers }
    );
  }
};
