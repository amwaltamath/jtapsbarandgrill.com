/**
 * Apple Wallet Web Service — Device Registration / Unregistration
 *
 * POST   /api/wallet/apple/v1/devices/{deviceLibraryIdentifier}/registrations/{passTypeIdentifier}/{serialNumber}
 *   → Apple calls this when a customer adds the pass to their Wallet.
 *   → Body: { "pushToken": "..." }
 *   → We store the device's push token so we can notify it of updates.
 *   → Returns 201 (new registration) or 200 (already registered).
 *
 * DELETE /api/wallet/apple/v1/devices/{deviceLibraryIdentifier}/registrations/{passTypeIdentifier}/{serialNumber}
 *   → Apple calls this when the customer removes the pass from Wallet.
 *   → We clear the push token and device ID from the DB.
 *   → Returns 200.
 *
 * Authorization: ApplePass {authenticationToken}
 */

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../../../../../../lib/supabase';

function extractAuthToken(request: Request): string | null {
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('ApplePass ')) return null;
  return header.slice('ApplePass '.length).trim();
}

export const POST: APIRoute = async ({ request, params }) => {
  const authToken = extractAuthToken(request);
  if (!authToken) {
    return new Response(null, { status: 401 });
  }

  const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = params;
  const expectedPassTypeId = import.meta.env.APPLE_PASS_TYPE_ID;

  if (!passTypeIdentifier || (expectedPassTypeId && passTypeIdentifier !== expectedPassTypeId)) {
    return new Response(null, { status: 404 });
  }

  // Verify the auth token belongs to this serial
  const { data: pass } = await supabaseAdmin
    .from('wallet_passes')
    .select('id, user_id, device_library_id, push_token')
    .eq('pass_serial', serialNumber)
    .eq('authentication_token', authToken)
    .maybeSingle();

  if (!pass) {
    return new Response(null, { status: 401 });
  }

  // Parse push token from request body
  let pushToken: string | undefined;
  try {
    const body = await request.json();
    pushToken = body?.pushToken;
  } catch {
    return new Response(null, { status: 400 });
  }

  if (!pushToken) {
    return new Response(null, { status: 400 });
  }

  // Already registered with the same token?
  if (pass.device_library_id === deviceLibraryIdentifier && pass.push_token === pushToken) {
    return new Response(null, { status: 200 });
  }

  await supabaseAdmin
    .from('wallet_passes')
    .update({
      device_library_id: deviceLibraryIdentifier,
      push_token: pushToken,
      last_updated: new Date().toISOString(),
    })
    .eq('id', pass.id);

  return new Response(null, { status: 201 });
};

export const DELETE: APIRoute = async ({ request, params }) => {
  const authToken = extractAuthToken(request);
  if (!authToken) {
    return new Response(null, { status: 401 });
  }

  const { passTypeIdentifier, serialNumber } = params;
  const expectedPassTypeId = import.meta.env.APPLE_PASS_TYPE_ID;

  if (!passTypeIdentifier || (expectedPassTypeId && passTypeIdentifier !== expectedPassTypeId)) {
    return new Response(null, { status: 404 });
  }

  const { data: pass } = await supabaseAdmin
    .from('wallet_passes')
    .select('id')
    .eq('pass_serial', serialNumber)
    .eq('authentication_token', authToken)
    .maybeSingle();

  if (!pass) {
    return new Response(null, { status: 401 });
  }

  await supabaseAdmin
    .from('wallet_passes')
    .update({
      device_library_id: null,
      push_token: null,
      last_updated: new Date().toISOString(),
    })
    .eq('id', pass.id);

  return new Response(null, { status: 200 });
};
