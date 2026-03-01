import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface CheckInRecord {
  id: number;
  user_id: string;
  points_awarded: number;
  checked_in_at: string;
  method: string;
  latitude: number | null;
  longitude: number | null;
}

interface CheckInSummary {
  totalCheckins: number;
  todayCheckins: number;
  weekCheckins: number;
  totalPointsAwarded: number;
  topCheckers: { email: string; name: string; total_checkins: number; checkin_points: number }[];
}

export default function CheckInManager() {
  const [recentCheckins, setRecentCheckins] = useState<(CheckInRecord & { profile_email?: string; profile_name?: string })[]>([]);
  const [summary, setSummary] = useState<CheckInSummary>({
    totalCheckins: 0,
    todayCheckins: 0,
    weekCheckins: 0,
    totalPointsAwarded: 0,
    topCheckers: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchRecentCheckins(),
        fetchSummary()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentCheckins = async () => {
    const { data, error } = await supabase
      .from('customer_checkins')
      .select('*')
      .order('checked_in_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      // Fetch profile info for each unique user
      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('customer_profiles')
        .select('user_id, email, name')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const enriched = data.map(checkin => ({
        ...checkin,
        profile_email: profileMap.get(checkin.user_id)?.email || 'Unknown',
        profile_name: profileMap.get(checkin.user_id)?.name || 'Unknown'
      }));

      setRecentCheckins(enriched);
    }
  };

  const fetchSummary = async () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [allRes, todayRes, weekRes, topRes] = await Promise.all([
      supabase.from('customer_checkins').select('id, points_awarded'),
      supabase.from('customer_checkins').select('id', { count: 'exact', head: true }).gte('checked_in_at', todayStart),
      supabase.from('customer_checkins').select('id', { count: 'exact', head: true }).gte('checked_in_at', weekAgo),
      supabase.from('customer_profiles')
        .select('email, name, total_checkins, checkin_points')
        .gt('total_checkins', 0)
        .order('total_checkins', { ascending: false })
        .limit(10)
    ]);

    const totalPoints = allRes.data?.reduce((sum, c) => sum + (c.points_awarded || 0), 0) || 0;

    setSummary({
      totalCheckins: allRes.data?.length || 0,
      todayCheckins: todayRes.count || 0,
      weekCheckins: weekRes.count || 0,
      totalPointsAwarded: totalPoints,
      topCheckers: topRes.data || []
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="section-card">
      <h2>📍 Check-In Manager</h2>

      {loading ? (
        <p>Loading check-in data...</p>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-number">{summary.totalCheckins}</div>
              <div className="stat-label">Total Check-Ins</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{summary.todayCheckins}</div>
              <div className="stat-label">Today</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{summary.weekCheckins}</div>
              <div className="stat-label">This Week</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{summary.totalPointsAwarded}</div>
              <div className="stat-label">Points Awarded</div>
            </div>
          </div>

          {/* Top Checkers */}
          {summary.topCheckers.length > 0 && (
            <div style={{ marginTop: '30px' }}>
              <h3>🏆 Top Check-In Customers</h3>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Check-Ins</th>
                      <th>Points Earned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.topCheckers.map((checker, idx) => (
                      <tr key={checker.email}>
                        <td>
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                        </td>
                        <td><strong>{checker.name}</strong></td>
                        <td>{checker.email}</td>
                        <td><strong>{checker.total_checkins}</strong></td>
                        <td>{checker.checkin_points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recent Check-Ins */}
          <div style={{ marginTop: '30px' }}>
            <h3>📋 Recent Check-Ins</h3>
            {recentCheckins.length === 0 ? (
              <p>No check-ins yet.</p>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Email</th>
                      <th>Points</th>
                      <th>Method</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentCheckins.map(checkin => (
                      <tr key={checkin.id}>
                        <td><strong>{checkin.profile_name}</strong></td>
                        <td>{checkin.profile_email}</td>
                        <td>+{checkin.points_awarded}</td>
                        <td>
                          {checkin.method === 'geo' ? '📍 Location' : '📋 Manual'}
                        </td>
                        <td>{formatDate(checkin.checked_in_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="info-box" style={{ marginTop: '30px' }}>
            <h3>Check-In Rewards System</h3>
            <ul>
              <li>🏆 <strong>10 points</strong> per check-in</li>
              <li>🔥 <strong>+5 bonus points</strong> for 3+ day streaks</li>
              <li>📍 Location verification available (0.3 mile radius)</li>
              <li>⏰ Customers can check in once per day</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
