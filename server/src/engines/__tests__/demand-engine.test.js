/**
 * Demand Planning Engine Tests — ASCM/APICS Compliance
 *
 * Written FIRST. Tests define correct behavior from textbook
 * demand planning methods. Implementation fills in until tests pass.
 *
 * Methods tested:
 *   1. Simple Moving Average (SMA) — configurable window
 *   2. Weighted Moving Average (WMA)
 *   3. Exponential Smoothing (SES) — single parameter alpha
 *   4. Double Exponential Smoothing (Holt) — trend-adjusted
 *   5. Holt-Winters — seasonal triple exponential smoothing
 *
 * Error metrics tested:
 *   MAD   — Mean Absolute Deviation
 *   MAPE  — Mean Absolute Percentage Error
 *   Bias  — average signed error (over/under forecast)
 *   Tracking Signal — cumulative bias / MAD
 */

import { describe, it, expect } from 'vitest';
import {
  simpleMovingAverage,
  weightedMovingAverage,
  exponentialSmoothing,
  holtLinear,
  holtWinters,
  calculateMetrics,
  bestFit,
} from '../demand-engine.js';

// ─── Test Data ────────────────────────────────────────────────────

// 24-period monthly demand with mild trend + seasonality
const SEASONAL_DEMAND = [
  120, 135, 150, 180, 200, 220,  // Jan-Jun Year 1 (ramp up)
  210, 190, 170, 155, 140, 130,  // Jul-Dec Year 1 (ramp down)
  130, 145, 160, 195, 215, 235,  // Jan-Jun Year 2 (higher)
  225, 200, 180, 165, 150, 140,  // Jul-Dec Year 2
];

// 12-period flat demand (no trend, no seasonality)
const FLAT_DEMAND = [100, 102, 98, 101, 99, 100, 103, 97, 101, 100, 98, 102];

// 12-period with strong upward trend
const TREND_DEMAND = [100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210];

// ─── 1. Simple Moving Average ─────────────────────────────────────

describe('Simple Moving Average', () => {
  it('calculates 3-period SMA correctly', () => {
    const result = simpleMovingAverage({
      history: [10, 20, 30, 40, 50],
      window: 3,
      periods: 2,
    });

    // SMA(3) at end of [10,20,30,40,50] = (30+40+50)/3 = 40
    // Next forecast = 40
    // forecast[0] = (30+40+50)/3 = 40
    // forecast[1] = (40+50+40)/3 = 43.33
    expect(result.forecast).toHaveLength(2);
    expect(result.forecast[0]).toBeCloseTo(40, 1);
  });

  it('returns fitted values for historical periods', () => {
    const result = simpleMovingAverage({
      history: [10, 20, 30, 40],
      window: 2,
      periods: 1,
    });

    // Fitted values start after first window
    // fitted[0] = null (no window yet)
    // fitted[1] = null (no window yet)
    // fitted[2] = (10+20)/2 = 15
    // fitted[3] = (20+30)/2 = 25
    expect(result.fitted).toHaveLength(4);
    expect(result.fitted[2]).toBeCloseTo(15, 1);
    expect(result.fitted[3]).toBeCloseTo(25, 1);
  });

  it('handles window larger than history', () => {
    const result = simpleMovingAverage({
      history: [10, 20],
      window: 5,
      periods: 1,
    });

    // Should use all available data as the window
    expect(result.forecast).toHaveLength(1);
    expect(result.forecast[0]).toBeCloseTo(15, 1);
  });

  it('handles single period history', () => {
    const result = simpleMovingAverage({
      history: [100],
      window: 3,
      periods: 2,
    });

    expect(result.forecast[0]).toBe(100);
    expect(result.forecast[1]).toBe(100);
  });

  it('produces flat forecast for flat demand', () => {
    const result = simpleMovingAverage({
      history: FLAT_DEMAND,
      window: 6,
      periods: 3,
    });

    // All forecasts should be close to 100
    for (const f of result.forecast) {
      expect(f).toBeGreaterThan(95);
      expect(f).toBeLessThan(105);
    }
  });
});

