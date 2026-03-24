import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { isAppleWalletConfigured, isGoogleWalletConfigured, computeTier } from '../../../lib/wallet';

export const GET: APIRoute = async ({ request }) => {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: 'Invalid or expired session' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Fetch customer profile
  const { data: profile } = await supabaseAdmin
    .from('customer_profiles')
    .select('name, email, checkin_points, total_checkins, current_streak, longest_streak, created_at, member_since, last_checkin_date')
    .eq('user_id', user.id)
    .single();

  if (!profile) {
    return new Response(
      JSON.stringify({ error: 'Customer profile not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const points = profile.checkin_points || 0;
  const tier = computeTier(points);

  // Check if user already has wallet passes installed
  const { data: passes } = await supabaseAdmin
    .from('wallet_passes')
    .select('pass_type, created_at, last_updated')
    .eq('user_id', user.id);

  const installedPasses = (passes || []).reduce((acc: Record<string, any>, p: any) => {
    acc[p.pass_type] = { installedAt: p.created_at, lastUpdated: p.last_updated };
    return acc;
  }, {});

  return new Response(
    JSON.stringify({
      member: {
        userId: user.id,
        name: profile.name || user.email?.split('@')[0] || 'Member',
        email: profile.email || user.email || '',
        points,
        tier,
        totalCheckins: profile.total_checkins || 0,
        currentStreak: profile.current_streak || 0,
        longestStreak: profile.longest_streak || 0,
        memberSince: profile.member_since || profile.created_at,
        lastCheckin: profile.last_checkin_date,
      },
      wallets: {
        apple: {
          configured: isAppleWalletConfigured(),
          installed: !!installedPasses.apple,
          ...installedPasses.apple,
        },
        google: {
          configured: isGoogleWalletConfigured(),
          installed: !!installedPasses.google,
          ...installedPasses.google,
        },
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
