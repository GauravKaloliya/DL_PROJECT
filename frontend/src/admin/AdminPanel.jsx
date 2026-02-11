import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";

// Settings Tab Component
function SettingsTab({ sessionToken, csvData = [], onDataDeleted, onToast }) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  
  const handleDeleteCSV = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    setDeleteSuccess(false);
    
    try {
      const response = await fetch(`${API_BASE}/admin/settings/csv-delete`, {
        method: 'DELETE',
        headers: { 'X-SESSION-TOKEN': sessionToken }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setDeleteSuccess(true);
        setShowConfirmDelete(false);
        onDataDeleted();
        onToast("All CSV data has been deleted successfully", "success");
      } else {
        setDeleteError(data.error || "Failed to delete CSV data");
        onToast(data.error || "Failed to delete CSV data", "error");
      }
    } catch (err) {
      setDeleteError("Network error. Please try again.");
      onToast("Network error. Please try again.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="settings">
      <h2>Settings</h2>
      
      {/* Data Management Section */}
      <div className="settings-section">
        <h3>Data Management</h3>
        <p style={{ color: 'var(--muted)', marginBottom: '20px' }}>
          Manage your research data. Export or delete submissions as needed.
        </p>
        
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
          <div style={{ 
            background: 'var(--panel)', 
            border: '2px solid var(--border)', 
            borderRadius: '12px', 
            padding: '20px',
            flex: '1',
            minWidth: '250px'
          }}>
            <h4 style={{ marginTop: 0, color: 'var(--primary)' }}>Current Data</h4>
            <p style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text)', margin: '8px 0' }}>
              {csvData.length} submissions
            </p>
            <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
              Total records in the database
            </p>
          </div>
        </div>

        {/* Delete Data Section */}
        <div className="danger-zone">
          <h4 style={{ marginTop: 0, color: '#c9444a' }}>⚠️ Danger Zone</h4>
          <p style={{ color: 'var(--muted)', marginBottom: '16px' }}>
            Deleting data is permanent and cannot be undone. All submissions will be removed from the CSV file.
          </p>
          
          {!showConfirmDelete ? (
            <button 
              className="danger-button"
              onClick={() => setShowConfirmDelete(true)}
              disabled={csvData.length === 0}
            >
              Delete All CSV Data
            </button>
          ) : (
            <div className="reset-confirm">
              <p style={{ marginTop: 0, fontWeight: '600', color: '#c9444a' }}>
                Are you sure? This action cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  className="danger-button"
                  onClick={handleDeleteCSV}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Yes, Delete All Data"}
                </button>
                <button 
                  className="ghost"
                  onClick={() => setShowConfirmDelete(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          
          {deleteError && (
            <p style={{ color: '#c9444a', marginTop: '12px' }}>{deleteError}</p>
          )}
        </div>
      </div>
      
      {/* System Information Section */}
      <div className="settings-section">
        <h3>System Information</h3>
        <div className="system-info">
          <p><strong>API Version:</strong> 2.0.0</p>
          <p><strong>Database:</strong> SQLite + CSV</p>
          <p><strong>Status:</strong> <span className="status-online">Online</span></p>
        </div>
      </div>
      
      {deleteSuccess && (
        <div className="toast success" style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 1000 }}>
          <span>All CSV data has been deleted successfully</span>
          <button onClick={() => setDeleteSuccess(false)} aria-label="Dismiss">×</button>
        </div>
      )}
    </div>
  );
}

const API_BASE = import.meta.env.VITE_API_BASE || "";

// Allow copy/paste only in input fields
const preventCopyPaste = (e) => {
  const target = e.target;
  const isInputField = target.tagName === 'INPUT' || 
                       target.tagName === 'TEXTAREA' || 
                       target.contentEditable === 'true' ||
                       target.closest('input') ||
                       target.closest('textarea') ||
                       target.closest('[contenteditable="true"]');
  
  // Allow copy/paste only in input fields
  if (!isInputField) {
    e.preventDefault();
    return false;
  }
};

export default function AdminPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionToken, setSessionToken] = useState("");
  const [user, setUser] = useState(null);
  
  // Login form state
  const [loginUsername, setLoginUsername] = useState("Gaurav");
  const [loginPassword, setLoginPassword] = useState("");
  
  // Data state
  const [stats, setStats] = useState(() => {
    const saved = sessionStorage.getItem("adminStats");
    return saved ? JSON.parse(saved) : null;
  });
  const [csvData, setCsvData] = useState(() => {
    const saved = sessionStorage.getItem("adminCsvData");
    return saved ? JSON.parse(saved) : [];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(() => {
    return sessionStorage.getItem("adminActiveTab") || "dashboard";
  });
  
  // Data analysis state
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("timestamp");
  const [sortDirection, setSortDirection] = useState("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [dataLoaded, setDataLoaded] = useState(false);
  
  // Toast notification state
  const [toasts, setToasts] = useState([]);
  
  // Toast notification helper
  const addToast = useCallback((message, type = "info") => {
    const id = Date.now() + Math.random();
    const newToast = { id, message, type };
    setToasts(prev => [...prev, newToast]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);
  
  // Check for existing session on mount
  useEffect(() => {
    const savedSession = sessionStorage.getItem("adminSessionToken");
    const savedUser = sessionStorage.getItem("adminUser");
    
    if (savedSession) {
      setSessionToken(savedSession);
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
      setIsAuthenticated(true);
    }
  }, []);
  
  // Fetch data when authenticated
  useEffect(() => {
    if (isAuthenticated && sessionToken && !dataLoaded) {
      fetchStats();
      fetchCsvData();
      setDataLoaded(true);
    }
  }, [isAuthenticated, sessionToken, dataLoaded]);

  // Fetch data when switching to data analysis tab
  useEffect(() => {
    if (isAuthenticated && sessionToken && activeTab === "data") {
      fetchCsvData();
    }
  }, [activeTab, isAuthenticated, sessionToken]);

  // Persist stats, csvData and activeTab
  useEffect(() => {
    if (stats) {
      sessionStorage.setItem("adminStats", JSON.stringify(stats));
    }
  }, [stats]);

  useEffect(() => {
    // Always save csvData to sessionStorage, even if empty
    sessionStorage.setItem("adminCsvData", JSON.stringify(csvData));
  }, [csvData]);

  useEffect(() => {
    sessionStorage.setItem("adminActiveTab", activeTab);
  }, [activeTab]);
  
  // Prevent copy/paste on the entire component
  useEffect(() => {
    const handleCopy = (e) => preventCopyPaste(e);
    const handlePaste = (e) => preventCopyPaste(e);
    const handleCut = (e) => preventCopyPaste(e);
    
    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", handlePaste);
    document.addEventListener("cut", handleCut);
    
    return () => {
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("cut", handleCut);
    };
  }, []);
  
  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/stats`, {
        headers: { 'X-SESSION-TOKEN': sessionToken }
      });
      if (!response.ok) {
        if (response.status === 401) {
          handleLogout();
          throw new Error("Session expired. Please login again.");
        }
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
      const response = await fetch(`${API_BASE}/admin/csv-data`, {
        headers: { 'X-SESSION-TOKEN': sessionToken }
      });
      if (!response.ok) {
        if (response.status === 401) {
          handleLogout();
          throw new Error("Session expired. Please login again.");
        }
        throw new Error("Failed to fetch CSV data");
      }
      const data = await response.json();
      setCsvData(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
      setCsvData([]);
    } finally {
      setLoading(false);
    }
  };
  
  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setError("Username and password are required");
      return;
    }
    
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSessionToken(data.session_token);
        setUser(data.user);
        setIsAuthenticated(true);
        setLoginPassword(""); // Clear password field
        
        // Store in sessionStorage
        sessionStorage.setItem("adminSessionToken", data.session_token);
        sessionStorage.setItem("adminUser", JSON.stringify(data.user));
        
        addToast("Login successful!", "success");
      } else {
        setError(data.error || "Invalid credentials");
      }
    } catch (err) {
      setError("Failed to login. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  // Registration functionality removed
  
  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/api/admin/logout`, {
        method: "POST",
        headers: { "X-SESSION-TOKEN": sessionToken }
      });
    } catch (err) {
      console.error("Logout error:", err);
    }

    // Clear session
    sessionStorage.removeItem("adminSessionToken");
    sessionStorage.removeItem("adminUser");
    sessionStorage.removeItem("adminStats");
    sessionStorage.removeItem("adminCsvData");
    sessionStorage.removeItem("adminActiveTab");

    // Clear all state
    setIsAuthenticated(false);
    setSessionToken("");
    setUser(null);
    setStats(null);
    setCsvData([]);
    setError(null);
    setLoading(false);
    setDataLoaded(false);
    navigate("/admin");
  };
  
  const downloadCsv = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/download`, {
        headers: { 'X-SESSION-TOKEN': sessionToken }
      });
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
      addToast(err.message, "error");
    }
  };

  // Filter and sort data
  const processedData = useCallback(() => {
    let data = [...csvData];
    
    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      data = data.filter(row => 
        Object.values(row).some(value => 
          String(value).toLowerCase().includes(term)
        )
      );
    }
    
    // Sort
    data.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      // Handle numeric sorting
      if (!isNaN(parseFloat(aVal)) && !isNaN(parseFloat(bVal))) {
        aVal = parseFloat(aVal);
        bVal = parseFloat(bVal);
      } else {
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
      }
      
      if (sortDirection === "asc") {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
    
    return data;
  }, [csvData, searchTerm, sortField, sortDirection]);
  
  const filteredData = processedData();
  
  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  
  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  
  // Get column headers for table (excluding certain fields)
  const getTableHeaders = () => {
    if (csvData.length === 0) return [];
    const excludedFields = ['username', 'gender', 'place', 'native_language', 'rating', 'is_survey', 'is_attention', 'attention_passed'];
    return Object.keys(csvData[0]).filter(key => !excludedFields.includes(key));
  };
  
  // Render login form
  if (!isAuthenticated) {
    return (
      <div className="admin-login" onCopy={preventCopyPaste} onPaste={preventCopyPaste}>
        <div className="login-panel">
          <div className="login-header">
            <h1>Admin Login</h1>
            <p>Enter your username and password to access the admin panel</p>
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <form onSubmit={handleLogin} className="auth-form">
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="Enter your username"
                autoFocus
                onCopy={preventCopyPaste}
                onPaste={preventCopyPaste}
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter your password"
                onCopy={preventCopyPaste}
                onPaste={preventCopyPaste}
              />
            </div>
            <button type="submit" className="primary" disabled={loading}>
              {loading ? "Authenticating..." : "Login"}
            </button>
          </form>

          <div className="auth-switch">
            <button className="ghost" onClick={() => navigate('/')}>
              Back to Home
            </button>
          </div>
          <div className="branding-footer" style={{ textAlign: 'center', marginTop: '8px', color: 'var(--muted)', fontSize: '14px' }}>
              Created by Gaurav Kaloliya
          </div>
          <div className="branding-header" style={{ textAlign: 'center', marginTop: '8px', color: 'var(--muted)', fontSize: '14px' }}>
            <strong>Gaurav Kaloliya</strong> - Founder of C.O.G.N.I.T. 
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="admin-panel" onCopy={preventCopyPaste} onPaste={preventCopyPaste}>
      <div className="admin-header">
        <div>
          <h1>Admin Panel</h1>
          {user && <p className="user-info">Welcome, {user.username}</p>}
        </div>
        <div className="admin-actions">
          <button className="ghost" onClick={() => navigate('/api/docs')}>API Docs</button>
          <button className="ghost" onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <div className="admin-tabs">
        <button
          className={activeTab === "dashboard" ? "active" : ""}
          onClick={() => setActiveTab("dashboard")}
        >
          Dashboard
        </button>
        <button
          className={activeTab === "data" ? "active" : ""}
          onClick={() => setActiveTab("data")}
        >
          Data Analysis
        </button>
        <button
          className={activeTab === "settings" ? "active" : ""}
          onClick={() => setActiveTab("settings")}
        >
          Settings
        </button>
      </div>

      <div className="admin-content">
        {activeTab === "dashboard" && (
          <div className="dashboard">
            <div className="quick-actions">
              <h2>Statistics Overview</h2>
              <div className="action-buttons">
                <button className="primary" onClick={downloadCsv}>Download CSV</button>
                <button className="ghost refresh-btn" onClick={fetchStats} title="Refresh Stats">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <polyline points="1 20 1 14 7 14"></polyline>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                  </svg>
                </button>
              </div>
            </div>
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
          </div>
        )}

        {activeTab === "data" && (
          <div className="data-analysis">
            <h2>Data Analysis</h2>
            
            <div className="data-controls">
              <div className="search-box">
                <input
                  type="text"
                  placeholder="Search all fields..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
                {searchTerm && (
                  <button 
                    className="clear-search"
                    onClick={() => {
                      setSearchTerm("");
                      setCurrentPage(1);
                    }}
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="primary" onClick={downloadCsv}>Export CSV</button>
              </div>
            </div>
            
            <div className="sort-controls">
              <label>Sort by:</label>
              <select value={sortField} onChange={(e) => setSortField(e.target.value)}>
                <option value="timestamp">Timestamp</option>
                <option value="participant_id">Participant ID</option>
                <option value="word_count">Word Count</option>
                <option value="time_spent_seconds">Time Spent</option>
              </select>
              <button 
                className="ghost sort-btn" 
                onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
              >
                {sortDirection === "asc" ? "Ascending" : "Descending"}
              </button>
            </div>

            {loading ? (
              <div className="loading">Loading data...</div>
            ) : csvData.length === 0 ? (
              <div className="no-data-message">
                <p>No data available yet. Start collecting submissions to see data here.</p>
                <p className="hint">Use the participant interface to submit responses.</p>
              </div>
            ) : filteredData.length > 0 ? (
              <div className="data-table-wrapper">
                <div className="modern-table-container">
                  <table className="modern-data-table">
                    <thead>
                      <tr>
                        {getTableHeaders().map((key) => (
                          <th key={key}>
                            <div className="th-content" title={key}>
                              {key.replace(/_/g, ' ').toUpperCase()}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {currentItems.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {getTableHeaders().map((key, colIndex) => {
                            const value = row[key] ?? '';
                            const displayValue = String(value);
                            return (
                              <td key={colIndex}>
                                <div className="td-content" title={displayValue}>
                                  {displayValue}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="pagination-modern">
                    <button
                      className="pagination-btn"
                      onClick={() => paginate(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                    >
                      ← Previous
                    </button>
                    <div className="pagination-info">
                      <span className="page-number">{currentPage}</span>
                      <span className="page-separator">/</span>
                      <span className="page-total">{totalPages}</span>
                    </div>
                    <button
                      className="pagination-btn"
                      onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next →
                    </button>
                  </div>
                )}

                <div className="data-summary-modern">
                  Showing <strong>{indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredData.length)}</strong> of <strong>{filteredData.length}</strong> entries
                </div>
              </div>
            ) : (
              <div className="no-data-message">
                <p>No matching data found. Try adjusting your search.</p>
                <button className="ghost" onClick={() => { setSearchTerm(""); setCurrentPage(1); }}>Clear Search</button>
              </div>
            )}
          </div>
        )}

        {activeTab === "settings" && (
          <SettingsTab 
            sessionToken={sessionToken} 
            csvData={csvData}
            onDataDeleted={() => {
              setCsvData([]);
              fetchStats().then(() => {
                fetchCsvData();
              });
            }}
            onToast={addToast}
          />
        )}
      </div>
      <div className="branding-footer" style={{ textAlign: 'center', marginTop: '8px', color: 'var(--muted)', fontSize: '14px' }}>
          Created by Gaurav Kaloliya
      </div>
      <div className="branding-header" style={{ textAlign: 'center', marginTop: '8px', color: 'var(--muted)', fontSize: '14px' }}>
        <strong>Gaurav Kaloliya</strong> - Founder of C.O.G.N.I.T. 
      </div>
      
      {/* Toast notifications */}
      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map(toast => (
            <div key={toast.id} className={`toast ${toast.type}`}>
              <span>{toast.message}</span>
              <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} aria-label="Dismiss">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