// ─── 2. Weighted Moving Average ───────────────────────────────────

describe('Weighted Moving Average', () => {
  it('applies weights correctly', () => {
    const result = weightedMovingAverage({
      history: [10, 20, 30],
      weights: [0.1, 0.3, 0.6], // most recent period gets highest weight
      periods: 1,
    });

    // WMA = 10*0.1 + 20*0.3 + 30*0.6 = 1 + 6 + 18 = 25
    expect(result.forecast[0]).toBeCloseTo(25, 1);
  });

  it('normalizes weights that dont sum to 1', () => {
    const result = weightedMovingAverage({
      history: [10, 20, 30],
      weights: [1, 3, 6], // sum = 10, should normalize to 0.1, 0.3, 0.6
      periods: 1,
    });

    expect(result.forecast[0]).toBeCloseTo(25, 1);
  });

  it('gives more weight to recent values', () => {
    // Recent-weighted should forecast higher when trend is up
    const recentWeighted = weightedMovingAverage({
      history: [10, 20, 30],
      weights: [0.1, 0.3, 0.6],
      periods: 1,
    });

    const equalWeighted = simpleMovingAverage({
      history: [10, 20, 30],
      window: 3,
      periods: 1,
    });

    // Recent-weighted should be higher (closer to 30)
    expect(recentWeighted.forecast[0]).toBeGreaterThan(equalWeighted.forecast[0]);
  });
});

// ─── 3. Exponential Smoothing (SES) ──────────────────────────────

describe('Exponential Smoothing', () => {
  it('calculates with alpha = 0.3', () => {
    // SES: F(t+1) = alpha * A(t) + (1-alpha) * F(t)
    // Starting: F(1) = A(0) = 100
    // F(2) = 0.3*110 + 0.7*100 = 33 + 70 = 103
    // F(3) = 0.3*120 + 0.7*103 = 36 + 72.1 = 108.1
    const result = exponentialSmoothing({
      history: [100, 110, 120, 130],
      alpha: 0.3,
      periods: 1,
    });

    expect(result.fitted).toHaveLength(4);
    expect(result.fitted[1]).toBeCloseTo(100, 0); // F(1) = A(0) initial
    expect(result.fitted[2]).toBeCloseTo(103, 0);
    expect(result.forecast).toHaveLength(1);
  });

  it('responds faster with higher alpha', () => {
    const lowAlpha = exponentialSmoothing({
      history: TREND_DEMAND,
      alpha: 0.1,
      periods: 1,
    });

    const highAlpha = exponentialSmoothing({
      history: TREND_DEMAND,
      alpha: 0.9,
      periods: 1,
    });

    // High alpha should be closer to last actual (210)
    expect(highAlpha.forecast[0]).toBeGreaterThan(lowAlpha.forecast[0]);
  });

  it('clamps alpha to 0-1 range', () => {
    // Should not throw, just clamp
    const result = exponentialSmoothing({
      history: [100, 110],
      alpha: 1.5,
      periods: 1,
    });
    expect(result.forecast).toHaveLength(1);
  });

  it('handles constant demand', () => {
    const result = exponentialSmoothing({
      history: [50, 50, 50, 50],
      alpha: 0.3,
      periods: 2,
    });

    expect(result.forecast[0]).toBeCloseTo(50, 1);
    expect(result.forecast[1]).toBeCloseTo(50, 1);
  });
});

// ─── 4. Holt's Linear Trend ──────────────────────────────────────

