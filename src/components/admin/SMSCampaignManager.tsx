import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface Subscriber {
  id: number;
  phone: string;
  name: string | null;
  sms_opt_in: boolean;
}

interface Campaign {
  id: number;
  message: string;
  sent_count: number;
  created_at: string;
  sent_at: string | null;
}

export default function SMSCampaignManager() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedSubscribers, setSelectedSubscribers] = useState<number[]>([]);
  const [messageLength, setMessageLength] = useState(0);
  
  const [formData, setFormData] = useState({
    message: ''
  });

  const SMS_CHAR_LIMIT = 160;

  useEffect(() => {
    fetchSubscribers();
    fetchCampaigns();
  }, []);

  const fetchSubscribers = async () => {
    const { data, error } = await supabase
      .from('newsletter_subscribers')
      .select('*')
      .eq('sms_opt_in', true)
      .not('phone', 'is', null)
      .order('created_at', { ascending: false })
      .range(0, 9999); // Fetch up to 10,000 subscribers

    if (!error && data) {
      setSubscribers(data);
    }
  };

  const fetchCampaigns = async () => {
    const { data, error } = await supabase
      .from('sms_campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setCampaigns(data);
    }
  };

  const handleSelectSubscriber = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedSubscribers([...selectedSubscribers, id]);
    } else {
      setSelectedSubscribers(selectedSubscribers.filter(s => s !== id));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSubscribers(subscribers.map(s => s.id));
    } else {
      setSelectedSubscribers([]);
    }
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const msg = e.target.value;
    setFormData({ message: msg });
    setMessageLength(msg.length);
  };

  const handleSendCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!formData.message.trim()) {
      setError('Message is required');
      setLoading(false);
      return;
    }

    if (messageLength === 0) {
      setError('Message cannot be empty');
      setLoading(false);
      return;
    }

    if (selectedSubscribers.length === 0) {
      setError('Please select at least one subscriber');
      setLoading(false);
      return;
    }

    try {
      // Get selected subscriber details
      const selectedData = subscribers.filter(s => selectedSubscribers.includes(s.id));

      // Get session for auth header
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated. Please login again.');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/send-sms-campaign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          message: formData.message,
          subscribers: selectedData
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send campaign');
      }

      setSuccess(`Campaign sent successfully! (${result.sent} sent, ${result.failed} failed)`);
      setFormData({ message: '' });
      setMessageLength(0);
      setSelectedSubscribers([]);
      setShowForm(false);
      fetchCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send campaign');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="campaign-manager">
      <h2>📱 SMS Text Campaigns</h2>
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="campaign-stats">
        <div className="stat-box">
          <div className="stat-number">{subscribers.length}</div>
          <div className="stat-label">SMS Subscribers</div>
        </div>
        <div className="stat-box">
          <div className="stat-number">{campaigns.length}</div>
          <div className="stat-label">Campaigns Sent</div>
        </div>
      </div>

      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="primary-button">
          + Create New SMS Campaign
        </button>
      ) : (
        <div className="campaign-form">
          <h3>Create SMS Campaign</h3>
          <form onSubmit={handleSendCampaign}>
            <div className="form-group">
              <label htmlFor="message">SMS Message *</label>
              <textarea
                id="message"
                placeholder="Write your SMS message here. Keep it concise! (Max 160 characters)"
                value={formData.message}
                onChange={handleMessageChange}
                className={`form-textarea ${messageLength > SMS_CHAR_LIMIT ? 'error' : ''}`}
                rows={3}
                maxLength={SMS_CHAR_LIMIT * 2}
              />
              <div className="character-counter">
                <span className={messageLength > SMS_CHAR_LIMIT ? 'over-limit' : ''}>
                  {messageLength}/{SMS_CHAR_LIMIT}
                </span>
                {messageLength > SMS_CHAR_LIMIT && (
                  <span className="warning">Message exceeds standard SMS length</span>
                )}
              </div>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={selectedSubscribers.length === subscribers.length && subscribers.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="form-checkbox"
                />
                {' '}Select All ({subscribers.length} subscribers)
              </label>
            </div>

            <div className="subscribers-list">
              <h4>Recipients ({selectedSubscribers.length} selected)</h4>
              <div className="subscribers-container">
                {subscribers.length === 0 ? (
                  <p className="empty-state">No SMS subscribers yet</p>
                ) : (
                  subscribers.map(subscriber => (
                    <label key={subscriber.id} className="subscriber-item">
                      <input
                        type="checkbox"
                        checked={selectedSubscribers.includes(subscriber.id)}
                        onChange={(e) => handleSelectSubscriber(subscriber.id, e.target.checked)}
                        className="form-checkbox"
                      />
                      <span>{subscriber.name || 'No name'}</span>
                      <span className="subscriber-email">{subscriber.phone}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                disabled={loading || selectedSubscribers.length === 0 || messageLength === 0}
                className="primary-button"
              >
                {loading ? 'Sending...' : 'Send Campaign'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setFormData({ message: '' });
                  setMessageLength(0);
                  setSelectedSubscribers([]);
                }}
                className="secondary-button"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="campaigns-history">
        <h3>Campaign History</h3>
        {campaigns.length === 0 ? (
          <p className="empty-state">No campaigns sent yet</p>
        ) : (
          <div className="campaigns-table">
            <table>
              <thead>
                <tr>
                  <th>Message</th>
                  <th>Sent Count</th>
                  <th>Created</th>
                  <th>Sent</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map(campaign => (
                  <tr key={campaign.id}>
                    <td className="message-cell">{campaign.message}</td>
                    <td>{campaign.sent_count}</td>
                    <td>{new Date(campaign.created_at).toLocaleDateString()}</td>
                    <td>{campaign.sent_at ? new Date(campaign.sent_at).toLocaleDateString() : 'Pending'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
