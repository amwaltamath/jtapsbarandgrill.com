import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { requireAdmin } from '../../../lib/adminAuth';
import type { ReviewStatus } from '../../../lib/reviews';

const headers = { 'Content-Type': 'application/json' };
const VALID_STATUSES: ReviewStatus[] = ['pending', 'approved', 'featured', 'declined', 'google_invited'];

export const GET: APIRoute = async ({ request, url }) => {
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

  const status = url.searchParams.get('status');
  let query = supabaseAdmin
    .from('internal_reviews')
    .select('*')
    .order('created_at', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query.limit(200);

  if (error) {
    console.error('Admin reviews fetch error:', error);
    return new Response(JSON.stringify({ error: 'Failed to load reviews' }), { status: 500, headers });
  }

  return new Response(JSON.stringify({ reviews: data ?? [] }), { status: 200, headers });
};

export const PATCH: APIRoute = async ({ request }) => {
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
    const status = body?.status as ReviewStatus | undefined;
    const adminNotes = body?.admin_notes?.trim();

    if (!Number.isInteger(id) || id <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid review ID' }), { status: 400, headers });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return new Response(JSON.stringify({ error: 'Invalid status' }), { status: 400, headers });
      }
      updates.status = status;
    }

    if (adminNotes !== undefined) {
      updates.admin_notes = adminNotes || null;
    }

    if (Object.keys(updates).length === 1) {
      return new Response(JSON.stringify({ error: 'No updates provided' }), { status: 400, headers });
    }

    const { data, error } = await supabaseAdmin
      .from('internal_reviews')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) {
      console.error('Review update error:', error);
      return new Response(JSON.stringify({ error: 'Failed to update review' }), { status: 500, headers });
    }

    return new Response(JSON.stringify({ review: data }), { status: 200, headers });
  } catch (error) {
    console.error('Review patch error:', error);
    return new Response(JSON.stringify({ error: 'Something went wrong' }), { status: 500, headers });
  }
};
