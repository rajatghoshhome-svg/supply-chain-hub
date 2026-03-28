import { useState, useEffect, useRef } from 'react';
import { T } from '../styles/tokens';
import ModuleLayout from '../components/shared/ModuleLayout';
import PageHeader from '../components/shared/PageHeader';
import Card from '../components/shared/Card';
import ForecastChart from '../components/demand/ForecastChart';

const TABS = [
  { id: 'forecast', label: 'Statistical Forecast' },
  { id: 'history', label: 'Demand History' },
  { id: 'accuracy', label: 'Forecast Accuracy' },
];

const OVERRIDE_REASONS = [
  'Promotion',
  'New Distribution Point',
  'Seasonal Adjustment',
  'Customer Intelligence',
  'Supply Constraint',
  'Other',
];

const REASON_COLORS = {
  'Promotion': { bg: '#EDE9FE', color: '#7C3AED', border: '#C4B5FD' },
  'New Distribution Point': { bg: '#DBEAFE', color: '#2563EB', border: '#93C5FD' },
  'Seasonal Adjustment': { bg: '#FEF3C7', color: '#D97706', border: '#FCD34D' },
  'Customer Intelligence': { bg: '#D1FAE5', color: '#059669', border: '#6EE7B7' },
  'Supply Constraint': { bg: '#FEE2E2', color: '#DC2626', border: '#FCA5A5' },
  'Other': { bg: '#F3F4F6', color: '#6B7280', border: '#D1D5DB' },
  'Manual': { bg: '#F3F4F6', color: '#6B7280', border: '#D1D5DB' },
};

const API = '/api/demand';

// ─── Static fallback data (used when API is unavailable, e.g. Vercel) ────
const STATIC_SKUS = [
  { skuCode: 'GRN-BAR', skuName: 'Oat & Honey Granola Bar' },
  { skuCode: 'PRO-BAR', skuName: 'Peanut Butter Protein Bar' },
  { skuCode: 'TRL-MIX', skuName: 'Classic Trail Mix' },
  { skuCode: 'VEG-CHP', skuName: 'Sea Salt Veggie Chips' },
  { skuCode: 'RCE-CRK', skuName: 'Brown Rice Crackers' },
  { skuCode: 'SPK-WAT', skuName: 'Lemon Sparkling Water' },
  { skuCode: 'JCE-APL', skuName: 'Cold-Pressed Apple Juice' },
  { skuCode: 'KMB-GNG', skuName: 'Ginger Kombucha' },
  { skuCode: 'NRG-CIT', skuName: 'Citrus Energy Drink' },
  { skuCode: 'CLD-BRW', skuName: 'Vanilla Cold Brew Coffee' },
  { skuCode: 'NUT-BTR', skuName: 'Almond Nut Butter' },
];

const STATIC_DEMO = {
  status: 'ok', skuCode: 'GRN-BAR', skuName: 'Oat & Honey Granola Bar',
  bestMethod: 'holt-winters',
  history: { periods: ['W01','W02','W03','W04','W05','W06','W07','W08','W09','W10','W11','W12'], demand: [520,545,530,558,542,570,555,580,568,590,575,598] },
  forecast: { periods: ['W13','W14','W15','W16','W17','W18'], demand: [528,515,505,495,488,480] },
  fitted: [518,543,532,556,544,568,557,578,570,588,577,596],
  metrics: { mape: 2.8, mad: 12.4, bias: -1.8, trackingSignal: -0.6 },
  allMethods: [
    { method: 'holt-winters', mape: 2.8, mad: 12.4, bias: -1.8, forecast: [528,515,505,495,488,480] },
    { method: 'exponential-smoothing', mape: 4.5, mad: 18.2, bias: 3.2, forecast: [540,535,530,525,520,518] },
    { method: 'moving-average-3', mape: 5.9, mad: 24.8, bias: 1.5, forecast: [554,548,542,538,534,530] },
    { method: 'moving-average-6', mape: 6.4, mad: 26.1, bias: -2.4, forecast: [560,555,550,545,540,536] },
    { method: 'weighted-moving-avg', mape: 4.1, mad: 16.8, bias: 0.8, forecast: [535,525,518,510,505,498] },
  ],
};

const STATIC_HISTORY = {
  skuCode: 'GRN-BAR', skuName: 'Oat & Honey Granola Bar',
  periods: ['W01','W02','W03','W04','W05','W06','W07','W08','W09','W10','W11','W12'],
  demand: [520,545,530,558,542,570,555,580,568,590,575,598],
};

