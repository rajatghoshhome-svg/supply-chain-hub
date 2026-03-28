/**
 * Synthetic Demand History for Validation
 *
 * 52 weeks of weekly demand for the 3 finished goods from the motor BOM.
 * Includes realistic patterns: seasonality, trend, noise, and outliers.
 */

// Seed-based deterministic "random" for reproducible noise
function seededNoise(seed, amplitude) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return (x - Math.floor(x) - 0.5) * 2 * amplitude;
}

function generateWeeklyDemand({ base, trend, seasonAmplitude, noiseAmplitude, weeks, seed }) {
  const demand = [];
  for (let w = 0; w < weeks; w++) {
    const trendComponent = trend * w;
    const seasonComponent = seasonAmplitude * Math.sin((2 * Math.PI * w) / 52);
    const noise = seededNoise(w + seed, noiseAmplitude);
    const value = Math.max(0, Math.round(base + trendComponent + seasonComponent + noise));
    demand.push(value);
  }
  return demand;
}

export const demandHistory = {
  // MTR-100: Bread-and-butter product. Stable with mild seasonality.
  'MTR-100': {
    name: '1HP Standard Motor',
    weekly: generateWeeklyDemand({
      base: 18, trend: 0.05, seasonAmplitude: 5, noiseAmplitude: 3, weeks: 52, seed: 1,
    }),
  },

  // MTR-200: Growing premium product. Clear upward trend.
  'MTR-200': {
    name: '2HP Premium Motor',
    weekly: generateWeeklyDemand({
      base: 8, trend: 0.15, seasonAmplitude: 3, noiseAmplitude: 2, weeks: 52, seed: 2,
    }),
  },

  // MTR-500: Low-volume industrial. Lumpy demand.
  'MTR-500': {
    name: '5HP Industrial Motor',
    weekly: generateWeeklyDemand({
      base: 3, trend: 0.02, seasonAmplitude: 1, noiseAmplitude: 2, weeks: 52, seed: 3,
    }),
  },

  // MTR-150: Compact motor. Steady mid-volume.
  'MTR-150': {
    name: '1.5HP Compact Motor',
    weekly: generateWeeklyDemand({
      base: 12, trend: 0.08, seasonAmplitude: 3, noiseAmplitude: 2, weeks: 52, seed: 4,
    }),
  },

  // MTR-300: Mid-range motor. Moderate seasonality.
  'MTR-300': {
    name: '3HP Mid-Range Motor',
    weekly: generateWeeklyDemand({
      base: 10, trend: 0.06, seasonAmplitude: 4, noiseAmplitude: 2.5, weeks: 52, seed: 5,
    }),
  },

  // MTR-400: Heavy-duty motor. Growing demand.
  'MTR-400': {
    name: '4HP Heavy-Duty Motor',
    weekly: generateWeeklyDemand({
      base: 6, trend: 0.12, seasonAmplitude: 2, noiseAmplitude: 1.5, weeks: 52, seed: 6,
    }),
  },

  // MTR-600: High-torque motor. Stable, low volume.
  'MTR-600': {
    name: '6HP High-Torque Motor',
    weekly: generateWeeklyDemand({
      base: 4, trend: 0.03, seasonAmplitude: 1.5, noiseAmplitude: 1.5, weeks: 52, seed: 7,
    }),
  },

  // MTR-700: Explosion-proof motor. Niche, lumpy.
  'MTR-700': {
    name: '7HP Explosion-Proof Motor',
    weekly: generateWeeklyDemand({
      base: 2, trend: 0.01, seasonAmplitude: 0.8, noiseAmplitude: 1.5, weeks: 52, seed: 8,
    }),
  },

  // MTR-800: Marine-grade motor. Seasonal (summer peak).
  'MTR-800': {
    name: '8HP Marine-Grade Motor',
    weekly: generateWeeklyDemand({
      base: 5, trend: 0.04, seasonAmplitude: 4, noiseAmplitude: 2, weeks: 52, seed: 9,
    }),
  },

  // MTR-900: Variable-speed motor. Growing fast.
  'MTR-900': {
    name: '9HP Variable-Speed Motor',
    weekly: generateWeeklyDemand({
      base: 3, trend: 0.18, seasonAmplitude: 1, noiseAmplitude: 1.5, weeks: 52, seed: 10,
    }),
  },

  // MTR-1000: Ultra-heavy industrial. Very low volume, sporadic.
  'MTR-1000': {
    name: '10HP Ultra-Heavy Motor',
    weekly: generateWeeklyDemand({
      base: 1, trend: 0.01, seasonAmplitude: 0.5, noiseAmplitude: 1, weeks: 52, seed: 11,
    }),
  },
};

/**
 * Get demand history as period-labeled arrays
 */
export function getDemandWithPeriods(skuCode) {
  const data = demandHistory[skuCode];
  if (!data) return null;

  const base = new Date('2025-04-07'); // Start of history (1 year ago)
  const periods = data.weekly.map((_, i) => {
    const d = new Date(base);
    d.setDate(d.getDate() + i * 7);
    return d.toISOString().slice(0, 10);
  });

  return {
    skuCode,
    skuName: data.name,
    periods,
    demand: data.weekly,
  };
}
