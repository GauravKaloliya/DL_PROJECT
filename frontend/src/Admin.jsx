import React, { useEffect, useState } from 'react';
import { verifyApiKey, fetchStats, fetchSubmissions, searchSubmissions, getDownloadUrl } from './api';

export default function Admin() {
  const [apiKey, setApiKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [stats, setStats] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortColumn, setSortColumn] = useState('timestamp');
  const [sortDirection, setSortDirection] = useState('desc');
  const [expandedRow, setExpandedRow] = useState(null);
  const [error, setError] = useState('');

  const login = async () => {
    setError('');
    try {
      const valid = await verifyApiKey(apiKey);
      if (valid) {
        setIsAuthenticated(true);
        sessionStorage.setItem('admin_api_key', apiKey);
        loadStats();
        loadSubmissions();
      } else {
        setError('Invalid API key');
      }
    } catch (e) {
      setError('Invalid API key');
    }
  };

  const loadSubmissions = async () => {
    if (!apiKey) return;
    setLoading(true);
    setError('');
    try {
      let data;
      if (searchQuery.trim()) {
        data = await searchSubmissions(apiKey, searchQuery, page, 20);
      } else {
        data = await fetchSubmissions(apiKey, page, 20);
      }
      
      let filtered = data.submissions;
      
      // Apply type filter
      if (filterType !== 'all') {
        filtered = filtered.filter(sub => {
          if (filterType === 'attention') return sub.is_attention === 'True' || sub.is_attention === true;
          if (filterType === 'practice') return sub.is_practice === 'True' || sub.is_practice === true;
          if (filterType === 'normal') return (sub.is_practice === 'False' || sub.is_practice === false) && (sub.is_attention === 'False' || sub.is_attention === false);
          return true;
        });
      }
      
      // Sort
      filtered.sort((a, b) => {
        let aVal = a[sortColumn] || '';
        let bVal = b[sortColumn] || '';
        
        // Try to parse as numbers
        const aNum = parseFloat(aVal);
        const bNum = parseFloat(bVal);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
        }
        
        // String comparison
        if (sortDirection === 'asc') {
          return aVal.toString().localeCompare(bVal.toString());
        } else {
          return bVal.toString().localeCompare(aVal.toString());
        }
      });
      
      setSubmissions(filtered);
      setTotalPages(data.total_pages);
      setTotal(data.total);
    } catch (e) {
      setError(e.message || 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!apiKey) return;
    try {
      const data = await fetchStats(apiKey);
      setStats(data);
    } catch (e) {
      console.error('Failed to load stats:', e);
    }
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const downloadCSV = () => {
    window.open(getDownloadUrl(apiKey), '_blank');
  };

  useEffect(() => {
    const storedKey = sessionStorage.getItem('admin_api_key');
    if (storedKey) {
      setApiKey(storedKey);
      verifyApiKey(storedKey).then(valid => {
        if (valid) {
          setIsAuthenticated(true);
          loadStats();
          loadSubmissions();
        }
      });
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadSubmissions();
    }
  }, [page, searchQuery, filterType, sortColumn, sortDirection]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      login();
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="admin-login">
        <div className="admin-login-card">
          <h1>🔐 C.O.G.N.I.T. Admin Panel</h1>
          <p>Enter your API key to access the dashboard</p>
          <input
            type="password"
            placeholder="Enter API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          {error && <div className="admin-error">{error}</div>}
          <button className="primary" onClick={login}>
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <header className="admin-header">
        <div>
          <h1>📊 C.O.G.N.I.T. Admin Dashboard</h1>
          <p className="admin-subtitle">Monitor and analyze study submissions</p>
        </div>
        <div className="admin-header-actions">
          <button className="primary" onClick={downloadCSV}>
            📥 Download CSV
          </button>
          <button className="ghost" onClick={() => {
            setIsAuthenticated(false);
            sessionStorage.removeItem('admin_api_key');
            setApiKey('');
          }}>
            Logout
          </button>
        </div>
      </header>

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📝</div>
            <div className="stat-content">
              <h3>Total Submissions</h3>
              <p className="stat-value">{stats.total_submissions}</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <h3>Avg Word Count</h3>
              <p className="stat-value">{stats.avg_word_count?.toFixed(1)}</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⚠️</div>
            <div className="stat-content">
              <h3>Attention Fail Rate</h3>
              <p className="stat-value">{(stats.attention_fail_rate * 100)?.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      )}

      <div className="submissions-section">
        <div className="submissions-controls">
          <div className="search-box">
            <input
              type="text"
              placeholder="🔍 Search descriptions, participants, images..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="filter-controls">
            <select value={filterType} onChange={(e) => {
              setFilterType(e.target.value);
              setPage(1);
            }}>
              <option value="all">All Types</option>
              <option value="normal">Normal</option>
              <option value="practice">Practice</option>
              <option value="attention">Attention</option>
            </select>
            <button className="ghost btn-small" onClick={() => loadSubmissions()}>
              🔄 Refresh
            </button>
          </div>
        </div>

        {error && <div className="admin-error">{error}</div>}

        <div className="submissions-table-container">
          <table className="submissions-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('timestamp')}>
                  Timestamp {sortColumn === 'timestamp' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('participant_id')}>
                  Participant {sortColumn === 'participant_id' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('image_id')}>
                  Image {sortColumn === 'image_id' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('word_count')}>
                  Words {sortColumn === 'word_count' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('rating')}>
                  Rating {sortColumn === 'rating' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th>Type</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>
                    Loading...
                  </td>
                </tr>
              ) : submissions.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>
                    No submissions found
                  </td>
                </tr>
              ) : (
                submissions.map((sub, idx) => (
                  <React.Fragment key={idx}>
                    <tr className={expandedRow === idx ? 'expanded' : ''}>
                      <td>{new Date(sub.timestamp).toLocaleString()}</td>
                      <td>
                        <span className="participant-id" title={sub.participant_id}>
                          {sub.participant_id?.slice(0, 8)}...
                        </span>
                      </td>
                      <td>{sub.image_id}</td>
                      <td>{sub.word_count}</td>
                      <td>{sub.rating}/10</td>
                      <td>
                        {sub.is_attention === 'True' || sub.is_attention === true ? (
                          <span className="type-badge attention">Attention</span>
                        ) : sub.is_practice === 'True' || sub.is_practice === true ? (
                          <span className="type-badge practice">Practice</span>
                        ) : (
                          <span className="type-badge normal">Normal</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="ghost btn-small"
                          onClick={() => setExpandedRow(expandedRow === idx ? null : idx)}
                        >
                          {expandedRow === idx ? 'Hide' : 'Details'}
                        </button>
                      </td>
                    </tr>
                    {expandedRow === idx && (
                      <tr className="expanded-details">
                        <td colSpan="7">
                          <div className="details-content">
                            <div className="detail-section">
                              <h4>Description</h4>
                              <p>{sub.description}</p>
                            </div>
                            <div className="detail-section">
                              <h4>Feedback</h4>
                              <p>{sub.feedback}</p>
                            </div>
                            <div className="details-grid">
                              <div className="detail-item">
                                <strong>Session ID:</strong> {sub.session_id}
                              </div>
                              <div className="detail-item">
                                <strong>Time Spent:</strong> {sub.time_spent_seconds}s
                              </div>
                              <div className="detail-item">
                                <strong>Too Fast:</strong> {sub.too_fast_flag}
                              </div>
                              <div className="detail-item">
                                <strong>Attention Passed:</strong> {sub.attention_passed?.toString()}
                              </div>
                            </div>
                            <div className="detail-section">
                              <h4>NASA-TLX Ratings</h4>
                              <div className="nasa-grid">
                                <div><strong>Mental:</strong> {sub.nasa_mental}/5</div>
                                <div><strong>Physical:</strong> {sub.nasa_physical}/5</div>
                                <div><strong>Temporal:</strong> {sub.nasa_temporal}/5</div>
                                <div><strong>Performance:</strong> {sub.nasa_performance}/5</div>
                                <div><strong>Effort:</strong> {sub.nasa_effort}/5</div>
                                <div><strong>Frustration:</strong> {sub.nasa_frustration}/5</div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            <button 
              className="ghost btn-small"
              disabled={page === 1} 
              onClick={() => setPage(p => p - 1)}
            >
              ← Previous
            </button>
            <span className="page-info">
              Page {page} of {totalPages} ({total} total)
            </span>
            <button 
              className="ghost btn-small"
              disabled={page === totalPages} 
              onClick={() => setPage(p => p + 1)}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
