// ─────────────────────────────────────────────────────────────────────────────
// Peakline Foods — 52-week Demand History
// Realistic demand for $120M CPG company (hundreds to low thousands cases/week)
//
// Seasonality:
//   - Beverages peak weeks 15-35 (spring/summer)
//   - Bars/snacks peak weeks 36-50 (fall/winter, back-to-school, holiday)
//   - Trail mix has additional holiday peaks (Thanksgiving/Christmas wk 44-51)
//   - +/-15% noise, slight upward trend (~0.15% per week)
// ─────────────────────────────────────────────────────────────────────────────

// Deterministic seeded PRNG for reproducible noise
function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// Seasonality multipliers by week (1-52)
function beverageSeasonality(week) {
  // Peak in summer (weeks 20-30), trough in winter
  const center = 25;
  const spread = 12;
  const peak = 1.35;
  const base = 0.72;
  const x = (week - center) / spread;
  return base + (peak - base) * Math.exp(-0.5 * x * x);
}

function barSnackSeasonality(week) {
  // Peak in fall/winter (weeks 36-50), with back-to-school and holiday
  const fallCenter = 43;
  const spread = 8;
  const peak = 1.30;
  const base = 0.78;
  const x = (week - fallCenter) / spread;
  // Also a mild back-to-school bump (week 34-38)
  const btsCenter = 36;
  const btsSpread = 3;
  const btsPeak = 1.10;
  const bts = (btsPeak - 1.0) * Math.exp(-0.5 * ((week - btsCenter) / btsSpread) ** 2);
  return base + (peak - base) * Math.exp(-0.5 * x * x) + bts;
}

function trailMixSeasonality(week) {
  // Base bar/snack seasonality + extra Thanksgiving/Christmas peak
  let base = barSnackSeasonality(week);
  // Holiday bump weeks 44-51
  if (week >= 44 && week <= 51) {
    const holidayCenter = 48;
    const x = (week - holidayCenter) / 3;
    base += 0.20 * Math.exp(-0.5 * x * x);
  }
  return base;
}

// Base annual demand per SKU per DC (cases/week at mid-year average)
// Total across 3 DCs * 52 weeks should sum to realistic annual volumes
// ~$120M revenue / avg ~$25 per case = ~4.8M cases/year = ~92K cases/week total
const baseDemand = {
  // Bars — ~30% of volume
  'GRN-BAR': { 'DC-ATL': 195, 'DC-CHI': 240, 'DC-LAS': 155 },  // ~590/wk = 30,680/yr
  'PRO-BAR': { 'DC-ATL': 170, 'DC-CHI': 210, 'DC-LAS': 130 },  // ~510/wk = 26,520/yr

  // Snacks — ~25% of volume
  'TRL-MIX': { 'DC-ATL': 140, 'DC-CHI': 175, 'DC-LAS': 108 },  // ~423/wk = 21,996/yr
  'VEG-CHP': { 'DC-ATL': 118, 'DC-CHI': 148, 'DC-LAS': 92 },   // ~358/wk = 18,616/yr
  'RCE-CRK': { 'DC-ATL': 85, 'DC-CHI': 108, 'DC-LAS': 68 },    // ~261/wk = 13,572/yr
  'NUT-BTR': { 'DC-ATL': 108, 'DC-CHI': 135, 'DC-LAS': 84 },   // ~327/wk = 17,004/yr

  // Beverages — ~45% of volume
  'SPK-WAT': { 'DC-ATL': 295, 'DC-CHI': 365, 'DC-LAS': 230 },  // ~890/wk = 46,280/yr
  'JCE-APL': { 'DC-ATL': 102, 'DC-CHI': 128, 'DC-LAS': 80 },   // ~310/wk = 16,120/yr
  'KMB-GNG': { 'DC-ATL': 75, 'DC-CHI': 95, 'DC-LAS': 60 },     // ~230/wk = 11,960/yr
  'NRG-CIT': { 'DC-ATL': 205, 'DC-CHI': 255, 'DC-LAS': 160 },  // ~620/wk = 32,240/yr
  'CLD-BRW': { 'DC-ATL': 58, 'DC-CHI': 74, 'DC-LAS': 46 },     // ~178/wk = 9,256/yr
};

const beverageSKUs = new Set(['SPK-WAT', 'JCE-APL', 'KMB-GNG', 'NRG-CIT', 'CLD-BRW']);
const trailMixSKU = 'TRL-MIX';

function generateDemandHistory() {
  const rand = seededRandom(42);
  const history = [];

  // 52 weeks of history, starting from week 1 of the prior year
  // Week 1 = first Monday of April 2025 (52 weeks back from late March 2026)
  const startDate = new Date('2025-03-31'); // Monday

  for (const [skuCode, dcDemand] of Object.entries(baseDemand)) {
    for (const [dcCode, weeklyBase] of Object.entries(dcDemand)) {
      for (let w = 0; w < 52; w++) {
        const weekNum = (w % 52) + 1; // 1-52
        const weekStart = new Date(startDate);
        weekStart.setDate(weekStart.getDate() + w * 7);

        // Determine seasonality
        let seasonMult;
        if (skuCode === trailMixSKU) {
          seasonMult = trailMixSeasonality(weekNum);
        } else if (beverageSKUs.has(skuCode)) {
          seasonMult = beverageSeasonality(weekNum);
        } else {
          seasonMult = barSnackSeasonality(weekNum);
        }

        // Slight upward trend: +0.15% per week
        const trendMult = 1 + 0.0015 * w;

        // Random noise: +/-15%
        const noise = 1 + (rand() * 0.30 - 0.15);

        const qty = Math.round(weeklyBase * seasonMult * trendMult * noise);

        history.push({
          skuCode,
          dcCode,
          weekStart: weekStart.toISOString().split('T')[0],
          periodType: 'weekly',
          actualQty: Math.max(qty, 0),
        });
      }
    }
  }

  return history;
}

export const demandHistory = generateDemandHistory();
