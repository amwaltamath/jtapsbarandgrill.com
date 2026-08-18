import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase';
import { getResend } from '../../lib/resend';
import { createEmailTemplate } from '../../lib/emailTemplates';
import { GOOGLE_REVIEW_URL } from '../../lib/reviews';

const PETE_EMAIL = 'vasilioupete@gmail.com';
const headers = { 'Content-Type': 'application/json' };

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function getOptionalUser(authHeader?: string | null) {
  if (!authHeader?.startsWith('Bearer ') || !supabaseAdmin) return null;
  const token = authHeader.slice(7);
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    if (!supabaseAdmin) {
      return new Response(JSON.stringify({ error: 'Review service is not configured.' }), {
        status: 503,
        headers,
      });
    }

    const body = await request.json();
    const name = body?.name?.trim();
    const email = body?.email?.trim().toLowerCase();
    const comment = body?.comment?.trim();
    const rating = Number(body?.rating);
    const website = body?.website?.trim();
    const source = body?.source?.trim() || 'website';

    if (website) {
      return new Response(JSON.stringify({ success: true }), { status: 200, headers });
    }

    if (!name || !email || !comment) {
      return new Response(JSON.stringify({ error: 'Please complete your name, email, and review.' }), {
        status: 400,
        headers,
      });
    }

    if (!isValidEmail(email)) {
      return new Response(JSON.stringify({ error: 'Please enter a valid email address.' }), {
        status: 400,
        headers,
      });
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return new Response(JSON.stringify({ error: 'Please select a rating from 1 to 5 stars.' }), {
        status: 400,
        headers,
      });
    }

    if (comment.length < 10) {
      return new Response(JSON.stringify({ error: 'Please write at least 10 characters in your review.' }), {
        status: 400,
        headers,
      });
    }

    if (comment.length > 2000) {
      return new Response(JSON.stringify({ error: 'Review is too long. Please keep it under 2000 characters.' }), {
        status: 400,
        headers,
      });
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentReview } = await supabaseAdmin
      .from('internal_reviews')
      .select('id')
      .eq('reviewer_email', email)
      .gte('created_at', oneDayAgo)
      .maybeSingle();

    if (recentReview) {
      return new Response(
        JSON.stringify({ error: 'You already submitted a review recently. Thank you!' }),
        { status: 429, headers },
      );
    }

    const user = await getOptionalUser(request.headers.get('Authorization'));

    const { data: review, error: insertError } = await supabaseAdmin
      .from('internal_reviews')
      .insert({
        user_id: user?.id ?? null,
        reviewer_name: name,
        reviewer_email: email,
        rating,
        comment,
        source,
        status: 'pending',
      })
      .select('id, rating')
      .single();

    if (insertError || !review) {
      console.error('Review insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Could not save your review. Please try again.' }), {
        status: 500,
        headers,
      });
    }

    const resend = getResend();
    if (resend) {
      const stars = '★'.repeat(rating);
      const safeName = escapeHtml(name);
      const safeEmail = escapeHtml(email);
      const safeComment = escapeHtml(comment).replace(/\n/g, '<br>');

      const adminHtml = createEmailTemplate({
        recipientName: 'Pete',
        preheader: `New ${stars} review from ${name}`,
        content: `
          <h2 style="color: #E13622; margin: 0 0 15px; font-size: 22px;">New Customer Review</h2>
          <p style="margin: 0 0 12px;"><strong>From:</strong> ${safeName} (${safeEmail})</p>
          <p style="margin: 0 0 12px;"><strong>Rating:</strong> ${stars} (${rating}/5)</p>
          <div style="margin: 18px 0 0; padding: 18px; background: #f7f7f7; border-left: 4px solid #E13622; border-radius: 8px;">
            <p style="margin: 0 0 8px; font-weight: bold;">Review</p>
            <p style="margin: 0; line-height: 1.7;">${safeComment}</p>
          </div>
          <p style="margin: 20px 0 0;">
            <a href="https://jtapsbarandgrill.com/admin" style="color: #E13622;">Manage reviews in admin →</a>
          </p>
        `,
      });

      try {
        await resend.emails.send({
          from: 'JTAPS Reviews <no-reply@jtapsbarandgrill.com>',
          to: PETE_EMAIL,
          subject: `New ${rating}-star review from ${name}`,
          html: adminHtml,
        });
      } catch (emailError) {
        console.error('Review notification email failed:', emailError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        reviewId: review.id,
        rating: review.rating,
        suggestGoogle: rating >= 4,
        googleReviewUrl: GOOGLE_REVIEW_URL,
      }),
      { status: 200, headers },
    );
  } catch (error) {
    console.error('Review submission error:', error);
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
      status: 500,
      headers,
    });
  }
};

export const GET: APIRoute = async () => {
  try {
    if (!supabaseAdmin) {
      return new Response(JSON.stringify({ reviews: [] }), { status: 200, headers });
    }

    const { data, error } = await supabaseAdmin
      .from('internal_reviews')
      .select('reviewer_name, rating, comment, created_at')
      .eq('status', 'featured')
      .order('created_at', { ascending: false })
      .limit(6);

    if (error) {
      console.error('Featured reviews fetch error:', error);
      return new Response(JSON.stringify({ reviews: [] }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ reviews: data ?? [] }), { status: 200, headers });
  } catch (error) {
    console.error('Featured reviews error:', error);
    return new Response(JSON.stringify({ reviews: [] }), { status: 200, headers });
  }
};
