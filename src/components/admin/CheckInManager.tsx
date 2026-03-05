import React, { useState, useEffect, useMemo } from 'react';
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

interface CustomerProfile {
  user_id: string;
  email: string;
  name: string;
  total_checkins: number;
  checkin_points: number;
  current_streak: number;
  longest_streak: number;
  last_checkin_date: string | null;
}

interface CheckInSummary {
  totalCheckins: number;
  todayCheckins: number;
  weekCheckins: number;
  monthCheckins: number;
  totalPointsAwarded: number;
  avgCheckinsPerCustomer: number;
}

type SubView = 'overview' | 'customers' | 'history';
type SortField = 'total_checkins' | 'checkin_points' | 'current_streak' | 'last_checkin_date' | 'name';
type SortDir = 'asc' | 'desc';
type FreqFilter = 'all' | 'daily' | 'weekly' | 'monthly' | 'inactive';

export default function CheckInManager() {
  const [recentCheckins, setRecentCheckins] = useState<(CheckInRecord & { profile_email?: string; profile_name?: string })[]>([]);
  const [allCustomers, setAllCustomers] = useState<CustomerProfile[]>([]);
  const [summary, setSummary] = useState<CheckInSummary>({
    totalCheckins: 0,
    todayCheckins: 0,
    weekCheckins: 0,
    monthCheckins: 0,
    totalPointsAwarded: 0,
    avgCheckinsPerCustomer: 0
  });
  const [loading, setLoading] = useState(true);
  const [subView, setSubView] = useState<SubView>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('total_checkins');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [freqFilter, setFreqFilter] = useState<FreqFilter>('all');

  // Customer detail drill-down
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerProfile | null>(null);
  const [customerHistory, setCustomerHistory] = useState<CheckInRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchRecentCheckins(),
        fetchSummary(),
        fetchAllCustomers()
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
      .limit(100);

    if (!error && data) {
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

  const fetchAllCustomers = async () => {
    const { data, error } = await supabase
      .from('customer_profiles')
      .select('user_id, email, name, total_checkins, checkin_points, current_streak, longest_streak, last_checkin_date')
      .gt('total_checkins', 0)
      .order('total_checkins', { ascending: false });

    if (!error && data) {
      setAllCustomers(data);
    }
  };

  const fetchSummary = async () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [allRes, todayRes, weekRes, monthRes, customerCountRes] = await Promise.all([
      supabase.from('customer_checkins').select('id, points_awarded'),
      supabase.from('customer_checkins').select('id', { count: 'exact', head: true }).gte('checked_in_at', todayStart),
      supabase.from('customer_checkins').select('id', { count: 'exact', head: true }).gte('checked_in_at', weekAgo),
      supabase.from('customer_checkins').select('id', { count: 'exact', head: true }).gte('checked_in_at', monthAgo),
      supabase.from('customer_profiles').select('id', { count: 'exact', head: true }).gt('total_checkins', 0)
    ]);

    const totalPoints = allRes.data?.reduce((sum, c) => sum + (c.points_awarded || 0), 0) || 0;
    const totalCheckins = allRes.data?.length || 0;
    const customerCount = customerCountRes.count || 1;

    setSummary({
      totalCheckins,
      todayCheckins: todayRes.count || 0,
      weekCheckins: weekRes.count || 0,
      monthCheckins: monthRes.count || 0,
      totalPointsAwarded: totalPoints,
      avgCheckinsPerCustomer: Math.round((totalCheckins / customerCount) * 10) / 10
    });
  };

  const fetchCustomerHistory = async (customer: CustomerProfile) => {
    setSelectedCustomer(customer);
    setHistoryLoading(true);
    setSubView('history');

    const { data, error } = await supabase
      .from('customer_checkins')
      .select('*')
      .eq('user_id', customer.user_id)
      .order('checked_in_at', { ascending: false });

    if (!error && data) {
      setCustomerHistory(data);
    }
    setHistoryLoading(false);
  };

  /** Classify a customer's check-in frequency based on their history */
  const getFrequencyLabel = (customer: CustomerProfile): { label: string; color: string } => {
    if (!customer.last_checkin_date) return { label: 'Inactive', color: '#6b7280' };

    const lastDate = new Date(customer.last_checkin_date);
    const now = new Date();
    const daysSinceLast = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceLast > 30) return { label: 'Inactive', color: '#6b7280' };
    if (customer.current_streak >= 3 || customer.total_checkins >= 20) return { label: 'Daily Regular', color: '#10b981' };
    if (customer.total_checkins >= 8) return { label: 'Weekly Regular', color: '#3b82f6' };
    if (customer.total_checkins >= 2) return { label: 'Monthly Visitor', color: '#f59e0b' };
    return { label: 'New', color: '#8b5cf6' };
  };

  const matchesFreqFilter = (customer: CustomerProfile): boolean => {
    if (freqFilter === 'all') return true;
    const freq = getFrequencyLabel(customer);
    if (freqFilter === 'daily') return freq.label === 'Daily Regular';
    if (freqFilter === 'weekly') return freq.label === 'Weekly Regular';
    if (freqFilter === 'monthly') return freq.label === 'Monthly Visitor' || freq.label === 'New';
    if (freqFilter === 'inactive') return freq.label === 'Inactive';
    return true;
  };

  /** Filtered & sorted customer list */
  const filteredCustomers = useMemo(() => {
    let list = allCustomers.filter(matchesFreqFilter);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c =>
        c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      if (sortField === 'last_checkin_date') {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      }
      if (sortField === 'name') {
        aVal = (aVal || '').toLowerCase();
        bVal = (bVal || '').toLowerCase();
      }
      if (sortDir === 'asc') return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });

    return list;
  }, [allCustomers, searchQuery, sortField, sortDir, freqFilter]);

  /** Build a simple day-of-week frequency chart for a customer's history */
  const getDayOfWeekDistribution = (history: CheckInRecord[]) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts = new Array(7).fill(0);
    history.forEach(c => {
      const d = new Date(c.checked_in_at).getDay();
      counts[d]++;
    });
    const max = Math.max(...counts, 1);
    return days.map((day, i) => ({ day, count: counts[i], pct: Math.round((counts[i] / max) * 100) }));
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

  const formatShortDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  };

  return (
    <div className="section-card">
      <h2>📍 Check-In Manager</h2>

      {/* Sub-navigation tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { key: 'overview' as SubView, label: '📊 Overview' },
          { key: 'customers' as SubView, label: '👥 Customer Frequency' },
          { key: 'history' as SubView, label: selectedCustomer ? `📋 ${selectedCustomer.name || selectedCustomer.email}` : '📋 History' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => { if (tab.key !== 'history' || selectedCustomer) setSubView(tab.key); }}
            disabled={tab.key === 'history' && !selectedCustomer}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: subView === tab.key ? '2px solid #b8860b' : '1px solid #333',
              background: subView === tab.key ? 'rgba(184,134,11,0.15)' : 'rgba(255,255,255,0.05)',
              color: subView === tab.key ? '#b8860b' : '#ccc',
              cursor: tab.key === 'history' && !selectedCustomer ? 'not-allowed' : 'pointer',
              fontWeight: subView === tab.key ? 700 : 400,
              fontSize: '14px',
              opacity: tab.key === 'history' && !selectedCustomer ? 0.4 : 1
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p>Loading check-in data...</p>
      ) : (
        <>
          {/* ===== OVERVIEW TAB ===== */}
          {subView === 'overview' && (
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
                  <div className="stat-number">{summary.monthCheckins}</div>
                  <div className="stat-label">This Month</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">{summary.totalPointsAwarded}</div>
                  <div className="stat-label">Points Awarded</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">{summary.avgCheckinsPerCustomer}</div>
                  <div className="stat-label">Avg / Customer</div>
                </div>
              </div>

              {/* Frequency Breakdown */}
              <div style={{ marginTop: '30px' }}>
                <h3>📊 Customer Frequency Breakdown</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginTop: '12px' }}>
                  {([
                    { label: 'Daily Regulars', filter: 'daily' as FreqFilter, color: '#10b981', icon: '🔥' },
                    { label: 'Weekly Regulars', filter: 'weekly' as FreqFilter, color: '#3b82f6', icon: '📅' },
                    { label: 'Monthly Visitors', filter: 'monthly' as FreqFilter, color: '#f59e0b', icon: '📆' },
                    { label: 'Inactive (30d+)', filter: 'inactive' as FreqFilter, color: '#6b7280', icon: '💤' }
                  ]).map(bucket => {
                    const count = allCustomers.filter(c => {
                      const freq = getFrequencyLabel(c);
                      if (bucket.filter === 'daily') return freq.label === 'Daily Regular';
                      if (bucket.filter === 'weekly') return freq.label === 'Weekly Regular';
                      if (bucket.filter === 'monthly') return freq.label === 'Monthly Visitor' || freq.label === 'New';
                      if (bucket.filter === 'inactive') return freq.label === 'Inactive';
                      return false;
                    }).length;
                    return (
                      <div
                        key={bucket.filter}
                        onClick={() => { setFreqFilter(bucket.filter); setSubView('customers'); }}
                        style={{
                          padding: '16px',
                          borderRadius: '10px',
                          background: 'rgba(255,255,255,0.05)',
                          border: `1px solid ${bucket.color}40`,
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'transform 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                        onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
                      >
                        <div style={{ fontSize: '24px' }}>{bucket.icon}</div>
                        <div style={{ fontSize: '28px', fontWeight: 700, color: bucket.color }}>{count}</div>
                        <div style={{ fontSize: '12px', color: '#999' }}>{bucket.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

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
                        {recentCheckins.slice(0, 20).map(checkin => (
                          <tr
                            key={checkin.id}
                            onClick={() => {
                              const customer = allCustomers.find(c => c.user_id === checkin.user_id);
                              if (customer) fetchCustomerHistory(customer);
                            }}
                            style={{ cursor: 'pointer' }}
                          >
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

          {/* ===== CUSTOMER FREQUENCY TAB ===== */}
          {subView === 'customers' && (
            <div>
              {/* Toolbar */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="form-input"
                  style={{ flex: '1 1 200px', minWidth: '180px' }}
                />
                <select
                  value={freqFilter}
                  onChange={e => setFreqFilter(e.target.value as FreqFilter)}
                  className="form-input"
                  style={{ width: 'auto', minWidth: '150px' }}
                >
                  <option value="all">All Customers</option>
                  <option value="daily">🔥 Daily Regulars</option>
                  <option value="weekly">📅 Weekly Regulars</option>
                  <option value="monthly">📆 Monthly / New</option>
                  <option value="inactive">💤 Inactive (30d+)</option>
                </select>
              </div>

              <p style={{ color: '#999', fontSize: '13px', margin: '0 0 12px' }}>
                Showing {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? 's' : ''} — click a row to view full history
              </p>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ cursor: 'pointer' }} onClick={() => handleSort('name')}>
                        Name{sortIndicator('name')}
                      </th>
                      <th>Email</th>
                      <th style={{ cursor: 'pointer' }} onClick={() => handleSort('total_checkins')}>
                        Check-Ins{sortIndicator('total_checkins')}
                      </th>
                      <th style={{ cursor: 'pointer' }} onClick={() => handleSort('current_streak')}>
                        Streak{sortIndicator('current_streak')}
                      </th>
                      <th style={{ cursor: 'pointer' }} onClick={() => handleSort('checkin_points')}>
                        Points{sortIndicator('checkin_points')}
                      </th>
                      <th style={{ cursor: 'pointer' }} onClick={() => handleSort('last_checkin_date')}>
                        Last Visit{sortIndicator('last_checkin_date')}
                      </th>
                      <th>Frequency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map(customer => {
                      const freq = getFrequencyLabel(customer);
                      return (
                        <tr
                          key={customer.user_id}
                          onClick={() => fetchCustomerHistory(customer)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td><strong>{customer.name || '—'}</strong></td>
                          <td>{customer.email}</td>
                          <td><strong>{customer.total_checkins}</strong></td>
                          <td>
                            {customer.current_streak > 0 ? (
                              <span>
                                {customer.current_streak}🔥
                                {customer.longest_streak > customer.current_streak && (
                                  <span style={{ color: '#999', fontSize: '12px' }}> (best: {customer.longest_streak})</span>
                                )}
                              </span>
                            ) : '—'}
                          </td>
                          <td>{customer.checkin_points}</td>
                          <td>{formatShortDate(customer.last_checkin_date)}</td>
                          <td>
                            <span style={{
                              display: 'inline-block',
                              padding: '3px 10px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: '#fff',
                              background: freq.color
                            }}>
                              {freq.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredCustomers.length === 0 && (
                      <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#999' }}>No customers match your filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===== CUSTOMER DETAIL / HISTORY TAB ===== */}
          {subView === 'history' && selectedCustomer && (
            <div>
              <button
                onClick={() => setSubView('customers')}
                style={{ background: 'none', border: 'none', color: '#b8860b', cursor: 'pointer', marginBottom: '16px', fontSize: '14px' }}
              >
                ← Back to Customer List
              </button>

              {/* Customer header */}
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '24px' }}>
                <div style={{ flex: '1 1 300px' }}>
                  <h3 style={{ margin: '0 0 4px' }}>{selectedCustomer.name || 'Unnamed Customer'}</h3>
                  <p style={{ margin: 0, color: '#999' }}>{selectedCustomer.email}</p>
                  <span style={{
                    display: 'inline-block',
                    marginTop: '8px',
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#fff',
                    background: getFrequencyLabel(selectedCustomer).color
                  }}>
                    {getFrequencyLabel(selectedCustomer).label}
                  </span>
                </div>
              </div>

              {/* Stats for this customer */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-number">{selectedCustomer.total_checkins}</div>
                  <div className="stat-label">Total Visits</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">{selectedCustomer.checkin_points}</div>
                  <div className="stat-label">Points Earned</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">{selectedCustomer.current_streak}🔥</div>
                  <div className="stat-label">Current Streak</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">{selectedCustomer.longest_streak}</div>
                  <div className="stat-label">Longest Streak</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">{formatShortDate(selectedCustomer.last_checkin_date)}</div>
                  <div className="stat-label">Last Visit</div>
                </div>
              </div>

              {historyLoading ? (
                <p style={{ marginTop: '24px' }}>Loading history...</p>
              ) : (
                <>
                  {/* Day-of-week frequency chart */}
                  {customerHistory.length > 0 && (
                    <div style={{ marginTop: '30px' }}>
                      <h3>📅 Visit Frequency by Day of Week</h3>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '120px', marginTop: '12px', padding: '0 8px' }}>
                        {getDayOfWeekDistribution(customerHistory).map(d => (
                          <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                            <span style={{ fontSize: '12px', color: '#ccc', marginBottom: '4px' }}>{d.count || ''}</span>
                            <div style={{
                              width: '100%',
                              maxWidth: '40px',
                              height: `${Math.max(d.pct, 4)}%`,
                              background: d.count > 0 ? 'linear-gradient(to top, #b8860b, #daa520)' : 'rgba(255,255,255,0.1)',
                              borderRadius: '4px 4px 0 0',
                              transition: 'height 0.3s'
                            }} />
                            <span style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>{d.day}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Full check-in history table */}
                  <div style={{ marginTop: '30px' }}>
                    <h3>📋 Full Check-In History ({customerHistory.length} visits)</h3>
                    {customerHistory.length === 0 ? (
                      <p>No check-in history found.</p>
                    ) : (
                      <div className="table-container">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Date</th>
                              <th>Points</th>
                              <th>Method</th>
                            </tr>
                          </thead>
                          <tbody>
                            {customerHistory.map((checkin, idx) => (
                              <tr key={checkin.id}>
                                <td>{customerHistory.length - idx}</td>
                                <td>{formatDate(checkin.checked_in_at)}</td>
                                <td>+{checkin.points_awarded}</td>
                                <td>{checkin.method === 'geo' ? '📍 Location' : '📋 Manual'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
