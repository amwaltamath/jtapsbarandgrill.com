/**
 * Apple Wallet Web Service — Get Updated Pass
 *
 * GET /api/wallet/apple/v1/passes/{passTypeIdentifier}/{serialNumber}
 *   → Apple calls this after receiving a push notification, to fetch the
 *     latest version of the pass.
 *   → Authorization: ApplePass {authenticationToken}
 *   → Returns the .pkpass file (regenerated with current points/tier).
 *   → Must include `Last-Modified` header with the pass's last_updated time.
 *   → Returns 304 if pass hasn't changed since `If-Modified-Since` header.
 */

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../../../../lib/supabase';
import { generateApplePass, computeTier } from '../../../../../../../lib/wallet';
import type { LoyaltyMember } from '../../../../../../../lib/wallet';

export const GET: APIRoute = async ({ request, params }) => {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('ApplePass ')) {
    return new Response(null, { status: 401 });
  }
  const authToken = authHeader.slice('ApplePass '.length).trim();
  const { passTypeIdentifier, serialNumber } = params;
  const expectedPassTypeId = import.meta.env.APPLE_PASS_TYPE_ID;

  if (!passTypeIdentifier || (expectedPassTypeId && passTypeIdentifier !== expectedPassTypeId)) {
    return new Response(null, { status: 404 });
  }

  // Verify auth token and look up the pass
  const { data: pass } = await supabaseAdmin
    .from('wallet_passes')
    .select('user_id, authentication_token, last_updated')
    .eq('pass_serial', serialNumber)
    .eq('authentication_token', authToken)
    .maybeSingle();

  if (!pass) {
    return new Response(null, { status: 401 });
  }

  // Handle conditional GET — 304 if not modified
  const ifModifiedSince = request.headers.get('If-Modified-Since');
  if (ifModifiedSince) {
    const lastUpdatedDate = new Date(pass.last_updated);
    const ifModifiedSinceDate = new Date(ifModifiedSince);
    if (lastUpdatedDate <= ifModifiedSinceDate) {
      return new Response(null, { status: 304 });
    }
  }

  // Fetch the customer's current profile
  const { data: profile } = await supabaseAdmin
    .from('customer_profiles')
    .select('name, email, checkin_points, total_checkins, current_streak, created_at, member_since')
    .eq('user_id', pass.user_id)
    .single();

  if (!profile) {
    return new Response(null, { status: 404 });
  }

  // Merge POS points
  let posPoints = 0;
  const profileEmail = profile.email;
  if (profileEmail) {
    const { data: loyaltyRow } = await supabaseAdmin
      .from('loyalty_members')
      .select('points')
      .eq('email', profileEmail.toLowerCase())
      .maybeSingle();
    if (loyaltyRow) posPoints = loyaltyRow.points || 0;
  }

  const points = (profile.checkin_points || 0) + posPoints;
  const tier = computeTier(points);

  // Look up the user's display name from auth
  const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(pass.user_id);

  const member: LoyaltyMember = {
    userId: pass.user_id,
    name: profile.name || user?.email?.split('@')[0] || 'Member',
    email: profile.email || user?.email || '',
    points,
    tier,
    totalCheckins: profile.total_checkins || 0,
    currentStreak: profile.current_streak || 0,
    memberSince: profile.member_since || profile.created_at,
  };

  try {
    const passBuffer = await generateApplePass(member, authToken);
    const updatedAt = new Date().toISOString();

    // Update snapshot in DB
    await supabaseAdmin
      .from('wallet_passes')
      .update({
        points_snapshot: points,
        tier_snapshot: tier,
        last_updated: updatedAt,
      })
      .eq('pass_serial', serialNumber);

    return new Response(new Uint8Array(passBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Last-Modified': new Date(updatedAt).toUTCString(),
      },
    });
  } catch (err: any) {
    console.error('Pass regeneration error:', err);
    return new Response(null, { status: 500 });
  }
};
