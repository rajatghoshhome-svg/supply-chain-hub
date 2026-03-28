import { useState } from 'react';
import { T } from '../styles/tokens';

const PRESETS = [
  { label: 'Baseline (1x)',      multiplier: 1.0 },
  { label: '+20% Demand',        multiplier: 1.2 },
  { label: '+50% Demand',        multiplier: 1.5 },
  { label: '-30% Demand',        multiplier: 0.7 },
  { label: '2x Demand Spike',    multiplier: 2.0 },
];

const METRIC_ROWS = [
  { key: 'drpExceptions',  label: 'DRP Exceptions',    extract: r => r.drp.exceptions,        lowerIsBetter: true },
  { key: 'prodOrders',     label: 'Production Orders',  extract: r => r.production.orders,     lowerIsBetter: true },
  { key: 'schedOrders',    label: 'Scheduled Orders',   extract: r => r.scheduling.orders,     lowerIsBetter: false },
  { key: 'lateOrders',     label: 'Late Orders',        extract: r => r.scheduling.lateOrders, lowerIsBetter: true },
  { key: 'makespan',       label: 'Total Makespan (h)', extract: r => r.scheduling.makespan,   lowerIsBetter: true },
  { key: 'mrpExceptions',  label: 'MRP Exceptions',     extract: r => r.mrp.totalExceptions,   lowerIsBetter: true },
  { key: 'mrpCritical',    label: 'MRP Critical',       extract: r => r.mrp.critical,          lowerIsBetter: true },
];

