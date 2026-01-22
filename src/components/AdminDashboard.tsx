import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import '../styles/admin.css';

interface Subscriber {
  id: number;
  email: string;
  name: string | null;
  subscribed_at: string;
}

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);
  
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setIsAuthenticated(!!session);
    if (session) {
      fetchSubscribers();
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setIsAuthenticated(true);
    setLoading(false);
    fetchSubscribers();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setSubscribers([]);
  };

  const fetchSubscribers = async () => {
    setLoadingSubscribers(true);
    const { data, error } = await supabase
      .from('newsletter_subscribers')
      .select('*')
      .order('subscribed_at', { ascending: false });

    if (!error && data) {
      setSubscribers(data);
    }
    setLoadingSubscribers(false);
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

  if (!isAuthenticated) {
    return (
      <div className="admin-login">
        <div className="login-card">
          <h1>Admin Login</h1>
          <form onSubmit={handleLogin}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="form-input"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="form-input"
            />
            <button type="submit" disabled={loading} className="form-button">
              {loading ? 'Logging in...' : 'Login'}
            </button>
            {error && <div className="error-message">{error}</div>}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <h1>JTAPS Admin Dashboard</h1>
        <button onClick={handleLogout} className="logout-button">Logout</button>
      </header>

      <div className="dashboard-content">
        <section className="subscribers-section">
          <h2>Newsletter Subscribers ({subscribers.length})</h2>
          {loadingSubscribers ? (
            <p>Loading subscribers...</p>
          ) : (
            <div className="table-container">
              <table className="subscribers-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Subscribed Date</th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.map((sub) => (
                    <tr key={sub.id}>
                      <td>{sub.name || 'N/A'}</td>
                      <td>{sub.email}</td>
                      <td>{new Date(sub.subscribed_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="email-section">
          <h2>Send Promotional Email</h2>
          <form onSubmit={handleSendEmail} className="email-form">
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
              rows={10}
            />
            <button type="submit" disabled={sendingEmail} className="form-button">
              {sendingEmail ? 'Sending...' : `Send to ${subscribers.length} subscribers`}
            </button>
            {emailSuccess && <div className="success-message">{emailSuccess}</div>}
            {error && <div className="error-message">{error}</div>}
          </form>
        </section>
      </div>
    </div>
  );
}
