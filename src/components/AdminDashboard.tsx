import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import '../styles/admin.css';

// Import sub-components
import EmailCampaigns from './admin/EmailCampaigns';
import GameCalendar from './admin/GameCalendar';
import SpecialsManager from './admin/SpecialsManager';
import MenuManager from './admin/MenuManager';
import AnalyticsDashboard from './admin/AnalyticsDashboard';
import LoyaltyProgram from './admin/LoyaltyProgram';
import PromoCodeManager from './admin/PromoCodeManager';

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    subscribers: 0,
    games: 0,
    specials: 0,
    menuItems: 0
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setIsAuthenticated(!!session);
    if (session) {
      fetchStats();
    }
  };

  const fetchStats = async () => {
    try {
      const [subRes, gameRes, specRes, menuRes] = await Promise.all([
        supabase.from('newsletter_subscribers').select('id', { count: 'exact' }),
        supabase.from('game_calendar').select('id', { count: 'exact' }),
        supabase.from('specials').select('id', { count: 'exact' }),
        supabase.from('menu_items').select('id', { count: 'exact' })
      ]);

      setStats({
        subscribers: subRes.count || 0,
        games: gameRes.count || 0,
        specials: specRes.count || 0,
        menuItems: menuRes.count || 0
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
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
    fetchStats();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="admin-login">
        <div className="login-card">
          <h1>JTAPS Admin</h1>
          <p className="login-subtitle">Business Management Dashboard</p>
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
          className={`tab-button ${activeTab === 'email' ? 'active' : ''}`}
          onClick={() => setActiveTab('email')}
        >
          📧 Email Campaigns
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
      </div>

      <div className="dashboard-content">
        {activeTab === 'overview' && (
          <div className="overview-section">
            <h2>Business Overview</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-number">{stats.subscribers}</div>
                <div className="stat-label">Newsletter Subscribers</div>
              </div>
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
            </div>
            <div className="quick-actions">
              <h3>Quick Actions</h3>
              <button onClick={() => setActiveTab('email')} className="action-button">
                Send Email Campaign
              </button>
              <button onClick={() => setActiveTab('games')} className="action-button">
                Add Game Event
              </button>
              <button onClick={() => setActiveTab('specials')} className="action-button">
                Create Special
              </button>
            </div>
          </div>
        )}

        {activeTab === 'email' && <EmailCampaigns />}
        {activeTab === 'games' && <GameCalendar />}
        {activeTab === 'specials' && <SpecialsManager />}
        {activeTab === 'menu' && <MenuManager />}
        {activeTab === 'loyalty' && <LoyaltyProgram />}
        {activeTab === 'promos' && <PromoCodeManager />}
        {activeTab === 'analytics' && <AnalyticsDashboard />}
      </div>
    </div>
  );
}

