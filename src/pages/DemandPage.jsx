import { useState, useEffect, useCallback } from 'react';
import { T } from '../styles/tokens';
import ModuleLayout from '../components/shared/ModuleLayout';
import PageHeader from '../components/shared/PageHeader';
import Card from '../components/shared/Card';
import HierarchyNav from '../components/demand/HierarchyNav';
import PlanningGrid from '../components/demand/PlanningGrid';
import AccuracyChart from '../components/demand/AccuracyChart';
import CascadeViz from '../components/CascadeViz';

/* ──────────────────────────────────────────────────────────────────
 * Static fallback data — used when API is unavailable (e.g. Vercel)
 * Champion Pet Foods: ORIJEN + ACANA, 9 product families, 105 SKUs
 * ────────────────────────────────────────────────────────────────── */
const FAMILIES = [
  { id: 'ORI-DOG-DRY', name: 'ORIJEN Dog Dry', brand: 'ORIJEN', skus: 18 },
  { id: 'ORI-CAT-DRY', name: 'ORIJEN Cat Dry', brand: 'ORIJEN', skus: 12 },
  { id: 'ORI-FD',      name: 'ORIJEN Freeze-Dried', brand: 'ORIJEN', skus: 10 },
  { id: 'ORI-TREATS',  name: 'ORIJEN Treats', brand: 'ORIJEN', skus: 8 },
  { id: 'ACA-DOG-DRY', name: 'ACANA Dog Dry', brand: 'ACANA', skus: 20 },
  { id: 'ACA-CAT-DRY', name: 'ACANA Cat Dry', brand: 'ACANA', skus: 12 },
  { id: 'ACA-WET-DOG', name: 'ACANA Wet Dog', brand: 'ACANA', skus: 10 },
  { id: 'ACA-WET-CAT', name: 'ACANA Wet Cat', brand: 'ACANA', skus: 8 },
  { id: 'ACA-SINGLES', name: 'ACANA Singles', brand: 'ACANA', skus: 7 },
];

// Generate 12 weekly Monday dates starting 6 weeks before today
const _fb_baseDate = new Date('2026-03-16'); // Monday anchor
const _fb_weeks = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(_fb_baseDate);
  d.setDate(d.getDate() + i * 7);
  return d.toISOString().slice(0, 10);
});
const _fb_historyPeriods = _fb_weeks.slice(0, 6);
const _fb_forecastPeriods = _fb_weeks.slice(6);

// Realistic weekly case volumes per family (history → forecast with slight growth)
const _fb_familyVolumes = {
  'ORI-DOG-DRY': [4820, 5010, 4690, 5230, 4950, 5180,  5320, 5410, 5280, 5500, 5390, 5620],
  'ORI-CAT-DRY': [2140, 2250, 2080, 2310, 2190, 2270,  2350, 2420, 2300, 2480, 2410, 2530],
  'ORI-FD':      [1380, 1420, 1290, 1510, 1350, 1460,  1520, 1580, 1490, 1610, 1550, 1640],
  'ORI-TREATS':  [ 960, 1010,  920, 1040,  980, 1020,  1060, 1100, 1040, 1130, 1080, 1150],
  'ACA-DOG-DRY': [6350, 6580, 6210, 6720, 6440, 6630,  6810, 6950, 6730, 7020, 6890, 7160],
  'ACA-CAT-DRY': [2480, 2560, 2370, 2620, 2510, 2590,  2670, 2730, 2640, 2790, 2710, 2850],
  'ACA-WET-DOG': [1750, 1820, 1680, 1900, 1780, 1850,  1920, 1970, 1890, 2010, 1950, 2060],
  'ACA-WET-CAT': [1120, 1180, 1060, 1230, 1150, 1200,  1260, 1310, 1240, 1340, 1290, 1370],
  'ACA-SINGLES': [ 890,  940,  850,  970,  910,  950,   990, 1030,  970, 1050, 1010, 1080],
};

// Aggregate totals across all families
const _fb_totalHistory = _fb_historyPeriods.map((_, i) =>
  FAMILIES.reduce((s, f) => s + _fb_familyVolumes[f.id][i], 0));
const _fb_totalStat = _fb_forecastPeriods.map((_, i) =>
  FAMILIES.reduce((s, f) => s + _fb_familyVolumes[f.id][6 + i], 0));

const FALLBACK_DIMENSIONS = {
  product: {
    label: 'Product',
    values: [
      { level: 'brand', id: 'ORIJEN', name: 'ORIJEN', children: FAMILIES.filter(f => f.brand === 'ORIJEN').map(f => f.id) },
      { level: 'brand', id: 'ACANA', name: 'ACANA', children: FAMILIES.filter(f => f.brand === 'ACANA').map(f => f.id) },
      ...FAMILIES.map(f => ({ level: 'family', id: f.id, name: f.name, parent: f.brand })),
    ],
  },
  customer: {
    label: 'Customer',
    values: [
      { id: 'PETCO', name: 'Petco' },
      { id: 'PETSMART', name: 'PetSmart' },
      { id: 'CHEWY', name: 'Chewy' },
      { id: 'AMAZON', name: 'Amazon' },
      { id: 'INDIE', name: 'Independent Retailers' },
    ],
  },
};

