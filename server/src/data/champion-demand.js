// ─────────────────────────────────────────────────────────────────────────────
// Champion Pet Foods — 104-Week Demand History Generator
//
// Generates realistic demand for ~65 SKUs × 5 customers = ~33,800 data points.
// All output is deterministic via seeded PRNG — same seed, same numbers every run.
//
// Patterns:
//   - Pet food: mild seasonality (slight summer dip, slight winter rise)
//   - Treats: holiday spike weeks 44-52
//   - Puppy formulas: spring peak weeks 12-20 (puppy season)
//   - Freeze-dried: mild holiday bump
//   - YoY trend: Orijen +7%, Acana +2%
//   - Customer mix: Petco 30%, Chewy 25%, PetSmart 20%, Independent 15%, Amazon 10%
//   - Size mix applied via sizeMixPct from catalog
//   - Noise: +/- 12% random variation
// ─────────────────────────────────────────────────────────────────────────────

import { skus, products, lines, families, baseDemandPerProduct } from './champion-catalog.js';

// ── Customers ──
export const customers = [
  { id: 'PETCO',   name: 'Petco',                  channel: 'specialty-retail', mixPct: 0.30 },
  { id: 'CHEWY',   name: 'Chewy',                  channel: 'ecommerce',       mixPct: 0.25 },
  { id: 'PETSMT',  name: 'PetSmart',               channel: 'specialty-retail', mixPct: 0.20 },
  { id: 'INDIE',   name: 'Independent Pet Stores',  channel: 'independent',     mixPct: 0.15 },
  { id: 'AMAZON',  name: 'Amazon',                  channel: 'ecommerce',       mixPct: 0.10 },
];

// ── Seeded PRNG (same LCG as Peakline for consistency) ──
function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// ── Seasonality functions ──

// General pet food: mild — slight winter uptick (people stock up), slight summer dip
function petFoodSeasonality(week) {
  // week 1 = early January
  // Winter bump centered on week 4 (late Jan) and week 48 (late Nov)
  const winterCenter = 48;
  const winterSpread = 8;
  const winterPeak = 1.08;
  const base = 0.96;
  const x1 = (week - winterCenter) / winterSpread;
  const x2 = (week - 4) / 6; // Jan bump
  return base + (winterPeak - base) * Math.exp(-0.5 * x1 * x1)
             + 0.04 * Math.exp(-0.5 * x2 * x2);
}

// Treats: strong holiday spike weeks 44-52 + mild Valentine's Day bump
function treatSeasonality(week) {
  const base = 0.80;
  // Holiday spike
  const holidayCenter = 49;
  const holidaySpread = 4;
  const holidayPeak = 1.65;
  const xH = (week - holidayCenter) / holidaySpread;
  // Valentine's bump (week 6-7)
  const xV = (week - 7) / 2;
  return base + (holidayPeak - base) * Math.exp(-0.5 * xH * xH)
             + 0.12 * Math.exp(-0.5 * xV * xV);
}

// Puppy formulas: spring peak weeks 12-20 (puppy season = new pet adoptions)
function puppySeasonality(week) {
  const base = 0.85;
  const springCenter = 16;
  const springSpread = 5;
  const springPeak = 1.35;
  const x = (week - springCenter) / springSpread;
  // Mild holiday bump (Christmas puppies → food demand starts ~week 1-4)
  const xH = (week - 2) / 3;
  return base + (springPeak - base) * Math.exp(-0.5 * x * x)
             + 0.10 * Math.exp(-0.5 * xH * xH);
}

// Freeze-dried: mild holiday bump (gifting, stocking stuffers)
function freezeDriedSeasonality(week) {
  const base = 0.92;
  const holidayCenter = 50;
  const holidaySpread = 5;
  const holidayPeak = 1.25;
  const x = (week - holidayCenter) / holidaySpread;
  return base + (holidayPeak - base) * Math.exp(-0.5 * x * x);
}

// Kitten: similar to puppy, spring peak
function kittenSeasonality(week) {
  // "Kitten season" peaks even earlier, April-June
  const base = 0.82;
  const springCenter = 18;
  const springSpread = 6;
  const springPeak = 1.40;
  const x = (week - springCenter) / springSpread;
  return base + (springPeak - base) * Math.exp(-0.5 * x * x);
}

// ── Pick seasonality function for a product ──
function getSeasonalityFn(productId) {
  const lower = productId.toLowerCase();
  if (lower.includes('puppy') || lower.includes('pup')) return puppySeasonality;
  if (lower.includes('kit')) return kittenSeasonality;

  const product = products.find(p => p.id === productId);
  if (!product) return petFoodSeasonality;
  const line = lines.find(l => l.id === product.lineId);
  if (!line) return petFoodSeasonality;
  const family = families.find(f => f.id === line.familyId);
  if (!family) return petFoodSeasonality;

  if (family.format === 'treat') return treatSeasonality;
  if (family.format === 'freeze-dried') return freezeDriedSeasonality;
  return petFoodSeasonality;
}

