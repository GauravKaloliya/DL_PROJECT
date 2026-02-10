import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import App from "./App.jsx";
import AdminPanel from "./admin/AdminPanel.jsx";

// Prevent copy/paste on the entire application
document.addEventListener("copy", (e) => { e.preventDefault(); });
document.addEventListener("paste", (e) => { e.preventDefault(); });
document.addEventListener("cut", (e) => { e.preventDefault(); });

function MainApp() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/admin/*" element={<AdminPanel />} />
        <Route path="/verify-email" element={<Navigate to="/admin?verify=true" replace />} />
      </Routes>
    </Router>
  );
}

export default MainApp;