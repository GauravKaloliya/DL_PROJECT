import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement } from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement);

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

// Simple toast notification helper
const addToast = (message, type = "info") => {
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

export default function AdminPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Auth state
  const [authMode, setAuthMode] = useState("login"); // "login", "register", "verify"
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionToken, setSessionToken] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [user, setUser] = useState(null);
  
  // Login form state
  const [loginUsername, setLoginUsername] = useState("");
  const [loginApiKey, setLoginApiKey] = useState("");
  
  // Register form state
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  
  // Verification state
  const [verifyToken, setVerifyToken] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  
  // Data state
  const [stats, setStats] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  
  // Data explorer state
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("timestamp");
  const [sortDirection, setSortDirection] = useState("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  // Check for existing session on mount
  useEffect(() => {
    const savedSession = sessionStorage.getItem("adminSessionToken");
    const savedApiKey = sessionStorage.getItem("adminApiKey");
    const savedUser = sessionStorage.getItem("adminUser");
    
    if (savedSession && savedApiKey) {
      setSessionToken(savedSession);
      setApiKey(savedApiKey);
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
      setIsAuthenticated(true);
    }
    
    // Check for verification token in URL
    const params = new URLSearchParams(location.search);
    const token = params.get("token");
    if (token) {
      setVerifyToken(token);
      setAuthMode("verify");
    }
  }, [location]);
  
  // Fetch data when authenticated
  useEffect(() => {
    if (isAuthenticated && apiKey) {
      fetchStats();
      fetchCsvData();
    }
  }, [isAuthenticated, apiKey]);
  
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
  
  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (!loginUsername.trim() || !loginApiKey.trim()) {
      setError("Username and API key are required");
      return;
    }
    
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUsername, api_key: loginApiKey })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSessionToken(data.session_token);
        setApiKey(data.api_key);
        setUser(data.user);
        setIsAuthenticated(true);
        
        // Store in sessionStorage
        sessionStorage.setItem("adminSessionToken", data.session_token);
        sessionStorage.setItem("adminApiKey", data.api_key);
        sessionStorage.setItem("adminUser", JSON.stringify(data.user));
        
        addToast("Login successful!", "success");
      } else {
        if (data.needs_verification) {
          setPendingEmail(data.email || "");
          setAuthMode("verify");
          setError("Please verify your email before logging in");
        } else {
          setError(data.error || "Invalid credentials");
        }
      }
    } catch (err) {
      setError("Failed to login. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleJsonFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setError('Please select a JSON file');
      return;
    }

    try {
      setLoading(true);
      const text = await file.text();
      const credentials = JSON.parse(text);

      if (!credentials.username || !credentials.api_key) {
        setError('JSON file must contain "username" and "api_key" fields');
        return;
      }

      // Set the credentials and attempt login
      setLoginUsername(credentials.username);
      setLoginApiKey(credentials.api_key);

      // Automatically trigger login with the loaded credentials
      const response = await fetch(`${API_BASE}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          username: credentials.username, 
          api_key: credentials.api_key 
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSessionToken(data.session_token);
        setApiKey(data.api_key);
        setUser(data.user);
        setIsAuthenticated(true);

        // Store in sessionStorage
        sessionStorage.setItem("adminSessionToken", data.session_token);
        sessionStorage.setItem("adminApiKey", data.api_key);
        sessionStorage.setItem("adminUser", JSON.stringify(data.user));

        addToast("Login successful with loaded credentials!", "success");
      } else {
        if (data.needs_verification) {
          setPendingEmail(data.email || "");
          setAuthMode("verify");
          setError("Please verify your email before logging in");
        } else {
          setError(data.error || "Invalid credentials from JSON file");
        }
      }
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON file format');
      } else {
        setError('Failed to process JSON file: ' + err.message);
      }
    } finally {
      setLoading(false);
      // Reset the file input
      event.target.value = '';
    }
  };
  
  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);
    
    // Validation
    if (!regUsername.trim() || regUsername.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }
    if (!regEmail.trim() || !regEmail.includes("@")) {
      setError("Valid email is required");
      return;
    }
    if (!regPassword || regPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/admin/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: regUsername,
          email: regEmail,
          password: regPassword
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Download API key as JSON file
        const apiKeyData = {
          username: data.username,
          api_key: data.api_key,
          created_at: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(apiKeyData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `API_KEY_${data.username}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        setPendingEmail(regEmail);
        setAuthMode("verify");
        addToast("Registration successful! Please check your email to verify your account.", "success");
      } else {
        setError(data.error || "Registration failed");
      }
    } catch (err) {
      setError("Failed to register. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };
  
  const handleVerify = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (!verifyToken.trim()) {
      setError("Verification token is required");
      return;
    }
    
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/admin/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: verifyToken })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setApiKey(data.api_key);
        setAuthMode("login");
        addToast("Email verified! You can now login.", "success");
      } else {
        setError(data.error || "Verification failed");
      }
    } catch (err) {
      setError("Failed to verify email. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };
  
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
    sessionStorage.removeItem("adminApiKey");
    sessionStorage.removeItem("adminUser");
    
    setIsAuthenticated(false);
    setSessionToken("");
    setApiKey("");
    setUser(null);
    setStats(null);
    setCsvData([]);
    navigate("/admin");
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
  
  // Data processing for charts
  const processChartData = () => {
    if (!csvData || csvData.length === 0) return null;
    
    // Age group distribution
    const ageGroups = { '18-24': 0, '25-34': 0, '35-44': 0, '45-54': 0, '55+': 0, 'Unknown': 0 };
    const genders = {};
    const languages = {};
    const ratings = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0};
    const wordCounts = [];
    const timeSpent = [];
    
    csvData.forEach(row => {
      const ageGroup = row.age_group || 'Unknown';
      if (ageGroups[ageGroup] !== undefined) {
        ageGroups[ageGroup]++;
      } else {
        ageGroups['Unknown']++;
      }
      
      const gender = row.gender || 'Unknown';
      genders[gender] = (genders[gender] || 0) + 1;
      
      const language = row.native_language || 'Unknown';
      languages[language] = (languages[language] || 0) + 1;
      
      const rating = parseInt(row.rating) || 0;
      if (rating >= 1 && rating <= 10) {
        ratings[rating]++;
      }
      
      const words = parseInt(row.word_count) || 0;
      wordCounts.push(words);
      
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
  
  // Get column headers for table (excluding certain fields)
  const getTableHeaders = () => {
    if (csvData.length === 0) return [];
    const excludedFields = ['age_group', 'gender', 'place', 'native_language', 'rating', 'is_practice', 'is_attention', 'attention_passed'];
    return Object.keys(csvData[0]).filter(key => !excludedFields.includes(key));
  };
  
  // Render login form
  if (!isAuthenticated && authMode === "login") {
    return (
      <div className="admin-login" onCopy={preventCopyPaste} onPaste={preventCopyPaste}>
        <div className="login-panel">
          <div className="login-header">
            <h1>Admin Login</h1>
            <p>Enter your username and API key to access the admin panel</p>
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
              <label>API Key</label>
              <input
                type="password"
                value={loginApiKey}
                onChange={(e) => setLoginApiKey(e.target.value)}
                placeholder="Enter your API key"
                onCopy={preventCopyPaste}
                onPaste={preventCopyPaste}
              />
            </div>
            <button type="submit" className="primary" disabled={loading}>
              {loading ? "Authenticating..." : "Login"}
            </button>
          </form>

          <div className="json-upload-section">
            <div className="json-upload-divider">
              <span>OR</span>
            </div>
            <div className="json-upload">
              <label htmlFor="json-file-upload" className="json-upload-label">
                📄 Upload JSON Credentials File
              </label>
              <input
                id="json-file-upload"
                type="file"
                accept=".json"
                onChange={handleJsonFileUpload}
                disabled={loading}
                style={{ display: 'none' }}
              />
              <p className="json-upload-help">
                Select a JSON file containing your credentials
              </p>
              <p className="json-upload-format">
                Format: {"{"}"username": "your_username", "api_key": "your_api_key"{"}"}
              </p>
            </div>
          </div>
          
          <div className="auth-switch">
            <p>Don't have an account?</p>
            <button className="ghost" onClick={() => { setAuthMode("register"); setError(null); }}>
              Register
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Render register form
  if (!isAuthenticated && authMode === "register") {
    return (
      <div className="admin-login" onCopy={preventCopyPaste} onPaste={preventCopyPaste}>
        <div className="login-panel">
          <div className="login-header">
            <h1>Register Account</h1>
            <p>Create a new admin account with your own API key</p>
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <form onSubmit={handleRegister} className="auth-form">
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                placeholder="Choose a username (min 3 chars)"
                autoFocus
                onCopy={preventCopyPaste}
                onPaste={preventCopyPaste}
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="Enter your email"
                onCopy={preventCopyPaste}
                onPaste={preventCopyPaste}
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="Create a password (min 8 chars)"
                onCopy={preventCopyPaste}
                onPaste={preventCopyPaste}
              />
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                value={regConfirmPassword}
                onChange={(e) => setRegConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                onCopy={preventCopyPaste}
                onPaste={preventCopyPaste}
              />
            </div>
            <button type="submit" className="primary" disabled={loading}>
              {loading ? "Creating Account..." : "Register"}
            </button>
          </form>
          
          <div className="auth-switch">
            <p>Already have an account?</p>
            <button className="ghost" onClick={() => { setAuthMode("login"); setError(null); }}>
              Login
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Render verification form
  if (!isAuthenticated && authMode === "verify") {
    return (
      <div className="admin-login" onCopy={preventCopyPaste} onPaste={preventCopyPaste}>
        <div className="login-panel">
          <div className="login-header">
            <h1>Verify Email</h1>
            <p>Enter the verification token sent to your email</p>
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <form onSubmit={handleVerify} className="auth-form">
            <div className="form-group">
              <label>Verification Token</label>
              <input
                type="text"
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value)}
                placeholder="Enter verification token"
                autoFocus
                onCopy={preventCopyPaste}
                onPaste={preventCopyPaste}
              />
            </div>
            <button type="submit" className="primary" disabled={loading}>
              {loading ? "Verifying..." : "Verify Email"}
            </button>
          </form>
          
          <div className="auth-switch">
            <button className="ghost" onClick={() => { setAuthMode("login"); setError(null); }}>
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Render admin panel
  return (
    <div className="admin-panel" onCopy={preventCopyPaste} onPaste={preventCopyPaste}>
      <div className="admin-header">
        <div>
          <h1>Admin Panel</h1>
          {user && <p className="user-info">Welcome, {user.username}</p>}
        </div>
        <div className="admin-actions">
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
          Data Explorer
        </button>
        <button
          className={activeTab === "security" ? "active" : ""}
          onClick={() => setActiveTab("security")}
        >
          Security
        </button>
      </div>

      <div className="admin-content">
        {activeTab === "dashboard" && (
          <div className="dashboard">
            <h2>Statistics Overview</h2>
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
                <h3>Demographic Distribution</h3>
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

                <h3>Performance Metrics</h3>
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

                <h3>Engagement Metrics</h3>
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
                <p>No chart data available. Submit some responses to see visualizations.</p>
              </div>
            )}

            <div className="quick-actions">
              <h3>Quick Actions</h3>
              <div className="action-buttons">
                <button className="primary" onClick={downloadCsv}>Download CSV</button>
                <button className="ghost" onClick={() => setActiveTab("data")}>View Data</button>
                <button className="ghost" onClick={fetchStats}>Refresh Stats</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "data" && (
          <div className="data-explorer">
            <h2>Data Explorer</h2>
            
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
              </div>
              <button className="primary" onClick={downloadCsv}>Export CSV</button>
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
              <div className="data-table-container">
                <div className="data-table">
                  <div className="table-header">
                    {getTableHeaders().map((key) => (
                      <div key={key} className="table-cell header">{key}</div>
                    ))}
                  </div>
                  <div className="table-body">
                    {currentItems.map((row, index) => (
                      <div key={index} className="table-row">
                        {getTableHeaders().map((key, i) => (
                          <div key={i} className="table-cell">
                            {String(row[key] || "").substring(0, 50)}{String(row[key] || "").length > 50 ? "..." : ""}
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
                <p>No matching data found. Try adjusting your search.</p>
                <button className="ghost" onClick={() => { setSearchTerm(""); setCurrentPage(1); }}>Clear Search</button>
              </div>
            )}
          </div>
        )}

        {activeTab === "security" && (
          <div className="security">
            <h2>Security Center</h2>
            <div className="security-overview">
              <h3>Security Overview</h3>
              <p>This panel provides security information for your C.O.G.N.I.T. application.</p>
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
              <h3>Your API Key</h3>
              <div className="api-key-display">
                <code>{apiKey}</code>
                <p className="api-key-hint">Keep your API key secure. Do not share it with others.</p>
              </div>
            </div>

            <div className="security-section">
              <h3>Security Recommendations</h3>
              <div className="security-recommendations">
                <ul>
                  <li>Keep your API key secure and never share it</li>
                  <li>Use strong, unique passwords</li>
                  <li>Enable HTTPS in production environments</li>
                  <li>Monitor your account activity regularly</li>
                  <li>Log out when finished using the admin panel</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
