import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface LoyaltyMember {
  id: number;
  email: string;
  name: string;
  points: number;
  tier: string;
  joined_at: string;
}

export default function LoyaltyProgram() {
  const [members, setMembers] = useState<LoyaltyMember[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('loyalty_members')
      .select('*')
      .order('points', { ascending: false });

    if (!error && data) {
      setMembers(data);
    }
    setLoading(false);
  };

  const getTierColor = (tier: string) => {
    switch(tier) {
      case 'gold': return '🟡';
      case 'silver': return '⚪';
      case 'bronze': return '🟤';
      default: return '⭕';
    }
  };

  const pointsToNextTier = (points: number) => {
    if (points < 100) return 100 - points;
    if (points < 300) return 300 - points;
    return 0;
  };

  return (
    <div className="section-card">
      <h2>Loyalty Program</h2>
      
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-number">{members.length}</div>
          <div className="stat-label">Total Members</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{members.filter(m => m.tier === 'gold').length}</div>
          <div className="stat-label">Gold Members</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{members.reduce((acc, m) => acc + m.points, 0)}</div>
          <div className="stat-label">Total Points</div>
        </div>
      </div>

      {loading ? (
        <p>Loading members...</p>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Tier</th>
                <th>Points</th>
                <th>To Next Tier</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.map(member => (
                <tr key={member.id}>
                  <td><strong>{member.name}</strong></td>
                  <td>{member.email}</td>
                  <td>{getTierColor(member.tier)} {member.tier.toUpperCase()}</td>
                  <td><strong>{member.points}</strong></td>
                  <td>{pointsToNextTier(member.points) > 0 ? pointsToNextTier(member.points) : '✨ MAX'}</td>
                  <td>{new Date(member.joined_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="info-box">
        <h3>Loyalty Tier System</h3>
        <ul>
          <li>🟤 <strong>Bronze:</strong> 0-99 points</li>
          <li>⚪ <strong>Silver:</strong> 100-299 points</li>
          <li>🟡 <strong>Gold:</strong> 300+ points</li>
        </ul>
      </div>
    </div>
  );
}
