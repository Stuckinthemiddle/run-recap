import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={styles.tooltip}>
        <p style={styles.tooltipLabel}>Week of {label}</p>
        <p style={styles.tooltipValue}>{payload[0].value.toFixed(2)} miles</p>
      </div>
    );
  }
  return null;
};

export default function WeeklyMileageChart({ data }) {
  const maxMiles = Math.max(...data.map((d) => d.miles), 1);

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Weekly Mileage — Last 8 Weeks</h2>
      <ResponsiveContainer width="100%" height={380}>
        <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
          <XAxis
            dataKey="week"
            tick={{ fill: '#aaa', fontSize: 13 }}
            axisLine={{ stroke: '#444' }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => `${v} mi`}
            tick={{ fill: '#aaa', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
          <Bar dataKey="miles" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={entry.miles === maxMiles ? '#4ade80' : '#22c55e99'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p style={styles.summary}>
        Total: <strong>{data.reduce((sum, d) => sum + d.miles, 0).toFixed(1)} miles</strong> &nbsp;|&nbsp;
        Avg: <strong>{(data.reduce((sum, d) => sum + d.miles, 0) / data.length).toFixed(1)} mi/week</strong>
      </p>
    </div>
  );
}

const styles = {
  container: {
    background: '#111',
    borderRadius: 12,
    padding: '24px 28px',
    border: '1px solid #222',
  },
  title: {
    margin: '0 0 24px 0',
    fontSize: 18,
    fontWeight: 600,
    color: '#eee',
  },
  tooltip: {
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: 8,
    padding: '10px 14px',
  },
  tooltipLabel: {
    margin: 0,
    color: '#aaa',
    fontSize: 12,
  },
  tooltipValue: {
    margin: '4px 0 0 0',
    color: '#4ade80',
    fontWeight: 700,
    fontSize: 16,
  },
  summary: {
    marginTop: 16,
    color: '#888',
    fontSize: 13,
    textAlign: 'right',
  },
};
