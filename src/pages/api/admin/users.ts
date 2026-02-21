import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

const getUserFromRequest = async (request: Request) => {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : '';

  if (!token) {
    return { error: 'Missing authorization token', status: 401 };
  }

  if (!supabaseAdmin) {
    return { error: 'Supabase not configured', status: 500 };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    return { error: 'Invalid or expired session', status: 401 };
  }

  return { user: data.user };
};

const requireAdmin = async (request: Request) => {
  const authResult = await getUserFromRequest(request);
  if ('error' in authResult) {
    return authResult;
  }

  const { data: adminRow, error: adminError } = await supabaseAdmin
    .from('admin_users')
    .select('id')
    .eq('user_id', authResult.user.id)
    .maybeSingle();

  if (adminError) {
    return { error: 'Failed to verify admin access', status: 500 };
  }

  if (!adminRow) {
    return { error: 'Forbidden', status: 403 };
  }

  return { user: authResult.user };
};

export const GET: APIRoute = async ({ request }) => {
  const adminResult = await requireAdmin(request);
  if ('error' in adminResult) {
    return new Response(JSON.stringify({ error: adminResult.error }), {
      status: adminResult.status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!supabaseAdmin) {
    return new Response(JSON.stringify({ error: 'Supabase not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    perPage: 1000,
    page: 1
  });

  if (error || !data?.users) {
    return new Response(JSON.stringify({ error: 'Failed to load users' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { data: adminRows } = await supabaseAdmin
    .from('admin_users')
    .select('user_id');

  const adminSet = new Set((adminRows || []).map((row) => row.user_id));

  const users = data.users.map((user) => ({
    id: user.id,
    email: user.email ?? null,
    created_at: user.created_at ?? null,
    last_sign_in_at: user.last_sign_in_at ?? null,
    is_admin: adminSet.has(user.id)
  }));

  return new Response(JSON.stringify({ users }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const POST: APIRoute = async ({ request }) => {
  const adminResult = await requireAdmin(request);
  if ('error' in adminResult) {
    return new Response(JSON.stringify({ error: adminResult.error }), {
      status: adminResult.status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!supabaseAdmin) {
    return new Response(JSON.stringify({ error: 'Supabase not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { action, userId } = await request.json();

  if (!userId || typeof userId !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing userId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (action !== 'promote' && action !== 'demote') {
    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (action === 'promote') {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = userData?.user?.email ?? null;

    const { error } = await supabaseAdmin
      .from('admin_users')
      .upsert({ user_id: userId, email });

    if (error) {
      return new Response(JSON.stringify({ error: 'Failed to promote user' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  if (action === 'demote') {
    const { error } = await supabaseAdmin
      .from('admin_users')
      .delete()
      .eq('user_id', userId);

    if (error) {
      return new Response(JSON.stringify({ error: 'Failed to remove admin access' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
