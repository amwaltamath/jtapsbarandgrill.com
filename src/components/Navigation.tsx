import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import '../styles/navigation.css';

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
    
    // Listen for auth changes - only if supabase is available
    if (supabase?.auth) {
      try {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          setIsAuthenticated(!!session);
        });

        return () => subscription?.unsubscribe();
      } catch (error) {
        console.warn('Auth listener failed:', error);
      }
    }
  }, []);

  const checkAuth = async () => {
    if (!supabase?.auth) {
      setIsAuthenticated(false);
      return;
    }
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
    } catch (error) {
      console.warn('Auth check failed:', error);
      setIsAuthenticated(false);
    }
  };

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  return (
    <>
      {/* Top Utility Bar */}
      <div className="utility-bar">
        <div className="utility-container">
          <div className="utility-left">
            <a href="tel:+15135749777" className="utility-phone">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
              (513) 574-9777
            </a>
            <span className="utility-divider">|</span>
            <span className="utility-hours">Mon-Thu 11am-12am · Fri-Sat 11am-1am · Sun 11am-11pm</span>
          </div>
          <div className="utility-right">
            <a href="https://www.facebook.com/JTAPS" target="_blank" rel="noopener" aria-label="Facebook" className="utility-social">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </a>
            <a href="https://www.instagram.com/jtapsbarandgrill" target="_blank" rel="noopener" aria-label="Instagram" className="utility-social">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            </a>
            <a href="https://www.google.com/maps/place/JTAPS+Bar+and+Grill" target="_blank" rel="noopener" aria-label="Google Maps" className="utility-social">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C7.802 0 4 3.403 4 7.602 4 11.8 7.469 16.812 12 24c4.531-7.188 8-12.2 8-16.398C20 3.403 16.199 0 12 0zm0 11a3 3 0 110-6 3 3 0 010 6z"/></svg>
            </a>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="navigation">
        <div className="nav-container">
          <a href="/" className="logo-link">
            <span className="logo">JTAPS</span>
            <span className="logo-sub">BAR & GRILL</span>
          </a>
          
          <button 
            className={`hamburger ${isOpen ? 'active' : ''}`}
            onClick={toggleMenu}
            aria-label="Toggle menu"
            aria-expanded={isOpen}
          >
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
          </button>

          <ul className={`nav-menu ${isOpen ? 'active' : ''}`}>
            <li><a href="/" onClick={closeMenu}>Home</a></li>
            <li><a href="/menu" onClick={closeMenu}>Menu</a></li>
            <li><a href="/watch-the-game" onClick={closeMenu}>Watch the Game</a></li>
            <li><a href="/blog" onClick={closeMenu}>Blog</a></li>
            <li><a href="/contact" onClick={closeMenu}>Contact</a></li>
            <li>
              <a
                href={isAuthenticated ? "/dashboard" : "/login"}
                onClick={closeMenu}
                className="nav-cta nav-account"
              >
                {isAuthenticated ? "My Account" : "Login / Sign Up"}
              </a>
            </li>
            <li>
              <a
                href="https://togoorder.com/web/3136#/"
                target="_blank"
                rel="noopener"
                onClick={closeMenu}
                className="nav-cta nav-order"
              >
                Order Online
              </a>
            </li>
          </ul>
        </div>
      </nav>
    </>
  );
}
