/**
 * External Risk Intelligence Route
 *
 * GET /api/external-risks/weather      — Real weather alerts from NWS API
 * GET /api/external-risks/geopolitical — Synthetic geopolitical risk scenarios
 * GET /api/external-risks/all          — Combined feed, sorted by severity
 */

import { Router } from 'express';

export const externalRisksRouter = Router();

// --- Plant / DC locations ---
const LOCATIONS = [
  { id: 'PLANT-NORTH', name: 'Detroit, MI',  lat: 42.33, lon: -83.05 },
  { id: 'PLANT-SOUTH', name: 'Houston, TX',  lat: 29.76, lon: -95.37 },
  { id: 'DC-EAST',     name: 'Atlanta, GA',  lat: 33.75, lon: -84.39 },
  { id: 'DC-WEST',     name: 'Phoenix, AZ',  lat: 33.45, lon: -112.07 },
  { id: 'DC-CENTRAL',  name: 'Chicago, IL',  lat: 41.88, lon: -87.63 },
];

// --- NWS severity → our severity ---
function mapSeverity(nwsSeverity) {
  const s = (nwsSeverity || '').toLowerCase();
  if (s === 'extreme' || s === 'severe') return 'critical';
  return 'warning';
}

// --- Event type → demand/capacity multiplier ---
function eventToMultiplier(event) {
  const e = (event || '').toLowerCase();
  if (/tornado|hurricane/.test(e)) return 0.5;
  if (/winter storm|blizzard|ice storm/.test(e)) return 0.7;
  if (/flood|flash flood/.test(e)) return 0.8;
  if (/heat advisory|excessive heat/.test(e)) return 0.9;
  return 0.85;
}

function multiplierToLabel(multiplier, event, locationId) {
  const pct = Math.round(Math.abs(1 - multiplier) * 100);
  const dir = multiplier < 1 ? `-${pct}%` : `+${pct}%`;
  const shortEvent = (event || 'Weather Alert').split(' ').slice(0, 2).join(' ');
  return `${shortEvent}: ${dir} ${locationId}`;
}

// --- Synthetic fallback weather risks ---
const FALLBACK_WEATHER = [
  {
    id: 'weather-fallback-1', source: 'nws', type: 'weather', severity: 'warning',
    location: 'PLANT-NORTH', locationName: 'Detroit, MI',
    headline: 'Winter Weather Advisory for Detroit metro area',
    description: 'Accumulating snow expected with 4-6 inches possible. Travel disruptions likely.',
    event: 'Winter Weather Advisory',
    suggestedMultiplier: 0.7,
    suggestedScenarioLabel: 'Winter Storm: -30% PLANT-NORTH',
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'weather-fallback-2', source: 'nws', type: 'weather', severity: 'critical',
    location: 'PLANT-SOUTH', locationName: 'Houston, TX',
    headline: 'Flash Flood Warning for Harris County',
    description: 'Heavy rainfall causing flash flooding on roadways. Inbound material shipments delayed.',
    event: 'Flash Flood Warning',
    suggestedMultiplier: 0.8,
    suggestedScenarioLabel: 'Flash Flood: -20% PLANT-SOUTH',
    expires: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'weather-fallback-3', source: 'nws', type: 'weather', severity: 'warning',
    location: 'DC-CENTRAL', locationName: 'Chicago, IL',
    headline: 'Heat Advisory for Cook County',
    description: 'Heat index values up to 108. Warehouse operations may slow during peak hours.',
    event: 'Heat Advisory',
    suggestedMultiplier: 0.9,
    suggestedScenarioLabel: 'Heat Advisory: -10% DC-CENTRAL',
    expires: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(),
  },
];

