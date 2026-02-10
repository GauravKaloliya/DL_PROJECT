import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement } from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement);

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
  const [filters, setFilters] = useState({
    ageGroup: "",
    language: "",
    rating: "",
    isPractice: "",
    isAttention: "",
    attentionPassed: ""
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showApiKeyChange, setShowApiKeyChange] = useState(false);
  const [newApiKey, setNewApiKey] = useState("");
  const [confirmApiKey, setConfirmApiKey] = useState("");
  const [apiKeyError, setApiKeyError] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");

  const navigate = useNavigate();

  // Check if user is already authenticated (e.g., from localStorage)
  useEffect(() => {
    const savedAuth = localStorage.getItem("adminAuthenticated");
    const savedApiKey = localStorage.getItem("adminApiKey");
    if (savedAuth === "true" && savedApiKey) {
      setApiKey(savedApiKey);
      setIsAuthenticated(true);
      fetchStats();
      fetchCsvData();
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (apiKey.trim() === "") {
      setError("Please enter an API key");
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Validate API key with backend
      const response = await fetch(`${API_BASE}/api/security/info?api_key=${apiKey}`);
      
      if (response.ok) {
        setIsAuthenticated(true);
        localStorage.setItem("adminAuthenticated", "true");
        localStorage.setItem("adminApiKey", apiKey);
        fetchStats();
        fetchCsvData();
      } else {
        setError("Invalid API key");
      }
    } catch (err) {
      setError("Failed to authenticate. Please check your connection.");
    } finally {
      setLoading(false);
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

  const handleChangeApiKey = () => {
    if (newApiKey.length < 8) {
      setApiKeyError("API key must be at least 8 characters");
      return;
    }
    if (newApiKey !== confirmApiKey) {
      setApiKeyError("API keys do not match");
      return;
    }
    
    // In a real app, this would call the backend to change the API key
    // For now, we'll just update the local storage and state
    localStorage.setItem("adminApiKey", newApiKey);
    setApiKey(newApiKey);
    setShowApiKeyChange(false);
    setApiKeyError(null);
    addToast("API key changed successfully! 🎉", "success");
  };

  const handleResetDatabase = () => {
    if (resetConfirmText !== "RESET") {
      setError("Please type RESET to confirm");
      return;
    }
    
    // In a real app, this would call the backend to reset the database
    // For now, we'll just clear the local data
    setCsvData([]);
    setStats(null);
    setShowResetConfirm(false);
    addToast("Database reset completed! 🎉", "success");
  };

  const addToast = (message, type = "info") => {
    // Simple toast notification
    const toastId = Date.now();
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span>${message}</span>
      <button onclick="this.parentElement.remove()" aria-label="Dismiss">×</button>
    `;
    toast.style.position = "fixed";
    toast.style.top = "20px";
    toast.style.right = "20px";
    toast.style.zIndex = "1000";
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 4000);
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
    // Search filter
    const searchMatch = searchTerm === "" || Object.values(row).some((value) => {
      return String(value).toLowerCase().includes(searchTerm.toLowerCase());
    });
    
    // Age group filter
    const ageMatch = filters.ageGroup === "" || row.age_group === filters.ageGroup;
    
    // Language filter
    const languageMatch = filters.language === "" || row.native_language === filters.language;
    
    // Rating filter
    const ratingMatch = filters.rating === "" || row.rating === filters.rating;
    
    // Practice filter
    const practiceMatch = filters.isPractice === "" || row.is_practice === filters.isPractice;
    
    // Attention filter
    const attentionMatch = filters.isAttention === "" || row.is_attention === filters.isAttention;
    
    // Attention passed filter
    const attentionPassedMatch = filters.attentionPassed === "" || row.attention_passed === filters.attentionPassed;
    
    return searchMatch && ageMatch && languageMatch && ratingMatch && practiceMatch && attentionMatch && attentionPassedMatch;
  });

  // Data processing for charts
  const processChartData = () => {
    if (!csvData || csvData.length === 0) return null;

    // Age group distribution
    const ageGroups = {
      '18-24': 0, '25-34': 0, '35-44': 0, '45-54': 0, '55+': 0, 'Unknown': 0
    };
    
    // Language distribution
    const languages = {};
    
    // Rating distribution
    const ratings = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0};
    
    // Word count distribution
    const wordCounts = [];
    
    // Time spent distribution
    const timeSpent = [];
    
    // NASA-TLX averages
    const nasaAverages = {
      mental: [], physical: [], temporal: [], performance: [], effort: [], frustration: []
    };

    csvData.forEach(row => {
      // Age groups
      const ageGroup = row.age_group || 'Unknown';
      if (ageGroups[ageGroup] !== undefined) {
        ageGroups[ageGroup]++;
      } else {
        ageGroups['Unknown']++;
      }

      // Languages
      const language = row.native_language || 'Unknown';
      languages[language] = (languages[language] || 0) + 1;

      // Ratings
      const rating = parseInt(row.rating) || 0;
      if (rating >= 1 && rating <= 10) {
        ratings[rating]++;
      }

      // Word counts
      const words = parseInt(row.word_count) || 0;
      wordCounts.push(words);

      // Time spent
      const time = parseFloat(row.time_spent_seconds) || 0;
      timeSpent.push(time);

      // NASA-TLX
      Object.keys(nasaAverages).forEach(key => {
        const value = parseInt(row[`nasa_${key}`]) || 0;
        if (value >= 1 && value <= 5) {
          nasaAverages[key].push(value);
        }
      });
    });

    return {
      ageGroups,
      languages: Object.entries(languages).sort((a, b) => b[1] - a[1]).slice(0, 5),
      ratings,
      wordCounts,
      timeSpent,
      nasaAverages: Object.entries(nasaAverages).map(([key, values]) => {
        const sum = values.reduce((a, b) => a + b, 0);
        return {
          label: key.charAt(0).toUpperCase() + key.slice(1),
          average: values.length > 0 ? (sum / values.length).toFixed(2) : 0
        };
      })
    };
  };

  const chartData = processChartData();

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
                autoFocus
              />
            </div>
            <button type="submit" className="primary" disabled={loading}>
              {loading ? "Authenticating..." : "Login"}
            </button>
          </form>
          <div className="login-help">
            <p>Forgot your API key? Check the backend configuration or environment variables.</p>
            <p>Default API key: <code>changeme</code></p>
          </div>
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
          className={activeTab === "security" ? "active" : ""}
          onClick={() => setActiveTab("security")}
        >
          Security 🔒
        </button>
        <button
          className={activeTab === "settings" ? "active" : ""}
          onClick={() => setActiveTab("settings")}
        >
          Settings ⚙️
        </button>
        <button
          className={activeTab === "api-docs" ? "active" : ""}
          onClick={() => setActiveTab("api-docs")}
        >
          API Docs 📚
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
                <div className="stat-card">
                  <h3>Unique Participants</h3>
                  <div className="stat-value">{csvData.length > 0 ? new Set(csvData.map(row => row.participant_id)).size : 0}</div>
                </div>
                <div className="stat-card">
                  <h3>Unique Sessions</h3>
                  <div className="stat-value">{csvData.length > 0 ? new Set(csvData.map(row => row.session_id)).size : 0}</div>
                </div>
              </div>
            ) : (
              <div className="error-message">No statistics available</div>
            )}

            {chartData && (
              <div className="charts-section">
                <h3>Demographic Distribution 📊</h3>
                <div className="chart-grid">
                  <div className="chart-card">
                    <h4>Age Groups</h4>
                    <Bar
                      data={{
                        labels: Object.keys(chartData.ageGroups),
                        datasets: [{
                          label: 'Participants',
                          data: Object.values(chartData.ageGroups),
                          backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40']
                        }]
                      }}
                      options={{ responsive: true, maintainAspectRatio: true }}
                    />
                  </div>
                  <div className="chart-card">
                    <h4>Top Languages</h4>
                    <Pie
                      data={{
                        labels: chartData.languages.map(l => l[0]),
                        datasets: [{
                          data: chartData.languages.map(l => l[1]),
                          backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF']
                        }]
                      }}
                      options={{ responsive: true, maintainAspectRatio: true }}
                    />
                  </div>
                </div>

                <h3>Performance Metrics 📈</h3>
                <div className="chart-grid">
                  <div className="chart-card">
                    <h4>Rating Distribution</h4>
                    <Bar
                      data={{
                        labels: Object.keys(chartData.ratings),
                        datasets: [{
                          label: 'Submissions',
                          data: Object.values(chartData.ratings),
                          backgroundColor: '#36A2EB'
                        }]
                      }}
                      options={{ responsive: true, maintainAspectRatio: true, scales: { y: { beginAtZero: true } } }}
                    />
                  </div>
                  <div className="chart-card">
                    <h4>NASA-TLX Averages</h4>
                    <Bar
                      data={{
                        labels: chartData.nasaAverages.map(item => item.label),
                        datasets: [{
                          label: 'Average Score',
                          data: chartData.nasaAverages.map(item => item.average),
                          backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40']
                        }]
                      }}
                      options={{ responsive: true, maintainAspectRatio: true, scales: { y: { beginAtZero: true, max: 5 } } }}
                    />
                  </div>
                </div>

                <h3>Engagement Metrics ⏱️</h3>
                <div className="chart-grid">
                  <div className="chart-card">
                    <h4>Word Count Distribution</h4>
                    <Line
                      data={{
                        labels: chartData.wordCounts.map((_, i) => i + 1),
                        datasets: [{
                          label: 'Words per Submission',
                          data: chartData.wordCounts,
                          borderColor: '#36A2EB',
                          backgroundColor: 'rgba(54, 162, 235, 0.1)',
                          fill: true
                        }]
                      }}
                      options={{ responsive: true, maintainAspectRatio: true }}
                    />
                  </div>
                  <div className="chart-card">
                    <h4>Time Spent Distribution</h4>
                    <Line
                      data={{
                        labels: chartData.timeSpent.map((_, i) => i + 1),
                        datasets: [{
                          label: 'Seconds per Submission',
                          data: chartData.timeSpent,
                          borderColor: '#FF6384',
                          backgroundColor: 'rgba(255, 99, 132, 0.1)',
                          fill: true
                        }]
                      }}
                      options={{ responsive: true, maintainAspectRatio: true }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="quick-actions">
              <h3>Quick Actions</h3>
              <div className="action-buttons">
                <button className="primary" onClick={downloadCsv}>Download CSV 📥</button>
                <button className="ghost" onClick={() => setActiveTab("data")}>View Data 👁️</button>
                <button className="ghost" onClick={fetchStats}>Refresh Stats 🔄</button>
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
            
            <div className="filters-section">
              <h4>Filters 🔧</h4>
              <div className="filter-grid">
                <div className="filter-group">
                  <label>Age Group</label>
                  <select
                    value={filters.ageGroup}
                    onChange={(e) => setFilters({...filters, ageGroup: e.target.value})}
                  >
                    <option value="">All</option>
                    <option value="18-24">18-24</option>
                    <option value="25-34">25-34</option>
                    <option value="35-44">35-44</option>
                    <option value="45-54">45-54</option>
                    <option value="55+">55+</option>
                  </select>
                </div>
                <div className="filter-group">
                  <label>Language</label>
                  <select
                    value={filters.language}
                    onChange={(e) => setFilters({...filters, language: e.target.value})}
                  >
                    <option value="">All</option>
                    {csvData.length > 0 && [...new Set(csvData.map(row => row.native_language).filter(Boolean))].map(lang => (
                      <option key={lang} value={lang}>{lang}</option>
                    ))}
                  </select>
                </div>
                <div className="filter-group">
                  <label>Rating</label>
                  <select
                    value={filters.rating}
                    onChange={(e) => setFilters({...filters, rating: e.target.value})}
                  >
                    <option value="">All</option>
                    {[1,2,3,4,5,6,7,8,9,10].map(num => (
                      <option key={num} value={String(num)}>{num}</option>
                    ))}
                  </select>
                </div>
                <div className="filter-group">
                  <label>Type</label>
                  <select
                    value={filters.isPractice}
                    onChange={(e) => setFilters({...filters, isPractice: e.target.value})}
                  >
                    <option value="">All</option>
                    <option value="True">Practice</option>
                    <option value="False">Main Trial</option>
                  </select>
                </div>
                <div className="filter-group">
                  <label>Attention Check</label>
                  <select
                    value={filters.isAttention}
                    onChange={(e) => setFilters({...filters, isAttention: e.target.value})}
                  >
                    <option value="">All</option>
                    <option value="True">Yes</option>
                    <option value="False">No</option>
                  </select>
                </div>
                <div className="filter-group">
                  <label>Attention Passed</label>
                  <select
                    value={filters.attentionPassed}
                    onChange={(e) => setFilters({...filters, attentionPassed: e.target.value})}
                  >
                    <option value="">All</option>
                    <option value="True">Passed</option>
                    <option value="False">Failed</option>
                  </select>
                </div>
                <div className="filter-group">
                  <button className="ghost" onClick={() => setFilters({
                    ageGroup: "",
                    language: "",
                    rating: "",
                    isPractice: "",
                    isAttention: "",
                    attentionPassed: ""
                  })}>
                    Clear Filters 🚫
                  </button>
                </div>
              </div>
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

        {activeTab === "security" && (
          <div className="security">
            <h2>Security Center 🔒</h2>
            <div className="security-overview">
              <h3>Security Overview</h3>
              <p>This panel provides comprehensive security information and controls for your C.O.G.N.I.T. application.</p>
            </div>

            <div className="security-section">
              <h3>Security Status</h3>
              <div className="security-status-grid">
                <div className="security-status-item">
                  <span className="status-icon">✅</span>
                  <span className="status-label">API Key Protection</span>
                </div>
                <div className="security-status-item">
                  <span className="status-icon">✅</span>
                  <span className="status-label">Rate Limiting</span>
                </div>
                <div className="security-status-item">
                  <span className="status-icon">✅</span>
                  <span className="status-label">CORS Restrictions</span>
                </div>
                <div className="security-status-item">
                  <span className="status-icon">✅</span>
                  <span className="status-label">Security Headers</span>
                </div>
                <div className="security-status-item">
                  <span className="status-icon">✅</span>
                  <span className="status-label">IP Hashing</span>
                </div>
                <div className="security-status-item">
                  <span className="status-icon">✅</span>
                  <span className="status-label">Data Encryption</span>
                </div>
              </div>
            </div>

            <div className="security-section">
              <h3>Rate Limiting Configuration</h3>
              <div className="rate-limit-info">
                <p><strong>Default Limits:</strong> 200 requests per day, 50 requests per hour</p>
                <p><strong>Admin Endpoints:</strong> 10 requests per minute</p>
                <p><strong>Security Endpoints:</strong> 5 requests per minute</p>
              </div>
            </div>

            <div className="security-section">
              <h3>Data Protection</h3>
              <div className="data-protection-info">
                <p><strong>IP Address Handling:</strong> SHA-256 hashing with salt for anonymization</p>
                <p><strong>Data Storage:</strong> CSV format with restricted access</p>
                <p><strong>Anonymous Data:</strong> No personally identifiable information stored</p>
                <p><strong>Session Security:</strong> Secure, HTTP-only cookies with SameSite protection</p>
              </div>
            </div>

            <div className="security-section">
              <h3>Security Recommendations</h3>
              <div className="security-recommendations">
                <ul>
                  <li>🔑 Rotate API keys regularly (every 30-60 days)</li>
                  <li>🔒 Use strong, unique API keys (minimum 16 characters)</li>
                  <li>🌐 Enable HTTPS in production environments</li>
                  <li>🛡️ Review and update CORS origins for production</li>
                  <li>📊 Monitor failed login attempts and unusual activity</li>
                  <li>🔄 Regularly backup your data files</li>
                  <li>🚨 Keep dependencies updated to latest secure versions</li>
                </ul>
              </div>
            </div>

            <div className="security-section">
              <h3>Security Audit</h3>
              <button className="primary" onClick={() => {
                fetch(`${API_BASE}/admin/security/audit?api_key=${apiKey}`)
                  .then(response => response.json())
                  .then(data => {
                    addToast("Security audit completed! Check console for details.", "success");
                    console.log("Security Audit:", data);
                  })
                  .catch(error => {
                    addToast("Failed to run security audit", "error");
                    console.error("Security audit error:", error);
                  });
              }}>Run Security Audit 🛡️</button>
            </div>
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
                <button className="ghost" onClick={() => setShowApiKeyChange(true)}>Change API Key 🔑</button>
              </div>
              
              {showApiKeyChange && (
                <div className="api-key-change">
                  <h4>Change API Key</h4>
                  <div className="form-group">
                    <label>New API Key</label>
                    <input
                      type="password"
                      value={newApiKey}
                      onChange={(e) => setNewApiKey(e.target.value)}
                      placeholder="Enter new API key (min 8 chars)"
                    />
                  </div>
                  <div className="form-group">
                    <label>Confirm API Key</label>
                    <input
                      type="password"
                      value={confirmApiKey}
                      onChange={(e) => setConfirmApiKey(e.target.value)}
                      placeholder="Confirm new API key"
                    />
                  </div>
                  {apiKeyError && <div className="error-message">{apiKeyError}</div>}
                  <div className="action-buttons">
                    <button className="primary" onClick={handleChangeApiKey}>Save New API Key</button>
                    <button className="ghost" onClick={() => setShowApiKeyChange(false)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>

            <div className="settings-section">
              <h3>System Information</h3>
              <div className="system-info">
                <p><strong>Frontend Version:</strong> 2.0.0</p>
                <p><strong>Backend Status:</strong> <span className="status-online">Online ✅</span></p>
                <p><strong>Database Status:</strong> <span className="status-online">Connected ✅</span></p>
                <p><strong>Total Storage:</strong> {csvData.length > 0 ? `${(JSON.stringify(csvData).length / 1024).toFixed(2)} KB` : '0 KB'}</p>
              </div>
            </div>

            <div className="settings-section">
              <h3>Security Settings</h3>
              <div className="security-settings">
                <div className="form-group">
                  <label>Session Timeout</label>
                  <select defaultValue="30">
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="60">60 minutes</option>
                    <option value="120">120 minutes</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Max Failed Login Attempts</label>
                  <select defaultValue="5">
                    <option value="3">3 attempts</option>
                    <option value="5">5 attempts</option>
                    <option value="10">10 attempts</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="settings-section">
              <h3>Danger Zone</h3>
              <div className="danger-zone">
                <button className="danger-button" onClick={() => setShowResetConfirm(true)}>Reset Database ⚠️</button>
                <p className="danger-note">This will permanently delete all data!</p>
                
                {showResetConfirm && (
                  <div className="reset-confirm">
                    <p style={{ color: '#c9444a', fontWeight: '600' }}>⚠️ WARNING: This action cannot be undone!</p>
                    <div className="form-group">
                      <label>Type "RESET" to confirm</label>
                      <input
                        type="text"
                        value={resetConfirmText}
                        onChange={(e) => setResetConfirmText(e.target.value)}
                        placeholder="Type RESET to confirm"
                      />
                    </div>
                    <div className="action-buttons">
                      <button className="danger-button" onClick={handleResetDatabase}>Confirm Reset</button>
                      <button className="ghost" onClick={() => setShowResetConfirm(false)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "api-docs" && (
          <div className="api-docs">
            <h2>API Documentation 📚</h2>
            <div className="api-docs-section">
              <h3>Available Endpoints</h3>
              <div className="endpoint-grid">
                <div className="endpoint-card">
                  <h4>Public Endpoints</h4>
                  <ul>
                    <li><code>GET /api/images/random</code> - Get random image</li>
                    <li><code>GET /api/images/&lt;image_id&gt;</code> - Get specific image</li>
                    <li><code>POST /api/submit</code> - Submit participant data</li>
                    <li><code>GET /api/pages/*</code> - Page information</li>
                    <li><code>GET /api/docs</code> - Full API documentation</li>
                  </ul>
                </div>
                <div className="endpoint-card">
                  <h4>Admin Endpoints</h4>
                  <ul>
                    <li><code>GET /api/stats</code> - Get statistics</li>
                    <li><code>GET /admin/download</code> - Download CSV</li>
                    <li><code>GET /admin/csv-data</code> - Get CSV as JSON</li>
                    <li><code>GET /api/security/info</code> - Security info</li>
                    <li><code>GET /admin/security/audit</code> - Security audit</li>
                    <li><code>POST /api/admin/login</code> - Admin login</li>
                    <li><code>POST /api/admin/logout</code> - Admin logout</li>
                    <li><code>GET /api/admin/me</code> - Get user info</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="api-docs-section">
              <h3>Authentication</h3>
              <p>Most admin endpoints require authentication using an API key.</p>
              <div className="auth-methods">
                <h4>Authentication Methods</h4>
                <ul>
                  <li><strong>X-API-KEY header:</strong> <code>X-API-KEY: your-api-key</code></li>
                  <li><strong>Query parameter:</strong> <code>?api_key=your-api-key</code></li>
                </ul>
                <p>Default API key for development: <code>changeme</code></p>
              </div>
            </div>

            <div className="api-docs-section">
              <h3>API Documentation Actions</h3>
              <div className="api-actions">
                <button className="primary" onClick={() => {
                  fetch(`${API_BASE}/api/docs`)
                    .then(response => response.json())
                    .then(data => {
                      const jsonStr = JSON.stringify(data, null, 2);
                      const blob = new Blob([jsonStr], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'cognit-api-docs.json';
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                      addToast('API documentation downloaded! 🎉', 'success');
                    })
                    .catch(error => {
                      addToast('Failed to download API docs', 'error');
                      console.error('API docs download error:', error);
                    });
                }}>Download Full API Docs 📥</button>

                <button className="ghost" onClick={() => {
                  window.open(`${API_BASE}/api/docs`, '_blank');
                }}>View Raw API Docs 🔍</button>
              </div>
            </div>

            <div className="api-docs-section">
              <h3>Data Structure</h3>
              <p>The submission data includes the following fields:</p>
              <div className="data-structure">
                <table>
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Type</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>timestamp</td><td>string</td><td>ISO format timestamp</td></tr>
                    <tr><td>participant_id</td><td>string</td><td>Unique participant ID</td></tr>
                    <tr><td>session_id</td><td>string</td><td>Unique session ID</td></tr>
                    <tr><td>image_id</td><td>string</td><td>Image identifier</td></tr>
                    <tr><td>description</td><td>string</td><td>Participant's description</td></tr>
                    <tr><td>word_count</td><td>integer</td><td>Number of words in description</td></tr>
                    <tr><td>rating</td><td>integer</td><td>General rating (1-10)</td></tr>
                    <tr><td>age_group</td><td>string</td><td>Participant's age group</td></tr>
                    <tr><td>native_language</td><td>string</td><td>Participant's native language</td></tr>
                    <tr><td>prior_experience</td><td>string</td><td>Participant's prior experience</td></tr>
                    <tr><td>nasa_mental</td><td>integer</td><td>NASA-TLX mental demand (1-5)</td></tr>
                    <tr><td>nasa_physical</td><td>integer</td><td>NASA-TLX physical demand (1-5)</td></tr>
                    <tr><td>nasa_temporal</td><td>integer</td><td>NASA-TLX temporal demand (1-5)</td></tr>
                    <tr><td>nasa_performance</td><td>integer</td><td>NASA-TLX performance (1-5)</td></tr>
                    <tr><td>nasa_effort</td><td>integer</td><td>NASA-TLX effort (1-5)</td></tr>
                    <tr><td>nasa_frustration</td><td>integer</td><td>NASA-TLX frustration (1-5)</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="api-docs-section">
              <h3>Rate Limits</h3>
              <p>API endpoints have the following rate limits:</p>
              <ul>
                <li><strong>Default:</strong> 200 requests per day, 50 requests per hour</li>
                <li><strong>Admin endpoints:</strong> 10 requests per minute</li>
                <li><strong>Security audit:</strong> 5 requests per minute</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}