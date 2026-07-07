import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface PushCampaign {
  id: number;
  title: string;
  message: string;
  target_count: number;
  sent_count: number;
  failed_count: number;
  sent_at: string | null;
  created_at: string;
}

export default function PushCampaignManager() {
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [campaigns, setCampaigns] = useState<PushCampaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    message: "",
    url: "/dashboard"
  });

  useEffect(() => {
    fetchSubscriberCount();
    fetchCampaigns();
  }, []);

  const fetchSubscriberCount = async () => {
    const { count } = await supabase
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("active", true);

    setSubscriberCount(count || 0);
  };

  const fetchCampaigns = async () => {
    const { data } = await supabase
      .from("push_campaigns")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (data) {
      setCampaigns(data);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (!formData.title.trim() || !formData.message.trim()) {
      setError("Title and message are required.");
      setLoading(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated. Please login again.");
      }

      const response = await fetch("/api/send-push-campaign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          title: formData.title,
          message: formData.message,
          url: formData.url || "/dashboard"
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to send push campaign.");
      }

      setSuccess(`Push sent: ${result.sent} delivered, ${result.failed} failed.`);
      setFormData({ title: "", message: "", url: "/dashboard" });
      fetchSubscriberCount();
      fetchCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send push campaign.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="campaign-manager">
      <h2>Push Campaigns</h2>

      <div className="campaign-stats">
        <div className="stat-card">
          <div className="stat-number">{subscriberCount}</div>
          <div className="stat-label">Active Push Subscribers</div>
        </div>
      </div>

      <form onSubmit={handleSend} className="campaign-form">
        <div className="form-group">
          <label htmlFor="push-title">Title</label>
          <input
            id="push-title"
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Tonight: Bengals game at JTAPS"
            maxLength={80}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="push-message">Message</label>
          <textarea
            id="push-message"
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            placeholder="Happy hour starts at 6 PM. Check in to earn points."
            maxLength={180}
            rows={4}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="push-url">Tap-through URL (optional)</label>
          <input
            id="push-url"
            type="text"
            value={formData.url}
            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            placeholder="/dashboard"
          />
        </div>

        <button type="submit" className="send-btn" disabled={loading || subscriberCount === 0}>
          {loading ? "Sending Push..." : "Send Push Notification"}
        </button>

        {subscriberCount === 0 && (
          <p className="campaign-note">No active push subscribers yet. Customers can opt in from their dashboard.</p>
        )}
      </form>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="recent-campaigns">
        <h3>Recent Push Sends</h3>
        {campaigns.length === 0 ? (
          <p>No push campaigns yet.</p>
        ) : (
          <div className="campaign-list">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="campaign-item">
                <h4>{campaign.title}</h4>
                <p>{campaign.message}</p>
                <div className="campaign-meta">
                  <span>Delivered: {campaign.sent_count}</span>
                  <span>Failed: {campaign.failed_count}</span>
                  <span>
                    {new Date(campaign.sent_at || campaign.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
