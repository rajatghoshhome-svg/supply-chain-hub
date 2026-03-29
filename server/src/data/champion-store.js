// ─────────────────────────────────────────────────────────────────────────────
// Champion Pet Foods — In-Memory Data Store
//
// Singleton initialized on server startup. Central data layer for all API routes.
//
// Responsibilities:
//   1. Import catalog, network, demand history
//   2. Generate statistical forecasts using best-fit method
//   3. Store finalForecast (initially = statForecast, editable via overrides)
//   4. Aggregation: sum children at any hierarchy level
//   5. Disaggregation: distribute parent-level edits proportionally to children
//   6. Hierarchy navigation: getChildren, getParent, getBreadcrumb
// ─────────────────────────────────────────────────────────────────────────────

import {
  brands, families, lines, products, skus,
  baseDemandPerProduct,
  getSkusForProduct, getSkusForLine, getSkusForFamily, getSkusForBrand,
  getProductsForLine, getLinesForFamily, getFamiliesForBrand,
  getBreadcrumb as catalogBreadcrumb,
  getHierarchyTree,
} from './champion-catalog.js';

import {
  generateDemandHistory, customers, getWeekStartDates,
  aggregateDemand,
} from './champion-demand.js';

import {
  plants, distributionCenters, lanes, workCenters,
  plantProductSourcing,
} from './champion-network.js';

import { bestFit, holtWinters, calculateMetrics } from '../engines/demand-engine.js';

// ─────────────────────────────────────────────────────────────────────────────
// Store state
// ─────────────────────────────────────────────────────────────────────────────

let _initialized = false;

// Core data
let _demandHistory = null;      // Map<'skuId|customerId', number[104]>
let _weekDates = null;          // string[104]

// Forecasts — keyed by 'skuId|customerId'
const _statForecasts = new Map();   // Map<key, { method, forecast: number[52], fitted: number[104], metrics }>
const _finalForecasts = new Map();  // Map<key, number[52]> — editable copy
const _overrides = new Map();       // Map<key, Map<periodIndex, { value, reason, timestamp }>>

// ── Forecast horizon ──
const HISTORY_PERIODS = 104;
const FORECAST_PERIODS = 52;  // 1-year forward forecast (total horizon = 2 years: 104 history + 52 forecast)

// ─────────────────────────────────────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────────────────────────────────────

export function initialize() {
  if (_initialized) return;

  console.log('[champion-store] Initializing Champion Pet Foods data...');
  const t0 = Date.now();

  // 1. Generate demand history
  _demandHistory = generateDemandHistory(2024);
  _weekDates = getWeekStartDates();

  // 2. Generate statistical forecasts for each SKU × customer
  let forecastCount = 0;
  for (const sku of skus) {
    for (const customer of customers) {
      const key = `${sku.id}|${customer.id}`;
      const history = _demandHistory.get(key);
      if (!history || history.length < 12) continue;

      try {
        // Use best-fit with 52-week season length (weekly data, annual seasonality)
        const result = bestFit({
          history,
          periods: FORECAST_PERIODS,
          seasonLength: 52,
        });

        _statForecasts.set(key, {
          method: result.bestMethod,
          forecast: result.forecast.map(v => Math.round(v)),
          fitted: result.fitted,
          metrics: result.metrics,
        });

        // Final forecast starts as a copy of stat forecast
        _finalForecasts.set(key, [...result.forecast.map(v => Math.round(v))]);
        forecastCount++;
      } catch {
        // If forecasting fails (not enough data, etc.), use simple average
        const avg = Math.round(history.reduce((s, v) => s + v, 0) / history.length);
        const forecast = new Array(FORECAST_PERIODS).fill(avg);
        _statForecasts.set(key, {
          method: 'average-fallback',
          forecast,
          fitted: new Array(HISTORY_PERIODS).fill(avg),
          metrics: { mad: 0, mape: 0, bias: 0, trackingSignal: 0 },
        });
        _finalForecasts.set(key, [...forecast]);
        forecastCount++;
      }
    }
  }

  _initialized = true;
  console.log(`[champion-store] Ready: ${skus.length} SKUs × ${customers.length} customers = ${forecastCount} forecasts in ${Date.now() - t0}ms`);
}