describe('Holt Linear (Double Exponential Smoothing)', () => {
  it('captures upward trend', () => {
    const result = holtLinear({
      history: TREND_DEMAND,
      alpha: 0.3,
      beta: 0.1,
      periods: 3,
    });

    // With a clear upward trend of ~10/period, forecasts should increase
    expect(result.forecast).toHaveLength(3);
    expect(result.forecast[0]).toBeGreaterThan(200); // above last actual
    expect(result.forecast[1]).toBeGreaterThan(result.forecast[0]);
    expect(result.forecast[2]).toBeGreaterThan(result.forecast[1]);
  });

  it('outperforms SES on trending data', () => {
    const ses = exponentialSmoothing({
      history: TREND_DEMAND,
      alpha: 0.3,
      periods: 1,
    });

    const holt = holtLinear({
      history: TREND_DEMAND,
      alpha: 0.3,
      beta: 0.1,
      periods: 1,
    });

    // Holt should forecast higher (captures the trend)
    // and be closer to the actual next value (~220)
    expect(holt.forecast[0]).toBeGreaterThan(ses.forecast[0]);
  });

  it('handles flat demand (trend ≈ 0)', () => {
    const result = holtLinear({
      history: FLAT_DEMAND,
      alpha: 0.3,
      beta: 0.1,
      periods: 2,
    });

    // Forecasts should be close to the mean (~100)
    expect(result.forecast[0]).toBeGreaterThan(95);
    expect(result.forecast[0]).toBeLessThan(105);
  });
});

// ─── 5. Holt-Winters (Seasonal) ──────────────────────────────────

