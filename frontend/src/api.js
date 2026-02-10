const API_BASE = import.meta.env.VITE_API_BASE || '';

// Retry utility
async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

export async function fetchRandomImage(type) {
  const res = await fetchWithRetry(`${API_BASE}/api/images/random?type=${type}`);
  if (!res.ok) throw new Error('Failed to fetch image');
  return res.json();
}

export async function submitTrial(data) {
  const res = await fetchWithRetry(`${API_BASE}/api/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Submission failed');
  }
  return res.json();
}

export async function healthCheck() {
  try {
    const res = await fetch(`${API_BASE}/api/health`, { timeout: 5000 });
    return res.ok;
  } catch {
    return false;
  }
}

// Admin API calls
export async function verifyApiKey(apiKey) {
  const res = await fetch(`${API_BASE}/api/stats?api_key=${apiKey}`);
  return res.ok;
}

export async function fetchStats(apiKey) {
  const res = await fetch(`${API_BASE}/api/stats?api_key=${apiKey}`);
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export async function fetchSubmissions(apiKey, page = 1, perPage = 20) {
  const res = await fetch(`${API_BASE}/api/submissions?page=${page}&per_page=${perPage}&api_key=${apiKey}`);
  if (!res.ok) throw new Error('Failed to fetch submissions');
  return res.json();
}

export async function searchSubmissions(apiKey, query, page = 1, perPage = 20) {
  const res = await fetch(`${API_BASE}/api/submissions/search?q=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}&api_key=${apiKey}`);
  if (!res.ok) throw new Error('Failed to search submissions');
  return res.json();
}

export async function fetchParticipantSubmissions(apiKey, participantId) {
  const res = await fetch(`${API_BASE}/api/submissions/${participantId}?api_key=${apiKey}`);
  if (!res.ok) throw new Error('Failed to fetch participant submissions');
  return res.json();
}

export function getDownloadUrl(apiKey) {
  return `${API_BASE}/admin/download?api_key=${apiKey}`;
}
