import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { addMember, inquiryByPhone, isFocusPosConfigured } from '../../../lib/focusPos';
import { applyInquiryToDatabase } from '../../../lib/posSync';
import { computeTier, isAppleWalletConfigured, isGoogleWalletConfigured } from '../../../lib/wallet';

async function syncPosPointsForUser(userId: string, email: string | undefined) {
  if (!isFocusPosConfigured() || !supabaseAdmin) return;

  const { data: profile } = await supabaseAdmin
    .from('customer_profiles')
    .select('name, email, phone')
    .eq('user_id', userId)
    .maybeSingle();

  const phone = profile?.phone;
  if (!phone) return;

  try {
    const inquiry = await inquiryByPhone(phone);
    await applyInquiryToDatabase(supabaseAdmin, inquiry, {
      email: profile?.email || email,
      name: profile?.name,
      phone,
    });
  } catch (error) {
    console.warn('Background POS sync skipped:', error);
  }
}

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

  // Fetch customer profile — only select columns guaranteed to exist
  let { data: profile, error: fetchError } = await supabaseAdmin
    .from('customer_profiles')
    .select('name, email, checkin_points, total_checkins, current_streak, longest_streak, created_at, last_checkin_date')
    .eq('user_id', user.id)
    .single();

  // If the select failed due to missing columns, try a minimal select
  if (fetchError && !profile) {
    const { data: basicProfile } = await supabaseAdmin
      .from('customer_profiles')
      .select('name, email, created_at')
      .eq('user_id', user.id)
      .single();

    if (basicProfile) {
      profile = {
        ...basicProfile,
        checkin_points: 0,
        total_checkins: 0,
        current_streak: 0,
        longest_streak: 0,
        last_checkin_date: null,
      };
    }
  }

  // Auto-create profile if the user is authenticated but has no profile row
  if (!profile) {
    const { data: newProfile, error: insertError } = await supabaseAdmin
      .from('customer_profiles')
      .insert({
        user_id: user.id,
        email: user.email || '',
        name: user.user_metadata?.name || user.email?.split('@')[0] || 'Member',
      })
      .select('name, email, created_at')
      .single();

    if (insertError || !newProfile) {
      console.error('Profile insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Could not create your loyalty profile.', detail: insertError?.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    profile = {
      ...newProfile,
      checkin_points: 0,
      total_checkins: 0,
      current_streak: 0,
      longest_streak: 0,
      last_checkin_date: null,
    };
  }

  await syncPosPointsForUser(user.id, user.email);

  // Merge check-in points with POS loyalty points
  const checkinPoints = profile.checkin_points || 0;
  let posPoints = 0;
  const profileEmail = profile.email || user.email;
  if (profileEmail) {
    const { data: loyaltyRow } = await supabaseAdmin
      .from('loyalty_members')
      .select('points')
      .eq('email', profileEmail.toLowerCase())
      .maybeSingle();
    if (loyaltyRow) {
      posPoints = loyaltyRow.points || 0;
    }
  }
  const points = checkinPoints + posPoints;
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
        memberSince: (profile as any).member_since || profile.created_at,
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
