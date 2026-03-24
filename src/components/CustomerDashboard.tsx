import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import CheckIn from './CheckIn';
import LoyaltyCard from './LoyaltyCard';
import '../styles/customer-dashboard.css';

interface Game {
  id: number;
  sport: string;
  league: string;
  matchup: string;
  game_date: string;
  tv_channel: string | null;
  importance: number;
  notes: string | null;
}

interface Special {
  id: number;
  title: string;
  description: string;
  discount_type: string | null;
  discount_amount: number | null;
  start_time: string | null;
  end_time: string | null;
  days_of_week: string[] | null;
  active: boolean;
}

interface CustomerProfile {
  name: string;
  email: string;
}

export default function CustomerDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState<Game[]>([]);
  const [specials, setSpecials] = useState<Special[]>([]);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'checkin' | 'loyalty' | 'games' | 'specials'>('checkin');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        window.location.href = '/login';
        return;
      }

      setIsAuthenticated(true);

      // Fetch user profile
      const { data: profileData } = await supabase
        .from('customer_profiles')
        .select('name, email')
        .eq('user_id', session.user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
      } else {
        setProfile({
          name: session.user.email?.split('@')[0] || 'Guest',
          email: session.user.email || ''
        });
      }

      // Fetch upcoming games
      await fetchGames();
      // Fetch active specials
      await fetchSpecials();
    } catch (err) {
      console.error('Auth check error:', err);
      window.location.href = '/login';
    } finally {
      setLoading(false);
    }
  };

  const fetchGames = async () => {
    try {
      const { data, error } = await supabase
        .from('game_calendar')
        .select('*')
        .gte('game_date', new Date().toISOString())
        .order('game_date', { ascending: true })
        .limit(10);

      if (!error && data) {
        setGames(data);
      }
    } catch (err) {
      console.error('Error fetching games:', err);
    }
  };

  const fetchSpecials = async () => {
    try {
      const { data, error } = await supabase
        .from('specials')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setSpecials(data);
      }
    } catch (err) {
      console.error('Error fetching specials:', err);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${period}`;
  };

  const getDayName = (day: string) => {
    const days: Record<string, string> = {
      'mon': 'Monday',
      'tue': 'Tuesday',
      'wed': 'Wednesday',
      'thu': 'Thursday',
      'fri': 'Friday',
      'sat': 'Saturday',
      'sun': 'Sunday'
    };
    return days[day.toLowerCase()] || day;
  };

  if (loading) {
    return (
      <div className="customer-dashboard">
        <div className="loading">Loading your dashboard...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="customer-dashboard">
      <header className="dashboard-header">
        <div className="header-left">
          <h1>Welcome, {profile?.name}! 🎉</h1>
          <p className="header-subtitle">Your JTAPS Experience</p>
        </div>
        <button onClick={handleLogout} className="logout-btn">Logout</button>
      </header>

      <div className="dashboard-nav">
        <button
          className={`nav-tab ${activeTab === 'checkin' ? 'active' : ''}`}
          onClick={() => setActiveTab('checkin')}
        >
          📍 Check In
        </button>
        <button
          className={`nav-tab ${activeTab === 'loyalty' ? 'active' : ''}`}
          onClick={() => setActiveTab('loyalty')}
        >
          💳 Loyalty Card
        </button>
        <button
          className={`nav-tab ${activeTab === 'games' ? 'active' : ''}`}
          onClick={() => setActiveTab('games')}
        >
          🏈 Upcoming Games
        </button>
        <button
          className={`nav-tab ${activeTab === 'specials' ? 'active' : ''}`}
          onClick={() => setActiveTab('specials')}
        >
          🎉 Specials
        </button>
      </div>

      <div className="dashboard-content">
        {activeTab === 'checkin' && (
          <div className="content-section">
            <CheckIn />
          </div>
        )}

        {activeTab === 'loyalty' && (
          <div className="content-section">
            <LoyaltyCard />
          </div>
        )}

        {activeTab === 'games' && (
          <div className="content-section">
            <h2>Upcoming Games</h2>
            {games.length === 0 ? (
              <div className="empty-state">
                <p>No upcoming games scheduled yet. Check back soon!</p>
              </div>
            ) : (
              <div className="games-grid">
                {games.map(game => (
                  <div key={game.id} className="game-card">
                    <div className="game-header">
                      <div className="game-sport">{game.sport}</div>
                      <div className={`game-importance importance-${game.importance}`}>
                        {'🔥'.repeat(game.importance)}
                      </div>
                    </div>
                    <div className="game-matchup">{game.matchup}</div>
                    <div className="game-league">{game.league}</div>
                    <div className="game-date">📅 {formatDate(game.game_date)}</div>
                    {game.tv_channel && (
                      <div className="game-channel">📺 Channel: {game.tv_channel}</div>
                    )}
                    {game.notes && (
                      <div className="game-notes">{game.notes}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'specials' && (
          <div className="content-section">
            <h2>Current Specials</h2>
            {specials.length === 0 ? (
              <div className="empty-state">
                <p>No active specials at the moment. Come back soon!</p>
              </div>
            ) : (
              <div className="specials-grid">
                {specials.map(special => (
                  <div key={special.id} className="special-card">
                    <h3>{special.title}</h3>
                    <p className="special-description">{special.description}</p>
                    
                    {special.discount_type && special.discount_amount && (
                      <div className="special-discount">
                        <span className="discount-badge">
                          {special.discount_type === 'percentage' ? `${special.discount_amount}% Off` : `$${special.discount_amount} Off`}
                        </span>
                      </div>
                    )}

                    {(special.start_time || special.end_time) && (
                      <div className="special-time">
                        ⏰ {special.start_time ? formatTime(special.start_time) : 'Anytime'}
                        {special.end_time && ` - ${formatTime(special.end_time)}`}
                      </div>
                    )}

                    {special.days_of_week && special.days_of_week.length > 0 && (
                      <div className="special-days">
                        <div className="days-label">Available on:</div>
                        <div className="days-list">
                          {special.days_of_week.map(day => (
                            <span key={day} className="day-tag">{getDayName(day)}</span>
                          ))}
                        </div>
                      </div>
                    )}
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
