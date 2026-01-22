import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface Game {
  id: number;
  sport: string;
  league: string;
  matchup: string;
  game_date: string;
  tv_channel: string;
  importance: number;
  notes: string;
}

const SPORTS = ['NFL', 'NBA', 'NCAA Basketball', 'MLB', 'NHL', 'MLS', 'Other'];

export default function GameCalendar() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    sport: 'NFL',
    league: '',
    matchup: '',
    game_date: '',
    game_time: '',
    tv_channel: '',
    importance: 3,
    notes: ''
  });

  useEffect(() => {
    fetchGames();
  }, []);

  const fetchGames = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('game_calendar')
      .select('*')
      .order('game_date', { ascending: true });

    if (!error && data) {
      setGames(data);
    }
    setLoading(false);
  };

  const handleAddGame = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const gameDateTime = `${formData.game_date}T${formData.game_time}:00`;

    const { error } = await supabase.from('game_calendar').insert([
      {
        sport: formData.sport,
        league: formData.league,
        matchup: formData.matchup,
        game_date: gameDateTime,
        tv_channel: formData.tv_channel,
        importance: formData.importance,
        notes: formData.notes
      }
    ]);

    if (error) {
      setError(error.message);
    } else {
      setSuccess('Game added successfully!');
      setFormData({
        sport: 'NFL',
        league: '',
        matchup: '',
        game_date: '',
        game_time: '',
        tv_channel: '',
        importance: 3,
        notes: ''
      });
      setShowForm(false);
      fetchGames();
    }
  };

  const handleDeleteGame = async (id: number) => {
    if (confirm('Are you sure you want to delete this game?')) {
      const { error } = await supabase.from('game_calendar').delete().eq('id', id);
      if (!error) {
        fetchGames();
      }
    }
  };

  return (
    <div className="section-card">
      <div className="section-header">
        <h2>Game Calendar & Events</h2>
        <button onClick={() => setShowForm(!showForm)} className="form-button-small">
          {showForm ? 'Cancel' : '+ Add Game'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAddGame} className="form-stack">
          <div className="form-grid">
            <select
              value={formData.sport}
              onChange={(e) => setFormData({...formData, sport: e.target.value})}
              className="form-input"
            >
              {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input
              type="text"
              placeholder="League"
              value={formData.league}
              onChange={(e) => setFormData({...formData, league: e.target.value})}
              className="form-input"
            />
          </div>
          <input
            type="text"
            placeholder="Matchup (e.g., Bengals vs Ravens)"
            value={formData.matchup}
            onChange={(e) => setFormData({...formData, matchup: e.target.value})}
            required
            className="form-input"
          />
          <div className="form-grid">
            <input
              type="date"
              value={formData.game_date}
              onChange={(e) => setFormData({...formData, game_date: e.target.value})}
              required
              className="form-input"
            />
            <input
              type="time"
              value={formData.game_time}
              onChange={(e) => setFormData({...formData, game_time: e.target.value})}
              required
              className="form-input"
            />
          </div>
          <input
            type="text"
            placeholder="TV Channel (e.g., ESPN, FOX)"
            value={formData.tv_channel}
            onChange={(e) => setFormData({...formData, tv_channel: e.target.value})}
            className="form-input"
          />
          <textarea
            placeholder="Notes"
            value={formData.notes}
            onChange={(e) => setFormData({...formData, notes: e.target.value})}
            className="form-textarea"
            rows={3}
          />
          <button type="submit" className="form-button">Add Game Event</button>
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
        </form>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Sport</th>
              <th>Matchup</th>
              <th>Date & Time</th>
              <th>Channel</th>
              <th>Importance</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {games.map((game) => (
              <tr key={game.id}>
                <td><strong>{game.sport}</strong></td>
                <td>{game.matchup}</td>
                <td>{new Date(game.game_date).toLocaleString()}</td>
                <td>{game.tv_channel}</td>
                <td>{'⭐'.repeat(game.importance)}</td>
                <td>
                  <button
                    onClick={() => handleDeleteGame(game.id)}
                    className="delete-button"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
