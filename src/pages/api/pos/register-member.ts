import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { addMember, inquiryByPhone, isFocusPosConfigured } from '../../../lib/focusPos';
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

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Guest', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export const POST: APIRoute = async ({ request }) => {
  try {
    if (!isFocusPosConfigured()) {
      return new Response(JSON.stringify({ skipped: true, reason: 'Focus POS not configured' }), {
        status: 200,
        headers,
      });
    }

    const user = await getUserFromToken(request.headers.get('Authorization'));
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
    }

    const { data: profile } = await supabaseAdmin!
      .from('customer_profiles')
      .select('name, email, phone')
      .eq('user_id', user.id)
      .maybeSingle();

    const phone = profile?.phone?.trim();
    const email = (profile?.email || user.email || '').trim().toLowerCase();
    const name = profile?.name?.trim() || user.user_metadata?.name || 'JTAPS Guest';

    if (!phone) {
      return new Response(JSON.stringify({ skipped: true, reason: 'No phone on profile' }), {
        status: 200,
        headers,
      });
    }

    let inquiry = await inquiryByPhone(phone);

    if (!inquiry.found) {
      const { firstName, lastName } = splitName(name);
      const addResult = await addMember({
        mobileNumber: phone,
        firstName,
        lastName,
        email,
      });

      if (!addResult.ok) {
        return new Response(
          JSON.stringify({
            registered: false,
            addResult,
            message: addResult.message,
          }),
          { status: 200, headers },
        );
      }

      inquiry = await inquiryByPhone(phone);
    }

    const sync = await applyInquiryToDatabase(supabaseAdmin!, inquiry, {
      email,
      name,
      phone,
    });

    return new Response(
      JSON.stringify({
        registered: true,
        inquiry,
        sync,
      }),
      { status: 200, headers },
    );
  } catch (error) {
    console.error('POS register-member error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'POS registration failed.' }),
      { status: 500, headers },
    );
  }
};