const FALLBACK_SUMMARY = {
  company: 'Champion Pet Foods',
  skus: 105,
  customers: 5,
  families: 9,
  brands: 2,
};

const FALLBACK_FORECAST = {
  level: 'all',
  id: 'all',
  method: 'Holt-Winters + ML Ensemble',
  customer: null,
  hasOverrides: true,
  overrideCount: 3,
  skuCount: 105,
  historyPeriods: _fb_historyPeriods,
  forecastPeriods: _fb_forecastPeriods,
  history: _fb_totalHistory,
  statForecast: _fb_totalStat,
  finalForecast: _fb_totalStat.map((v, i) => i === 2 ? v + 340 : i === 4 ? v - 210 : i === 5 ? v + 560 : v),
  breadcrumb: [{ level: 'all', id: 'all', name: 'All Products' }],
  children: FAMILIES.map(f => ({
    level: 'family',
    id: f.id,
    name: f.name,
    skuCount: f.skus,
  })),
};

const _fb_accOffsets = [[320, -110], [-180, 90], [410, -60], [-250, 140], [190, -80], [-140, 50]];
const FALLBACK_ACCURACY = {
  metrics: { mape: 12.4, bias: -38, trackingSignal: 1.7, mad: 312 },
  bars: _fb_historyPeriods.map((d, i) => ({
    period: d,
    actual: _fb_totalHistory[i],
    stat: _fb_totalHistory[i] + _fb_accOffsets[i][0],
    final: _fb_totalHistory[i] + _fb_accOffsets[i][1],
  })),
};

const TABS = [
  { id: 'consensus', label: 'Consensus Plan' },
  { id: 'history', label: 'Demand History' },
  { id: 'accuracy', label: 'Forecast Accuracy' },
];

