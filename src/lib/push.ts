import webpush from "web-push";

export interface StoredPushSubscription {
  id?: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

let configured = false;

export function isPushConfigured(): boolean {
  return Boolean(
    import.meta.env.PUBLIC_VAPID_PUBLIC_KEY &&
      import.meta.env.VAPID_PRIVATE_KEY &&
      import.meta.env.VAPID_SUBJECT
  );
}

function ensureConfigured() {
  if (configured) {
    return;
  }

  const publicKey = import.meta.env.PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = import.meta.env.VAPID_PRIVATE_KEY;
  const subject = import.meta.env.VAPID_SUBJECT ?? "mailto:info@jtapsbarandgrill.com";

  if (!publicKey || !privateKey) {
    throw new Error("Push notifications are not configured. Missing VAPID keys.");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export async function sendPushNotification(
  subscription: StoredPushSubscription,
  payload: PushPayload
) {
  ensureConfigured();

  return webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      expirationTime: null,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth
      }
    },
    JSON.stringify(payload),
    {
      TTL: 60 * 60,
      urgency: "normal"
    }
  );
}
