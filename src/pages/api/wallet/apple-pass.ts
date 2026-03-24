import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { generateApplePass, isAppleWalletConfigured, computeTier } from '../../../lib/wallet';
import type { LoyaltyMember } from '../../../lib/wallet';

export const GET: APIRoute = async ({ request }) => {
  // Check if Apple Wallet is configured
  if (!isAppleWalletConfigured()) {
    return new Response(
      JSON.stringify({ error: 'Apple Wallet is not configured on this server.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Authenticate the user
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
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('customer_profiles')
    .select('name, email, checkin_points, total_checkins, current_streak, created_at, member_since')
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile) {
    return new Response(
      JSON.stringify({ error: 'Customer profile not found. Please check in first.' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const points = profile.checkin_points || 0;
  const tier = computeTier(points);

  const member: LoyaltyMember = {
    userId: user.id,
    name: profile.name || user.email?.split('@')[0] || 'Member',
    email: profile.email || user.email || '',
    points,
    tier,
    totalCheckins: profile.total_checkins || 0,
    currentStreak: profile.current_streak || 0,
    memberSince: profile.member_since || profile.created_at,
  };

  try {
    const passBuffer = await generateApplePass(member);

    // Record the wallet pass in the database
    const serial = `jtaps-loyalty-${user.id}`;
    await supabaseAdmin
      .from('wallet_passes')
      .upsert(
        {
          user_id: user.id,
          pass_type: 'apple',
          pass_serial: serial,
          points_snapshot: points,
          tier_snapshot: tier,
          last_updated: new Date().toISOString(),
        },
        { onConflict: 'pass_serial' }
      );

    return new Response(new Uint8Array(passBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Content-Disposition': `attachment; filename="jtaps-loyalty-card.pkpass"`,
      },
    });
  } catch (err: any) {
    console.error('Apple pass generation error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to generate Apple Wallet pass.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
