import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import App from "./App.jsx";
import AdminPanel from "./admin/AdminPanel.jsx";

function ApiDocs() {
  React.useEffect(() => {
    window.location.href = '/api/docs';
  }, []);
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h2>Redirecting to API Documentation...</h2>
      <p>If you're not redirected automatically, <a href="/api/docs">click here</a>.</p>
    </div>
  );
}

function MainApp() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/admin/*" element={<AdminPanel />} />
        <Route path="/api/docs" element={<ApiDocs />} />
      </Routes>
    </Router>
  );
}

export default MainApp;
