import { supabaseAdmin } from './supabase';

export async function getUserFromRequest(request: Request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';

  if (!token) {
    return { error: 'Missing authorization token', status: 401 as const };
  }

  if (!supabaseAdmin) {
    return { error: 'Supabase not configured', status: 500 as const };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    return { error: 'Invalid or expired session', status: 401 as const };
  }

  return { user: data.user };
}

export async function requireAdmin(request: Request) {
  const authResult = await getUserFromRequest(request);
  if ('error' in authResult) {
    return authResult;
  }

  const { data: adminRow, error: adminError } = await supabaseAdmin!
    .from('admin_users')
    .select('id')
    .eq('user_id', authResult.user.id)
    .maybeSingle();

  if (adminError) {
    return { error: 'Failed to verify admin access', status: 500 as const };
  }

  if (!adminRow) {
    return { error: 'Forbidden', status: 403 as const };
  }

  return { user: authResult.user };
}
