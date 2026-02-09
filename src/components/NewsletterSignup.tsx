import React, { useState } from 'react';
import '../styles/newsletter.css';

export default function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [emailOptIn, setEmailOptIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    // Validate that at least one contact method is provided
    if (!email && !phone) {
      setMessage({ type: 'error', text: 'Please provide either an email or phone number.' });
      setLoading(false);
      return;
    }

    // Validate phone format if provided
    if (phone && !/^\+?1?[-.\s]?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})$/.test(phone.replace(/\D/g, ''))) {
      setMessage({ type: 'error', text: 'Please enter a valid phone number.' });
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, phone, name, smsOptIn, emailOptIn }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: data.message });
        setEmail('');
        setPhone('');
        setName('');
        setSmsOptIn(false);
        setEmailOptIn(true);
      } else {
        setMessage({ type: 'error', text: data.error || 'Something went wrong' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to subscribe. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="newsletter-signup">
      <div className="newsletter-content">
        <h2>🍺 Never Miss a Game or Special!</h2>
        <p>Get exclusive deals, new menu items, and game day specials delivered to your inbox or phone.</p>
        
        <form onSubmit={handleSubmit} className="newsletter-form">
          <input
            type="text"
            placeholder="Your name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="form-input"
          />
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="form-input"
          />
          <input
            type="tel"
            placeholder="Your phone number (optional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="form-input"
          />
          
          <div className="opt-in-options">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={emailOptIn}
                onChange={(e) => setEmailOptIn(e.target.checked)}
                disabled={!email}
              />
              <span>Receive email updates</span>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={smsOptIn}
                onChange={(e) => setSmsOptIn(e.target.checked)}
                disabled={!phone}
              />
              <span>Receive SMS updates (standard rates may apply)</span>
            </label>
          </div>
          
          <button 
            type="submit" 
            disabled={loading || (!email && !phone)}
            className="form-button"
          >
            {loading ? 'Subscribing...' : 'Subscribe'}
          </button>
        </form>

        {message.text && (
          <div className={`message message-${message.type}`}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}