// --- Geopolitical risk pool ---
const GEO_POOL = [
  {
    id: 'geo-1', source: 'intelligence', type: 'geopolitical', severity: 'warning',
    region: 'East Asia', headline: 'Port congestion at Shanghai increasing',
    description: 'Average vessel wait times up 40% this week',
    suggestedMultiplier: 1.3, suggestedScenarioLabel: 'Shanghai Port Delays: +30% Lead Time',
    category: 'logistics',
  },
  {
    id: 'geo-2', source: 'intelligence', type: 'geopolitical', severity: 'critical',
    region: 'Middle East', headline: 'Red Sea shipping disruptions continue',
    description: 'Major carriers rerouting via Cape of Good Hope, adding 12-14 days',
    suggestedMultiplier: 1.5, suggestedScenarioLabel: 'Red Sea Disruption: +50% Demand Buffer',
    category: 'logistics',
  },
  {
    id: 'geo-3', source: 'intelligence', type: 'commodity', severity: 'warning',
    region: 'Global', headline: 'Steel prices up 15% month-over-month',
    description: 'Raw material cost pressure from tariff escalation',
    suggestedMultiplier: 1.15, suggestedScenarioLabel: 'Steel Price Spike: +15% Material Cost',
    category: 'commodity',
  },
  {
    id: 'geo-4', source: 'intelligence', type: 'regulatory', severity: 'warning',
    region: 'North America', headline: 'New EPA emissions rules effective Q2',
    description: 'Manufacturing plants may need to reduce output during compliance transition',
    suggestedMultiplier: 0.85, suggestedScenarioLabel: 'EPA Compliance: -15% Capacity',
    category: 'regulatory',
  },
  {
    id: 'geo-5', source: 'intelligence', type: 'geopolitical', severity: 'warning',
    region: 'Southeast Asia', headline: 'Vietnam factory audits causing delays',
    description: 'Supplier lead times extended 2-3 weeks for components sourced from Ho Chi Minh City',
    suggestedMultiplier: 1.2, suggestedScenarioLabel: 'Vietnam Delays: +20% Lead Time',
    category: 'logistics',
  },
  {
    id: 'geo-6', source: 'intelligence', type: 'commodity', severity: 'critical',
    region: 'Global', headline: 'Lithium supply crunch intensifying',
    description: 'Spot prices up 25% as EV demand outpaces mining capacity expansion',
    suggestedMultiplier: 1.25, suggestedScenarioLabel: 'Lithium Crunch: +25% Battery Cost',
    category: 'commodity',
  },
  {
    id: 'geo-7', source: 'intelligence', type: 'regulatory', severity: 'warning',
    region: 'Europe', headline: 'EU CBAM carbon tariffs expanding scope',
    description: 'Carbon border adjustment now covers steel, aluminum, and cement imports',
    suggestedMultiplier: 1.1, suggestedScenarioLabel: 'EU Carbon Tariff: +10% Import Cost',
    category: 'regulatory',
  },
];

// --- Fetch weather alerts from NWS ---
async function fetchWeatherAlerts() {
  const results = [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const fetches = LOCATIONS.map(async (loc) => {
      try {
        const url = `https://api.weather.gov/alerts?point=${loc.lat},${loc.lon}&status=actual&limit=3`;
        const resp = await fetch(url, {
          headers: { 'User-Agent': '(supply-chain-hub, contact@example.com)' },
          signal: controller.signal,
        });
        if (!resp.ok) return [];
        const data = await resp.json();
        const features = data.features || [];
        return features.map((f, idx) => {
          const props = f.properties || {};
          const mult = eventToMultiplier(props.event);
          return {
            id: `weather-${loc.id}-${idx}`,
            source: 'nws',
            type: 'weather',
            severity: mapSeverity(props.severity),
            location: loc.id,
            locationName: loc.name,
            headline: props.headline || props.event || 'Weather Alert',
            description: (props.description || '').slice(0, 300),
            event: props.event || 'Weather Alert',
            suggestedMultiplier: mult,
            suggestedScenarioLabel: multiplierToLabel(mult, props.event, loc.id),
            expires: props.expires || null,
          };
        });
      } catch {
        return [];
      }
    });

    const allArrays = await Promise.all(fetches);
    for (const arr of allArrays) results.push(...arr);
  } catch {
    // NWS API entirely unreachable
  } finally {
    clearTimeout(timeout);
  }

  return results.length > 0 ? results : FALLBACK_WEATHER;
}

// --- Rotate geopolitical risks by day-of-week ---
function getGeopoliticalRisks() {
  const day = new Date().getDay(); // 0-6
  // Pick 4 items, rotating the pool by day
  const picked = [];
  for (let i = 0; i < 4; i++) {
    picked.push(GEO_POOL[(day + i) % GEO_POOL.length]);
  }
  return picked;
}

// --- Routes ---

externalRisksRouter.get('/weather', async (_req, res) => {
  try {
    const risks = await fetchWeatherAlerts();
    res.json(risks);
  } catch (err) {
    console.error('Weather risk fetch error:', err.message);
    res.json(FALLBACK_WEATHER);
  }
});

externalRisksRouter.get('/geopolitical', (_req, res) => {
  res.json(getGeopoliticalRisks());
});

externalRisksRouter.get('/all', async (_req, res) => {
  try {
    const [weather, geo] = await Promise.all([
      fetchWeatherAlerts(),
      Promise.resolve(getGeopoliticalRisks()),
    ]);
    const combined = [...weather, ...geo];
    // Sort: critical first, then warning
    combined.sort((a, b) => {
      if (a.severity === 'critical' && b.severity !== 'critical') return -1;
      if (a.severity !== 'critical' && b.severity === 'critical') return 1;
      return 0;
    });
    res.json(combined);
  } catch (err) {
    console.error('External risks fetch error:', err.message);
    res.json([...FALLBACK_WEATHER, ...getGeopoliticalRisks()]);
  }
});
