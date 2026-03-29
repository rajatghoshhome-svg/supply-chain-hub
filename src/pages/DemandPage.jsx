import { useState, useEffect, useCallback } from 'react';
import { T } from '../styles/tokens';
import ModuleLayout from '../components/shared/ModuleLayout';
import PageHeader from '../components/shared/PageHeader';
import Card from '../components/shared/Card';
import HierarchyNav from '../components/demand/HierarchyNav';
import PlanningGrid from '../components/demand/PlanningGrid';
import AccuracyChart from '../components/demand/AccuracyChart';
import CascadeViz from '../components/CascadeViz';

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
      .then(r => r.json())
      .then(setDimensions)
      .catch(() => {});
    fetch('/api/demand/summary')
      .then(r => r.json())
      .then(setSummary)
      .catch(() => {});
  }, []);

  // Fetch data when scope or tab changes
  useEffect(() => {
    const { level, id, customer } = scope;
    const params = `level=${level}&id=${id}${customer ? `&customer=${customer}` : ''}`;
    setLoading(true);

    if (activeTab === 'consensus' || activeTab === 'history') {
      fetch(`/api/demand/forecast?${params}`)
        .then(r => r.json())
        .then(data => {
          setForecastData(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }

    if (activeTab === 'history') {
      fetch(`/api/demand/history?${params}`)
        .then(r => r.json())
        .then(data => {
          setHistoryData(data);
        })
        .catch(() => {});
    }

    if (activeTab === 'accuracy') {
      fetch(`/api/demand/accuracy?${params}`)
        .then(r => r.json())
        .then(data => {
          setAccuracyData(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [scope, activeTab]);

  const handleOverride = useCallback(async (periodIndex, newValue) => {
    const { level, id, customer } = scope;
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
      if (!resp.ok) throw new Error(`Override failed: ${resp.status}`);
      const data = await resp.json();
      // Refresh forecast data
      setForecastData(prev => prev ? { ...prev, finalForecast: data.finalForecast } : prev);
    } catch (err) {
      console.error('Override error:', err);
    }
  }, [scope]);

  const handlePublish = async () => {
    try {
      const resp = await fetch('/api/demand/publish', { method: 'POST' });
      const data = await resp.json();
      setCascadeResult(data.cascade);
      setShowCascade(true);
    } catch (err) {
      console.error('Publish error:', err);
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
