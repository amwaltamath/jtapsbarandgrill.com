import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { requireAdmin } from '../../../lib/adminAuth';
import { addMember, inquiryByPhone, isFocusPosConfigured } from '../../../lib/focusPos';
import { applyInquiryToDatabase } from '../../../lib/posSync';

const headers = { 'Content-Type': 'application/json' };

export const GET: APIRoute = async ({ request }) => {
  return new Response(
    JSON.stringify({ configured: isFocusPosConfigured() }),
    { status: 200, headers },
  );
};

export const POST: APIRoute = async ({ request }) => {
  const adminResult = await requireAdmin(request);
  if ('error' in adminResult) {
    return new Response(JSON.stringify({ error: adminResult.error }), {
      status: adminResult.status,
      headers,
    });
  }

  if (!isFocusPosConfigured()) {
    return new Response(JSON.stringify({ error: 'Focus POS is not configured.' }), {
      status: 503,
      headers,
    });
  }

  try {
    const body = await request.json();
    const action = body?.action || 'inquiry';

    if (action === 'add-member') {
      const { phone, firstName, lastName, email } = body;
      if (!phone || !firstName || !email) {
        return new Response(
          JSON.stringify({ error: 'phone, firstName, and email are required for add-member.' }),
          { status: 400, headers },
        );
      }

      const result = await addMember({
        mobileNumber: phone,
        firstName,
        lastName: lastName || '',
        email,
      });

      return new Response(JSON.stringify({ result }), { status: 200, headers });
    }

    const phone = body?.phone?.trim();
    if (!phone) {
      return new Response(JSON.stringify({ error: 'phone is required.' }), { status: 400, headers });
    }

    const inquiry = await inquiryByPhone(phone);
    let sync = null;

    if (inquiry.found && supabaseAdmin) {
      sync = await applyInquiryToDatabase(supabaseAdmin, inquiry, {
        email: body?.email,
        name: body?.name,
        phone,
      });
    }

    return new Response(JSON.stringify({ inquiry, sync }), { status: 200, headers });
  } catch (error) {
    console.error('Admin POS inquiry error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'POS inquiry failed.' }),
      { status: 500, headers },
    );
  }
};
