import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

interface PushNotificationsProps {
  email?: string;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export default function PushNotifications({ email }: PushNotificationsProps) {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const canUsePush =
        typeof window !== "undefined" &&
        "Notification" in window &&
        "serviceWorker" in navigator &&
        "PushManager" in window;

      if (!canUsePush) {
        if (mounted) setSupported(false);
        return;
      }

      if (mounted) {
        setSupported(true);
        setPermission(Notification.permission);
      }

      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        const existingSubscription = await registration.pushManager.getSubscription();
        if (mounted) {
          setSubscribed(Boolean(existingSubscription));
        }
      } catch (err) {
        console.error("Push init error:", err);
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, []);

  const subscribe = async () => {
    setLoading(true);
    setMessage("");

    try {
      const vapidPublicKey = import.meta.env.PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        throw new Error("Push is not configured yet. Missing public VAPID key.");
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Please sign in before enabling notifications.");
      }

      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== "granted") {
        throw new Error("Notification permission was not granted.");
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription =
        (await registration.pushManager.getSubscription()) ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        }));

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          platform: "web",
          subscription
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to save push subscription.");
      }

      setSubscribed(true);
      setMessage("Push notifications are enabled. You will receive JTAPS updates here.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to enable push notifications.");
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    setLoading(true);
    setMessage("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Please sign in before changing notification settings.");
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        setSubscribed(false);
        setMessage("Notifications are already disabled on this device.");
        return;
      }

      const endpoint = subscription.endpoint;

      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ endpoint })
      });

      await subscription.unsubscribe();
      setSubscribed(false);
      setMessage("Push notifications have been disabled for this device.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to disable notifications.");
    } finally {
      setLoading(false);
    }
  };

  if (!supported) {
    return (
      <div className="push-settings-card">
        <h3>Push Notifications</h3>
        <p>This browser does not support push notifications. Try Chrome, Edge, or Safari on iOS 16.4+.</p>
      </div>
    );
  }

  return (
    <div className="push-settings-card">
      <h3>Push Notifications</h3>
      <p>
        Get alerts for game nights, specials, and loyalty updates{email ? ` at ${email}` : ""}.
      </p>
      <div className="push-status-row">
        <span className={`push-status-badge ${subscribed ? "on" : "off"}`}>
          {subscribed ? "Enabled" : "Disabled"}
        </span>
        <span className="push-permission">Browser permission: {permission}</span>
      </div>
      <div className="push-actions">
        {!subscribed ? (
          <button className="push-enable-btn" onClick={subscribe} disabled={loading}>
            {loading ? "Enabling..." : "Enable Notifications"}
          </button>
        ) : (
          <button className="push-disable-btn" onClick={unsubscribe} disabled={loading}>
            {loading ? "Updating..." : "Disable Notifications"}
          </button>
        )}
      </div>
      {message && <p className="push-feedback">{message}</p>}
    </div>
  );
}
