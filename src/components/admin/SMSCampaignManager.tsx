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

  // Test SMS state
  const [showTestSMS, setShowTestSMS] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('JTAPS Bar & Grill: This is a test message from your admin dashboard!');
  const [testLoading, setTestLoading] = useState(false);

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importLoading, setImportLoading] = useState(false);

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
      const selectedData = subscribers.filter(s => selectedSubscribers.includes(s.id));

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

  const handleSendTestSMS = async () => {
    setError('');
    setSuccess('');
    setTestLoading(true);

    const phone = testPhone.trim();
    if (!phone) {
      setError('Please enter a phone number');
      setTestLoading(false);
      return;
    }
    if (!testMessage.trim()) {
      setError('Please enter a test message');
      setTestLoading(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated. Please login again.');
        setTestLoading(false);
        return;
      }

      const response = await fetch('/api/send-sms-campaign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          message: testMessage,
          subscribers: [{ id: 0, phone, name: 'Test' }],
          isTest: true
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send test SMS');
      }

      if (result.sent > 0) {
        setSuccess(`Test SMS sent successfully to ${phone}!`);
        setShowTestSMS(false);
      } else {
        setError(`Test SMS failed. Check your Twilio configuration and that ${phone} is a valid number.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send test SMS');
    } finally {
      setTestLoading(false);
    }
  };

  const handleImportCustomers = async () => {
    setError('');
    setSuccess('');
    setImportLoading(true);

    const lines = importText.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) {
      setError('Please paste customer data to import');
      setImportLoading(false);
      return;
    }

    try {
      const customers: { name: string; phone: string; email?: string }[] = [];
      const skipped: string[] = [];

      for (const line of lines) {
        // Support: CSV (name, phone, email) or TSV or just phone numbers
        const parts = line.split(/[,\t]+/).map(p => p.trim().replace(/^["']|["']$/g, ''));
        
        if (parts.length >= 2) {
          // name, phone[, email]
          const name = parts[0];
          const phone = parts[1].replace(/[^+\d]/g, '');
          const email = parts[2] || undefined;
          if (phone.length >= 10) {
            customers.push({ name, phone: phone.startsWith('+') ? phone : '+1' + phone, email });
          } else {
            skipped.push(line);
          }
        } else if (parts.length === 1) {
          // just a phone number
          const phone = parts[0].replace(/[^+\d]/g, '');
          if (phone.length >= 10) {
            customers.push({ name: '', phone: phone.startsWith('+') ? phone : '+1' + phone });
          } else {
            skipped.push(line);
          }
        }
      }

      if (customers.length === 0) {
        setError('No valid customers found. Use format: Name, Phone, Email (one per line)');
        setImportLoading(false);
        return;
      }

      // Upsert into newsletter_subscribers
      let imported = 0;
      let duplicates = 0;

      for (const cust of customers) {
        // Check if phone already exists
        const { data: existing } = await supabase
          .from('newsletter_subscribers')
          .select('id')
          .eq('phone', cust.phone)
          .maybeSingle();

        if (existing) {
          duplicates++;
          continue;
        }

        const insertData: Record<string, unknown> = {
          phone: cust.phone,
          sms_opt_in: true,
        };
        if (cust.name) insertData.name = cust.name;
        if (cust.email) {
          insertData.email = cust.email.toLowerCase();
          insertData.email_opt_in = true;
        }

        const { error: insertErr } = await supabase
          .from('newsletter_subscribers')
          .insert(insertData);

        if (!insertErr) {
          imported++;
        } else {
          console.error('Import insert error:', insertErr);
          skipped.push(cust.phone);
        }
      }

      let msg = `Imported ${imported} customer${imported !== 1 ? 's' : ''}.`;
      if (duplicates > 0) msg += ` ${duplicates} duplicate${duplicates !== 1 ? 's' : ''} skipped.`;
      if (skipped.length > 0) msg += ` ${skipped.length} row${skipped.length !== 1 ? 's' : ''} could not be parsed.`;
      setSuccess(msg);
      setImportText('');
      setShowImport(false);
      fetchSubscribers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImportLoading(false);
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
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <button onClick={() => setShowForm(true)} className="primary-button">
            + Create New SMS Campaign
          </button>
          <button onClick={() => setShowTestSMS(!showTestSMS)} className="secondary-button" style={{ background: '#2563eb', color: '#fff', border: 'none' }}>
            🧪 Send Test SMS
          </button>
          <button onClick={() => setShowImport(!showImport)} className="secondary-button" style={{ background: '#7c3aed', color: '#fff', border: 'none' }}>
            📥 Import from POS
          </button>
        </div>
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

      {/* Test SMS Panel */}
      {showTestSMS && !showForm && (
        <div className="campaign-form" style={{ marginBottom: '24px', borderLeft: '4px solid #2563eb' }}>
          <h3>🧪 Send Test SMS</h3>
          <p style={{ color: '#999', fontSize: '13px', marginBottom: '12px' }}>
            Send a test message to verify your Twilio setup is working. Enter your own phone number below.
          </p>
          <div className="form-group">
            <label htmlFor="test-phone">Phone Number</label>
            <input
              id="test-phone"
              type="tel"
              placeholder="+15551234567"
              value={testPhone}
              onChange={e => setTestPhone(e.target.value)}
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label htmlFor="test-msg">Test Message</label>
            <textarea
              id="test-msg"
              value={testMessage}
              onChange={e => setTestMessage(e.target.value)}
              className="form-textarea"
              rows={2}
              maxLength={320}
            />
          </div>
          <div className="form-actions">
            <button
              type="button"
              onClick={handleSendTestSMS}
              disabled={testLoading || !testPhone.trim()}
              className="primary-button"
              style={{ background: '#2563eb' }}
            >
              {testLoading ? 'Sending...' : 'Send Test'}
            </button>
            <button type="button" onClick={() => setShowTestSMS(false)} className="secondary-button">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* POS Import Panel */}
      {showImport && !showForm && (
        <div className="campaign-form" style={{ marginBottom: '24px', borderLeft: '4px solid #7c3aed' }}>
          <h3>📥 Import Customers from POS</h3>
          <p style={{ color: '#999', fontSize: '13px', marginBottom: '8px' }}>
            Paste your POS export data below. Supported formats:
          </p>
          <ul style={{ color: '#999', fontSize: '13px', margin: '0 0 12px 16px', padding: 0 }}>
            <li><strong>CSV:</strong> Name, Phone, Email (one per line)</li>
            <li><strong>Phone only:</strong> One phone number per line</li>
            <li><strong>Tab-separated:</strong> Name &lt;tab&gt; Phone &lt;tab&gt; Email</li>
          </ul>
          <p style={{ color: '#999', fontSize: '12px', marginBottom: '12px' }}>
            Phone numbers without country code will default to +1 (US). Duplicates are automatically skipped.
          </p>
          <div className="form-group">
            <label htmlFor="import-data">Customer Data</label>
            <textarea
              id="import-data"
              placeholder={`John Smith, (513) 555-1234, john@email.com\nJane Doe, 5135559876\n(513) 555-0000`}
              value={importText}
              onChange={e => setImportText(e.target.value)}
              className="form-textarea"
              rows={8}
              style={{ fontFamily: 'monospace', fontSize: '13px' }}
            />
            <div style={{ color: '#999', fontSize: '12px', marginTop: '4px' }}>
              {importText.trim() ? `${importText.trim().split('\n').filter(l => l.trim()).length} line(s) detected` : 'Paste your data above'}
            </div>
          </div>
          <div className="form-actions">
            <button
              type="button"
              onClick={handleImportCustomers}
              disabled={importLoading || !importText.trim()}
              className="primary-button"
              style={{ background: '#7c3aed' }}
            >
              {importLoading ? 'Importing...' : 'Import Customers'}
            </button>
            <button type="button" onClick={() => setShowImport(false)} className="secondary-button">
              Cancel
            </button>
          </div>
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
