const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { GarminConnect } = require('garmin-connect');

const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
const SECRET_NAME = process.env.SECRET_NAME || 'run-recap/garmin';

// Cache credentials for the lifetime of the Lambda container
let cachedCreds = null;

async function getGarminCreds() {
  if (cachedCreds) return cachedCreds;
  const response = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: SECRET_NAME })
  );
  cachedCreds = JSON.parse(response.SecretString);
  return cachedCreds;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  try {
    const { GARMIN_EMAIL, GARMIN_PASSWORD } = await getGarminCreds();

    const client = new GarminConnect({ username: GARMIN_EMAIL, password: GARMIN_PASSWORD });
    await client.login(GARMIN_EMAIL, GARMIN_PASSWORD);

    const activities = await client.getActivities(0, 100);

    const now = new Date();
    const eightWeeksAgo = new Date(now);
    eightWeeksAgo.setDate(now.getDate() - 56);

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

    const lapPaceMap = {};
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    // ── Splits ────────────────────────────────────────────────────────
    const splitsResults = await Promise.allSettled(
      runningActivities.map((a) =>
        client.client.get(client.url.ACTIVITY + a.activityId + '/splits')
      )
    );

    let fastestLap = null;
    let fastestMile = null;

    splitsResults.forEach((result, idx) => {
      if (result.status !== 'fulfilled') return;
      const splits = result.value;
      const activity = runningActivities[idx];
      const activityDate = new Date(activity.startTimeLocal || activity.startTimeGMT);
      const activityName = activity.activityName || 'Run';
      const laps = splits?.lapDTOs ?? splits?.laps ?? [];
      const activityMonday = getMondayOfWeek(activityDate);
      const activityWeekKey = activityMonday.toISOString().split('T')[0];
      if (!lapPaceMap[activityWeekKey]) lapPaceMap[activityWeekKey] = [];

      for (const lap of laps) {
        const distM = lap.distance ?? 0;
        const durSec = lap.movingDuration ?? lap.elapsedDuration ?? 0;
        if (distM <= 0 || durSec <= 0) continue;

        const speedMs = distM / durSec;
        const paceMileMin = 1609.344 / speedMs / 60;
        const lapMiles = distM / 1609.344;

        lapPaceMap[activityWeekKey].push({ pace: parseFloat(paceMileMin.toFixed(4)), miles: parseFloat(lapMiles.toFixed(3)) });

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

    // Fallback: best average pace from any run ≥ 1 mile
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
            isActivityAverage: true,
          };
        }
      }
    }

    // Build weeks array now that lapPaceMap is fully populated
    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      const monday = getMondayOfWeek(new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      const key = monday.toISOString().split('T')[0];
      weeks.push({
        week: formatWeekLabel(monday),
        weekStart: key,
        miles: parseFloat((weekMap[key] || 0).toFixed(2)),
        isComplete: sunday < today,
        lapPaces: lapPaceMap[key] || [],
      });
    }

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ weeks, fastestLap, fastestMile }),
    };
  } catch (err) {
    console.error('Error:', err.message);
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to fetch Garmin data', detail: err.message }),
    };
  }
};

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
