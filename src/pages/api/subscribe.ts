import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../lib/supabase";
import { getResend } from "../../lib/resend";
import { createEmailTemplate } from "../../lib/emailTemplates";

export const POST: APIRoute = async ({ request }) => {
  const headers = { "Content-Type": "application/json" };

  try {
    const body = await request.json();
    const email = body?.email?.trim().toLowerCase();
    const smsOptIn = body?.smsOptIn === true;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: "Please enter a valid email address." }),
        { status: 400, headers }
      );
    }

    const { data: existing } = await supabaseAdmin
      .from("newsletter_subscribers")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ error: "You are already subscribed!" }),
        { status: 409, headers }
      );
    }

    const { error: insertError } = await supabaseAdmin
      .from("newsletter_subscribers")
      .insert({ email, sms_opt_in: smsOptIn });

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to subscribe. Please try again." }),
        { status: 500, headers }
      );
    }

    try {
      const resend = getResend();
      if (resend) {
        const emailHtml = createEmailTemplate({
          content: "<h2>Welcome to JTAPS!</h2><p>Thanks for subscribing. Stay tuned for updates!</p>",
          preheader: "Welcome!"
        });

        await resend.emails.send({
          from: "JTAPS Bar and Grill <no-reply@jtapsbarandgrill.com>",
          to: email,
          subject: "Welcome to JTAPS Bar and Grill!",
          html: emailHtml
        });
      }
    } catch (emailErr) {
      console.error("Email failed:", emailErr);
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
