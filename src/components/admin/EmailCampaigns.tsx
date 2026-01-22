import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { resend } from '../../lib/resend';

interface Subscriber {
  id: number;
  email: string;
  name: string | null;
  subscribed_at?: string;
}

export default function EmailCampaigns() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSubscribers();
  }, []);

  const fetchSubscribers = async () => {
    const { data, error } = await supabase
      .from('newsletter_subscribers')
      .select('*')
      .order('subscribed_at', { ascending: false });

    if (!error && data) {
      setSubscribers(data);
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingEmail(true);
    setEmailSuccess('');
    setError('');

    try {
      const response = await fetch('/api/send-promotional-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: emailSubject,
          message: emailMessage,
          subscribers: subscribers.map(s => ({ email: s.email, name: s.name }))
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setEmailSuccess(`Successfully sent ${data.sent} emails!`);
        setEmailSubject('');
        setEmailMessage('');
      } else {
        setError(data.error || 'Failed to send emails');
      }
    } catch (err) {
      setError('Failed to send emails');
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="section-card">
      <h2>Email Marketing Campaigns</h2>
      
      <div className="section-grid">
        <div className="section-item">
          <h3>Subscribers: {subscribers.length}</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.slice(0, 10).map((sub) => (
                  <tr key={sub.id}>
                    <td>{sub.name || 'N/A'}</td>
                    <td>{sub.email}</td>
                    <td>{sub.subscribed_at ? new Date(sub.subscribed_at).toLocaleDateString() : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {subscribers.length > 10 && <p className="muted">...and {subscribers.length - 10} more</p>}
        </div>

        <div className="section-item">
          <h3>Send Campaign Email</h3>
          <form onSubmit={handleSendEmail} className="form-stack">
            <input
              type="text"
              placeholder="Email Subject"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              required
              className="form-input"
            />
            <textarea
              placeholder="Email Message (HTML supported)"
              value={emailMessage}
              onChange={(e) => setEmailMessage(e.target.value)}
              required
              className="form-textarea"
              rows={8}
            />
            <button type="submit" disabled={sendingEmail} className="form-button">
              {sendingEmail ? 'Sending...' : `Send to ${subscribers.length} subscribers`}
            </button>
            {emailSuccess && <div className="success-message">{emailSuccess}</div>}
            {error && <div className="error-message">{error}</div>}
          </form>
        </div>
      </div>
    </div>
  );
}