export default function DemandPage() {
  const [activeTab, setActiveTab] = useState('consensus');
  const [scope, setScope] = useState({ level: 'all', id: 'all', customer: null });
  const [dimensions, setDimensions] = useState(null);
  const [forecastData, setForecastData] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [accuracyData, setAccuracyData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cascadeResult, setCascadeResult] = useState(null);
  const [showCascade, setShowCascade] = useState(false);
  const [summary, setSummary] = useState(null);

  // Fetch dimensions once
  useEffect(() => {
    fetch('/api/demand/dimensions')
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setDimensions)
      .catch(() => setDimensions(FALLBACK_DIMENSIONS));
    fetch('/api/demand/summary')
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setSummary)
      .catch(() => setSummary(FALLBACK_SUMMARY));
  }, []);

  // Fetch data when scope or tab changes
  useEffect(() => {
    const { level, id, customer } = scope;
    const params = `level=${level}&id=${id}${customer ? `&customer=${customer}` : ''}`;
    setLoading(true);

    if (activeTab === 'consensus' || activeTab === 'history') {
      fetch(`/api/demand/forecast?${params}`)
        .then(r => { if (!r.ok) throw new Error(); return r.json(); })
        .then(data => {
          setForecastData(data);
          setLoading(false);
        })
        .catch(() => { setForecastData(FALLBACK_FORECAST); setLoading(false); });
    }

    if (activeTab === 'history') {
      fetch(`/api/demand/history?${params}`)
        .then(r => { if (!r.ok) throw new Error(); return r.json(); })
        .then(data => {
          setHistoryData(data);
        })
        .catch(() => setHistoryData(FALLBACK_FORECAST));
    }

    if (activeTab === 'accuracy') {
      fetch(`/api/demand/accuracy?${params}`)
        .then(r => { if (!r.ok) throw new Error(); return r.json(); })
        .then(data => {
          setAccuracyData(data);
          setLoading(false);
        })
        .catch(() => { setAccuracyData(FALLBACK_ACCURACY); setLoading(false); });
    }
  }, [scope, activeTab]);

  const handleOverride = useCallback(async (periodIndex, newValue) => {
    const { level, id, customer } = scope;
    // Optimistic update so edits respond immediately
    setForecastData(prev => {
      if (!prev) return prev;
      const newFinal = [...prev.finalForecast];
      newFinal[periodIndex] = newValue;
      return { ...prev, finalForecast: newFinal, hasOverrides: true, overrideCount: (prev.overrideCount || 0) + 1 };
    });
    try {
      const resp = await fetch('/api/demand/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level, id, customer,
          overrides: { [periodIndex]: newValue },
          reason: 'Manual',
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setForecastData(prev => prev ? { ...prev, finalForecast: data.finalForecast } : prev);
      }
    } catch { /* API unavailable, local state already updated */ }
  }, [scope]);

  const handlePublish = async () => {
    try {
      const resp = await fetch('/api/demand/publish', { method: 'POST' });
      const data = await resp.json();
      setCascadeResult(data.cascade);
      setShowCascade(true);
    } catch {
      // Simulate cascade result for demo
      setCascadeResult({ planRunId: `PUB-${Date.now()}`, status: 'complete', modules: ['production-plan', 'mrp', 'scheduling'], timestamp: new Date().toISOString() });
      setShowCascade(true);
    }
  };

  const skuCount = forecastData?.children?.reduce?.((s, c) =>
    s + (c.level === 'sku' ? 1 : 0), 0) || 0;

  return (
    <ModuleLayout
      moduleContext="demand"
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      <div style={{ padding: '0 24px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0' }}>
          <div>
            <PageHeader
              title="Demand Planning"
              subtitle={summary ? `${summary.company} — ${summary.skus} SKUs × ${summary.customers} customers` : 'Loading...'}
            />
          </div>
          {activeTab === 'consensus' && (
            <button
              onClick={handlePublish}
              style={{
                background: T.modDemand,
                color: T.white,
                border: 'none',
                padding: '8px 20px',
                borderRadius: T.r2,
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: T.fontBody,
              }}
            >
              Publish & Cascade
            </button>
          )}
        </div>

        {/* Hierarchy Navigator */}
        <HierarchyNav
          scope={scope}
          onScopeChange={setScope}
          dimensions={dimensions}
        />

        {/* Scope info bar */}
        {forecastData && (
          <div style={{
            display: 'flex',
            gap: 16,
            padding: '10px 0',
            fontSize: 12,
            color: T.inkMid,
            fontFamily: T.fontBody,
          }}>
            <span>
              <strong>Level:</strong> {forecastData.level}
              {forecastData.level !== 'all' && ` — ${forecastData.breadcrumb?.[forecastData.breadcrumb.length - 1]?.name || forecastData.id}`}
            </span>
            <span><strong>Method:</strong> {forecastData.method}</span>
            {forecastData.hasOverrides && (
              <span style={{ color: T.warn }}>
                ✎ {forecastData.overrideCount} override{forecastData.overrideCount !== 1 ? 's' : ''}
              </span>
            )}
            {forecastData.customer && (
              <span><strong>Customer:</strong> {forecastData.customer}</span>
            )}
          </div>
        )}

        {/* Tab content */}
        {loading && (
          <Card>
            <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>Loading...</div>
          </Card>
        )}

        {/* Consensus Plan tab */}
        {activeTab === 'consensus' && forecastData && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* KPI summary row */}
            <div style={{ display: 'flex', gap: 12 }}>
              <KpiCard
                label="Avg Weekly (History)"
                value={formatNum(forecastData.history.reduce((s, v) => s + v, 0) / forecastData.history.length)}
              />
              <KpiCard
                label="Avg Weekly (Forecast)"
                value={formatNum(forecastData.statForecast.reduce((s, v) => s + v, 0) / forecastData.statForecast.length)}
              />
              <KpiCard
                label="Total Forecast (52w)"
                value={formatNum(forecastData.statForecast.reduce((s, v) => s + v, 0))}
              />
              <KpiCard
                label="Overrides"
                value={forecastData.overrideCount || 0}
                highlight={forecastData.hasOverrides}
              />
            </div>

            {/* Planning Grid — history + stat + final forecast rows */}
            <PlanningGrid
              historyPeriods={forecastData.historyPeriods}
              forecastPeriods={forecastData.forecastPeriods}
              history={forecastData.history}
              statForecast={forecastData.statForecast}
              finalForecast={forecastData.finalForecast}
              onOverride={handleOverride}
              level={forecastData.level}
              skuCount={forecastData.skuCount || forecastData.children?.length || 0}
            />
          </div>
        )}

        {/* Demand History tab */}
        {activeTab === 'history' && forecastData && !loading && (
          <PlanningGrid
            historyPeriods={forecastData.historyPeriods}
            forecastPeriods={[]}
            history={forecastData.history}
            statForecast={[]}
            finalForecast={[]}
            readOnly
            level={forecastData.level}
          />
        )}

        {/* Forecast Accuracy tab */}
        {activeTab === 'accuracy' && accuracyData && !loading && (
          <AccuracyChart
            metrics={accuracyData.metrics}
            bars={accuracyData.bars}
          />
        )}

        {/* Cascade visualization */}
        {showCascade && cascadeResult && (
          <div style={{ marginTop: 24 }}>
            <Card>
              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontFamily: T.fontHeading, fontSize: 14 }}>Cascade Results</h3>
                  <button
                    onClick={() => setShowCascade(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.inkLight, fontSize: 12 }}
                  >
                    Close
                  </button>
                </div>
                <CascadeViz planRunId={cascadeResult.planRunId} />
              </div>
            </Card>
          </div>
        )}
      </div>
    </ModuleLayout>
  );
}

function KpiCard({ label, value, highlight = false }) {
  return (
    <div style={{
      background: highlight ? T.warnBg : T.white,
      border: `1px solid ${highlight ? T.warnBorder : T.border}`,
      borderRadius: T.r3,
      padding: '10px 16px',
      flex: 1,
    }}>
      <div style={{ fontSize: 10, color: T.inkLight, fontFamily: T.fontBody, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, fontFamily: T.fontMono, color: T.ink }}>{value}</div>
    </div>
  );
}

function formatNum(n) {
  if (n == null) return '—';
  if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}