export function isInitialized() {
  return _initialized;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hierarchy navigation
// ─────────────────────────────────────────────────────────────────────────────

const LEVELS = ['brand', 'family', 'line', 'product', 'sku'];

export function getHierarchy() {
  return getHierarchyTree();
}

export function getChildren(level, id) {
  switch (level) {
    case 'all':
      return brands.map(b => ({ level: 'brand', id: b.id, name: b.name }));
    case 'brand':
      return getFamiliesForBrand(id).map(f => ({ level: 'family', id: f.id, name: f.name }));
    case 'family':
      return getLinesForFamily(id).map(l => ({ level: 'line', id: l.id, name: l.name }));
    case 'line':
      return getProductsForLine(id).map(p => ({ level: 'product', id: p.id, name: p.name }));
    case 'product':
      return getSkusForProduct(id).map(s => ({ level: 'sku', id: s.id, name: s.shortName }));
    case 'sku':
      return []; // leaf node
    default:
      return [];
  }
}

export function getParent(level, id) {
  switch (level) {
    case 'sku': {
      const sku = skus.find(s => s.id === id);
      return sku ? { level: 'product', id: sku.productId } : null;
    }
    case 'product': {
      const prod = products.find(p => p.id === id);
      return prod ? { level: 'line', id: prod.lineId } : null;
    }
    case 'line': {
      const line = lines.find(l => l.id === id);
      return line ? { level: 'family', id: line.familyId } : null;
    }
    case 'family': {
      const fam = families.find(f => f.id === id);
      return fam ? { level: 'brand', id: fam.brandId } : null;
    }
    case 'brand':
      return { level: 'all', id: 'all' };
    default:
      return null;
  }
}

export function getBreadcrumb(level, id) {
  if (level === 'sku') return catalogBreadcrumb(id);

  // Build breadcrumb by walking up from current level
  const crumbs = [{ level, id, name: getNodeName(level, id) }];
  let current = { level, id };
  while (current && current.level !== 'all') {
    current = getParent(current.level, current.id);
    if (current && current.level !== 'all') {
      crumbs.unshift({ ...current, name: getNodeName(current.level, current.id) });
    }
  }
  return crumbs;
}

function getNodeName(level, id) {
  switch (level) {
    case 'brand':   return brands.find(b => b.id === id)?.name || id;
    case 'family':  return families.find(f => f.id === id)?.name || id;
    case 'line':    return lines.find(l => l.id === id)?.name || id;
    case 'product': return products.find(p => p.id === id)?.name || id;
    case 'sku':     return skus.find(s => s.id === id)?.shortName || id;
    default:        return id;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SKU resolution — get leaf SKU IDs for any hierarchy level
// ─────────────────────────────────────────────────────────────────────────────

export function getSkuIdsForLevel(level, id) {
  switch (level) {
    case 'all':
      return skus.map(s => s.id);
    case 'brand':
      return getSkusForBrand(id).map(s => s.id);
    case 'family':
      return getSkusForFamily(id).map(s => s.id);
    case 'line':
      return getSkusForLine(id).map(s => s.id);
    case 'product':
      return getSkusForProduct(id).map(s => s.id);
    case 'sku':
      return [id];
    default:
      return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Data access — history, stat forecast, final forecast
// ─────────────────────────────────────────────────────────────────────────────

// Get raw history for a scope (aggregated to level)
export function getHistory(level, id, customerId = null) {
  const skuIds = getSkuIdsForLevel(level, id);
  return _aggregateFromMap(_demandHistory, skuIds, customerId);
}

// Get stat forecast for a scope
export function getStatForecast(level, id, customerId = null) {
  const skuIds = getSkuIdsForLevel(level, id);
  return _aggregateForecastFromMap(_statForecasts, skuIds, customerId);
}

// Get final (editable) forecast for a scope
export function getFinalForecast(level, id, customerId = null) {
  const skuIds = getSkuIdsForLevel(level, id);
  return _aggregateForecastFromMap(_finalForecasts, skuIds, customerId, true);
}

// Get forecast method info for a scope
export function getForecastMethod(level, id, customerId = null) {
  if (level === 'sku' && customerId) {
    const key = `${id}|${customerId}`;
    return _statForecasts.get(key)?.method || 'unknown';
  }
  // For aggregated views, return the most common method
  const skuIds = getSkuIdsForLevel(level, id);
  const methods = {};
  const custIds = customerId ? [customerId] : customers.map(c => c.id);
  for (const skuId of skuIds) {
    for (const cId of custIds) {
      const key = `${skuId}|${cId}`;
      const m = _statForecasts.get(key)?.method || 'unknown';
      methods[m] = (methods[m] || 0) + 1;
    }
  }
  const sorted = Object.entries(methods).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || 'unknown';
}

// Get accuracy metrics for a scope
export function getAccuracyMetrics(level, id, customerId = null) {
  const history = getHistory(level, id, customerId);
  const statForecast = getStatForecast(level, id, customerId);
  const finalForecast = getFinalForecast(level, id, customerId);

  // Use fitted values from stat forecast for historical comparison
  const skuIds = getSkuIdsForLevel(level, id);
  const fitted = _aggregateFittedFromMap(_statForecasts, skuIds, customerId);

  // Calculate metrics comparing fitted vs actuals (historical accuracy)
  const statMetrics = calculateMetrics({
    actuals: history,
    forecasts: fitted,
  });

  return {
    statMetrics,
    // Per-period accuracy bars: last 52 weeks of history vs fitted
    bars: buildAccuracyBars(history, fitted, finalForecast),
  };
}

function buildAccuracyBars(history, fitted, finalForecast) {
  // Show last 52 weeks of history with their fitted values
  const bars = [];
  const start = Math.max(0, history.length - 52);
  for (let i = start; i < history.length; i++) {
    bars.push({
      period: i,
      actual: history[i],
      stat: fitted[i] != null ? Math.round(fitted[i]) : null,
      final: null, // final forecast doesn't apply to historical periods
    });
  }
  // Add first few forecast periods (no actuals yet)
  const forecastShow = Math.min(finalForecast.length, 12);
  for (let i = 0; i < forecastShow; i++) {
    bars.push({
      period: history.length + i,
      actual: null,
      stat: Math.round(_aggregateForecastPeriod(_statForecasts, getSkuIdsForLevel('all', 'all'), null, i)),
      final: Math.round(finalForecast[i] || 0),
    });
  }
  return bars;
}

// ─────────────────────────────────────────────────────────────────────────────
// Overrides / Disaggregation
// ─────────────────────────────────────────────────────────────────────────────

// Apply an override at any hierarchy level
// If level > SKU, disaggregates proportionally to child SKUs
export function applyOverride(level, id, customerId, periodIndex, newValue, reason = 'Manual') {
  const skuIds = getSkuIdsForLevel(level, id);
  const custIds = customerId ? [customerId] : customers.map(c => c.id);

  if (skuIds.length === 1 && custIds.length === 1) {
    // Direct SKU × customer override
    _setFinalForecastValue(skuIds[0], custIds[0], periodIndex, newValue, reason);
    return { adjusted: 1, skuIds, level: 'direct' };
  }

  // Disaggregate: get current mix proportions at this period
  const currentValues = [];
  for (const skuId of skuIds) {
    for (const cId of custIds) {
      const key = `${skuId}|${cId}`;
      const forecast = _finalForecasts.get(key);
      const val = forecast ? forecast[periodIndex] || 0 : 0;
      currentValues.push({ skuId, customerId: cId, value: val });
    }
  }

  const currentTotal = currentValues.reduce((s, v) => s + v.value, 0);
  if (currentTotal === 0) {
    // Can't disaggregate from zero — spread evenly
    const evenSplit = Math.round(newValue / currentValues.length);
    for (const cv of currentValues) {
      _setFinalForecastValue(cv.skuId, cv.customerId, periodIndex, evenSplit, reason);
    }
  } else {
    // Proportional disaggregation
    let remaining = newValue;
    for (let i = 0; i < currentValues.length; i++) {
      const cv = currentValues[i];
      if (i === currentValues.length - 1) {
        // Last item gets the remainder to avoid rounding errors
        _setFinalForecastValue(cv.skuId, cv.customerId, periodIndex, remaining, reason);
      } else {
        const proportion = cv.value / currentTotal;
        const allocated = Math.round(newValue * proportion);
        _setFinalForecastValue(cv.skuId, cv.customerId, periodIndex, allocated, reason);
        remaining -= allocated;
      }
    }
  }

  return {
    adjusted: currentValues.length,
    skuIds,
    level: level === 'sku' ? 'customer-disagg' : 'hierarchy-disagg',
  };
}

function _setFinalForecastValue(skuId, customerId, periodIndex, value, reason) {
  const key = `${skuId}|${customerId}`;
  const forecast = _finalForecasts.get(key);
  if (!forecast) return;

  forecast[periodIndex] = Math.round(value);

  // Track the override
  if (!_overrides.has(key)) _overrides.set(key, new Map());
  _overrides.get(key).set(periodIndex, {
    value: Math.round(value),
    reason,
    timestamp: new Date().toISOString(),
  });
}

// Get overrides for a scope
export function getOverrides(level, id, customerId = null) {
  const skuIds = getSkuIdsForLevel(level, id);
  const custIds = customerId ? [customerId] : customers.map(c => c.id);
  const result = [];

  for (const skuId of skuIds) {
    for (const cId of custIds) {
      const key = `${skuId}|${cId}`;
      const overrideMap = _overrides.get(key);
      if (!overrideMap || overrideMap.size === 0) continue;

      for (const [period, info] of overrideMap) {
        result.push({
          skuId,
          customerId: cId,
          period,
          ...info,
        });
      }
    }
  }

  return result;
}

// Reset final forecast to stat forecast for a scope
export function resetOverrides(level, id, customerId = null) {
  const skuIds = getSkuIdsForLevel(level, id);
  const custIds = customerId ? [customerId] : customers.map(c => c.id);
  let count = 0;

  for (const skuId of skuIds) {
    for (const cId of custIds) {
      const key = `${skuId}|${cId}`;
      const stat = _statForecasts.get(key);
      if (!stat) continue;

      _finalForecasts.set(key, [...stat.forecast.map(v => Math.round(v))]);
      _overrides.delete(key);
      count++;
    }
  }

  return { reset: count };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal aggregation helpers
// ─────────────────────────────────────────────────────────────────────────────

function _aggregateFromMap(map, skuIds, customerId) {
  const result = new Array(HISTORY_PERIODS).fill(0);
  const custIds = customerId ? [customerId] : customers.map(c => c.id);

  for (const skuId of skuIds) {
    for (const cId of custIds) {
      const key = `${skuId}|${cId}`;
      const periods = map.get(key);
      if (periods) {
        for (let w = 0; w < HISTORY_PERIODS; w++) {
          result[w] += periods[w] || 0;
        }
      }
    }
  }
  return result;
}

function _aggregateForecastFromMap(map, skuIds, customerId, isFinal = false) {
  const result = new Array(FORECAST_PERIODS).fill(0);
  const custIds = customerId ? [customerId] : customers.map(c => c.id);

  for (const skuId of skuIds) {
    for (const cId of custIds) {
      const key = `${skuId}|${cId}`;
      const data = map.get(key);
      if (!data) continue;
      const periods = isFinal ? data : data.forecast;
      if (!periods) continue;
      for (let w = 0; w < FORECAST_PERIODS; w++) {
        result[w] += Math.round(periods[w] || 0);
      }
    }
  }
  return result;
}

function _aggregateFittedFromMap(statMap, skuIds, customerId) {
  const result = new Array(HISTORY_PERIODS).fill(0);
  const custIds = customerId ? [customerId] : customers.map(c => c.id);
  let hasData = false;

  for (const skuId of skuIds) {
    for (const cId of custIds) {
      const key = `${skuId}|${cId}`;
      const data = statMap.get(key);
      if (!data?.fitted) continue;
      hasData = true;
      for (let w = 0; w < HISTORY_PERIODS; w++) {
        if (data.fitted[w] != null) {
          result[w] += data.fitted[w];
        }
      }
    }
  }
  return hasData ? result : new Array(HISTORY_PERIODS).fill(null);
}

function _aggregateForecastPeriod(statMap, skuIds, customerId, periodIndex) {
  let total = 0;
  const custIds = customerId ? [customerId] : customers.map(c => c.id);
  for (const skuId of skuIds) {
    for (const cId of custIds) {
      const key = `${skuId}|${cId}`;
      const data = statMap.get(key);
      if (data?.forecast?.[periodIndex] != null) {
        total += data.forecast[periodIndex];
      }
    }
  }
  return total;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dimensions / pivots
// ─────────────────────────────────────────────────────────────────────────────

export function getDimensions() {
  return {
    product: {
      levels: LEVELS,
      values: {
        brand:   brands.map(b => ({ id: b.id, name: b.name })),
        family:  families.map(f => ({ id: f.id, name: f.name, parentId: f.brandId })),
        line:    lines.map(l => ({ id: l.id, name: l.name, parentId: l.familyId })),
        product: products.map(p => ({ id: p.id, name: p.name, parentId: p.lineId })),
        sku:     skus.map(s => ({ id: s.id, name: s.shortName, parentId: s.productId })),
      },
    },
    customer: {
      values: customers.map(c => ({ id: c.id, name: c.name, channel: c.channel })),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Data exports for other modules (DRP, MRP, etc.)
// ─────────────────────────────────────────────────────────────────────────────

export function getWeekDates() {
  return _weekDates;
}

export function getProducts() {
  return products;
}

export function getSkus() {
  return skus;
}

export function getCustomers() {
  return customers;
}

export function getPlants() {
  return plants;
}

export function getDistributionCenters() {
  return distributionCenters;
}

export function getLanes() {
  return lanes;
}

export function getWorkCenters() {
  return workCenters;
}

export function getPlantProductSourcing() {
  return plantProductSourcing;
}

// ── Summary for landing page / diagnostics ──
export function getStoreSummary() {
  return {
    company: 'Champion Pet Foods',
    brands: brands.length,
    families: families.length,
    lines: lines.length,
    products: products.length,
    skus: skus.length,
    customers: customers.length,
    plants: plants.length,
    dcs: distributionCenters.length,
    historyPeriods: HISTORY_PERIODS,
    forecastPeriods: FORECAST_PERIODS,
    totalForecasts: _statForecasts.size,
    totalOverrides: [..._overrides.values()].reduce((s, m) => s + m.size, 0),
    initialized: _initialized,
  };
}
