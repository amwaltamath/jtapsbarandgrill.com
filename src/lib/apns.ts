/**
 * Apple Push Notification service (APNs) utility for wallet pass updates.
 *
 * Apple Wallet push notifications are empty-payload pushes that tell the
 * device "come fetch the latest version of this pass." We use certificate-
 * based auth (the same pass-signing cert) over HTTP/2 — no extra package
 * needed beyond Node built-ins.
 *
 * Required env vars (already needed for pass generation):
 *   APPLE_PASS_CERT_BASE64  — Base64-encoded PEM signing certificate
 *   APPLE_PASS_KEY_BASE64   — Base64-encoded PEM private key
 *   APPLE_PASS_TYPE_ID      — e.g. "pass.com.jtapsbarandgrill.loyalty"
 *   APPLE_PASS_KEY_PASSPHRASE — (optional) private key passphrase
 *
 * Optional:
 *   APPLE_APNS_ENV — "production" (default) or "sandbox"
 */

import http2 from 'node:http2';
import type { SecureContextOptions } from 'node:tls';

interface ApnsConfig {
  cert: Buffer;
  key: Buffer;
  passTypeId: string;
  passphrase?: string;
  sandbox: boolean;
}

function getApnsConfig(): ApnsConfig | null {
  const certB64 = import.meta.env.APPLE_PASS_CERT_BASE64;
  const keyB64 = import.meta.env.APPLE_PASS_KEY_BASE64;
  const passTypeId = import.meta.env.APPLE_PASS_TYPE_ID;

  if (!certB64 || !keyB64 || !passTypeId) return null;

  return {
    cert: Buffer.from(certB64, 'base64'),
    key: Buffer.from(keyB64, 'base64'),
    passTypeId,
    passphrase: import.meta.env.APPLE_PASS_KEY_PASSPHRASE || undefined,
    sandbox: import.meta.env.APPLE_APNS_ENV !== 'production',
  };
}

/**
 * Send an APNs push notification to a single device push token.
 * The payload is intentionally empty — Apple Wallet just needs the nudge
 * to call our web service and fetch the refreshed pass.
 */
export async function sendApnsPassUpdate(pushToken: string): Promise<void> {
  const config = getApnsConfig();
  if (!config) {
    throw new Error('APNs not configured — set APPLE_PASS_CERT_BASE64, APPLE_PASS_KEY_BASE64, APPLE_PASS_TYPE_ID');
  }

  const host = config.sandbox
    ? 'api.sandbox.push.apple.com'
    : 'api.push.apple.com';

  return new Promise((resolve, reject) => {
    const tlsOptions: SecureContextOptions = {
      cert: config.cert,
      key: config.key,
      passphrase: config.passphrase,
    };

    const client = http2.connect(`https://${host}`, tlsOptions);

    client.on('error', (err) => {
      reject(err);
    });

    const body = '{}';
    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${pushToken}`,
      'apns-topic': config.passTypeId,
      'apns-push-type': 'background',
      'apns-priority': '5',   // low priority for background/non-alert pushes
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body).toString(),
    });

    let statusCode = 0;
    let responseBody = '';

    req.on('response', (headers) => {
      statusCode = headers[':status'] as number;
    });

    req.on('data', (chunk: Buffer) => {
      responseBody += chunk.toString();
    });

    req.on('end', () => {
      client.close();
      if (statusCode === 200) {
        resolve();
      } else {
        reject(new Error(`APNs error ${statusCode}: ${responseBody}`));
      }
    });

    req.on('error', (err) => {
      client.close();
      reject(err);
    });

    req.write(body);
    req.end();
  });
}

/**
 * Push a pass update notification to all registered Apple Wallet devices
 * for a given user. Silently skips if APNs is not configured or if the user
 * has no installed passes.
 *
 * @param supabaseAdmin — Supabase admin client
 * @param userId — auth.users UUID
 */
export async function pushWalletUpdateForUser(
  supabaseAdmin: import('@supabase/supabase-js').SupabaseClient,
  userId: string
): Promise<void> {
  const updatedAt = new Date().toISOString();

  // Mark passes as changed before sending pushes so Apple's serial lookup endpoint
  // can return these passes immediately after the device receives the push.
  const { data: passes, error } = await supabaseAdmin
    .from('wallet_passes')
    .update({ last_updated: updatedAt })
    .eq('user_id', userId)
    .eq('pass_type', 'apple')
    .not('push_token', 'is', null)
    .select('push_token');

  if (error) {
    console.error('Failed updating wallet_passes before APNs push:', error);
    return;
  }

  if (!passes || passes.length === 0) return;

  const results = await Promise.allSettled(
    passes.map((p: { push_token: string }) => sendApnsPassUpdate(p.push_token))
  );

  // Log failures without throwing — a failed push shouldn't break a check-in
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('APNs push failed:', result.reason);
    }
  }
}
