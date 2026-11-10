import { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const DEFAULT_EASY_PACE = '9:35';
const DEFAULT_HARD_PACE = '8:35';

function parsePace(str) {
  const [m, s] = str.split(':').map(Number);
  if (isNaN(m) || isNaN(s) || s >= 60) return null;
  return m + s / 60;
}

function bucketWeek(week, easyThreshold, hardThreshold) {
  let easyMiles = 0, moderateMiles = 0, hardMiles = 0;
  for (const { pace, miles } of (week.lapPaces || [])) {
    if (pace > easyThreshold) easyMiles += miles;
    else if (pace <= hardThreshold) hardMiles += miles;
    else moderateMiles += miles;
  }
  return { ...week, easyMiles, moderateMiles, hardMiles };
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div style={styles.tooltip}>
      <p style={styles.tooltipLabel}>Week of {label}</p>
      {payload.map((p) => {
        const pct = total > 0 ? ((p.value / total) * 100).toFixed(0) : 0;
        return (
          <p key={p.dataKey} style={{ ...styles.tooltipRow, color: p.fill }}>
            {p.name}: {p.value.toFixed(1)} mi ({pct}%)
          </p>
        );
      })}
      <p style={styles.tooltipTotal}>Total laps: {total.toFixed(1)} mi</p>
    </div>
  );
};

export default function EightyTwentyChart({ data }) {
  const [easyInput, setEasyInput] = useState(DEFAULT_EASY_PACE);
  const [hardInput, setHardInput] = useState(DEFAULT_HARD_PACE);

  const easyThreshold = parsePace(easyInput);
  const hardThreshold = parsePace(hardInput);
  const valid = easyThreshold !== null && hardThreshold !== null && easyThreshold > hardThreshold;

  const chartData = useMemo(() => {
    if (!valid) return data.map((w) => ({ ...w, easyMiles: 0, moderateMiles: 0, hardMiles: 0 }));
    return data.map((w) => bucketWeek(w, easyThreshold, hardThreshold));
  }, [data, easyThreshold, hardThreshold, valid]);

  const completeWeeks = chartData.filter((d) => d.isComplete);
  const totalEasy = completeWeeks.reduce((s, d) => s + d.easyMiles, 0);
  const totalModerate = completeWeeks.reduce((s, d) => s + d.moderateMiles, 0);
  const totalHard = completeWeeks.reduce((s, d) => s + d.hardMiles, 0);
  const totalZoned = totalEasy + totalModerate + totalHard;
  const easyPct = totalZoned > 0 ? ((totalEasy / totalZoned) * 100).toFixed(0) : 0;
  const hardPct = totalZoned > 0 ? (((totalModerate + totalHard) / totalZoned) * 100).toFixed(0) : 0;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>80/20 Effort Zones — Last 8 Weeks</h2>
        {totalZoned > 0 && (
          <div style={styles.ratio}>
            <span style={styles.easyRatio}>{easyPct}% easy</span>
            <span style={styles.separator}>/</span>
            <span style={styles.hardRatio}>{hardPct}% mod+hard</span>
          </div>
        )}
      </div>

      {/* Zone threshold settings */}
      <div style={styles.settings}>
        <ZoneInput
          label="Easy above"
          value={easyInput}
          onChange={setEasyInput}
          color="#60a5fa"
          error={easyThreshold !== null && hardThreshold !== null && easyThreshold <= hardThreshold}
        />
        <ZoneInput
          label="Hard below"
          value={hardInput}
          onChange={setHardInput}
          color="#f87171"
          error={easyThreshold !== null && hardThreshold !== null && easyThreshold <= hardThreshold}
        />
        {!valid && easyThreshold !== null && hardThreshold !== null && (
          <span style={styles.settingsError}>Easy pace must be slower than hard pace</span>
        )}
      </div>

      {/* Zone legend */}
      <div style={styles.legend}>
        <LegendItem color="#60a5fa" label="Easy"     pace={`> ${easyInput} min/mi`} />
        <LegendItem color="#fbbf24" label="Moderate" pace={`${hardInput} – ${easyInput} min/mi`} />
        <LegendItem color="#f87171" label="Hard"     pace={`< ${hardInput} min/mi`} />
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
          <XAxis dataKey="week" tick={{ fill: '#aaa', fontSize: 13 }} axisLine={{ stroke: '#444' }} tickLine={false} />
          <YAxis tickFormatter={(v) => `${v} mi`} tick={{ fill: '#aaa', fontSize: 12 }} axisLine={false} tickLine={false} width={60} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
          <Bar dataKey="easyMiles"     name="Easy"     stackId="a" fill="#60a5fa" fillOpacity={(entry) => entry?.isComplete ? 1 : 0.3} />
          <Bar dataKey="moderateMiles" name="Moderate" stackId="a" fill="#fbbf24" fillOpacity={(entry) => entry?.isComplete ? 1 : 0.3} />
          <Bar dataKey="hardMiles"     name="Hard"     stackId="a" fill="#f87171" fillOpacity={(entry) => entry?.isComplete ? 1 : 0.3} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {totalZoned === 0 && (
        <p style={styles.noData}>No lap data available for zone breakdown.</p>
      )}
    </div>
  );
}

function ZoneInput({ label, value, onChange, color, error }) {
  return (
    <label style={styles.inputGroup}>
      <span style={{ ...styles.inputLabel, color }}>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...styles.input, ...(error ? styles.inputError : {}) }}
        placeholder="M:SS"
        maxLength={5}
      />
    </label>
  );
}

function LegendItem({ color, label, pace }) {
  return (
    <div style={styles.legendItem}>
      <span style={{ ...styles.legendDot, background: color }} />
      <span style={styles.legendLabel}>{label}</span>
      <span style={styles.legendPace}>{pace}</span>
    </div>
  );
}

const styles = {
  container: {
    background: '#111',
    borderRadius: 12,
    padding: '24px 28px',
    border: '1px solid #222',
    marginTop: 20,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 8,
  },
  title: { margin: 0, fontSize: 18, fontWeight: 600, color: '#eee' },
  ratio: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 },
  easyRatio: { color: '#60a5fa' },
  separator: { color: '#444' },
  hardRatio: { color: '#fbbf24' },
  settings: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  inputGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'default',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  input: {
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: 6,
    color: '#eee',
    fontSize: 14,
    fontWeight: 600,
    padding: '5px 10px',
    width: 60,
    textAlign: 'center',
    outline: 'none',
    fontVariantNumeric: 'tabular-nums',
  },
  inputError: {
    borderColor: '#f87171',
  },
  settingsError: {
    color: '#f87171',
    fontSize: 12,
  },
  legend: { display: 'flex', gap: 20, marginBottom: 16, flexWrap: 'wrap' },
  legendItem: { display: 'flex', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  legendLabel: { color: '#ccc', fontSize: 13, fontWeight: 600 },
  legendPace: { color: '#555', fontSize: 12 },
  tooltip: {
    background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, padding: '10px 14px',
  },
  tooltipLabel: { margin: '0 0 6px 0', color: '#aaa', fontSize: 12 },
  tooltipRow: { margin: '2px 0', fontSize: 13, fontWeight: 600 },
  tooltipTotal: { margin: '6px 0 0 0', color: '#555', fontSize: 11, borderTop: '1px solid #333', paddingTop: 6 },
  noData: { textAlign: 'center', color: '#444', fontSize: 13, marginTop: 16 },
};
