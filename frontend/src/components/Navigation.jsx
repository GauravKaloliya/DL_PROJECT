import React from "react";
import { Link } from "react-router-dom";

export default function Navigation() {
  return (
    <nav className="navigation">
      <ul className="nav-list">
        <li className="nav-item">
          <Link to="/" className="nav-link">Home 🏠</Link>
        </li>
        <li className="nav-item">
          <Link to="/admin" className="nav-link">Admin 🛠️</Link>
        </li>
      </ul>
    </nav>
  );
}