/**
 * Demand Planning Engine — Deterministic Forecasting
 *
 * Pure functions. No DB access, no side effects, no LLM calls.
 * Implements ASCM/APICS standard demand planning methods:
 *
 *   1. Simple Moving Average (SMA)
 *   2. Weighted Moving Average (WMA)
 *   3. Exponential Smoothing (SES)
 *   4. Holt's Linear Trend (Double Exponential Smoothing)
 *   5. Holt-Winters (Triple Exponential Smoothing — seasonal)
 *   6. Error Metrics: MAD, MAPE, Bias, Tracking Signal
 *   7. Best Fit Selection (lowest MAPE across candidates)
 *
 * Input:  historical demand array
 * Output: forecast array + fitted values + accuracy metrics
 */

// ─── 1. Simple Moving Average ─────────────────────────────────────

export function simpleMovingAverage({ history, window, periods }) {
  if (!history || history.length === 0) throw new Error('History is required');

  const w = Math.min(window, history.length);
  const fitted = new Array(history.length).fill(null);
  const extended = [...history]; // mutable copy for rolling forecast

  // Calculate fitted values for historical periods
  for (let t = w; t < history.length; t++) {
    let sum = 0;
    for (let i = t - w; i < t; i++) sum += history[i];
    fitted[t] = sum / w;
  }

  // Generate forecasts
  const forecast = [];
  for (let p = 0; p < periods; p++) {
    const start = extended.length - w;
    let sum = 0;
    for (let i = start; i < extended.length; i++) sum += extended[i];
    const f = sum / w;
    forecast.push(Math.round(f * 100) / 100);
    extended.push(f); // use forecast as input for next period
  }

  return { forecast, fitted, method: `sma-${window}` };
}

// ─── 2. Weighted Moving Average ───────────────────────────────────

export function weightedMovingAverage({ history, weights, periods }) {
  if (!history || history.length === 0) throw new Error('History is required');
  if (!weights || weights.length === 0) throw new Error('Weights are required');

  const w = Math.min(weights.length, history.length);

  // Normalize weights to sum to 1
  const trimmedWeights = weights.slice(-w);
  const weightSum = trimmedWeights.reduce((s, v) => s + v, 0);
  const normalizedWeights = trimmedWeights.map(v => v / weightSum);

  const fitted = new Array(history.length).fill(null);
  const extended = [...history];

  // Fitted values
  for (let t = w; t < history.length; t++) {
    let sum = 0;
    for (let i = 0; i < w; i++) {
      sum += history[t - w + i] * normalizedWeights[i];
    }
    fitted[t] = Math.round(sum * 100) / 100;
  }

  // Forecasts
  const forecast = [];
  for (let p = 0; p < periods; p++) {
    let sum = 0;
    for (let i = 0; i < w; i++) {
      sum += extended[extended.length - w + i] * normalizedWeights[i];
    }
    const f = Math.round(sum * 100) / 100;
    forecast.push(f);
    extended.push(f);
  }

  return { forecast, fitted, method: 'wma' };
}

// ─── 3. Exponential Smoothing (SES) ──────────────────────────────

export function exponentialSmoothing({ history, alpha, periods }) {
  if (!history || history.length === 0) throw new Error('History is required');

  const a = Math.max(0, Math.min(1, alpha)); // clamp 0-1
  const fitted = new Array(history.length).fill(null);

  // Initialize: F(0) = A(0)
  fitted[0] = history[0];
  let lastForecast = history[0];

  // Calculate fitted values: F(t) = alpha * A(t-1) + (1-alpha) * F(t-1)
  for (let t = 1; t < history.length; t++) {
    lastForecast = a * history[t - 1] + (1 - a) * lastForecast;
    fitted[t] = Math.round(lastForecast * 100) / 100;
  }

  // Final forecast state
  lastForecast = a * history[history.length - 1] + (1 - a) * lastForecast;

  // Generate forecasts (SES produces flat future)
  const forecast = [];
  for (let p = 0; p < periods; p++) {
    forecast.push(Math.round(lastForecast * 100) / 100);
  }

  return { forecast, fitted, method: 'ses' };
}

// ─── 4. Holt's Linear Trend ──────────────────────────────────────

export function holtLinear({ history, alpha, beta, periods }) {
  if (!history || history.length === 0) throw new Error('History is required');

  const a = Math.max(0, Math.min(1, alpha));
  const b = Math.max(0, Math.min(1, beta));

  const fitted = new Array(history.length).fill(null);

  // Initialize
  let level = history[0];
  let trend = history.length > 1 ? history[1] - history[0] : 0;
  fitted[0] = level;

  // Update through history
  for (let t = 1; t < history.length; t++) {
    const prevLevel = level;
    level = a * history[t] + (1 - a) * (prevLevel + trend);
    trend = b * (level - prevLevel) + (1 - b) * trend;
    fitted[t] = Math.round((prevLevel + trend) * 100) / 100;
  }

  // Generate forecasts
  const forecast = [];
  for (let p = 1; p <= periods; p++) {
    const f = level + p * trend;
    forecast.push(Math.round(f * 100) / 100);
  }

  return { forecast, fitted, method: 'holt' };
}

// ─── 5. Holt-Winters (Seasonal) ──────────────────────────────────

