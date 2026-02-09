import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function AnalyticsDashboard() {
  const [metrics, setMetrics] = useState({
    totalGames: 0,
    activeSpecials: 0,
    loyaltyMembers: 0,
    totalPromoCodesUsed: 0
  });

  useEffect(() => {
    fetchMetrics();
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

  return (
    <div className="section-card">
      <h2>Analytics Dashboard</h2>
      
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

      <div className="insights-section">
        <h3>Key Insights</h3>
        <ul className="insights-list">
          <li>🏈 <strong>{metrics.totalGames}</strong> upcoming games to promote</li>
          <li>🎉 <strong>{metrics.activeSpecials}</strong> active promotions running</li>
          <li>💳 <strong>{metrics.loyaltyMembers}</strong> customers in loyalty program</li>
          <li>🎟️ Promo codes have been used <strong>{metrics.totalPromoCodesUsed}</strong> times</li>
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
