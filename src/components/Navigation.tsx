import React, { useState } from 'react';
import '../styles/navigation.css';

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);

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
          <li><a href="/contact" onClick={closeMenu}>Contact</a></li>
          <li><a href="https://facebook.com" target="_blank" onClick={closeMenu}>Facebook</a></li>
          <li><a href="https://instagram.com" target="_blank" onClick={closeMenu}>Instagram</a></li>
        </ul>
      </div>
    </nav>
  );
}
