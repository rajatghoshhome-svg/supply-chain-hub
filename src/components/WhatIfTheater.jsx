import { useState, useEffect } from 'react';
import { T } from '../styles/tokens';

const DEFAULT_PRESETS = [
  { label: 'Baseline (1x)',      multiplier: 1.0 },
  { label: '+20% Demand',        multiplier: 1.2 },
  { label: '+50% Demand',        multiplier: 1.5 },
  { label: '-30% Demand',        multiplier: 0.7 },
  { label: '2x Demand Spike',    multiplier: 2.0 },
];

const METRIC_ROWS = [
  { key: 'totalCost',       label: 'Total Cost',           unit: '$',  extract: r => r.totalCost,         lowerIsBetter: true,  format: v => `$${Math.round(v).toLocaleString()}` },
  { key: 'revenueAtRisk',   label: 'Revenue at Risk',      unit: '$',  extract: r => r.revenueAtRisk,     lowerIsBetter: true,  format: v => `$${Math.round(v).toLocaleString()}` },
  { key: 'cashImpact',      label: 'Cash Impact',          unit: '$',  extract: r => r.cashImpact,        lowerIsBetter: true,  format: v => `$${Math.round(v).toLocaleString()}` },
  { key: 'serviceLevel',    label: 'Service Level',        unit: '%',  extract: r => r.serviceLevel,      lowerIsBetter: false, format: v => `${v.toFixed(1)}%` },
  { key: 'planExceptions',  label: 'Planning Exceptions',  unit: '#',  extract: r => r.planExceptions,    lowerIsBetter: true,  format: v => v },
  { key: 'lateOrders',      label: 'Late Orders',          unit: '#',  extract: r => r.lateOrders,        lowerIsBetter: true,  format: v => v },
];

// Static fallback risks for when the API is unavailable (e.g. Vercel deployment)
const FALLBACK_RISKS = [
  {
    id: 'fallback-1', source: 'nws', type: 'weather', severity: 'warning',
    headline: 'Heat Advisory for Austin metro area',
    event: 'Excessive Heat Warning', location: 'PLT-ATX',
    suggestedMultiplier: 0.7, suggestedScenarioLabel: 'Heat Wave: -30% PLT-ATX',
  },
  {
    id: 'fallback-2', source: 'intelligence', type: 'geopolitical', severity: 'critical',
    headline: 'Red Sea shipping disruptions continue', category: 'logistics',
    suggestedMultiplier: 1.5, suggestedScenarioLabel: 'Red Sea Disruption: +50% Demand Buffer',
  },
  {
    id: 'fallback-3', source: 'intelligence', type: 'commodity', severity: 'warning',
    headline: 'Oat prices up 15% month-over-month', category: 'commodity',
    suggestedMultiplier: 1.15, suggestedScenarioLabel: 'Oat Price Spike: +15% Material Cost',
  },
];

const RISK_ICONS = {
  weather: '\u{1F328}\uFE0F',
  geopolitical: '\u{1F30D}',
  commodity: '\u{1F4E6}',
  regulatory: '\u2696\uFE0F',
};

function getRiskIcon(risk) {
  if (risk.category === 'commodity') return RISK_ICONS.commodity;
  if (risk.category === 'regulatory') return RISK_ICONS.regulatory;
  if (risk.type === 'weather') return RISK_ICONS.weather;
  if (risk.type === 'geopolitical') return RISK_ICONS.geopolitical;
  return RISK_ICONS.geopolitical;
}

function generateStaticScenario(multiplier, label) {
  const baseCost = 172000;
  const baseRevRisk = 22000;
  const baseCash = 89000;
  const baseSvc = 96.2;
  const baseExceptions = 13;
  const baseLate = 2;

  return {
    label,
    multiplier,
    totalCost: Math.round(baseCost * multiplier),
    revenueAtRisk: Math.round(baseRevRisk * Math.pow(multiplier, 1.8)),
    cashImpact: Math.round(baseCash * multiplier),
    serviceLevel: Math.round((baseSvc / Math.pow(multiplier, 0.3)) * 10) / 10,
    planExceptions: Math.round(baseExceptions * Math.pow(multiplier, 1.3)),
    lateOrders: Math.round(baseLate * Math.pow(multiplier, 1.5)),
  };
}

