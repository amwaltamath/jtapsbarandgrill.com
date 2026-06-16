import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { generateApplePass, isAppleWalletConfigured, generatePassAuthToken } from '../../../lib/wallet';
import { getLoyaltyMemberSnapshot } from '../../../lib/loyaltyMember';

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

  try {
    const { member } = await getLoyaltyMemberSnapshot(supabaseAdmin, user);

    // Generate or reuse the authentication token for push notification support
    const serial = `jtaps-loyalty-${user.id}`;

    const { data: existing } = await supabaseAdmin
      .from('wallet_passes')
      .select('authentication_token')
      .eq('pass_serial', serial)
      .maybeSingle();

    const authToken = existing?.authentication_token || generatePassAuthToken();

    const passBuffer = await generateApplePass(member, authToken);

    // Record the wallet pass in the database
    await supabaseAdmin
      .from('wallet_passes')
      .upsert(
        {
          user_id: user.id,
          pass_type: 'apple',
          pass_serial: serial,
          authentication_token: authToken,
          points_snapshot: member.points,
          tier_snapshot: member.tier,
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
