import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE || "";

export default function AdminPanel() {
  const [apiKey, setApiKey] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [stats, setStats] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const navigate = useNavigate();

  // Check if user is already authenticated (e.g., from localStorage)
  useEffect(() => {
    const savedAuth = localStorage.getItem("adminAuthenticated");
    if (savedAuth === "true") {
      setIsAuthenticated(true);
      fetchStats();
      fetchCsvData();
    }
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (apiKey.trim() === "") {
      setError("Please enter an API key");
      return;
    }
    
    // In a real app, you would validate this with the backend
    // For now, we'll use a simple check
    if (apiKey === "changeme" || apiKey === "admin123") {
      setIsAuthenticated(true);
      setError(null);
      localStorage.setItem("adminAuthenticated", "true");
      fetchStats();
      fetchCsvData();
    } else {
      setError("Invalid API key");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setApiKey("");
    setStats(null);
    setCsvData([]);
    localStorage.removeItem("adminAuthenticated");
    navigate("/admin");
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/stats?api_key=${apiKey}`);
      if (!response.ok) {
        throw new Error("Failed to fetch statistics");
      }
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCsvData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/admin/csv-data?api_key=${apiKey}`);
      if (!response.ok) {
        throw new Error("Failed to fetch CSV data");
      }
      const data = await response.json();
      setCsvData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadCsv = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/download?api_key=${apiKey}`);
      if (!response.ok) {
        throw new Error("Failed to download CSV");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "submissions.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err.message);
    }
  };

  const filteredData = csvData.filter((row) => {
    return Object.values(row).some((value) => {
      return String(value).toLowerCase().includes(searchTerm.toLowerCase());
    });
  });

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  if (!isAuthenticated) {
    return (
      <div className="admin-login">
        <div className="login-panel">
          <h1>Admin Login 🔐</h1>
          <p>Please enter your API key to access the admin panel</p>
          {error && <div className="error-message">{error}</div>}
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your API key"
              />
            </div>
            <button type="submit" className="primary" disabled={loading}>
              {loading ? "Authenticating..." : "Login"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1>Admin Panel 🛠️</h1>
        <div className="admin-actions">
          <button className="ghost" onClick={handleLogout}>Logout 🔒</button>
        </div>
      </div>

      <div className="admin-tabs">
        <button
          className={activeTab === "dashboard" ? "active" : ""}
          onClick={() => setActiveTab("dashboard")}
        >
          Dashboard 📊
        </button>
        <button
          className={activeTab === "data" ? "active" : ""}
          onClick={() => setActiveTab("data")}
        >
          Data Explorer 🔍
        </button>
        <button
          className={activeTab === "settings" ? "active" : ""}
          onClick={() => setActiveTab("settings")}
        >
          Settings ⚙️
        </button>
      </div>

      <div className="admin-content">
        {activeTab === "dashboard" && (
          <div className="dashboard">
            <h2>Statistics Overview 📈</h2>
            {loading ? (
              <div className="loading">Loading statistics...</div>
            ) : stats ? (
              <div className="stats-grid">
                <div className="stat-card">
                  <h3>Total Submissions</h3>
                  <div className="stat-value">{stats.total_submissions}</div>
                </div>
                <div className="stat-card">
                  <h3>Average Word Count</h3>
                  <div className="stat-value">{stats.avg_word_count.toFixed(1)}</div>
                </div>
                <div className="stat-card">
                  <h3>Attention Fail Rate</h3>
                  <div className="stat-value">{(stats.attention_fail_rate * 100).toFixed(1)}%</div>
                </div>
                <div className="stat-card">
                  <h3>Completion Rate</h3>
                  <div className="stat-value">
                    {stats.total_submissions > 0 ? 
                      (((stats.total_submissions - (stats.attention_fail_rate * stats.total_submissions)) / stats.total_submissions) * 100).toFixed(1) + "%" 
                      : "N/A"}
                  </div>
                </div>
              </div>
            ) : (
              <div className="error-message">No statistics available</div>
            )}

            <div className="quick-actions">
              <h3>Quick Actions</h3>
              <div className="action-buttons">
                <button className="primary" onClick={downloadCsv}>Download CSV 📥</button>
                <button className="ghost" onClick={() => setActiveTab("data")}>View Data 👁️</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "data" && (
          <div className="data-explorer">
            <h2>Data Explorer 🔍</h2>
            <div className="data-controls">
              <div className="search-box">
                <input
                  type="text"
                  placeholder="Search all fields..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1); // Reset to first page when searching
                  }}
                />
              </div>
              <button className="primary" onClick={downloadCsv}>Export CSV 📥</button>
            </div>

            {loading ? (
              <div className="loading">Loading data...</div>
            ) : filteredData.length > 0 ? (
              <div className="data-table-container">
                <div className="data-table">
                  <div className="table-header">
                    {Object.keys(filteredData[0]).map((key) => (
                      <div key={key} className="table-cell header">{key}</div>
                    ))}
                  </div>
                  <div className="table-body">
                    {currentItems.map((row, index) => (
                      <div key={index} className="table-row">
                        {Object.values(row).map((value, i) => (
                          <div key={i} className="table-cell">
                            {String(value).substring(0, 50)}{String(value).length > 50 ? "..." : ""}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                {totalPages > 1 && (
                  <div className="pagination">
                    <button
                      onClick={() => paginate(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </button>
                    <span>
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </button>
                  </div>
                )}

                <div className="data-summary">
                  Showing {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredData.length)} of {filteredData.length} entries
                </div>
              </div>
            ) : (
              <div className="error-message">No data available</div>
            )}
          </div>
        )}

        {activeTab === "settings" && (
          <div className="settings">
            <h2>Admin Settings ⚙️</h2>
            <div className="settings-section">
              <h3>API Configuration</h3>
              <div className="form-group">
                <label>Current API Key</label>
                <input type="password" value="********" readOnly />
                <button className="ghost">Change API Key 🔑</button>
              </div>
            </div>

            <div className="settings-section">
              <h3>System Information</h3>
              <div className="system-info">
                <p><strong>Frontend Version:</strong> 1.0.0</p>
                <p><strong>Backend Status:</strong> <span className="status-online">Online ✅</span></p>
                <p><strong>Database Status:</strong> <span className="status-online">Connected ✅</span></p>
              </div>
            </div>

            <div className="settings-section">
              <h3>Danger Zone</h3>
              <div className="danger-zone">
                <button className="danger-button">Reset Database ⚠️</button>
                <p className="danger-note">This will permanently delete all data!</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}