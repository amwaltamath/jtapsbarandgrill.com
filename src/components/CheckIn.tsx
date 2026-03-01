import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface CheckInStatus {
  checked_in_today: boolean;
  checkin_points: number;
  total_checkins: number;
  current_streak: number;
  longest_streak: number;
  last_checkin_date: string | null;
  history: CheckInRecord[];
}

interface CheckInRecord {
  id: number;
  points_awarded: number;
  checked_in_at: string;
  method: string;
}

export default function CheckIn() {
  const [status, setStatus] = useState<CheckInStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [celebrateAnim, setCelebrateAnim] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const getAuthToken = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

  const fetchStatus = async () => {
    try {
      const token = await getAuthToken();
      if (!token) return;

      const response = await fetch('/api/checkin', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch check-in status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (useGeo: boolean) => {
    setError('');
    setSuccess('');

    if (useGeo) {
      setGeoLoading(true);
      // Request geolocation
      if (!navigator.geolocation) {
        setError('Geolocation is not supported by your browser. Try checking in without location.');
        setGeoLoading(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          await doCheckIn(position.coords.latitude, position.coords.longitude);
          setGeoLoading(false);
        },
        (geoError) => {
          setError('Location access denied. You can still check in without location verification.');
          setGeoLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      await doCheckIn();
    }
  };

  const doCheckIn = async (latitude?: number, longitude?: number) => {
    setCheckingIn(true);
    setError('');

    try {
      const token = await getAuthToken();
      if (!token) {
        setError('Not authenticated. Please log in again.');
        setCheckingIn(false);
        return;
      }

      const response = await fetch('/api/checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          latitude: latitude || null,
          longitude: longitude || null
        })
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Check-in failed');
        setCheckingIn(false);
        return;
      }

      // Success!
      setCelebrateAnim(true);
      setTimeout(() => setCelebrateAnim(false), 2000);

      let msg = `🎉 Checked in! +${result.points_awarded} points`;
      if (result.streak_bonus) {
        msg += ` (includes ${5} point streak bonus! 🔥)`;
      }
      if (result.current_streak > 1) {
        msg += ` | ${result.current_streak}-day streak!`;
      }
      setSuccess(msg);

      // Refresh status
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check-in failed');
    } finally {
      setCheckingIn(false);
    }
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

  if (loading) {
    return (
      <div className="checkin-section">
        <div className="checkin-loading">Loading check-in status...</div>
      </div>
    );
  }

  return (
    <div className="checkin-section">
      <div className={`checkin-card ${celebrateAnim ? 'celebrate' : ''}`}>
        <div className="checkin-header">
          <h2>📍 Daily Check-In</h2>
          <p className="checkin-subtitle">Check in at JTAPS to earn reward points!</p>
        </div>

        {/* Stats Row */}
        <div className="checkin-stats">
          <div className="checkin-stat">
            <span className="stat-value">{status?.checkin_points || 0}</span>
            <span className="stat-label">Points</span>
          </div>
          <div className="checkin-stat">
            <span className="stat-value">{status?.total_checkins || 0}</span>
            <span className="stat-label">Check-ins</span>
          </div>
          <div className="checkin-stat">
            <span className="stat-value">
              {(status?.current_streak || 0) > 0 ? `${status?.current_streak}🔥` : '0'}
            </span>
            <span className="stat-label">Streak</span>
          </div>
          <div className="checkin-stat">
            <span className="stat-value">{status?.longest_streak || 0}</span>
            <span className="stat-label">Best Streak</span>
          </div>
        </div>

        {/* Points Info */}
        <div className="checkin-info">
          <p>🏆 <strong>10 points</strong> per check-in</p>
          <p>🔥 <strong>+5 bonus points</strong> for 3+ day streaks</p>
        </div>

        {/* Alerts */}
        {error && <div className="checkin-error">{error}</div>}
        {success && <div className="checkin-success">{success}</div>}

        {/* Check-In Buttons */}
        {status?.checked_in_today ? (
          <div className="already-checked-in">
            <div className="checked-badge">✅ Checked In Today!</div>
            <p>Come back tomorrow to keep your streak going.</p>
          </div>
        ) : (
          <div className="checkin-actions">
            <button
              className="checkin-btn checkin-btn-primary"
              onClick={() => handleCheckIn(true)}
              disabled={checkingIn || geoLoading}
            >
              {geoLoading ? '📡 Getting location...' : checkingIn ? 'Checking in...' : '📍 Check In with Location'}
            </button>
            <button
              className="checkin-btn checkin-btn-secondary"
              onClick={() => handleCheckIn(false)}
              disabled={checkingIn || geoLoading}
            >
              {checkingIn ? 'Checking in...' : 'Check In Without Location'}
            </button>
            <p className="checkin-note">
              Location check-in verifies you're at JTAPS for faster reward approval.
            </p>
          </div>
        )}

        {/* History Toggle */}
        <button
          className="history-toggle"
          onClick={() => setShowHistory(!showHistory)}
        >
          {showHistory ? 'Hide History ▲' : 'Show History ▼'}
        </button>

        {showHistory && (
          <div className="checkin-history">
            <h3>Recent Check-Ins</h3>
            {(!status?.history || status.history.length === 0) ? (
              <p className="no-history">No check-ins yet. Be the first!</p>
            ) : (
              <div className="history-list">
                {status.history.map(record => (
                  <div key={record.id} className="history-item">
                    <div className="history-date">{formatDate(record.checked_in_at)}</div>
                    <div className="history-meta">
                      <span className="history-points">+{record.points_awarded} pts</span>
                      <span className="history-method">
                        {record.method === 'geo' ? '📍 Location' : '📋 Manual'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
