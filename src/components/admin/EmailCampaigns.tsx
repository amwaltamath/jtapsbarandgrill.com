import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { resend } from '../../lib/resend';

interface Subscriber {
  id: number;
  email: string | null;
  phone: string | null;
  name: string | null;
  sms_opt_in: boolean;
  email_opt_in: boolean;
  subscribed_at?: string;
}

export default function EmailCampaigns() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [activeTab, setActiveTab] = useState<'email' | 'sms'>('email');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState('');
  const [smsSuccess, setSmsSuccess] = useState('');
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
          subscribers: subscribers.filter(s => s.email_opt_in && s.email).map(s => ({ email: s.email!, name: s.name }))
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

  const handleSendSms = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingSms(true);
    setSmsSuccess('');
    setError('');

    const smsSubscribers = subscribers.filter(s => s.phone && s.sms_opt_in);

    if (smsSubscribers.length === 0) {
      setError('No subscribers have opted in for SMS');
      setSendingSms(false);
      return;
    }

    try {
      const response = await fetch('/api/send-sms-campaign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabase.auth.getSession()}`
        },
        body: JSON.stringify({
          message: smsMessage,
          subscribers: smsSubscribers.map(s => ({ phone: s.phone!, name: s.name }))
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSmsSuccess(`Successfully sent ${data.sent} SMS messages!`);
        setSmsMessage('');
      } else {
        setError(data.error || 'Failed to send SMS messages');
      }
    } catch (err) {
      setError('Failed to send SMS messages');
    } finally {
      setSendingSms(false);
    }
  };

  return (
    <div className="section-card">
      <h2>Marketing Campaigns</h2>

      <div className="campaign-tabs">
        <button
          className={`tab-button ${activeTab === 'email' ? 'active' : ''}`}
          onClick={() => setActiveTab('email')}
        >
          📧 Email Campaigns
        </button>
        <button
          className={`tab-button ${activeTab === 'sms' ? 'active' : ''}`}
          onClick={() => setActiveTab('sms')}
        >
          📱 SMS Campaigns
        </button>
      </div>

      <div className="section-grid">
        <div className="section-item">
          <h3>Subscribers: {subscribers.length}</h3>
          <div className="subscriber-stats">
            <span>📧 Email: {subscribers.filter(s => s.email_opt_in).length}</span>
            <span>📱 SMS: {subscribers.filter(s => s.sms_opt_in).length}</span>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Opt-ins</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.slice(0, 10).map((sub) => (
                  <tr key={sub.id}>
                    <td>{sub.name || 'N/A'}</td>
                    <td>
                      {sub.email && <div>📧 {sub.email}</div>}
                      {sub.phone && <div>📱 {sub.phone}</div>}
                    </td>
                    <td>
                      {sub.email_opt_in && <span className="opt-in-badge">Email</span>}
                      {sub.sms_opt_in && <span className="opt-in-badge">SMS</span>}
                    </td>
                    <td>{sub.subscribed_at ? new Date(sub.subscribed_at).toLocaleDateString() : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {subscribers.length > 10 && <p className="muted">...and {subscribers.length - 10} more</p>}
        </div>

        <div className="section-item">
          {activeTab === 'email' ? (
            <>
              <h3>Send Email Campaign</h3>
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
                  {sendingEmail ? 'Sending...' : `Send to ${subscribers.filter(s => s.email_opt_in).length} email subscribers`}
                </button>
                {emailSuccess && <div className="success-message">{emailSuccess}</div>}
                {error && <div className="error-message">{error}</div>}
              </form>
            </>
          ) : (
            <>
              <h3>Send SMS Campaign</h3>
              <form onSubmit={handleSendSms} className="form-stack">
                <textarea
                  placeholder="SMS Message (160 characters max)"
                  value={smsMessage}
                  onChange={(e) => setSmsMessage(e.target.value)}
                  required
                  className="form-textarea"
                  rows={4}
                  maxLength={160}
                />
                <div className="character-count">
                  {smsMessage.length}/160 characters
                </div>
                <button type="submit" disabled={sendingSms} className="form-button">
                  {sendingSms ? 'Sending...' : `Send to ${subscribers.filter(s => s.sms_opt_in).length} SMS subscribers`}
                </button>
                {smsSuccess && <div className="success-message">{smsSuccess}</div>}
                {error && <div className="error-message">{error}</div>}
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
