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
import PushCampaignManager from './admin/PushCampaignManager';
import CheckInManager from './admin/CheckInManager';
import BeerMenuManager from './admin/BeerMenuManager';
import POSImportManager from './admin/POSImportManager';

const NAV_SECTIONS = [
  {
    label: 'Main',
    items: [
      { key: 'overview', icon: '📊', label: 'Overview' },
      { key: 'analytics', icon: '📈', label: 'Analytics' },
    ]
  },
  {
    label: 'Content',
    items: [
      { key: 'games', icon: '🏈', label: 'Game Calendar' },
      { key: 'specials', icon: '🎉', label: 'Specials' },
      { key: 'menu', icon: '🍗', label: 'Menu' },
      { key: 'beer-menu', icon: '🍺', label: 'Beer Menu' },
    ]
  },
  {
    label: 'Customers',
    items: [
      { key: 'checkins', icon: '📍', label: 'Check-Ins' },
      { key: 'loyalty', icon: '💳', label: 'Loyalty' },
      { key: 'promos', icon: '🎟️', label: 'Promo Codes' },
      { key: 'users', icon: '👥', label: 'Users' },
    ]
  },
  {
    label: 'Campaigns',
    items: [
      { key: 'email-campaigns', icon: '📧', label: 'Email' },
      { key: 'sms-campaigns', icon: '📱', label: 'SMS' },
      { key: 'push-campaigns', icon: '🔔', label: 'Push' },
    ]
  },
  {
    label: 'Integrations',
    items: [
      { key: 'pos-import', icon: '🔄', label: 'POS Import' },
    ]
  }
];

