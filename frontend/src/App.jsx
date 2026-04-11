import { useState } from 'react';
import axios from 'axios';
import WeeklyMileageChart from './components/WeeklyMileageChart';
import BestEffortCards from './components/BestEffortCards';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const { data: result } = await axios.get(`${API_URL}/api/run-data`);
      setData(result);
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.error || err.message;
      setError(`Failed to load data: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.h1}>Run Recap</h1>
            <p style={styles.subtitle}>Garmin Connect · Last 8 Weeks</p>
          </div>
          <button
            style={{ ...styles.button, ...(loading ? styles.buttonDisabled : {}) }}
            onClick={loadData}
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Load Data'}
          </button>
        </header>

        {error && (
          <div style={styles.error}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {data && !error && (
          <>
            <BestEffortCards
              fastestLap={data.fastestLap}
              fastestMile={data.fastestMile}
            />
            <WeeklyMileageChart data={data.weeks} />
          </>
        )}

        {!data && !loading && !error && (
          <div style={styles.empty}>
            <p>Press <strong>Load Data</strong> to fetch your last 8 weeks from Garmin Connect.</p>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0a0a0a',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '40px 16px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: 760,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  h1: {
    margin: 0,
    fontSize: 28,
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    margin: '4px 0 0 0',
    color: '#666',
    fontSize: 13,
  },
  button: {
    background: '#22c55e',
    color: '#000',
    border: 'none',
    borderRadius: 8,
    padding: '10px 22px',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.2px',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  error: {
    background: '#1f0a0a',
    border: '1px solid #5c1a1a',
    borderRadius: 8,
    color: '#f87171',
    padding: '12px 16px',
    marginBottom: 24,
    fontSize: 14,
  },
  empty: {
    background: '#111',
    border: '1px solid #222',
    borderRadius: 12,
    padding: '60px 40px',
    textAlign: 'center',
    color: '#555',
    fontSize: 15,
  },
};