export default function WhatIfTheater() {
  const [selected, setSelected] = useState([0, 1]); // indices into PRESETS
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function togglePreset(idx) {
    setSelected(prev => {
      if (prev.includes(idx)) return prev.filter(i => i !== idx);
      if (prev.length >= 3) return prev; // max 3
      return [...prev, idx];
    });
  }

  async function runComparison() {
    if (selected.length < 2) return;
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const scenarios = selected.map(i => PRESETS[i]);
      const responses = await Promise.all(
        scenarios.map(s =>
          fetch('/api/cascade/scenario', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ demandMultiplier: s.multiplier, label: s.label }),
          }).then(r => {
            if (!r.ok) throw new Error(`Scenario failed: ${s.label}`);
            return r.json();
          })
        )
      );
      setResults(responses);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function deltaColor(value, baseline, lowerIsBetter) {
    if (value === baseline) return T.inkMid;
    const isBetter = lowerIsBetter ? value < baseline : value > baseline;
    return isBetter ? T.safe : T.risk;
  }

  function formatDelta(value, baseline) {
    const diff = value - baseline;
    if (diff === 0) return '--';
    const sign = diff > 0 ? '+' : '';
    return `${sign}${Math.round(diff * 10) / 10}`;
  }

  const baselineIdx = results ? results.findIndex(r => r.multiplier === 1.0) : -1;
  const baseline = baselineIdx >= 0 ? results[baselineIdx] : null;

  return (
    <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 12, padding: '28px 32px' }}>
      {/* Header */}
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, color: T.inkLight, letterSpacing: 1.4, marginBottom: 6, textTransform: 'uppercase' }}>
        Scenario Analysis
      </div>
      <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 18, color: T.ink, letterSpacing: -0.3, marginBottom: 4 }}>
        What-If Theater
      </div>
      <div style={{ fontSize: 13, color: T.inkMid, lineHeight: 1.5, marginBottom: 20 }}>
        Compare demand scenarios side-by-side. Select 2-3 scenarios and run the full planning cascade for each.
      </div>

      {/* Preset Buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {PRESETS.map((preset, i) => {
          const isSelected = selected.includes(i);
          return (
            <button
              key={i}
              onClick={() => togglePreset(i)}
              style={{
                background: isSelected ? T.ink : T.white,
                color: isSelected ? T.white : T.ink,
                border: `1.5px solid ${isSelected ? T.ink : T.border}`,
                padding: '8px 16px',
                borderRadius: 8,
                cursor: selected.length >= 3 && !isSelected ? 'not-allowed' : 'pointer',
                fontSize: 13,
                fontFamily: 'Sora',
                fontWeight: 500,
                opacity: selected.length >= 3 && !isSelected ? 0.4 : 1,
                transition: 'all 0.15s',
              }}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* Compare Button */}
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={runComparison}
          disabled={selected.length < 2 || loading}
          style={{
            background: selected.length >= 2 ? T.accent : T.inkGhost,
            color: T.white,
            border: 'none',
            padding: '10px 28px',
            borderRadius: 8,
            cursor: selected.length >= 2 && !loading ? 'pointer' : 'not-allowed',
            fontSize: 14,
            fontFamily: 'Sora',
            fontWeight: 600,
            transition: 'all 0.15s',
          }}
        >
          {loading ? 'Running Scenarios...' : `Compare ${selected.length} Scenarios`}
        </button>
        {selected.length < 2 && (
          <span style={{ fontSize: 12, color: T.inkLight, marginLeft: 12 }}>Select at least 2 scenarios</span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: T.riskBg, border: `1px solid ${T.riskBorder}`, borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: T.risk }}>
          {error}
        </div>
      )}

      {/* Loading Indicator */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: T.inkLight }}>
            Running {selected.length} cascade scenarios...
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: T.inkGhost }}>
            DRP → Production Plan → Scheduling → MRP for each
          </div>
        </div>
      )}

      {/* Results Table */}
      {results && !loading && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{
                  textAlign: 'left', padding: '10px 14px', borderBottom: `2px solid ${T.border}`,
                  fontFamily: 'Sora', fontWeight: 600, fontSize: 12, color: T.inkLight,
                  textTransform: 'uppercase', letterSpacing: 0.8,
                }}>
                  Metric
                </th>
                {results.map((r, i) => (
                  <th key={i} style={{
                    textAlign: 'right', padding: '10px 14px', borderBottom: `2px solid ${T.border}`,
                    fontFamily: 'Sora', fontWeight: 600, fontSize: 12, color: T.ink,
                    minWidth: 120,
                  }}>
                    {r.label}
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkLight, fontWeight: 400, marginTop: 2 }}>
                      {r.multiplier}x demand
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRIC_ROWS.map((metric) => (
                <tr key={metric.key}>
                  <td style={{
                    padding: '10px 14px', borderBottom: `1px solid ${T.border}`,
                    fontFamily: 'Sora', fontSize: 13, color: T.inkMid,
                  }}>
                    {metric.label}
                  </td>
                  {results.map((r, i) => {
                    const value = metric.extract(r);
                    const color = baseline && r !== baseline
                      ? deltaColor(value, metric.extract(baseline), metric.lowerIsBetter)
                      : T.ink;
                    return (
                      <td key={i} style={{
                        textAlign: 'right', padding: '10px 14px', borderBottom: `1px solid ${T.border}`,
                        fontFamily: 'JetBrains Mono', fontSize: 14, fontWeight: 600, color,
                      }}>
                        {typeof value === 'number' ? Math.round(value * 10) / 10 : value}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* Delta Row */}
              {baseline && (
                <tr>
                  <td style={{
                    padding: '12px 14px', borderTop: `2px solid ${T.borderMid}`,
                    fontFamily: 'Sora', fontSize: 12, fontWeight: 600, color: T.ink,
                    textTransform: 'uppercase', letterSpacing: 0.5,
                  }}>
                    Delta vs Baseline
                  </td>
                  {results.map((r, i) => {
                    if (r === baseline) {
                      return (
                        <td key={i} style={{
                          textAlign: 'right', padding: '12px 14px', borderTop: `2px solid ${T.borderMid}`,
                          fontFamily: 'JetBrains Mono', fontSize: 12, color: T.inkGhost,
                        }}>
                          --
                        </td>
                      );
                    }
                    return (
                      <td key={i} style={{
                        textAlign: 'right', padding: '12px 14px', borderTop: `2px solid ${T.borderMid}`,
                        verticalAlign: 'top',
                      }}>
                        {METRIC_ROWS.filter(m => m.lowerIsBetter).map(metric => {
                          const val = metric.extract(r);
                          const base = metric.extract(baseline);
                          const delta = formatDelta(val, base);
                          const color = deltaColor(val, base, metric.lowerIsBetter);
                          return (
                            <div key={metric.key} style={{
                              fontFamily: 'JetBrains Mono', fontSize: 11, color,
                              marginBottom: 2, textAlign: 'right',
                            }}>
                              {metric.label.split(' ')[0]}: {delta}
                            </div>
                          );
                        })}
                      </td>
                    );
                  })}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