// ── YoY growth rate by brand ──
function getYoyGrowth(brandId) {
  return brandId === 'ORIJEN' ? 0.07 : 0.02;
}

// ── Week number helper ──
// Convert period index (0-103) to week-of-year (1-52)
function periodToWeekOfYear(periodIndex) {
  return (periodIndex % 52) + 1;
}

// ── Core generator ──
// Returns a Map where key = 'skuId|customerId' and value = number[104]
export function generateDemandHistory(seed = 2024) {
  const rand = seededRandom(seed);
  const demandMap = new Map();

  // Week 0 = 104 weeks ago from "now" (late March 2026)
  // That puts week 0 at ~early April 2024, week 103 at ~late March 2026
  const startDate = new Date('2024-04-01');

  for (const sku of skus) {
    const productBase = baseDemandPerProduct[sku.productId] || 500;
    // SKU-level base = product base × size mix percentage
    const skuBase = productBase * sku.sizeMixPct;
    const seasonFn = getSeasonalityFn(sku.productId);
    const yoyRate = getYoyGrowth(sku.brandId);
    // Weekly growth rate from annual: (1 + annual)^(1/52) - 1
    const weeklyGrowth = Math.pow(1 + yoyRate, 1 / 52) - 1;

    for (const customer of customers) {
      const key = `${sku.id}|${customer.id}`;
      const periods = new Array(104);
      const customerBase = skuBase * customer.mixPct;

      for (let w = 0; w < 104; w++) {
        const weekOfYear = periodToWeekOfYear(w);
        const seasonMult = seasonFn(weekOfYear);

        // Trend: compound growth from period 0
        const trendMult = Math.pow(1 + weeklyGrowth, w);

        // Noise: +/- 12%
        const noise = 1 + (rand() * 0.24 - 0.12);

        // Customer-specific variation: ecommerce slightly spikier
        let channelMod = 1.0;
        if (customer.channel === 'ecommerce' && weekOfYear >= 47 && weekOfYear <= 51) {
          // Cyber week / holiday online surge
          channelMod = 1.15;
        }
        if (customer.channel === 'independent') {
          // Independents slightly steadier, less seasonal
          channelMod = 0.92 + 0.08 * seasonMult;
        }

        const raw = customerBase * seasonMult * trendMult * noise * channelMod;
        periods[w] = Math.max(Math.round(raw), 0);
      }

      demandMap.set(key, periods);
    }
  }

  return demandMap;
}

// ── Week date labels ──
// Returns array of 104 ISO date strings (Monday of each week)
export function getWeekStartDates() {
  const startDate = new Date('2024-04-01'); // Monday
  const dates = [];
  for (let w = 0; w < 104; w++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + w * 7);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

// ── Aggregation helpers ──

// Sum demand arrays for a list of SKU IDs across one or all customers
export function aggregateDemand(demandMap, skuIds, customerId = null) {
  const result = new Array(104).fill(0);
  for (const skuId of skuIds) {
    const customerIds = customerId ? [customerId] : customers.map(c => c.id);
    for (const cId of customerIds) {
      const key = `${skuId}|${cId}`;
      const periods = demandMap.get(key);
      if (periods) {
        for (let w = 0; w < 104; w++) {
          result[w] += periods[w];
        }
      }
    }
  }
  return result;
}

// Sum demand for a single SKU across all customers
export function aggregateByCustomer(demandMap, skuId) {
  const byCustomer = {};
  for (const customer of customers) {
    const key = `${skuId}|${customer.id}`;
    byCustomer[customer.id] = demandMap.get(key) || new Array(104).fill(0);
  }
  return byCustomer;
}

// Get total demand for a SKU (all customers summed)
export function getSkuTotalDemand(demandMap, skuId) {
  return aggregateDemand(demandMap, [skuId]);
}

// ── Summary stats ──
export function getDemandSummary(demandMap) {
  let totalDataPoints = 0;
  let totalUnits = 0;
  let maxWeekly = 0;

  for (const [, periods] of demandMap) {
    totalDataPoints += periods.length;
    for (const v of periods) {
      totalUnits += v;
      if (v > maxWeekly) maxWeekly = v;
    }
  }

  return {
    totalKeys: demandMap.size,
    totalDataPoints,
    totalUnits,
    maxWeekly,
    skuCount: skus.length,
    customerCount: customers.length,
    periods: 104,
  };
}
