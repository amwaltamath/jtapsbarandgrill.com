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
    <nav className="navigation">
      <div className="nav-container">
        <div className="logo">JTAPS</div>
        
        <button 
          className="hamburger" 
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
              href="https://loyalty.focuspos.com/addmember/?C=2786"
              target="_blank"
              rel="noopener"
              onClick={closeMenu}
              className="nav-cta"
            >
              Rewards
            </a>
          </li>
          <li><a href="https://facebook.com" target="_blank" onClick={closeMenu}>Facebook</a></li>
          <li><a href="https://instagram.com" target="_blank" onClick={closeMenu}>Instagram</a></li>
        </ul>
      </div>
    </nav>
  );
}
