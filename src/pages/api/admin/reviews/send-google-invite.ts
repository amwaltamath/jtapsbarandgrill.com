import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase';
import { requireAdmin } from '../../../../lib/adminAuth';
import { getResend } from '../../../../lib/resend';
import { createEmailTemplate } from '../../../../lib/emailTemplates';
import { googleReviewUrl, starsForRating } from '../../../../lib/reviews';

const headers = { 'Content-Type': 'application/json' };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const POST: APIRoute = async ({ request }) => {
  const adminResult = await requireAdmin(request);
  if ('error' in adminResult) {
    return new Response(JSON.stringify({ error: adminResult.error }), {
      status: adminResult.status,
      headers,
    });
  }

  if (!supabaseAdmin) {
    return new Response(JSON.stringify({ error: 'Supabase not configured' }), { status: 500, headers });
  }

  try {
    const body = await request.json();
    const id = Number(body?.id);

    if (!Number.isInteger(id) || id <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid review ID' }), { status: 400, headers });
    }

    const { data: review, error: fetchError } = await supabaseAdmin
      .from('internal_reviews')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !review) {
      return new Response(JSON.stringify({ error: 'Review not found' }), { status: 404, headers });
    }

    if (review.rating < 4) {
      return new Response(
        JSON.stringify({ error: 'Google invites are best for 4–5 star reviews. Consider following up privately instead.' }),
        { status: 400, headers },
      );
    }

    const resend = getResend();
    if (!resend) {
      return new Response(JSON.stringify({ error: 'Email service is not configured.' }), { status: 503, headers });
    }

    const reviewLink = googleReviewUrl(review.id);
    const firstName = review.reviewer_name.trim().split(/\s+/)[0] || 'there';
    const safeFirstName = escapeHtml(firstName);
    const stars = starsForRating(review.rating);

    const html = createEmailTemplate({
      recipientName: firstName,
      preheader: 'Would you share your JTAPS experience on Google?',
      content: `
        <h2 style="color: #E13622; margin: 0 0 15px; font-size: 22px;">Thanks for the love, ${safeFirstName}!</h2>
        <p style="margin: 0 0 15px; line-height: 1.7;">
          We loved reading your ${stars} review. If you have a moment, sharing your experience on Google helps other Cincinnati fans discover JTAPS.
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${reviewLink}" style="display: inline-block; background: #E13622; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 999px; font-weight: bold;">
            Leave a Google Review
          </a>
        </div>
        <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.6;">
          Google reviews must be posted directly by you on Google — we can't post on your behalf. Thank you for supporting our neighborhood sports bar!
        </p>
      `,
    });

    await resend.emails.send({
      from: 'JTAPS Bar & Grill <info@jtapsbarandgrill.com>',
      to: review.reviewer_email,
      subject: 'Would you share your JTAPS review on Google?',
      html,
    });

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('internal_reviews')
      .update({
        status: 'google_invited',
        google_invite_sent_at: now,
        updated_at: now,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError || !updated) {
      console.error('Review invite update error:', updateError);
      return new Response(JSON.stringify({ error: 'Email sent but failed to update review status.' }), {
        status: 500,
        headers,
      });
    }

    return new Response(JSON.stringify({ success: true, review: updated }), { status: 200, headers });
  } catch (error) {
    console.error('Google invite error:', error);
    return new Response(JSON.stringify({ error: 'Failed to send Google review invite.' }), {
      status: 500,
      headers,
    });
  }
};