export function holtWinters({ history, alpha, beta, gamma, seasonLength, periods }) {
  if (!history || history.length === 0) throw new Error('History is required');
  if (history.length < seasonLength * 2) {
    throw new Error(`Holt-Winters requires at least 2 full seasons of data (need ${seasonLength * 2}, got ${history.length})`);
  }

  const a = Math.max(0, Math.min(1, alpha));
  const b = Math.max(0, Math.min(1, beta));
  const g = Math.max(0, Math.min(1, gamma));
  const m = seasonLength;

  // Initialize seasonal indices from first season
  const firstSeasonAvg = history.slice(0, m).reduce((s, v) => s + v, 0) / m;
  const seasonal = new Array(m);
  for (let i = 0; i < m; i++) {
    seasonal[i] = history[i] / firstSeasonAvg;
  }

  // Initialize level and trend from first two seasons
  const secondSeasonAvg = history.slice(m, 2 * m).reduce((s, v) => s + v, 0) / m;
  let level = firstSeasonAvg;
  let trend = (secondSeasonAvg - firstSeasonAvg) / m;

  const fitted = new Array(history.length).fill(null);

  // First season fitted values use initial estimates
  for (let i = 0; i < m; i++) {
    fitted[i] = Math.round((level + (i + 1) * trend) * seasonal[i] * 100) / 100;
  }

  // Update through history (starting from second season)
  for (let t = m; t < history.length; t++) {
    const sIdx = t % m;
    const prevLevel = level;

    // Level update
    level = a * (history[t] / seasonal[sIdx]) + (1 - a) * (prevLevel + trend);
    // Trend update
    trend = b * (level - prevLevel) + (1 - b) * trend;
    // Seasonal update
    seasonal[sIdx] = g * (history[t] / level) + (1 - g) * seasonal[sIdx];

    // Fitted value (one-step-ahead forecast made at t-1)
    fitted[t] = Math.round((prevLevel + trend) * seasonal[sIdx] * 100) / 100;
  }

  // Generate forecasts
  const forecast = [];
  for (let p = 1; p <= periods; p++) {
    const sIdx = (history.length - 1 + p) % m;
    const f = (level + p * trend) * seasonal[sIdx];
    forecast.push(Math.round(Math.max(0, f) * 100) / 100);
  }

  return { forecast, fitted, method: 'holt-winters' };
}

// ─── 6. Error Metrics ─────────────────────────────────────────────

export function calculateMetrics({ actuals, forecasts }) {
  const n = Math.min(actuals.length, forecasts.length);
  if (n === 0) return { mad: 0, mape: 0, bias: 0, trackingSignal: 0 };

  let sumAbsError = 0;
  let sumPctError = 0;
  let sumSignedError = 0;
  let pctCount = 0;

  for (let i = 0; i < n; i++) {
    if (forecasts[i] == null) continue;

    const error = actuals[i] - forecasts[i];
    const absError = Math.abs(error);

    sumAbsError += absError;
    sumSignedError += error;

    // MAPE: skip zero actuals
    if (actuals[i] !== 0) {
      sumPctError += absError / Math.abs(actuals[i]);
      pctCount++;
    }
  }

  const validCount = n;
  const mad = sumAbsError / validCount;
  const mape = pctCount > 0 ? (sumPctError / pctCount) * 100 : 0;
  const bias = sumSignedError / validCount;
  const trackingSignal = mad > 0 ? sumSignedError / mad : 0;

  return {
    mad: Math.round(mad * 100) / 100,
    mape: Math.round(mape * 100) / 100,
    bias: Math.round(bias * 100) / 100,
    trackingSignal: Math.round(trackingSignal * 100) / 100,
  };
}

// ─── 7. Best Fit Selection ────────────────────────────────────────

export function bestFit({ history, periods, seasonLength = 12 }) {
  if (!history || history.length === 0) throw new Error('History is required');

  const candidates = [];

  // SMA variants
  for (const w of [3, 6, 12]) {
    if (history.length >= w) {
      try {
        const result = simpleMovingAverage({ history, window: w, periods });
        const metrics = calculateMetrics({
          actuals: history,
          forecasts: result.fitted,
        });
        candidates.push({ ...result, metrics, method: `sma-${w}` });
      } catch { /* skip */ }
    }
  }

  // SES with multiple alpha values
  for (const alpha of [0.1, 0.3, 0.5]) {
    try {
      const result = exponentialSmoothing({ history, alpha, periods });
      const metrics = calculateMetrics({
        actuals: history,
        forecasts: result.fitted,
      });
      candidates.push({ ...result, metrics, method: `ses` });
    } catch { /* skip */ }
  }

  // Holt
  try {
    const result = holtLinear({ history, alpha: 0.3, beta: 0.1, periods });
    const metrics = calculateMetrics({
      actuals: history,
      forecasts: result.fitted,
    });
    candidates.push({ ...result, metrics, method: 'holt' });
  } catch { /* skip */ }

  // Holt-Winters (only if enough data)
  if (history.length >= seasonLength * 2) {
    try {
      const result = holtWinters({
        history, alpha: 0.3, beta: 0.1, gamma: 0.3,
        seasonLength, periods,
      });
      const metrics = calculateMetrics({
        actuals: history,
        forecasts: result.fitted,
      });
      candidates.push({ ...result, metrics, method: 'holt-winters' });
    } catch { /* skip */ }
  }

  if (candidates.length === 0) {
    throw new Error('No valid forecasting methods for the given data');
  }

  // Select by lowest MAPE (ignoring methods with MAPE=0 which means no fitted values)
  const validCandidates = candidates.filter(c => c.metrics.mape > 0);
  const best = (validCandidates.length > 0 ? validCandidates : candidates)
    .sort((a, b) => a.metrics.mape - b.metrics.mape)[0];

  return {
    bestMethod: best.method,
    forecast: best.forecast,
    fitted: best.fitted,
    metrics: best.metrics,
    allMethods: candidates.map(c => ({
      method: c.method,
      mape: c.metrics.mape,
      mad: c.metrics.mad,
      bias: c.metrics.bias,
      forecast: c.forecast,
    })),
  };
}