// Role-based access: maps role name → allowed tab keys (or 'all')
const ROLE_ALLOWED_TABS: Record<string, string[] | 'all'> = {
  admin: 'all',
  beer_menu: ['beer-menu'],
};

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(
    typeof window !== 'undefined' ? window.innerWidth > 1024 : true
  );

  const [activeTab, setActiveTab] = useState('overview');
  const [userRole, setUserRole] = useState<string>('admin');
  const [stats, setStats] = useState({
    games: 0,
    specials: 0,
    menuItems: 0,
    emailSubscribers: 0,
    smsSubscribers: 0,
    checkins: 0,
    loyaltyMembers: 0
  });

  useEffect(() => {
    checkAuth();

    const handleResize = () => {
      if (window.innerWidth <= 1024) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
          .select('id, role')
          .eq('user_id', session.user.id)
          .maybeSingle();

        const admin = Boolean(adminRow);
        setIsAdmin(admin);
        if (admin && adminRow) {
          const role = adminRow.role || 'admin';
          setUserRole(role);
          // Set initial tab based on role permissions
          const allowed = ROLE_ALLOWED_TABS[role];
          if (allowed !== 'all' && allowed) {
            setActiveTab(allowed[0]);
          }
          if (role === 'admin') {
            fetchStats();
          }
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
      const [gameRes, specRes, menuRes, emailSubRes, smsSubRes, checkinRes, loyaltyRes] = await Promise.all([
        supabase.from('game_calendar').select('id', { count: 'exact', head: true }),
        supabase.from('specials').select('id', { count: 'exact', head: true }),
        supabase.from('menu_items').select('id', { count: 'exact', head: true }),
        supabase.from('newsletter_subscribers').select('id', { count: 'exact', head: true }).eq('email_opt_in', true),
        supabase.from('newsletter_subscribers').select('id', { count: 'exact', head: true }).eq('sms_opt_in', true),
        supabase.from('customer_checkins').select('id', { count: 'exact', head: true }),
        supabase.from('loyalty_members').select('id', { count: 'exact', head: true })
      ]);

      setStats({
        games: gameRes.count || 0,
        specials: specRes.count || 0,
        menuItems: menuRes.count || 0,
        emailSubscribers: emailSubRes.count || 0,
        smsSubscribers: smsSubRes.count || 0,
        checkins: checkinRes.count || 0,
        loyaltyMembers: loyaltyRes.count || 0
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
        .select('id, role')
        .eq('user_id', session.user.id)
        .maybeSingle();

      const admin = Boolean(adminRow);
      setIsAdmin(admin);
      if (admin && adminRow) {
        const role = adminRow.role || 'admin';
        setUserRole(role);
        const allowed = ROLE_ALLOWED_TABS[role];
        if (allowed !== 'all' && allowed) {
          setActiveTab(allowed[0]);
        }
        if (role === 'admin') {
          fetchStats();
        }
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
          <div className="login-logo">🍗</div>
          <h1>JTAPS Admin</h1>
          <p className="login-subtitle">Checking access...</p>
          <div className="login-spinner"></div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="admin-login">
        <div className="login-card">
          <div className="login-logo">🍗</div>
          <h1>JTAPS Admin</h1>
          <p className="login-subtitle">Business Management Dashboard</p>

          {!supabase?.auth && (
            <div className="login-warning">
              ⚠️ <strong>Supabase Not Configured</strong><br />
              Environment variables (PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY) are not set in Vercel.
              <a href="https://vercel.com/dashboard" target="_blank" rel="noopener">
                Go to Vercel Settings →
              </a>
            </div>
          )}

          <form onSubmit={handleLogin} className="login-form">
            <div className="login-field">
              <label htmlFor="admin-email">Email</label>
              <input
                id="admin-email"
                type="email"
                placeholder="admin@jtapsbarandgrill.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="form-input"
                disabled={!supabase?.auth}
              />
            </div>
            <div className="login-field">
              <label htmlFor="admin-password">Password</label>
              <input
                id="admin-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="form-input"
                disabled={!supabase?.auth}
              />
            </div>
            <button type="submit" disabled={loading || !supabase?.auth} className="form-button login-btn">
              {loading ? 'Signing in...' : 'Sign In'}
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
          <div className="login-logo">🔒</div>
          <h1>Access Denied</h1>
          <p className="login-subtitle">You are signed in, but this account does not have admin privileges.</p>
          <button onClick={handleLogout} className="form-button login-btn">Sign Out</button>
        </div>
      </div>
    );
  }

  // Filter nav sections based on role permissions
  const allowedTabs = ROLE_ALLOWED_TABS[userRole];
  const filteredSections = allowedTabs === 'all'
    ? NAV_SECTIONS
    : NAV_SECTIONS
        .map(section => ({
          ...section,
          items: section.items.filter(item =>
            Array.isArray(allowedTabs) && allowedTabs.includes(item.key)
          )
        }))
        .filter(section => section.items.length > 0);

  const currentTabLabel = filteredSections.flatMap(s => s.items).find(i => i.key === activeTab)?.label || 'Overview';

  return (
    <div className={`admin-dashboard ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <span className="brand-icon">🍗</span>
            <div className="brand-text">
              <span className="brand-name">JTAPS</span>
              <span className="brand-role">{userRole === 'admin' ? 'Admin Panel' : 'Beer Menu'}</span>
            </div>
          </div>
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle sidebar">
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        <nav className="sidebar-nav">
          {filteredSections.map(section => (
            <div key={section.label} className="nav-group">
              <div className="nav-group-label">{section.label}</div>
              {section.items.map(item => (
                <button
                  key={item.key}
                  className={`nav-item ${activeTab === item.key ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab(item.key);
                    if (window.innerWidth <= 1024) setSidebarOpen(false);
                  }}
                  title={item.label}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button onClick={handleLogout} className="sidebar-logout">
            <span className="nav-icon">🚪</span>
            <span className="nav-label">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="admin-topbar">
        <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle menu">
          ☰
        </button>
        <h1 className="topbar-title">{currentTabLabel}</h1>
        <button onClick={handleLogout} className="topbar-logout">Sign Out</button>
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Main Content */}
      <main className="admin-main">
        <div className="main-header">
          <h2 className="page-title">{currentTabLabel}</h2>
          <div className="header-meta">
            <span className="current-date">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>

        <div className="main-body">
          {activeTab === 'overview' && (
            <div className="overview-section">
              {/* Stats Grid */}
              <div className="overview-stats">
                <div className="stat-card stat-red" onClick={() => setActiveTab('games')}>
                  <div className="stat-icon">🏈</div>
                  <div className="stat-content">
                    <div className="stat-number">{stats.games}</div>
                    <div className="stat-label">Upcoming Games</div>
                  </div>
                </div>
                <div className="stat-card stat-orange" onClick={() => setActiveTab('specials')}>
                  <div className="stat-icon">🎉</div>
                  <div className="stat-content">
                    <div className="stat-number">{stats.specials}</div>
                    <div className="stat-label">Active Specials</div>
                  </div>
                </div>
                <div className="stat-card stat-blue" onClick={() => setActiveTab('menu')}>
                  <div className="stat-icon">🍗</div>
                  <div className="stat-content">
                    <div className="stat-number">{stats.menuItems}</div>
                    <div className="stat-label">Menu Items</div>
                  </div>
                </div>
                <div className="stat-card stat-green" onClick={() => setActiveTab('email-campaigns')}>
                  <div className="stat-icon">📧</div>
                  <div className="stat-content">
                    <div className="stat-number">{stats.emailSubscribers}</div>
                    <div className="stat-label">Email Subscribers</div>
                  </div>
                </div>
                <div className="stat-card stat-purple" onClick={() => setActiveTab('sms-campaigns')}>
                  <div className="stat-icon">📱</div>
                  <div className="stat-content">
                    <div className="stat-number">{stats.smsSubscribers}</div>
                    <div className="stat-label">SMS Subscribers</div>
                  </div>
                </div>
                <div className="stat-card stat-teal" onClick={() => setActiveTab('checkins')}>
                  <div className="stat-icon">📍</div>
                  <div className="stat-content">
                    <div className="stat-number">{stats.checkins}</div>
                    <div className="stat-label">Total Check-Ins</div>
                  </div>
                </div>
                <div className="stat-card stat-gold" onClick={() => setActiveTab('loyalty')}>
                  <div className="stat-icon">💳</div>
                  <div className="stat-content">
                    <div className="stat-number">{stats.loyaltyMembers}</div>
                    <div className="stat-label">Loyalty Members</div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="overview-row">
                <div className="overview-card">
                  <h3>⚡ Quick Actions</h3>
                  <div className="quick-actions-grid">
                    <button onClick={() => setActiveTab('games')} className="quick-action-btn">
                      <span>🏈</span> Add Game
                    </button>
                    <button onClick={() => setActiveTab('specials')} className="quick-action-btn">
                      <span>🎉</span> New Special
                    </button>
                    <button onClick={() => setActiveTab('menu')} className="quick-action-btn">
                      <span>🍗</span> Edit Menu
                    </button>
                    <button onClick={() => setActiveTab('email-campaigns')} className="quick-action-btn">
                      <span>📧</span> Send Email
                    </button>
                    <button onClick={() => setActiveTab('sms-campaigns')} className="quick-action-btn">
                      <span>📱</span> Send SMS
                    </button>
                    <button onClick={() => setActiveTab('promos')} className="quick-action-btn">
                      <span>🎟️</span> Create Promo
                    </button>
                  </div>
                </div>

                <div className="overview-card">
                  <h3>💡 Tips & Reminders</h3>
                  <ul className="tips-list">
                    <li>
                      <span className="tip-icon">📅</span>
                      <span>Schedule email campaigns 3 days before big sporting events</span>
                    </li>
                    <li>
                      <span className="tip-icon">🎯</span>
                      <span>Create game-day specials tied to upcoming matchups</span>
                    </li>
                    <li>
                      <span className="tip-icon">🔥</span>
                      <span>SMS flash deals (2-hour windows) drive same-day traffic</span>
                    </li>
                    <li>
                      <span className="tip-icon">📍</span>
                      <span>Check-in rewards encourage repeat visits and loyalty</span>
                    </li>
                  </ul>
                </div>
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
          {activeTab === 'push-campaigns' && <PushCampaignManager />}
          {activeTab === 'checkins' && <CheckInManager />}
          {activeTab === 'beer-menu' && <BeerMenuManager />}
          {activeTab === 'pos-import' && <POSImportManager />}
        </div>
      </main>
    </div>
  );
}