const CASCADE_STEPS = [
  { id: 'demand', label: 'Demand', event: 'cascade:demand_updated' },
  { id: 'drp', label: 'DRP', event: 'cascade:drp_rebalanced' },
  { id: 'production', label: 'Prod Plan', event: 'cascade:production_plan_changed' },
  { id: 'scheduling', label: 'Scheduling', event: 'cascade:schedule_updated' },
  { id: 'mrp', label: 'MRP', event: 'cascade:mrp_run_complete' },
];

export default function DemandPage() {
  const [tab, setTab] = useState('forecast');
  const [skus, setSkus] = useState([]);
  const [selectedSku, setSelectedSku] = useState('GRN-BAR');
  const [demoData, setDemoData] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Planner overrides for demand forecast
  const [overrides, setOverrides] = useState({});
  const [editingCell, setEditingCell] = useState(null);
  const [overrideSaved, setOverrideSaved] = useState(false);

  // Cascade state
  const [cascadeActive, setCascadeActive] = useState(false);
  const [cascadeStepsDone, setCascadeStepsDone] = useState(0);
  const [cascadeStatus, setCascadeStatus] = useState(null); // 'running' | 'complete' | 'failed'
  const [cascadePlanRunId, setCascadePlanRunId] = useState(null);
  const sseRef = useRef(null);

  // Load SKU list
  useEffect(() => {
    fetch(`${API}/history`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => setSkus(data.skus || []))
      .catch(() => setSkus(STATIC_SKUS));
  }, []);

  // Clean up SSE on unmount
  useEffect(() => {
    return () => { sseRef.current?.close(); };
  }, []);

  // Connect to cascade SSE and track progress
  const connectCascadeSSE = (planRunId) => {
    sseRef.current?.close();
    setCascadeActive(true);
    setCascadeStepsDone(0);
    setCascadeStatus('running');
    setCascadePlanRunId(planRunId);

    const sse = new EventSource('/api/cascade/state');
    sseRef.current = sse;

    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'step_complete') {
          setCascadeStepsDone(prev => prev + 1);
        }
        if (data.type === 'cascade_complete') {
          setCascadeStatus('complete');
          setCascadeStepsDone(CASCADE_STEPS.length);
          sse.close();
        }
        if (data.type === 'cascade_failed') {
          setCascadeStatus('failed');
          sse.close();
        }
      } catch {}
    };
  };

  // Load demo forecast when SKU changes
  useEffect(() => {
    if (!selectedSku) return;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`${API}/demo/${selectedSku}`).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
      fetch(`${API}/history/${selectedSku}`).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
    ]).then(([demo, hist]) => {
      setDemoData(demo);
      setHistoryData(hist);
      setLoading(false);

      // If the server triggered a cascade, connect SSE to track it
      if (demo.cascade?.triggered) {
        connectCascadeSSE(demo.cascade.planRunId);
      }
    }).catch(() => {
      // Fallback to static data (e.g. on Vercel where no Express server runs)
      console.warn('Demand API unavailable, using static fallback data');
      setDemoData(STATIC_DEMO);
      setHistoryData(STATIC_HISTORY);
      setError(null);
      setLoading(false);
    });
  }, [selectedSku]);

  // Restore previously saved overrides when SKU changes
  // Overrides shape: { [period]: { value: number, reason: string } }
  useEffect(() => {
    if (!selectedSku) return;
    fetch(`${API}/overrides/${selectedSku}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(saved => {
        const ov = saved?.overrides || saved;
        if (ov && typeof ov === 'object' && Object.keys(ov).length > 0) {
          // Normalize: if old format (just numbers), wrap them
          const normalized = {};
          for (const [k, v] of Object.entries(ov)) {
            if (typeof v === 'number') {
              normalized[k] = { value: v, reason: 'Manual' };
            } else {
              normalized[k] = v;
            }
          }
          setOverrides(normalized);
        } else {
          setOverrides({});
        }
      })
      .catch(() => { setOverrides({}); });
  }, [selectedSku]);

  return (
    <ModuleLayout moduleContext="demand" tabs={TABS} activeTab={tab} onTabChange={setTab}>
      <PageHeader title="Demand Planning" subtitle="Forecast & Analyze" />

      <div className="module-content" style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 40px' }}>

        {/* Product Selector */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
          {(skus.length > 0 ? skus : [{ skuCode: 'GRN-BAR', skuName: 'Oat & Honey Granola Bar' }]).map(s => (
            <button
              key={s.skuCode}
              onClick={() => setSelectedSku(s.skuCode)}
              style={{
                background: selectedSku === s.skuCode ? T.ink : T.white,
                color: selectedSku === s.skuCode ? T.white : T.ink,
                border: `1px solid ${selectedSku === s.skuCode ? T.ink : T.border}`,
                borderRadius: 6,
                padding: '6px 12px',
                cursor: 'pointer',
                fontFamily: 'Inter',
                fontSize: 12,
                fontWeight: selectedSku === s.skuCode ? 500 : 400,
                transition: 'all 0.12s',
              }}
            >
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11 }}>{s.skuCode}</span>
              <span style={{ marginLeft: 5, color: selectedSku === s.skuCode ? 'rgba(255,255,255,0.7)' : T.inkLight, fontSize: 11 }}>{s.skuName}</span>
            </button>
          ))}
        </div>

        {/* Cascade Progress Bar */}
        {cascadeActive && (
          <div style={{
            background: T.white,
            border: `1px solid ${cascadeStatus === 'complete' ? T.safe : cascadeStatus === 'failed' ? T.risk : T.accent}`,
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontFamily: 'Sora', fontSize: 12, fontWeight: 600, color: T.ink }}>
                {cascadeStatus === 'complete' ? 'Cascade Complete' : cascadeStatus === 'failed' ? 'Cascade Failed' : 'Cascade Triggered'}
              </div>
              {cascadePlanRunId && (
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkLight }}>{cascadePlanRunId}</div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {CASCADE_STEPS.map((step, i) => {
                const done = i < cascadeStepsDone;
                const active = i === cascadeStepsDone && cascadeStatus === 'running';
                return (
                  <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '3px 8px', borderRadius: 4,
                      background: done ? `${T.safe}12` : active ? `${T.accent}12` : T.bgDark,
                      border: `1px solid ${done ? T.safe : active ? T.accent : T.border}`,
                      transition: 'all 0.3s',
                    }}>
                      <span style={{ fontSize: 10, color: done ? T.safe : active ? T.accent : T.inkLight }}>
                        {done ? '\u2713' : active ? '\u23F3' : '\u2022'}
                      </span>
                      <span style={{
                        fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 500,
                        color: done ? T.safe : active ? T.accent : T.inkLight,
                      }}>
                        {step.label}
                      </span>
                    </div>
                    {i < CASCADE_STEPS.length - 1 && (
                      <span style={{ fontSize: 10, color: done ? T.safe : T.inkGhost }}>{'\u2192'}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <Card>
            <div style={{ padding: 20, color: T.risk, fontSize: 13 }}>
              Error loading data: {error}. Make sure the server is running (<code style={{ fontFamily: 'JetBrains Mono', background: T.bgDark, padding: '2px 6px', borderRadius: 3 }}>npm run dev</code>)
            </div>
          </Card>
        )}

        {/* ─── Forecast Tab ────────────────────────────────────── */}
        {tab === 'forecast' && (
          <>
            <Card title={`Demand Forecast — ${selectedSku}`}>
              {loading ? (
                <div style={{ padding: 60, textAlign: 'center', color: T.inkLight }}>Loading forecast...</div>
              ) : demoData ? (
                <div style={{ padding: '16px 20px' }}>
                  {/* Method badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <span style={{ fontSize: 12, color: T.inkLight }}>Best fit:</span>
                    <span style={{
                      background: T.safeBg, color: T.safe, border: `1px solid ${T.safe}`,
                      padding: '3px 10px', borderRadius: 4, fontSize: 12, fontWeight: 500, fontFamily: 'JetBrains Mono',
                    }}>
                      {demoData.bestMethod}
                    </span>
                    <span style={{ fontSize: 12, color: T.inkLight }}>
                      MAPE: {demoData.metrics?.mape}% | MAD: {demoData.metrics?.mad}
                    </span>
                  </div>

                  {/* Chart */}
                  <ForecastChart
                    historyPeriods={demoData.history?.periods}
                    historyDemand={demoData.history?.demand}
                    forecastPeriods={demoData.forecast?.periods}
                    forecastDemand={demoData.forecast?.demand}
                    fitted={demoData.fitted}
                    method={demoData.bestMethod}
                  />

                  {/* Forecast table view — planner override with reasons */}
                  <div style={{ marginTop: 16, overflowX: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkLight, letterSpacing: 1, textTransform: 'uppercase' }}>
                        Consensus Forecast
                      </div>
                      {Object.keys(overrides).length > 0 && (
                        <button
                          onClick={async () => {
                            setOverrideSaved(true);
                            try {
                              const res = await fetch(`${API}/override`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ skuCode: selectedSku, overrides }),
                              });
                              if (!res.ok) throw new Error('API unavailable');
                              const result = await res.json();
                              if (result.cascade?.planRunId) {
                                connectCascadeSSE(result.cascade.planRunId);
                              } else {
                                setCascadeActive(true);
                                setCascadeStepsDone(CASCADE_STEPS.length);
                                setCascadeStatus('complete');
                              }
                            } catch {
                              setCascadeActive(true);
                              setCascadeStepsDone(0);
                              setCascadeStatus('running');
                              let step = 0;
                              const tick = setInterval(() => {
                                step++;
                                setCascadeStepsDone(step);
                                if (step >= CASCADE_STEPS.length) {
                                  clearInterval(tick);
                                  setCascadeStatus('complete');
                                }
                              }, 600);
                            }
                            setTimeout(() => setOverrideSaved(false), 3000);
                          }}
                          style={{
                            background: T.accent, color: T.white, border: 'none', borderRadius: 6,
                            padding: '6px 16px', fontSize: 11, fontWeight: 600, fontFamily: 'Inter',
                            cursor: 'pointer', transition: 'all 0.15s',
                          }}
                        >
                          {overrideSaved ? '\u2713 Published — Cascading...' : `Publish Forecast & Cascade (${Object.keys(overrides).length} override${Object.keys(overrides).length > 1 ? 's' : ''})`}
                        </button>
                      )}
                    </div>

                    {/* Transposed forecast table: rows = metrics, columns = periods */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'JetBrains Mono' }}>
                      <thead>
                        <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                          <th scope="col" style={{ textAlign: 'left', padding: '8px 12px', color: T.inkLight, fontWeight: 500, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, minWidth: 140 }}></th>
                          {demoData.forecast?.periods?.map(p => (
                            <th key={p} scope="col" style={{ textAlign: 'right', padding: '8px 10px', color: T.inkLight, fontWeight: 500, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>{p}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {/* Statistical Forecast row */}
                        <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                          <td style={{ padding: '8px 12px', color: T.inkMid, fontWeight: 500, fontSize: 11 }}>Statistical Forecast</td>
                          {demoData.forecast?.periods?.map((p, i) => (
                            <td key={p} style={{ padding: '6px 10px', textAlign: 'right', color: T.inkLight }}>{demoData.forecast.demand[i]}</td>
                          ))}
                        </tr>

                        {/* Planner Override row (editable) */}
                        <tr style={{ borderBottom: `1px solid ${T.border}`, background: `${T.accent}04` }}>
                          <td style={{ padding: '8px 12px', color: T.accent, fontWeight: 600, fontSize: 11 }}>Planner Override</td>
                          {demoData.forecast?.periods?.map((p, i) => {
                            const stat = demoData.forecast.demand[i];
                            const ov = overrides[p];
                            const hasOverride = ov != null;
                            const overrideVal = hasOverride ? ov.value : null;
                            const overrideReason = hasOverride ? ov.reason : null;
                            const isEditing = editingCell === p;
                            const reasonColors = overrideReason ? (REASON_COLORS[overrideReason] || REASON_COLORS['Other']) : null;
                            return (
                              <td key={p} style={{ padding: '4px 6px', textAlign: 'right', verticalAlign: 'top' }}>
                                {isEditing ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                    <input
                                      type="number"
                                      defaultValue={overrideVal ?? stat}
                                      autoFocus
                                      onBlur={(e) => {
                                        const val = parseInt(e.target.value, 10);
                                        if (!isNaN(val) && val !== stat) {
                                          setOverrides(prev => ({
                                            ...prev,
                                            [p]: { value: val, reason: prev[p]?.reason || 'Other' },
                                          }));
                                        } else if (val === stat) {
                                          setOverrides(prev => { const n = { ...prev }; delete n[p]; return n; });
                                        }
                                        setEditingCell(null);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') e.target.blur();
                                        if (e.key === 'Escape') setEditingCell(null);
                                      }}
                                      style={{
                                        width: 70, textAlign: 'right', fontFamily: 'JetBrains Mono', fontSize: 12,
                                        border: `1px solid ${T.accent}`, borderRadius: 4, padding: '3px 6px',
                                        outline: 'none', background: T.white, color: T.ink,
                                      }}
                                    />
                                    <select
                                      value={ov?.reason || 'Other'}
                                      onChange={(e) => {
                                        setOverrides(prev => ({
                                          ...prev,
                                          [p]: { value: prev[p]?.value ?? stat, reason: e.target.value },
                                        }));
                                      }}
                                      style={{
                                        width: 100, fontFamily: 'JetBrains Mono', fontSize: 9,
                                        border: `1px solid ${T.border}`, borderRadius: 3, padding: '2px 4px',
                                        outline: 'none', background: T.white, color: T.inkMid, cursor: 'pointer',
                                      }}
                                    >
                                      {OVERRIDE_REASONS.map(r => (
                                        <option key={r} value={r}>{r}</option>
                                      ))}
                                    </select>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                                    <div
                                      onClick={() => setEditingCell(p)}
                                      style={{
                                        cursor: 'pointer', padding: '3px 6px', borderRadius: 4,
                                        border: `1px dashed ${hasOverride ? T.accent : T.border}`,
                                        color: hasOverride ? T.accent : T.inkGhost,
                                        fontWeight: hasOverride ? 600 : 400,
                                        minWidth: 50, display: 'inline-block',
                                      }}
                                      title="Click to override"
                                    >
                                      {overrideVal != null ? overrideVal : '\u2014'}
                                    </div>
                                    {hasOverride && reasonColors && (
                                      <span style={{
                                        display: 'inline-block', padding: '1px 5px', borderRadius: 3,
                                        fontSize: 8, fontWeight: 500, lineHeight: '14px',
                                        background: reasonColors.bg, color: reasonColors.color,
                                        border: `1px solid ${reasonColors.border}`,
                                      }}>
                                        {overrideReason}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>

                        {/* Final Forecast row */}
                        <tr style={{ borderBottom: `1px solid ${T.border}`, background: `${T.ink}06` }}>
                          <td style={{ padding: '8px 12px', color: T.ink, fontWeight: 600, fontSize: 11 }}>Final Forecast</td>
                          {demoData.forecast?.periods?.map((p, i) => {
                            const stat = demoData.forecast.demand[i];
                            const ov = overrides[p];
                            const final_ = ov != null ? ov.value : stat;
                            const changed = ov != null && ov.value !== stat;
                            return (
                              <td key={p} style={{ padding: '6px 10px', textAlign: 'right', color: changed ? T.accent : T.ink, fontWeight: 600 }}>{final_}</td>
                            );
                          })}
                        </tr>

                        {/* Prior Year Actual row */}
                        <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                          <td style={{ padding: '8px 12px', color: T.inkLight, fontWeight: 500, fontSize: 11 }}>Prior Year Actual</td>
                          {demoData.forecast?.periods?.map((p, i) => {
                            const priorIdx = demoData.history?.demand ? demoData.history.demand.length - demoData.forecast.periods.length + i : -1;
                            const priorVal = priorIdx >= 0 && priorIdx < (demoData.history?.demand?.length || 0) ? demoData.history.demand[priorIdx] : null;
                            return (
                              <td key={p} style={{ padding: '6px 10px', textAlign: 'right', color: T.inkGhost, fontStyle: priorVal == null ? 'italic' : 'normal' }}>
                                {priorVal != null ? priorVal : '\u2014'}
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{ padding: 60, textAlign: 'center', color: T.inkLight }}>Select a Product</div>
              )}
            </Card>

            {/* Method Comparison */}
            {demoData?.allMethods && (
              <Card title="Method Comparison" style={{ marginTop: 16 }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                        {['Method', 'MAPE', 'MAD', 'Bias', 'Next 3 Periods'].map(h => (
                          <th key={h} scope="col" style={{ textAlign: h === 'Method' ? 'left' : 'right', padding: '8px 12px', color: T.inkLight, fontWeight: 500, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {demoData.allMethods.map(m => (
                        <tr key={m.method} style={{
                          borderBottom: `1px solid ${T.border}`,
                          background: m.method === demoData.bestMethod ? T.safeBg : 'transparent',
                        }}>
                          <td style={{ padding: '8px 12px', fontFamily: 'JetBrains Mono', fontWeight: m.method === demoData.bestMethod ? 600 : 400 }}>
                            {m.method} {m.method === demoData.bestMethod ? '★' : ''}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono', color: m.mape < 10 ? T.safe : m.mape < 20 ? T.warn : T.risk }}>{m.mape}%</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono' }}>{m.mad}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono', color: m.bias > 0 ? T.risk : T.safe }}>{m.bias > 0 ? '+' : ''}{m.bias}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono', color: T.inkMid }}>{m.forecast.slice(0, 3).join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}

        {/* ─── History Tab ─────────────────────────────────────── */}
        {tab === 'history' && (
          <>
            {/* Demand History Bar Chart */}
            {historyData && !loading && (() => {
              const d = historyData.demand;
              const maxVal = Math.max(...d);
              const avg = Math.round(d.reduce((s, v) => s + v, 0) / d.length * 10) / 10;
              const chartW = 1120, chartH = 140, barGap = 1;
              const barW = Math.max(1, (chartW - barGap * d.length) / d.length);
              return (
                <Card title={`Demand Pattern — ${selectedSku}`} style={{ marginBottom: 16 }}>
                  <div style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
                      {[
                        { label: 'Avg Weekly', value: avg },
                        { label: 'Peak', value: Math.max(...d) },
                        { label: 'Min', value: Math.min(...d) },
                        { label: 'Weeks', value: d.length },
                        { label: 'CoV', value: `${Math.round(Math.sqrt(d.reduce((s, v) => s + (v - avg) ** 2, 0) / d.length) / avg * 100)}%` },
                      ].map(m => (
                        <div key={m.label}>
                          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkLight, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>{m.label}</div>
                          <div style={{ fontFamily: 'Sora', fontSize: 18, fontWeight: 600, color: T.ink }}>{m.value}</div>
                        </div>
                      ))}
                    </div>
                    <svg width="100%" viewBox={`0 0 ${chartW} ${chartH}`} role="img" aria-label={`Demand history bar chart for ${selectedSku}, showing ${d.length} weeks of data`} style={{ display: 'block' }}>
                      {/* Average line */}
                      <line x1={0} y1={chartH - (avg / maxVal) * (chartH - 10)} x2={chartW} y2={chartH - (avg / maxVal) * (chartH - 10)} stroke={T.accent} strokeDasharray="4 3" strokeWidth={1} opacity={0.5} />
                      {/* Bars */}
                      {d.map((v, i) => {
                        const h = (v / maxVal) * (chartH - 10);
                        return (
                          <rect
                            key={i}
                            x={i * (barW + barGap)}
                            y={chartH - h}
                            width={barW}
                            height={h}
                            fill={v >= avg ? T.ink : T.inkLight}
                            opacity={0.7}
                            rx={1}
                          />
                        );
                      })}
                    </svg>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkGhost }}>
                      <span>{historyData.periods[0]}</span>
                      <span style={{ color: T.accent, fontSize: 9 }}>— avg: {avg}</span>
                      <span>{historyData.periods[d.length - 1]}</span>
                    </div>
                  </div>
                </Card>
              );
            })()}

            <Card title={`Weekly Demand History — ${selectedSku}`}>
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>Loading...</div>
              ) : historyData ? (
                <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${T.border}`, position: 'sticky', top: 0, background: T.white }}>
                        <th scope="col" style={{ textAlign: 'left', padding: '8px 12px', color: T.inkLight, fontWeight: 500, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Week</th>
                        <th scope="col" style={{ textAlign: 'left', padding: '8px 12px', color: T.inkLight, fontWeight: 500, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Period</th>
                        <th scope="col" style={{ textAlign: 'right', padding: '8px 12px', color: T.inkLight, fontWeight: 500, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Demand</th>
                        <th scope="col" style={{ textAlign: 'left', padding: '8px 12px', color: T.inkLight, fontWeight: 500, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, width: 120 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyData.periods?.map((p, i) => {
                        const maxD = Math.max(...historyData.demand);
                        const pct = (historyData.demand[i] / maxD) * 100;
                        return (
                          <tr key={p} style={{ borderBottom: `1px solid ${T.border}` }}>
                            <td style={{ padding: '6px 12px', color: T.inkLight, fontFamily: 'JetBrains Mono', fontSize: 11 }}>{i + 1}</td>
                            <td style={{ padding: '6px 12px', fontFamily: 'JetBrains Mono', fontSize: 11 }}>{p}</td>
                            <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono', fontWeight: 500 }}>{historyData.demand[i]}</td>
                            <td style={{ padding: '6px 12px' }}>
                              <div style={{ height: 10, width: `${pct}%`, background: T.ink, borderRadius: 2, opacity: 0.5 }} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>No history available</div>
              )}
            </Card>
          </>
        )}

        {/* ─── Accuracy Tab ────────────────────────────────────── */}
        {tab === 'accuracy' && (
          <Card title={`Forecast Accuracy — ${selectedSku}`}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>Loading...</div>
            ) : demoData?.metrics ? (
              <div style={{ padding: '24px 20px' }}>
                <div className="accuracy-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                  {[
                    {
                      label: 'MAPE',
                      value: `${demoData.metrics.mape}%`,
                      desc: 'Mean Absolute % Error',
                      color: demoData.metrics.mape < 10 ? T.safe : demoData.metrics.mape < 20 ? T.warn : T.risk,
                      rating: demoData.metrics.mape < 10 ? 'Excellent' : demoData.metrics.mape < 20 ? 'Good' : demoData.metrics.mape < 30 ? 'Fair' : 'Poor',
                    },
                    {
                      label: 'MAD',
                      value: demoData.metrics.mad,
                      desc: 'Mean Absolute Deviation',
                      color: T.ink,
                    },
                    {
                      label: 'Bias',
                      value: `${demoData.metrics.bias > 0 ? '+' : ''}${demoData.metrics.bias}`,
                      desc: demoData.metrics.bias > 0 ? 'Under-forecasting' : demoData.metrics.bias < 0 ? 'Over-forecasting' : 'Balanced',
                      color: Math.abs(demoData.metrics.bias) > 5 ? T.risk : T.safe,
                    },
                    {
                      label: 'Tracking Signal',
                      value: demoData.metrics.trackingSignal,
                      desc: Math.abs(demoData.metrics.trackingSignal) > 4 ? 'Out of control (>±4)' : 'In control',
                      color: Math.abs(demoData.metrics.trackingSignal) > 4 ? T.risk : T.safe,
                    },
                  ].map(m => (
                    <div key={m.label} style={{ background: T.bgDark, borderRadius: 8, padding: '16px' }}>
                      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkLight, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>{m.label}</div>
                      <div style={{ fontFamily: 'Sora', fontSize: 28, fontWeight: 600, color: m.color, marginBottom: 4 }}>{m.value}</div>
                      <div style={{ fontSize: 11, color: T.inkLight }}>{m.desc}</div>
                      {m.rating && <div style={{ fontSize: 10, color: m.color, fontWeight: 500, marginTop: 4 }}>{m.rating}</div>}
                    </div>
                  ))}
                </div>

                {/* Interpretation */}
                <div style={{ background: T.bgDark, borderRadius: 8, padding: '16px 20px', fontSize: 13, color: T.inkMid, lineHeight: 1.6 }}>
                  <div style={{ fontWeight: 500, color: T.ink, marginBottom: 8 }}>Interpretation</div>
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    <li>
                      <strong>Method:</strong> {demoData.bestMethod} was selected as best fit based on lowest MAPE across{' '}
                      {demoData.allMethods?.length || 0} candidates.
                    </li>
                    <li>
                      <strong>Bias:</strong>{' '}
                      {demoData.metrics.bias > 2
                        ? 'Positive bias indicates consistent under-forecasting — consider increasing forecasts to improve service levels.'
                        : demoData.metrics.bias < -2
                          ? 'Negative bias indicates over-forecasting — excess inventory risk. Consider reducing forecasts.'
                          : 'Bias is balanced — no systematic over or under-forecasting detected.'}
                    </li>
                    <li>
                      <strong>Tracking Signal:</strong>{' '}
                      {Math.abs(demoData.metrics.trackingSignal) > 4
                        ? 'Out of control — the forecast model may need recalibration or a different method.'
                        : 'Within ±4 control limits — the model is tracking well.'}
                    </li>
                  </ul>
                </div>
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>Run a forecast to see accuracy metrics</div>
            )}
          </Card>
        )}
      </div>
    </ModuleLayout>
  );
}
