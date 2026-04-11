export default function BestEffortCards({ fastestLap, fastestMile }) {
  const lapSub = fastestLap
    ? `${fastestLap.distanceMiles} mi · ${fastestLap.durationFormatted} · ${fastestLap.date}`
    : 'No lap data found';

  let mileSub = 'No mile splits found';
  if (fastestMile) {
    if (fastestMile.isActivityAverage) {
      mileSub = `Overall run avg · ${fastestMile.date}`;
    } else {
      mileSub = `${fastestMile.distanceMiles} mi split · ${fastestMile.durationFormatted} · ${fastestMile.date}`;
    }
  }

  return (
    <div style={styles.row}>
      <StatCard
        label="Fastest Lap"
        value={fastestLap ? fastestLap.paceFormatted : '—'}
        unit={fastestLap ? 'min/mi' : ''}
        sub={lapSub}
      />
      <StatCard
        label="Fastest Mile"
        value={fastestMile ? fastestMile.paceFormatted : '—'}
        unit={fastestMile ? 'min/mi' : ''}
        sub={mileSub}
        dimmed={fastestMile?.isActivityAverage}
      />
    </div>
  );
}

function StatCard({ label, value, unit, sub, dimmed }) {
  return (
    <div style={styles.card}>
      <p style={styles.label}>{label}</p>
      <div style={styles.valueRow}>
        <span style={{ ...styles.value, ...(dimmed ? styles.valueDimmed : {}) }}>{value}</span>
        {unit && <span style={styles.unit}>{unit}</span>}
      </div>
      <p style={styles.sub}>{sub}</p>
    </div>
  );
}

const styles = {
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
    marginBottom: 24,
  },
  card: {
    background: '#111',
    border: '1px solid #222',
    borderRadius: 12,
    padding: '20px 24px',
  },
  label: {
    margin: '0 0 8px 0',
    fontSize: 12,
    fontWeight: 600,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  valueRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 6,
  },
  value: {
    fontSize: 36,
    fontWeight: 700,
    color: '#4ade80',
    letterSpacing: '-1px',
    fontVariantNumeric: 'tabular-nums',
  },
  valueDimmed: {
    color: '#86efac',  // lighter green to signal "estimated"
  },
  unit: {
    fontSize: 13,
    color: '#555',
    fontWeight: 500,
  },
  sub: {
    margin: '6px 0 0 0',
    fontSize: 12,
    color: '#555',
  },
};
