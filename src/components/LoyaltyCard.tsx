import React, { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabase';
import '../styles/loyalty-card.css';

interface MemberData {
  userId: string;
  name: string;
  email: string;
  points: number;
  tier: 'bronze' | 'silver' | 'gold';
  totalCheckins: number;
  currentStreak: number;
  longestStreak: number;
  memberSince: string;
  lastCheckin: string | null;
}

interface WalletStatus {
  configured: boolean;
  installed: boolean;
  installedAt?: string;
  lastUpdated?: string;
}

interface WalletData {
  member: MemberData;
  wallets: {
    apple: WalletStatus;
    google: WalletStatus;
  };
}

const TIER_CONFIG = {
  bronze: {
    label: 'Bronze',
    icon: '🟤',
    gradient: 'linear-gradient(135deg, #8B4513 0%, #CD7F32 50%, #A0522D 100%)',
    accent: '#CD7F32',
    nextTier: 'Silver',
    nextPoints: 100,
  },
  silver: {
    label: 'Silver',
    icon: '⚪',
    gradient: 'linear-gradient(135deg, #708090 0%, #C0C0C0 50%, #A9A9A9 100%)',
    accent: '#C0C0C0',
    nextTier: 'Gold',
    nextPoints: 300,
  },
  gold: {
    label: 'Gold',
    icon: '🟡',
    gradient: 'linear-gradient(135deg, #B8860B 0%, #FFD700 50%, #DAA520 100%)',
    accent: '#FFD700',
    nextTier: null,
    nextPoints: 0,
  },
};

export default function LoyaltyCard() {
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState<'apple' | 'google' | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [flipped, setFlipped] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Please log in to view your loyalty card.');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/wallet/status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.detail ? `${body.error}: ${body.detail}` : body.error || 'Failed to load loyalty card');
      }

      const walletData: WalletData = await res.json();
      setData(walletData);
    } catch (err: any) {
      setError(err.message || 'Failed to load loyalty card data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleAppleWallet = async () => {
    if (downloading) return;
    setDownloading('apple');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch('/api/wallet/apple-pass', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to generate Apple Wallet pass');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'jtaps-loyalty-card.pkpass';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Refresh status
      await fetchStatus();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDownloading(null);
    }
  };

  const handleGoogleWallet = async () => {
    if (downloading) return;
    setDownloading('google');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch('/api/wallet/google-pass', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to generate Google Wallet pass');
      }

      const { url } = await res.json();
      window.open(url, '_blank', 'noopener,noreferrer');

      // Refresh status
      await fetchStatus();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <div className="loyalty-card-container">
        <div className="loyalty-card-loading">
          <div className="loading-spinner" />
          <p>Loading your loyalty card...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const isAuthError = error.includes('log in') || error.includes('Authentication');
    return (
      <div className="loyalty-card-container">
        <div className="loyalty-card-error">
          <p>{error}</p>
          {isAuthError ? (
            <a href="/login" className="loyalty-login-link">Log in to view your card</a>
          ) : (
            <button onClick={() => { setError(''); setLoading(true); fetchStatus(); }} className="loyalty-login-link">
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { member, wallets } = data;
  const tierConfig = TIER_CONFIG[member.tier];
  const progressPercent = tierConfig.nextTier
    ? Math.min(100, (member.points / tierConfig.nextPoints) * 100)
    : 100;
  const pointsToNext = tierConfig.nextTier
    ? Math.max(0, tierConfig.nextPoints - member.points)
    : 0;

  return (
    <div className="loyalty-card-container">
      <div className="loyalty-card-section">
        <h2 className="section-title">Your JTAPS Loyalty Card</h2>
        <p className="section-subtitle">
          Save to your phone's wallet for quick access every visit
        </p>

        {/* Card */}
        <div className={`loyalty-card-wrapper ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(!flipped)}>
          {/* Front */}
          <div className="loyalty-card-front" style={{ background: tierConfig.gradient }}>
            <div className="card-shine" />
            <div className="card-header">
              <div className="card-logo">
                <span className="card-logo-text">JTAPS</span>
                <span className="card-logo-sub">BAR &amp; GRILL</span>
              </div>
              <div className="card-tier-badge" style={{ borderColor: tierConfig.accent }}>
                <span className="tier-icon">{tierConfig.icon}</span>
                <span className="tier-label">{tierConfig.label}</span>
              </div>
            </div>

            <div className="card-points-display">
              <span className="points-number">{member.points.toLocaleString()}</span>
              <span className="points-label">POINTS</span>
            </div>

            <div className="card-member-info">
              <span className="member-name">{member.name}</span>
              <span className="member-since">
                Member since {new Date(member.memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </span>
            </div>

            <div className="card-stats-row">
              <div className="card-stat">
                <span className="stat-value">{member.totalCheckins}</span>
                <span className="stat-label">Visits</span>
              </div>
              <div className="card-stat">
                <span className="stat-value">{member.currentStreak}</span>
                <span className="stat-label">Streak</span>
              </div>
              <div className="card-stat">
                <span className="stat-value">{member.longestStreak}</span>
                <span className="stat-label">Best</span>
              </div>
            </div>

            <div className="card-flip-hint">Tap to flip</div>
          </div>

          {/* Back */}
          <div className="loyalty-card-back">
            <div className="card-back-content">
              <div className="card-qr-section">
                <QRCodeSVG
                  value={`https://jtapsbarandgrill.com/dashboard?ref=${member.userId}`}
                  size={160}
                  bgColor="white"
                  fgColor="#1a1a1a"
                  level="M"
                  includeMargin={true}
                />
                <p className="qr-hint">Scan at the bar to check in</p>
              </div>

              <div className="card-back-info">
                <h4>JTAPS Rewards Program</h4>
                <ul className="rewards-list">
                  <li>🟤 Bronze: 0-99 pts</li>
                  <li>⚪ Silver: 100-299 pts</li>
                  <li>🟡 Gold: 300+ pts</li>
                </ul>
                <p className="rewards-earn">Earn 10 pts per visit + streak bonuses!</p>
              </div>
            </div>
            <div className="card-flip-hint dark">Tap to flip</div>
          </div>
        </div>

        {/* Progress */}
        {tierConfig.nextTier && (
          <div className="tier-progress-section">
            <div className="tier-progress-label">
              <span>{pointsToNext} pts to {tierConfig.nextTier}</span>
              <span>{member.points} / {tierConfig.nextPoints}</span>
            </div>
            <div className="tier-progress-bar">
              <div
                className="tier-progress-fill"
                style={{ width: `${progressPercent}%`, background: tierConfig.accent }}
              />
            </div>
          </div>
        )}

        {/* QR Code Toggle (mobile-friendly big view) */}
        <button className="qr-toggle-btn" onClick={() => setShowQR(!showQR)}>
          {showQR ? 'Hide QR Code' : '📱 Show QR Code for Check-in'}
        </button>

        {showQR && (
          <div className="qr-fullscreen">
            <QRCodeSVG
              value={`https://jtapsbarandgrill.com/dashboard?ref=${member.userId}`}
              size={250}
              bgColor="white"
              fgColor="#1a1a1a"
              level="M"
              includeMargin={true}
            />
            <p className="qr-fullscreen-text">Show this at the bar to check in</p>
          </div>
        )}

        {/* Wallet Buttons */}
        <div className="wallet-buttons">
          <h3 className="wallet-title">Save to Your Wallet</h3>
          <p className="wallet-subtitle">
            Keep your loyalty card handy — add it directly to your phone's wallet
          </p>

          <div className="wallet-btn-row">
            {/* Apple Wallet */}
            <button
              className={`wallet-btn apple-wallet-btn ${!wallets.apple.configured ? 'disabled' : ''}`}
              onClick={handleAppleWallet}
              disabled={!wallets.apple.configured || downloading === 'apple'}
              title={wallets.apple.configured ? 'Add to Apple Wallet' : 'Apple Wallet coming soon'}
            >
              <svg className="wallet-icon" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 21.99 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 21.99C7.79 22.03 6.8 20.68 5.96 19.47C4.25 16.97 2.94 12.45 4.7 9.39C5.57 7.87 7.13 6.91 8.82 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z" />
              </svg>
              <span className="wallet-btn-text">
                {downloading === 'apple' ? 'Generating...' : wallets.apple.installed ? 'Update Apple Wallet' : 'Add to Apple Wallet'}
              </span>
            </button>

            {/* Google Wallet */}
            <button
              className={`wallet-btn google-wallet-btn ${!wallets.google.configured ? 'disabled' : ''}`}
              onClick={handleGoogleWallet}
              disabled={!wallets.google.configured || downloading === 'google'}
              title={wallets.google.configured ? 'Add to Google Wallet' : 'Google Wallet coming soon'}
            >
              <svg className="wallet-icon" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
              <span className="wallet-btn-text">
                {downloading === 'google' ? 'Generating...' : wallets.google.installed ? 'Update Google Wallet' : 'Add to Google Wallet'}
              </span>
            </button>
          </div>

          {!wallets.apple.configured && !wallets.google.configured && (
            <p className="wallet-coming-soon">
              Wallet passes are being set up. In the meantime, bookmark this page or add it to your home screen!
            </p>
          )}

          {(wallets.apple.installed || wallets.google.installed) && (
            <div className="wallet-installed-info">
              <p>✅ Your card will automatically update with your latest points and tier when you add it again.</p>
            </div>
          )}
        </div>

        {/* Home Screen Prompt */}
        <div className="homescreen-prompt">
          <h4>📲 Quick Access Tip</h4>
          <p>
            Add this page to your home screen for instant access to your loyalty card,
            just like an app! On iPhone, tap the share button and "Add to Home Screen."
            On Android, tap the menu and "Add to Home Screen."
          </p>
        </div>
      </div>
    </div>
  );
}
