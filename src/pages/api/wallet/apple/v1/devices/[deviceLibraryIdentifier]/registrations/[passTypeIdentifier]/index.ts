/**
 * Apple Wallet Web Service — Get Serial Numbers for a Device
 *
 * GET /api/wallet/apple/v1/devices/{deviceLibraryIdentifier}/registrations/{passTypeIdentifier}
 *   → Apple calls this to ask: "which passes registered to this device have
 *     been updated since the given timestamp?"
 *   → Query param: passesUpdatedSince (optional, ISO timestamp or epoch seconds)
 *   → Returns: { lastUpdated: "...", serialNumbers: ["..."] }
 *   → Returns 204 if nothing has changed.
 *
 * This endpoint does NOT require authentication — Apple does not send the
 * pass auth token here; it only sends the deviceLibraryIdentifier as a
 * path parameter, which we treat as a sufficient device identifier.
 */

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../../../../../../lib/supabase';

interface DevicePassRow {
  pass_serial: string;
  last_updated: string;
}

export const GET: APIRoute = async ({ params, url }) => {
  const { deviceLibraryIdentifier, passTypeIdentifier } = params;
  const expectedPassTypeId = import.meta.env.APPLE_PASS_TYPE_ID;

  if (!passTypeIdentifier || (expectedPassTypeId && passTypeIdentifier !== expectedPassTypeId)) {
    return new Response(null, { status: 404 });
  }

  const passesUpdatedSinceRaw = url.searchParams.get('passesUpdatedSince');
  let updatedSince: Date | null = null;

  if (passesUpdatedSinceRaw) {
    // Apple may send either an ISO string or Unix epoch seconds
    const asNum = Number(passesUpdatedSinceRaw);
    if (!isNaN(asNum)) {
      updatedSince = new Date(asNum * 1000);
    } else {
      const parsed = new Date(passesUpdatedSinceRaw);
      if (!isNaN(parsed.getTime())) {
        updatedSince = parsed;
      }
    }
  }

  let query = supabaseAdmin
    .from('wallet_passes')
    .select('pass_serial, last_updated')
    .eq('pass_type', 'apple')
    .eq('device_library_id', deviceLibraryIdentifier);

  if (updatedSince) {
    query = query.gt('last_updated', updatedSince.toISOString());
  }

  const { data: passes, error } = await query;

  if (error) {
    console.error('wallet/apple/v1/devices GET error:', error);
    return new Response(null, { status: 500 });
  }

  if (!passes || passes.length === 0) {
    return new Response(null, { status: 204 });
  }

  // Find the most recent update timestamp
  const typedPasses = passes as DevicePassRow[];

  const lastUpdated = typedPasses.reduce((latest, p) => {
    return p.last_updated > latest ? p.last_updated : latest;
  }, typedPasses[0].last_updated);

  return new Response(
    JSON.stringify({
      lastUpdated,
      serialNumbers: typedPasses.map((p) => p.pass_serial),
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};
