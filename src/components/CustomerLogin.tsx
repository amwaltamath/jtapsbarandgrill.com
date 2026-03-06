import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import '../styles/customer-auth.css';

export default function CustomerLogin() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    smsOptIn: false
  });

  useEffect(() => {
    // Check if already logged in
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      window.location.href = '/dashboard';
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: formData.email.toLowerCase().trim(),
        password: formData.password,
      });

      if (loginError) {
        setError(loginError.message);
        setLoading(false);
        return;
      }

      setSuccess('Login successful! Redirecting...');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (!formData.name.trim()) {
        setError('Please enter your name');
        setLoading(false);
        return;
      }

      const { data, error: signupError } = await supabase.auth.signUp({
        email: formData.email.toLowerCase().trim(),
        password: formData.password,
      });

      if (signupError) {
        setError(signupError.message);
        setLoading(false);
        return;
      }

      // Create customer profile
      if (data.user) {
        const profileData: Record<string, unknown> = {
          user_id: data.user.id,
          email: formData.email.toLowerCase().trim(),
          name: formData.name
        };
        if (formData.phone.trim()) {
          profileData.phone = formData.phone.trim();
        }

        const { error: profileError } = await supabase
          .from('customer_profiles')
          .insert([profileData]);

        // If phone provided and SMS opted in, add to newsletter_subscribers for SMS
        if (formData.smsOptIn && formData.phone.trim()) {
          const rawPhone = formData.phone.trim().replace(/[^+\d]/g, '');
          const normalizedPhone = rawPhone.startsWith('+') ? rawPhone : '+1' + rawPhone;
          await supabase
            .from('newsletter_subscribers')
            .upsert({
              email: formData.email.toLowerCase().trim(),
              name: formData.name,
              phone: normalizedPhone,
              sms_opt_in: true,
              email_opt_in: true
            }, { onConflict: 'email' });
        }

        if (profileError) {
          console.error('Profile creation error:', profileError);
        }
      }

      setSuccess('Account created! Logging you in...');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
      setLoading(false);
    }
  };

  return (
    <div className="customer-auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>JTAPS Bar & Grill</h1>
          <p>Games • Specials • Updates</p>
        </div>

        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">{success}</div>}

        {isLogin ? (
          <form onSubmit={handleLogin} className="auth-form">
            <h2>Login</h2>
            
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                name="email"
                placeholder="your-email@example.com"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                name="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleInputChange}
                required
                className="form-input"
              />
            </div>

            <button type="submit" disabled={loading} className="auth-button">
              {loading ? 'Logging in...' : 'Login'}
            </button>

            <div className="auth-toggle">
              <p>Don't have an account? 
                <button
                  type="button"
                  onClick={() => setIsLogin(false)}
                  className="toggle-link"
                >
                  Sign up
                </button>
              </p>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSignup} className="auth-form">
            <h2>Create Account</h2>
            
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                id="name"
                type="text"
                name="name"
                placeholder="Your Name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                name="email"
                placeholder="your-email@example.com"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="phone">Phone (Optional)</label>
              <input
                id="phone"
                type="tel"
                name="phone"
                placeholder="(555) 123-4567"
                value={formData.phone}
                onChange={handleInputChange}
                className="form-input"
              />
            </div>

            {formData.phone.trim() && (
              <div className="form-group" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <input
                  id="smsOptIn"
                  type="checkbox"
                  name="smsOptIn"
                  checked={formData.smsOptIn}
                  onChange={handleInputChange}
                  style={{ marginTop: '4px', width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="smsOptIn" style={{ fontSize: '14px', lineHeight: '1.4', cursor: 'pointer' }}>
                  Yes, send me text message alerts about promotions, specials, and events from JTAPS Bar &amp; Grill. Msg &amp; data rates may apply. Reply STOP to unsubscribe.
                </label>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                name="password"
                placeholder="Create a strong password"
                value={formData.password}
                onChange={handleInputChange}
                required
                className="form-input"
              />
            </div>

            <button type="submit" disabled={loading} className="auth-button">
              {loading ? 'Creating Account...' : 'Sign Up'}
            </button>

            <div className="auth-toggle">
              <p>Already have an account? 
                <button
                  type="button"
                  onClick={() => setIsLogin(true)}
                  className="toggle-link"
                >
                  Login
                </button>
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
