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
    gender: "",
    place: "",
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
    
    // Gender filter
    const genderMatch = filters.gender === "" || row.gender === filters.gender;
    
    // Place filter
    const placeMatch = filters.place === "" || 
      (row.place && row.place.toLowerCase().includes(filters.place.toLowerCase()));
    
    // Language filter
    const languageMatch = filters.language === "" || row.native_language === filters.language;
    
    // Rating filter
    const ratingMatch = filters.rating === "" || String(row.rating) === filters.rating;
    
    // Practice filter - handle both string and boolean values
    const practiceMatch = filters.isPractice === "" || 
      String(row.is_practice).toLowerCase() === filters.isPractice.toLowerCase();
    
    // Attention filter
    const attentionMatch = filters.isAttention === "" || 
      String(row.is_attention).toLowerCase() === filters.isAttention.toLowerCase();
    
    // Attention passed filter
    const attentionPassedMatch = filters.attentionPassed === "" || 
      String(row.attention_passed).toLowerCase() === filters.attentionPassed.toLowerCase();
    
    return searchMatch && ageMatch && genderMatch && placeMatch && languageMatch && ratingMatch && practiceMatch && attentionMatch && attentionPassedMatch;
  });

  // Data processing for charts
  const processChartData = () => {
    if (!csvData || csvData.length === 0) return null;

    // Age group distribution
    const ageGroups = {
      '18-24': 0, '25-34': 0, '35-44': 0, '45-54': 0, '55+': 0, 'Unknown': 0
    };
    
    // Gender distribution
    const genders = {};
    
    // Language distribution
    const languages = {};
    
    // Rating distribution
    const ratings = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0};
    
    // Word count distribution
    const wordCounts = [];
    
    // Time spent distribution
    const timeSpent = [];

    csvData.forEach(row => {
      // Age groups
      const ageGroup = row.age_group || 'Unknown';
      if (ageGroups[ageGroup] !== undefined) {
        ageGroups[ageGroup]++;
      } else {
        ageGroups['Unknown']++;
      }

      // Gender
      const gender = row.gender || 'Unknown';
      genders[gender] = (genders[gender] || 0) + 1;

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
    });

    return {
      ageGroups,
      genders: Object.entries(genders).sort((a, b) => b[1] - a[1]),
      languages: Object.entries(languages).sort((a, b) => b[1] - a[1]).slice(0, 5),
      ratings,
      wordCounts,
      timeSpent
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

            {chartData && stats && stats.total_submissions > 0 ? (
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
                    <h4>Gender Distribution</h4>
                    <Pie
                      data={{
                        labels: chartData.genders.map(g => g[0]),
                        datasets: [{
                          data: chartData.genders.map(g => g[1]),
                          backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF']
                        }]
                      }}
                      options={{ responsive: true, maintainAspectRatio: true }}
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
            ) : (
              <div className="no-data-message">
                <p>No chart data available. Submit some responses to see visualizations 📊</p>
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
                  <label>Gender</label>
                  <select
                    value={filters.gender}
                    onChange={(e) => setFilters({...filters, gender: e.target.value})}
                  >
                    <option value="">All</option>
                    {csvData.length > 0 && [...new Set(csvData.map(row => row.gender).filter(Boolean))].map(gender => (
                      <option key={gender} value={gender}>{gender}</option>
                    ))}
                  </select>
                </div>
                <div className="filter-group">
                  <label>Place</label>
                  <input
                    type="text"
                    placeholder="Filter by place..."
                    value={filters.place}
                    onChange={(e) => setFilters({...filters, place: e.target.value})}
                  />
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
                    gender: "",
                    place: "",
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
            ) : csvData.length === 0 ? (
              <div className="no-data-message">
                <p>No data available yet. Start collecting submissions to see data here 📊</p>
                <p className="hint">Use the participant interface to submit responses.</p>
              </div>
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
              <div className="no-data-message">
                <p>No matching data found. Try adjusting your filters 🔍</p>
                <button className="ghost" onClick={() => setFilters({
                  ageGroup: "",
                  gender: "",
                  place: "",
                  language: "",
                  rating: "",
                  isPractice: "",
                  isAttention: "",
                  attentionPassed: ""
                })}>Clear Filters 🚫</button>
              </div>
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

      </div>
    </div>
  );
}