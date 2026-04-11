require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GarminConnect } = require('garmin-connect');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Returns weekly mileage + fastest lap + fastest mile for the last 8 weeks
app.get('/api/run-data', async (req, res) => {
  const email = process.env.GARMIN_EMAIL;
  const password = process.env.GARMIN_PASSWORD;

  if (!email || !password) {
    return res.status(500).json({ error: 'Garmin credentials not configured' });
  }

  try {
    const client = new GarminConnect({ username: email, password });
    await client.login(email, password);

    const activities = await client.getActivities(0, 100);

    const now = new Date();
    const eightWeeksAgo = new Date(now);
    eightWeeksAgo.setDate(now.getDate() - 56);

    // Filter to running activities within the 8-week window
    const runningActivities = activities.filter((a) => {
      const type = (a.activityType?.typeKey || '').toLowerCase();
      if (!type.includes('running') && !type.includes('run')) return false;
      const date = new Date(a.startTimeLocal || a.startTimeGMT);
      return date >= eightWeeksAgo;
    });

    // ── Weekly mileage ────────────────────────────────────────────────
    const weekMap = {};
    for (const activity of runningActivities) {
      const activityDate = new Date(activity.startTimeLocal || activity.startTimeGMT);
      const monday = getMondayOfWeek(activityDate);
      const key = monday.toISOString().split('T')[0];
      const miles = (activity.distance || 0) / 1609.344;
      weekMap[key] = (weekMap[key] || 0) + miles;
    }

    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      const monday = getMondayOfWeek(new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000));
      const key = monday.toISOString().split('T')[0];
      weeks.push({
        week: formatWeekLabel(monday),
        weekStart: key,
        miles: parseFloat((weekMap[key] || 0).toFixed(2)),
      });
    }

    // ── Fetch splits via the Garmin activity-service API ─────────────
    // garmin-connect doesn't expose a getActivitySplits method, so we use
    // the underlying authenticated HttpClient directly.
    const splitsResults = await Promise.allSettled(
      runningActivities.map((a) =>
        client.client.get(client.url.ACTIVITY + a.activityId + '/splits')
      )
    );

    let fastestLap = null;    // best pace across any lap ≥ 400 m
    let fastestMile = null;   // best lap in the 1500–1750 m window

    splitsResults.forEach((result, idx) => {
      if (result.status !== 'fulfilled') return;
      const splits = result.value;
      const activity = runningActivities[idx];
      const activityDate = new Date(activity.startTimeLocal || activity.startTimeGMT);
      const activityName = activity.activityName || 'Run';

      const laps = splits?.lapDTOs ?? splits?.laps ?? [];

      for (const lap of laps) {
        const distM = lap.distance ?? 0;
        const durSec = lap.movingDuration ?? lap.elapsedDuration ?? 0;
        if (distM <= 0 || durSec <= 0) continue;

        const speedMs = distM / durSec;
        const paceMileMin = 1609.344 / speedMs / 60;

        // Fastest lap: any lap ≥ 800 m
        if (distM >= 800) {
          if (!fastestLap || paceMileMin < fastestLap.paceMileMin) {
            fastestLap = {
              paceMileMin,
              paceFormatted: formatPace(paceMileMin),
              durationFormatted: formatDuration(durSec),
              distanceMiles: parseFloat((distM / 1609.344).toFixed(2)),
              date: activityDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              activityName,
            };
          }
        }

        // Fastest mile: laps between 1300 m and 1900 m (~1 mile ± 18%)
        // Wide window to catch auto-laps that get cut short by manual lap presses
        if (distM >= 1300 && distM <= 1900) {
          if (!fastestMile || paceMileMin < fastestMile.paceMileMin) {
            fastestMile = {
              paceMileMin,
              paceFormatted: formatPace(paceMileMin),
              durationFormatted: formatDuration(durSec),
              distanceMiles: parseFloat((distM / 1609.344).toFixed(2)),
              date: activityDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              activityName,
            };
          }
        }
      }
    });

    // Fallback for fastest mile: if no lap landed in the mile window (can happen
    // when manual laps break up auto-laps), use the best average pace from any
    // run that covers at least 1 mile. Mark it so the UI can note it's estimated.
    if (!fastestMile) {
      for (const activity of runningActivities) {
        if ((activity.distance || 0) < 1609.344) continue;
        const speedMs = activity.averageSpeed ?? 0;
        if (speedMs <= 0) continue;
        const paceMileMin = 1609.344 / speedMs / 60;
        const activityDate = new Date(activity.startTimeLocal || activity.startTimeGMT);
        if (!fastestMile || paceMileMin < fastestMile.paceMileMin) {
          fastestMile = {
            paceMileMin,
            paceFormatted: formatPace(paceMileMin),
            durationFormatted: null,
            distanceMiles: null,
            date: activityDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            activityName: activity.activityName || 'Run',
            isActivityAverage: true, // no mile split available; using overall run pace
          };
        }
      }
    }

    res.json({ weeks, fastestLap, fastestMile });
  } catch (err) {
    console.error('Garmin error:', err.message);
    res.status(500).json({ error: 'Failed to fetch Garmin data', detail: err.message });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────

function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekLabel(monday) {
  return monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatPace(minPerMile) {
  const mins = Math.floor(minPerMile);
  const secs = Math.round((minPerMile - mins) * 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
