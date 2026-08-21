import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { inquiryByPhone, isFocusPosConfigured } from '../../../lib/focusPos';
import { applyInquiryToDatabase } from '../../../lib/posSync';

const headers = { 'Content-Type': 'application/json' };

async function getUserFromToken(authHeader?: string | null) {
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
    if (!isFocusPosConfigured()) {
      return new Response(JSON.stringify({ error: 'Focus POS sync is not configured.' }), {
        status: 503,
        headers,
      });
    }

    const user = await getUserFromToken(request.headers.get('Authorization'));
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized. Please log in.' }), {
        status: 401,
        headers,
      });
    }

    const body = await request.json().catch(() => ({}));
    const requestedPhone = body?.phone?.trim();

    const { data: profile } = await supabaseAdmin!
      .from('customer_profiles')
      .select('name, email, phone')
      .eq('user_id', user.id)
      .maybeSingle();

    const phone = requestedPhone || profile?.phone || '';
    if (!phone) {
      return new Response(
        JSON.stringify({ error: 'Add a mobile number to your profile to sync POS points.' }),
        { status: 400, headers },
      );
    }

    const inquiry = await inquiryByPhone(phone);
    const syncResult = await applyInquiryToDatabase(supabaseAdmin!, inquiry, {
      email: profile?.email || user.email,
      name: profile?.name,
      phone,
    });

    return new Response(JSON.stringify({ inquiry, sync: syncResult }), { status: 200, headers });
  } catch (error) {
    console.error('POS sync error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'POS sync failed.' }),
      { status: 500, headers },
    );
  }
};
