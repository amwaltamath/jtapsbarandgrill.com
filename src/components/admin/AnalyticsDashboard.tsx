import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface GA4Summary {
  activeUsers: number;
  sessions: number;
  screenPageViews: number;
  newUsers: number;
  averageSessionDuration: number;
  bounceRate: number;
}

interface GA4Page {
  path: string;
  title: string;
  views: number;
  users: number;
}

interface GA4TrendDay {
  date: string;
  sessions: number;
  users: number;
}

interface GA4Data {
  summary: GA4Summary;
  topPages: GA4Page[];
  trend: GA4TrendDay[];
}

export default function AnalyticsDashboard() {
  const [metrics, setMetrics] = useState({
    totalGames: 0,
    activeSpecials: 0,
    loyaltyMembers: 0,
    totalPromoCodesUsed: 0
  });
  const [ga4, setGa4] = useState<GA4Data | null>(null);
  const [ga4Loading, setGa4Loading] = useState(true);
  const [ga4Error, setGa4Error] = useState('');

  useEffect(() => {
    fetchMetrics();
    fetchGA4();
  }, []);

  const fetchMetrics = async () => {
    try {
      const today = new Date();

      const [games, specials, loyalty, promoCodes] = await Promise.all([
        supabase.from('game_calendar').select('id', { count: 'exact' }).gt('game_date', today.toISOString()),
        supabase.from('specials').select('id', { count: 'exact' }).eq('active', true),
        supabase.from('loyalty_members').select('id', { count: 'exact' }),
        supabase.from('promo_codes').select('uses_count')
      ]);

      const totalPromoUses = promoCodes.data?.reduce((sum: number, code: any) => sum + (code.uses_count || 0), 0) || 0;

      setMetrics({
        totalGames: games.count || 0,
        activeSpecials: specials.count || 0,
        loyaltyMembers: loyalty.count || 0,
        totalPromoCodesUsed: totalPromoUses
      });
    } catch (err) {
      console.error('Error fetching metrics:', err);
    }
  };

  const fetchGA4 = async () => {
    setGa4Loading(true);
    setGa4Error('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setGa4Error('Not authenticated');
        return;
      }
      const resp = await fetch('/api/admin/analytics', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const result = await resp.json();
      if (!resp.ok) {
        setGa4Error(result.error || 'Failed to load Google Analytics data');
        return;
      }
      setGa4(result);
    } catch (err) {
      setGa4Error('Failed to load Google Analytics data');
    } finally {
      setGa4Loading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  };

  const formatDate = (raw: string) => {
    // raw is YYYYMMDD
    const y = raw.slice(0, 4);
    const m = raw.slice(4, 6);
    const d = raw.slice(6, 8);
    return `${m}/${d}`;
  };

  const trendMax = ga4 ? Math.max(...ga4.trend.map(d => d.sessions), 1) : 1;

  return (
    <div className="section-card">
      <h2>Analytics Dashboard</h2>

      {/* ── Site metrics (Supabase) ── */}
      <div className="analytics-grid">
        <div className="metric-card">
          <div className="metric-icon">🏈</div>
          <div className="metric-content">
            <div className="metric-value">{metrics.totalGames}</div>
            <div className="metric-label">Upcoming Games</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">🎉</div>
          <div className="metric-content">
            <div className="metric-value">{metrics.activeSpecials}</div>
            <div className="metric-label">Active Specials</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">💳</div>
          <div className="metric-content">
            <div className="metric-value">{metrics.loyaltyMembers}</div>
            <div className="metric-label">Loyalty Members</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">🎟️</div>
          <div className="metric-content">
            <div className="metric-value">{metrics.totalPromoCodesUsed}</div>
            <div className="metric-label">Promo Codes Used</div>
          </div>
        </div>
      </div>

      {/* ── Google Analytics (GA4) ── */}
      <div className="ga4-section">
        <h3>
          <svg width="18" height="18" viewBox="0 0 192 192" style={{ verticalAlign: 'middle', marginRight: 6 }} aria-hidden="true">
            <rect width="192" height="192" rx="0" fill="none"/>
            <path d="M120 32h32v128h-32z" fill="#F9AB00"/>
            <path d="M40 112h32v48H40z" fill="#0F9D58"/>
            <path d="M80 72h32v88H80z" fill="#4285F4"/>
          </svg>
          Google Analytics — Last 30 Days
        </h3>

        {ga4Loading && (
          <p className="ga4-loading">Loading Google Analytics data…</p>
        )}

        {!ga4Loading && ga4Error && (
          <div className="ga4-error">
            <strong>⚠️ {ga4Error}</strong>
            {ga4Error.includes('not configured') && (
              <p>Add <code>GA4_PROPERTY_ID</code> to your environment variables and ensure the service account has <em>Viewer</em> access in Google Analytics.</p>
            )}
          </div>
        )}

        {!ga4Loading && ga4 && (
          <>
            <div className="analytics-grid ga4-grid">
              <div className="metric-card">
                <div className="metric-icon">👥</div>
                <div className="metric-content">
                  <div className="metric-value">{ga4.summary.activeUsers.toLocaleString()}</div>
                  <div className="metric-label">Active Users</div>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-icon">🔁</div>
                <div className="metric-content">
                  <div className="metric-value">{ga4.summary.sessions.toLocaleString()}</div>
                  <div className="metric-label">Sessions</div>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-icon">📄</div>
                <div className="metric-content">
                  <div className="metric-value">{ga4.summary.screenPageViews.toLocaleString()}</div>
                  <div className="metric-label">Page Views</div>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-icon">✨</div>
                <div className="metric-content">
                  <div className="metric-value">{ga4.summary.newUsers.toLocaleString()}</div>
                  <div className="metric-label">New Users</div>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-icon">⏱️</div>
                <div className="metric-content">
                  <div className="metric-value">{formatDuration(ga4.summary.averageSessionDuration)}</div>
                  <div className="metric-label">Avg. Session</div>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-icon">↩️</div>
                <div className="metric-content">
                  <div className="metric-value">{(ga4.summary.bounceRate * 100).toFixed(1)}%</div>
                  <div className="metric-label">Bounce Rate</div>
                </div>
              </div>
            </div>

            {/* Sparkline trend */}
            {ga4.trend.length > 0 && (
              <div className="ga4-trend">
                <h4>Daily Sessions — Last 14 Days</h4>
                <div className="ga4-sparkline" role="img" aria-label="Daily sessions chart">
                  {ga4.trend.map((day) => (
                    <div key={day.date} className="ga4-bar-wrap" title={`${formatDate(day.date)}: ${day.sessions} sessions`}>
                      <div
                        className="ga4-bar"
                        style={{ height: `${Math.max(4, Math.round((day.sessions / trendMax) * 80))}px` }}
                      />
                      <span className="ga4-bar-label">{formatDate(day.date)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top pages */}
            {ga4.topPages.length > 0 && (
              <div className="ga4-top-pages">
                <h4>Top Pages</h4>
                <table className="ga4-table">
                  <thead>
                    <tr>
                      <th>Page</th>
                      <th>Views</th>
                      <th>Users</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ga4.topPages.map((page) => (
                      <tr key={page.path}>
                        <td className="ga4-page-path" title={page.title}>{page.path}</td>
                        <td>{page.views.toLocaleString()}</td>
                        <td>{page.users.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Key Insights ── */}
      <div className="insights-section">
        <h3>Key Insights</h3>
        <ul className="insights-list">
          <li>🏈 <strong>{metrics.totalGames}</strong> upcoming games to promote</li>
          <li>🎉 <strong>{metrics.activeSpecials}</strong> active promotions running</li>
          <li>💳 <strong>{metrics.loyaltyMembers}</strong> customers in loyalty program</li>
          <li>🎟️ Promo codes have been used <strong>{metrics.totalPromoCodesUsed}</strong> times</li>
          {ga4 && (
            <li>📊 <strong>{ga4.summary.activeUsers.toLocaleString()}</strong> active website visitors in the last 30 days</li>
          )}
        </ul>
      </div>

      <div className="recommendations">
        <h3>💡 Recommendations</h3>
        <ul>
          <li>Create special offers around the {metrics.totalGames} upcoming games</li>
          <li>Track loyalty member engagement and offer tier-based rewards</li>
          <li>A/B test promo code campaigns to increase redemption rates</li>
          <li>Schedule email campaigns 3 days before major sporting events</li>
        </ul>
      </div>
    </div>
  );
}