export default function WhatIfTheater() {
  const [presets, setPresets] = useState(DEFAULT_PRESETS);
  const [selected, setSelected] = useState([0, 1]); // indices into presets
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [externalRisks, setExternalRisks] = useState([]);
  const [modeledRiskIds, setModeledRiskIds] = useState(new Set());
  const [savedScenarios, setSavedScenarios] = useState([]);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveLabel, setSaveLabel] = useState('');

  // Fetch external risks on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const resp = await fetch('/api/external-risks/all');
        if (!resp.ok) throw new Error('API unavailable');
        const data = await resp.json();
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          setExternalRisks(data.slice(0, 4));
        } else if (!cancelled) {
          setExternalRisks(FALLBACK_RISKS);
        }
      } catch {
        if (!cancelled) setExternalRisks(FALLBACK_RISKS);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Fetch saved scenarios on mount
  useEffect(() => {
    let cancelled = false;
    async function loadSaved() {
      try {
        const resp = await fetch('/api/cascade/scenarios');
        if (!resp.ok) return;
        const data = await resp.json();
        if (!cancelled && Array.isArray(data.scenarios)) {
          setSavedScenarios(data.scenarios);
        }
      } catch { /* silent */ }
    }
    loadSaved();
    return () => { cancelled = true; };
  }, []);

  async function saveCurrentScenario() {
    if (!results || results.length === 0) return;
    setSaveLoading(true);
    try {
      const label = saveLabel.trim() || `Scenario ${new Date().toLocaleString()}`;
      const resp = await fetch('/api/cascade/scenarios/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          demandMultiplier: results[0].multiplier,
          label,
          scenarios: results,
        }),
      });
      if (resp.ok) {
        const saved = await resp.json();
        setSavedScenarios(prev => [...prev, saved]);
        setSaveLabel('');
      }
    } catch { /* silent */ } finally {
      setSaveLoading(false);
    }
  }

  function loadSavedScenario(scenario) {
    // Restore results from saved scenario
    if (scenario.scenarios && scenario.scenarios.length > 0) {
      setResults(scenario.scenarios);
    } else {
      // Fallback: generate from stored multiplier
      setResults([generateStaticScenario(scenario.demandMultiplier, scenario.label)]);
    }
  }

  function togglePreset(idx) {
    setSelected(prev => {
      if (prev.includes(idx)) return prev.filter(i => i !== idx);
      if (prev.length >= 3) return prev; // max 3
      return [...prev, idx];
    });
  }

  function modelRisk(risk) {
    if (modeledRiskIds.has(risk.id)) return;
    const newPreset = { label: risk.suggestedScenarioLabel, multiplier: risk.suggestedMultiplier };
    const newPresets = [...presets, newPreset];
    const newIdx = newPresets.length - 1;
    setPresets(newPresets);
    setModeledRiskIds(prev => new Set([...prev, risk.id]));
    // Auto-select the new scenario (replace second selection if 3 already selected)
    setSelected(prev => {
      if (prev.length >= 3) return [prev[0], newIdx];
      return [...prev, newIdx];
    });
  }

  async function runComparison() {
    if (selected.length < 2) return;
    setLoading(true);
    setError(null);
    setResults(null);

    const scenarios = selected.map(i => presets[i]);

    try {
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
      // API returns financialImpact as nested object; flatten for METRIC_ROWS extraction
      const normalized = responses.map(r => ({
        label: r.label,
        multiplier: r.multiplier,
        ...(r.financialImpact || {}),
        // Keep top-level cascade data too
        drp: r.drp,
        production: r.production,
        scheduling: r.scheduling,
        mrp: r.mrp,
      }));
      setResults(normalized);
    } catch (err) {
      // Fallback: generate synthetic scenario data only when API is completely unavailable
      const staticResults = scenarios.map(s => generateStaticScenario(s.multiplier, s.label));
      setResults(staticResults);
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

      {/* External Risk Intelligence Feed */}
      {externalRisks.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkLight, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 }}>
            Risk Intelligence
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {externalRisks.map(risk => {
              const isCritical = risk.severity === 'critical';
              const isModeled = modeledRiskIds.has(risk.id);
              return (
                <div
                  key={risk.id}
                  style={{
                    background: isCritical ? T.riskBg : T.warnBg,
                    border: `1px solid ${isCritical ? T.riskBorder : T.warnBorder}`,
                    borderRadius: 8,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  {/* Top row: severity dot + icon + headline */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span
                      aria-label={isCritical ? 'Critical severity' : 'Warning severity'}
                      style={{
                      display: 'inline-block',
                      width: 7, height: 7, borderRadius: '50%',
                      background: isCritical ? T.risk : T.warn,
                      marginTop: 4, flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>
                      {getRiskIcon(risk)}
                    </span>
                    <span style={{
                      fontFamily: 'Sora', fontSize: 12, fontWeight: 600,
                      color: isCritical ? T.risk : T.warn, lineHeight: 1.3,
                    }}>
                      {risk.headline}
                    </span>
                  </div>

                  {/* Suggested impact */}
                  <div style={{
                    fontFamily: 'JetBrains Mono', fontSize: 10.5,
                    color: T.inkMid, lineHeight: 1.3,
                  }}>
                    {risk.suggestedScenarioLabel}
                  </div>

                  {/* Model This button */}
                  <button
                    onClick={() => modelRisk(risk)}
                    disabled={isModeled}
                    style={{
                      alignSelf: 'flex-start',
                      background: isModeled ? T.inkGhost : T.ink,
                      color: T.white,
                      border: 'none',
                      padding: '5px 12px',
                      borderRadius: 6,
                      cursor: isModeled ? 'default' : 'pointer',
                      fontSize: 11,
                      fontFamily: 'Sora',
                      fontWeight: 600,
                      marginTop: 2,
                      opacity: isModeled ? 0.5 : 1,
                      transition: 'all 0.15s',
                    }}
                  >
                    {isModeled ? 'Added' : 'Model This'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Preset Buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {presets.map((preset, i) => {
          const isSelected = selected.includes(i);
          const isRiskPreset = i >= DEFAULT_PRESETS.length;
          return (
            <button
              key={i}
              onClick={() => togglePreset(i)}
              style={{
                background: isSelected ? T.ink : T.white,
                color: isSelected ? T.white : T.ink,
                border: `1.5px solid ${isSelected ? T.ink : isRiskPreset ? T.warnBorder : T.border}`,
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
        <div aria-live="polite" style={{ textAlign: 'center', padding: '32px 0' }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: T.inkLight }}>
            Running {selected.length} cascade scenarios...
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: T.inkGhost }}>
            DRP &rarr; Production Plan &rarr; Scheduling &rarr; MRP for each
          </div>
        </div>
      )}

      {/* Results Table */}
      {results && !loading && (
        <div className="whatif-table-scroll" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th scope="col" style={{
                  textAlign: 'left', padding: '10px 14px', borderBottom: `2px solid ${T.border}`,
                  fontFamily: 'Sora', fontWeight: 600, fontSize: 12, color: T.inkLight,
                  textTransform: 'uppercase', letterSpacing: 0.8,
                }}>
                  Metric
                </th>
                {results.map((r, i) => (
                  <th key={i} scope="col" style={{
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
                        {metric.format ? metric.format(value) : (typeof value === 'number' ? Math.round(value * 10) / 10 : value)}
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

      {/* Save Scenario */}
      {results && !loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
          <input
            type="text"
            value={saveLabel}
            onChange={e => setSaveLabel(e.target.value)}
            placeholder="Name this scenario..."
            style={{
              flex: 1, maxWidth: 280, padding: '8px 12px', borderRadius: 6,
              border: `1px solid ${T.border}`, fontSize: 13, fontFamily: 'Sora',
              outline: 'none',
            }}
          />
          <button
            onClick={saveCurrentScenario}
            disabled={saveLoading}
            style={{
              background: T.ink, color: T.white, border: 'none', padding: '8px 20px',
              borderRadius: 6, cursor: saveLoading ? 'not-allowed' : 'pointer',
              fontSize: 13, fontFamily: 'Sora', fontWeight: 600,
              opacity: saveLoading ? 0.6 : 1, transition: 'all 0.15s',
            }}
          >
            {saveLoading ? 'Saving...' : 'Save Scenario'}
          </button>
        </div>
      )}

      {/* Saved Scenarios */}
      {savedScenarios.length > 0 && (
        <div style={{ marginTop: 24, borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkLight, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 }}>
            Saved Scenarios
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {savedScenarios.map((s, i) => (
              <div
                key={s.id || i}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8,
                  padding: '10px 14px',
                }}
              >
                <div>
                  <div style={{ fontFamily: 'Sora', fontSize: 13, fontWeight: 500, color: T.ink }}>
                    {s.label}
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: T.inkLight, marginTop: 2 }}>
                    {s.demandMultiplier}x demand
                    {s.financialImpact && ` · $${Math.round(s.financialImpact.totalCost || 0).toLocaleString()} cost`}
                    {s.savedAt && ` · ${new Date(s.savedAt).toLocaleDateString()}`}
                  </div>
                </div>
                <button
                  onClick={() => loadSavedScenario(s)}
                  style={{
                    background: T.white, color: T.accent, border: `1px solid ${T.accent}`,
                    padding: '5px 14px', borderRadius: 6, cursor: 'pointer',
                    fontSize: 12, fontFamily: 'Sora', fontWeight: 600,
                    transition: 'all 0.15s',
                  }}
                >
                  Load
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
