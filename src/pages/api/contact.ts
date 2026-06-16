import type { APIRoute } from "astro";
import { getResend } from "../../lib/resend";
import { createEmailTemplate } from "../../lib/emailTemplates";

const PETE_EMAIL = "vasilioupete@gmail.com";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const POST: APIRoute = async ({ request }) => {
  const headers = { "Content-Type": "application/json" };

  try {
    const body = await request.json();
    const name = body?.name?.trim();
    const email = body?.email?.trim().toLowerCase();
    const phone = body?.phone?.trim();
    const subject = body?.subject?.trim();
    const message = body?.message?.trim();
    const website = body?.website?.trim();

    if (website) {
      return new Response(JSON.stringify({ success: true }), { status: 200, headers });
    }

    if (!name || !email || !subject || !message) {
      return new Response(
        JSON.stringify({ error: "Please complete your name, email, subject, and message." }),
        { status: 400, headers }
      );
    }

    if (!isValidEmail(email)) {
      return new Response(JSON.stringify({ error: "Please enter a valid email address." }), {
        status: 400,
        headers
      });
    }

    const resend = getResend();
    if (!resend) {
      return new Response(
        JSON.stringify({ error: "Email service is not configured right now." }),
        { status: 503, headers }
      );
    }

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safePhone = phone ? escapeHtml(phone) : "Not provided";
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message).replace(/\n/g, "<br>");

    const html = createEmailTemplate({
      recipientName: "Pete",
      preheader: `New contact form message: ${subject}`,
      content: `
        <h2 style="color: #E13622; margin: 0 0 15px; font-size: 22px;">New Contact Form Submission</h2>
        <p style="margin: 0 0 12px;"><strong>Name:</strong> ${safeName}</p>
        <p style="margin: 0 0 12px;"><strong>Email:</strong> ${safeEmail}</p>
        <p style="margin: 0 0 12px;"><strong>Phone:</strong> ${safePhone}</p>
        <p style="margin: 0 0 12px;"><strong>Subject:</strong> ${safeSubject}</p>
        <div style="margin: 18px 0 0; padding: 18px; background: #f7f7f7; border-left: 4px solid #E13622; border-radius: 8px;">
          <p style="margin: 0 0 8px; font-weight: bold;">Message</p>
          <p style="margin: 0; line-height: 1.7;">${safeMessage}</p>
        </div>
      `
    });

    await resend.emails.send({
      from: "JTAPS Contact Form <no-reply@jtapsbarandgrill.com>",
      to: [PETE_EMAIL, "info@jtapsbarandgrill.com"],
      replyTo: email,
      subject: `JTAPS Contact Form: ${subject}`,
      html
    });

    return new Response(
      JSON.stringify({ message: "Your message has been sent to Pete." }),
      { status: 200, headers }
    );
  } catch (err) {
    console.error("Contact form error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Failed to send your message." }),
      { status: 500, headers }
    );
  }
};