import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import '../styles/admin.css';

// Import sub-components
import GameCalendar from './admin/GameCalendar';
import SpecialsManager from './admin/SpecialsManager';
import MenuManager from './admin/MenuManager';
import AnalyticsDashboard from './admin/AnalyticsDashboard';
import LoyaltyProgram from './admin/LoyaltyProgram';
import PromoCodeManager from './admin/PromoCodeManager';
import AdminUsersManager from './admin/AdminUsersManager';
import EmailCampaignManager from './admin/EmailCampaignManager';
import SMSCampaignManager from './admin/SMSCampaignManager';

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    games: 0,
    specials: 0,
    menuItems: 0,
    emailSubscribers: 0,
    smsSubscribers: 0
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    if (!supabase?.auth) {
      console.warn('Supabase auth not available');
      setIsAuthenticated(false);
      setIsAdmin(false);
      setAuthChecked(true);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authenticated = Boolean(session);
      setIsAuthenticated(authenticated);

      if (session) {
        const { data: adminRow } = await supabase
          .from('admin_users')
          .select('id')
          .eq('user_id', session.user.id)
          .maybeSingle();

        const admin = Boolean(adminRow);
        setIsAdmin(admin);
        if (admin) {
          fetchStats();
        }
      } else {
        setIsAdmin(false);
      }
    } catch (err) {
      console.error('Auth check error:', err);
      setIsAuthenticated(false);
      setIsAdmin(false);
    } finally {
      setAuthChecked(true);
    }
  };

  const fetchStats = async () => {
    if (!supabase) {
      console.warn('Supabase not available');
      return;
    }

    try {
      const [gameRes, specRes, menuRes, emailSubRes, smsSubRes] = await Promise.all([
        supabase.from('game_calendar').select('id', { count: 'exact', head: true }),
        supabase.from('specials').select('id', { count: 'exact', head: true }),
        supabase.from('menu_items').select('id', { count: 'exact', head: true }),
        supabase.from('newsletter_subscribers').select('id', { count: 'exact', head: true }).eq('email_opt_in', true),
        supabase.from('newsletter_subscribers').select('id', { count: 'exact', head: true }).eq('sms_opt_in', true)
      ]);

      setStats({
        games: gameRes.count || 0,
        specials: specRes.count || 0,
        menuItems: menuRes.count || 0,
        emailSubscribers: emailSubRes.count || 0,
        smsSubscribers: smsSubRes.count || 0
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!supabase?.auth) {
      setError('Supabase is not configured. Please check environment variables.');
      return;
    }

    setLoading(true);
    setError('');

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (loginError) {
      setError(loginError.message);
      setLoading(false);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const authenticated = Boolean(session);
    setIsAuthenticated(authenticated);

    if (session) {
      const { data: adminRow } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      const admin = Boolean(adminRow);
      setIsAdmin(admin);
      if (admin) {
        fetchStats();
      }
    } else {
      setIsAdmin(false);
    }

    setLoading(false);
  };

  const handleLogout = async () => {
    if (supabase?.auth) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('Logout error:', err);
      }
    }
    setIsAuthenticated(false);
    setIsAdmin(false);
  };

  if (!authChecked) {
    return (
      <div className="admin-login">
        <div className="login-card">
          <h1>JTAPS Admin</h1>
          <p className="login-subtitle">Checking access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="admin-login">
        <div className="login-card">
          <h1>JTAPS Admin</h1>
          <p className="login-subtitle">Business Management Dashboard</p>

          {!supabase?.auth && (
            <div style={{
              padding: '12px',
              marginBottom: '16px',
              backgroundColor: '#fee',
              border: '1px solid #f99',
              borderRadius: '4px',
              fontSize: '14px',
              color: '#c33'
            }}>
              ⚠️ <strong>Supabase Not Configured</strong><br />
              Environment variables (PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY) are not set in Vercel.
              <a href="https://vercel.com/dashboard" target="_blank" rel="noopener" style={{display: 'block', marginTop: '8px', color: '#c33', textDecoration: 'underline'}}>
                Go to Vercel Settings →
              </a>
            </div>
          )}

          <form onSubmit={handleLogin}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="form-input"
              disabled={!supabase?.auth}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="form-input"
              disabled={!supabase?.auth}
            />
            <button type="submit" disabled={loading || !supabase?.auth} className="form-button">
              {loading ? 'Logging in...' : 'Login'}
            </button>
            {error && <div className="error-message">{error}</div>}
          </form>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="admin-login">
        <div className="login-card">
          <h1>JTAPS Admin</h1>
          <p className="login-subtitle">You are signed in, but this account is not an admin.</p>
          <button onClick={handleLogout} className="form-button">Logout</button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="header-left">
          <h1>JTAPS Admin Dashboard</h1>
          <p className="header-subtitle">Sports Bar Management System</p>
        </div>
        <button onClick={handleLogout} className="logout-button">Logout</button>
      </header>

      <div className="dashboard-tabs">
        <button
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 Overview
        </button>
        <button
          className={`tab-button ${activeTab === 'games' ? 'active' : ''}`}
          onClick={() => setActiveTab('games')}
        >
          🏈 Game Calendar
        </button>
        <button
          className={`tab-button ${activeTab === 'specials' ? 'active' : ''}`}
          onClick={() => setActiveTab('specials')}
        >
          🎉 Specials
        </button>
        <button
          className={`tab-button ${activeTab === 'menu' ? 'active' : ''}`}
          onClick={() => setActiveTab('menu')}
        >
          🍗 Menu
        </button>
        <button
          className={`tab-button ${activeTab === 'loyalty' ? 'active' : ''}`}
          onClick={() => setActiveTab('loyalty')}
        >
          💳 Loyalty
        </button>
        <button
          className={`tab-button ${activeTab === 'promos' ? 'active' : ''}`}
          onClick={() => setActiveTab('promos')}
        >
          🎟️ Promo Codes
        </button>
        <button
          className={`tab-button ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          📈 Analytics
        </button>
        <button
          className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          👥 Users
        </button>
        <button
          className={`tab-button ${activeTab === 'email-campaigns' ? 'active' : ''}`}
          onClick={() => setActiveTab('email-campaigns')}
        >
          📧 Email
        </button>
        <button
          className={`tab-button ${activeTab === 'sms-campaigns' ? 'active' : ''}`}
          onClick={() => setActiveTab('sms-campaigns')}
        >
          📱 SMS
        </button>
      </div>

      <div className="dashboard-content">
        {activeTab === 'overview' && (
          <div className="overview-section">
            <h2>Business Overview</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-number">{stats.games}</div>
                <div className="stat-label">Upcoming Games</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{stats.specials}</div>
                <div className="stat-label">Active Specials</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{stats.menuItems}</div>
                <div className="stat-label">Menu Items</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{stats.emailSubscribers}</div>
                <div className="stat-label">Email Subscribers</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{stats.smsSubscribers}</div>
                <div className="stat-label">SMS Subscribers</div>
              </div>
            </div>
            <div className="quick-actions">
              <h3>Quick Actions</h3>
              <button onClick={() => setActiveTab('games')} className="action-button">
                Add Game Event
              </button>
              <button onClick={() => setActiveTab('specials')} className="action-button">
                Create Special
              </button>
            </div>
          </div>
        )}
        {activeTab === 'games' && <GameCalendar />}
        {activeTab === 'specials' && <SpecialsManager />}
        {activeTab === 'menu' && <MenuManager />}
        {activeTab === 'loyalty' && <LoyaltyProgram />}
        {activeTab === 'promos' && <PromoCodeManager />}
        {activeTab === 'analytics' && <AnalyticsDashboard />}
        {activeTab === 'users' && <AdminUsersManager />}
        {activeTab === 'email-campaigns' && <EmailCampaignManager />}
        {activeTab === 'sms-campaigns' && <SMSCampaignManager />}
      </div>
    </div>
  );
}

