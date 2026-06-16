/**
 * Apple Wallet Web Service — Log Endpoint
 *
 * POST /api/wallet/apple/v1/log
 *   → Apple calls this when an error occurs in the pass web service.
 *   → Body: { "logs": ["error message 1", ...] }
 *   → We just console.error the messages and return 200.
 */

import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const logs: string[] = body?.logs ?? [];
    for (const msg of logs) {
      console.error('[Apple Wallet log]', msg);
    }
  } catch {
    // Malformed body — still return 200
  }
  return new Response(null, { status: 200 });
};