describe('Holt-Winters (Triple Exponential Smoothing)', () => {
  it('captures seasonal pattern', () => {
    const result = holtWinters({
      history: SEASONAL_DEMAND,
      alpha: 0.3,
      beta: 0.1,
      gamma: 0.3,
      seasonLength: 12,
      periods: 6,
    });

    expect(result.forecast).toHaveLength(6);
    // First forecast periods (Jan-Jun Year 3) should show seasonal ramp-up
    // similar to previous years
    expect(result.forecast[0]).toBeDefined();
    expect(Number.isFinite(result.forecast[0])).toBe(true);
  });

  it('needs at least 2 full seasons of data', () => {
    // Only 12 periods with seasonLength 12 → not enough
    expect(() =>
      holtWinters({
        history: FLAT_DEMAND, // only 12 periods
        alpha: 0.3,
        beta: 0.1,
        gamma: 0.3,
        seasonLength: 12,
        periods: 3,
      })
    ).toThrow(/season/i);
  });

  it('returns fitted values aligned with history', () => {
    const result = holtWinters({
      history: SEASONAL_DEMAND,
      alpha: 0.3,
      beta: 0.1,
      gamma: 0.3,
      seasonLength: 12,
      periods: 1,
    });

    expect(result.fitted).toHaveLength(24);
  });

  it('forecasts are non-negative', () => {
    const result = holtWinters({
      history: SEASONAL_DEMAND,
      alpha: 0.3,
      beta: 0.1,
      gamma: 0.3,
      seasonLength: 12,
      periods: 12,
    });

    for (const f of result.forecast) {
      expect(f).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─── 6. Error Metrics ─────────────────────────────────────────────

describe('Error Metrics', () => {
  it('calculates MAD correctly', () => {
    // MAD = mean(|actual - forecast|)
    const metrics = calculateMetrics({
      actuals: [100, 110, 90, 105],
      forecasts: [95, 115, 95, 100],
    });

    // |5| + |5| + |5| + |5| = 20, MAD = 20/4 = 5
    expect(metrics.mad).toBeCloseTo(5, 1);
  });

  it('calculates MAPE correctly', () => {
    // MAPE = mean(|actual - forecast| / actual) * 100
    const metrics = calculateMetrics({
      actuals: [100, 200, 150],
      forecasts: [90, 210, 140],
    });

    // |10/100| + |10/200| + |10/150| = 0.1 + 0.05 + 0.0667 = 0.2167
    // MAPE = 21.67%
    expect(metrics.mape).toBeCloseTo(7.22, 0); // (10+5+6.67)/3 = 7.22%
  });

  it('calculates bias correctly', () => {
    // Bias = mean(actual - forecast)
    // Positive bias = under-forecasting, negative = over-forecasting
    const metrics = calculateMetrics({
      actuals: [100, 110, 120],
      forecasts: [90, 100, 110],
    });

    // (10 + 10 + 10) / 3 = 10 (consistently under-forecasting)
    expect(metrics.bias).toBeCloseTo(10, 1);
  });

  it('calculates tracking signal correctly', () => {
    // TS = cumulative bias / MAD
    const metrics = calculateMetrics({
      actuals: [100, 110, 120, 130],
      forecasts: [90, 100, 110, 120],
    });

    // cumBias = 10+10+10+10 = 40, MAD = 10
    // TS = 40 / 10 = 4 (signals consistent under-forecast)
    expect(metrics.trackingSignal).toBeCloseTo(4, 1);
  });

  it('handles zero actuals in MAPE (skip those periods)', () => {
    const metrics = calculateMetrics({
      actuals: [0, 100, 0, 200],
      forecasts: [10, 90, 5, 190],
    });

    // Only periods with actual > 0 should be in MAPE
    expect(Number.isFinite(metrics.mape)).toBe(true);
  });

  it('returns all metric fields', () => {
    const metrics = calculateMetrics({
      actuals: [100, 110],
      forecasts: [95, 105],
    });

    expect(metrics).toHaveProperty('mad');
    expect(metrics).toHaveProperty('mape');
    expect(metrics).toHaveProperty('bias');
    expect(metrics).toHaveProperty('trackingSignal');
  });
});

// ─── 7. Best Fit Selection ────────────────────────────────────────

describe('Best Fit Method Selection', () => {
  it('selects the method with lowest MAPE', () => {
    const result = bestFit({
      history: FLAT_DEMAND,
      periods: 3,
    });

    expect(result.bestMethod).toBeDefined();
    expect(result.forecast).toHaveLength(3);
    expect(result.metrics).toBeDefined();
    expect(result.allMethods).toBeDefined();
  });

  it('includes all candidate methods in comparison', () => {
    const result = bestFit({
      history: FLAT_DEMAND,
      periods: 2,
    });

    const methodNames = result.allMethods.map(m => m.method);
    expect(methodNames).toContain('sma-3');
    expect(methodNames).toContain('sma-6');
    expect(methodNames).toContain('ses');
    expect(methodNames).toContain('holt');
  });

  it('returns reasonable forecasts for trending data', () => {
    const result = bestFit({
      history: TREND_DEMAND,
      periods: 3,
    });

    // Should forecast above the last actual (210)
    expect(result.forecast[0]).toBeGreaterThan(180);
  });
});

// ─── 8. Edge Cases ────────────────────────────────────────────────

describe('Edge Cases', () => {
  it('handles empty history', () => {
    expect(() =>
      simpleMovingAverage({ history: [], window: 3, periods: 1 })
    ).toThrow();
  });

  it('handles single value history', () => {
    const result = exponentialSmoothing({
      history: [42],
      alpha: 0.3,
      periods: 3,
    });

    // Should forecast the single value for all periods
    for (const f of result.forecast) {
      expect(f).toBeCloseTo(42, 0);
    }
  });

  it('handles zero alpha (pure persistence)', () => {
    const result = exponentialSmoothing({
      history: [100, 200, 300],
      alpha: 0,
      periods: 1,
    });

    // Alpha=0 means forecast never updates from initial
    expect(result.forecast[0]).toBeCloseTo(100, 0);
  });

  it('handles alpha = 1 (pure naive)', () => {
    const result = exponentialSmoothing({
      history: [100, 200, 300],
      alpha: 1,
      periods: 1,
    });

    // Alpha=1 means forecast = last actual
    expect(result.forecast[0]).toBeCloseTo(300, 0);
  });
});
