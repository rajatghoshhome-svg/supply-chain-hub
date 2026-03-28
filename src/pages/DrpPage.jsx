import { useState, useEffect } from 'react';
import { T } from '../styles/tokens';
import ModuleLayout from '../components/shared/ModuleLayout';
import PageHeader from '../components/shared/PageHeader';
import Card from '../components/shared/Card';

const TABS = [
  { id: 'requirements', label: 'DRP Records' },
  { id: 'plant', label: 'Plant Requirements' },
  { id: 'network', label: 'Network' },
  { id: 'exceptions', label: 'Exceptions' },
];

// ─── Static fallback data (used when API is unavailable, e.g. Vercel) ────
const STATIC_DRP = {
  skusPlanned: 3, locationsPlanned: 3, totalExceptions: 2, criticalExceptions: 1,
  periods: ['W13','W14','W15','W16','W17','W18'],
  results: [
    {
      skuCode: 'GRN-BAR', skuName: 'Oat & Honey Granola Bar',
      exceptions: [{ severity: 'critical', type: 'expedite', message: 'DC-ATL safety stock breach — expedite 200 cases from PLT-PDX' }],
      dcResults: [
        { locationCode: 'DC-ATL', safetyStock: 200, leadTime: 2, onHand: 180,
          records: [
            { period: 'W13', grossReq: 175, scheduledReceipts: 0, projectedOH: 5, netReq: 195, plannedShipment: 195, plannedShipmentRelease: 170 },
            { period: 'W14', grossReq: 170, scheduledReceipts: 195, projectedOH: 30, netReq: 170, plannedShipment: 170, plannedShipmentRelease: 165 },
            { period: 'W15', grossReq: 165, scheduledReceipts: 170, projectedOH: 35, netReq: 165, plannedShipment: 165, plannedShipmentRelease: 160 },
            { period: 'W16', grossReq: 160, scheduledReceipts: 165, projectedOH: 40, netReq: 160, plannedShipment: 160, plannedShipmentRelease: 155 },
            { period: 'W17', grossReq: 155, scheduledReceipts: 160, projectedOH: 45, netReq: 155, plannedShipment: 155, plannedShipmentRelease: 150 },
            { period: 'W18', grossReq: 150, scheduledReceipts: 155, projectedOH: 50, netReq: 0, plannedShipment: 0, plannedShipmentRelease: 0 },
          ] },
        { locationCode: 'DC-CHI', safetyStock: 200, leadTime: 2, onHand: 820,
          records: [
            { period: 'W13', grossReq: 215, scheduledReceipts: 0, projectedOH: 605, netReq: 0, plannedShipment: 0, plannedShipmentRelease: 0 },
            { period: 'W14', grossReq: 210, scheduledReceipts: 0, projectedOH: 395, netReq: 0, plannedShipment: 0, plannedShipmentRelease: 205 },
            { period: 'W15', grossReq: 205, scheduledReceipts: 0, projectedOH: 190, netReq: 10, plannedShipment: 210, plannedShipmentRelease: 200 },
            { period: 'W16', grossReq: 200, scheduledReceipts: 210, projectedOH: 200, netReq: 0, plannedShipment: 0, plannedShipmentRelease: 195 },
            { period: 'W17', grossReq: 195, scheduledReceipts: 0, projectedOH: 5, netReq: 195, plannedShipment: 195, plannedShipmentRelease: 190 },
            { period: 'W18', grossReq: 190, scheduledReceipts: 195, projectedOH: 10, netReq: 190, plannedShipment: 190, plannedShipmentRelease: 0 },
          ] },
        { locationCode: 'DC-LAS', safetyStock: 200, leadTime: 3, onHand: 340,
          records: [
            { period: 'W13', grossReq: 138, scheduledReceipts: 0, projectedOH: 202, netReq: 0, plannedShipment: 0, plannedShipmentRelease: 135 },
            { period: 'W14', grossReq: 135, scheduledReceipts: 0, projectedOH: 67, netReq: 133, plannedShipment: 133, plannedShipmentRelease: 130 },
            { period: 'W15', grossReq: 130, scheduledReceipts: 133, projectedOH: 70, netReq: 130, plannedShipment: 130, plannedShipmentRelease: 128 },
            { period: 'W16', grossReq: 128, scheduledReceipts: 130, projectedOH: 72, netReq: 128, plannedShipment: 128, plannedShipmentRelease: 125 },
            { period: 'W17', grossReq: 125, scheduledReceipts: 128, projectedOH: 75, netReq: 125, plannedShipment: 125, plannedShipmentRelease: 122 },
            { period: 'W18', grossReq: 122, scheduledReceipts: 125, projectedOH: 78, netReq: 0, plannedShipment: 0, plannedShipmentRelease: 0 },
          ] },
      ],
      plantRequirements: { grossReqs: [195,305,505,355,475,312], byDC: [
        { dc: 'DC-ATL', reqs: [195,170,165,160,155,0] },
        { dc: 'DC-CHI', reqs: [0,0,210,0,195,190] },
        { dc: 'DC-LAS', reqs: [0,135,130,195,125,122] },
      ] },
    },
    {
      skuCode: 'SPK-WAT', skuName: 'Lemon Sparkling Water', exceptions: [],
      dcResults: [
        { locationCode: 'DC-ATL', safetyStock: 300, leadTime: 2, onHand: 220,
          records: [
            { period: 'W13', grossReq: 290, scheduledReceipts: 400, projectedOH: 330, netReq: 0, plannedShipment: 0, plannedShipmentRelease: 310 },
            { period: 'W14', grossReq: 310, scheduledReceipts: 0, projectedOH: 20, netReq: 280, plannedShipment: 310, plannedShipmentRelease: 330 },
            { period: 'W15', grossReq: 330, scheduledReceipts: 310, projectedOH: 0, netReq: 300, plannedShipment: 330, plannedShipmentRelease: 350 },
            { period: 'W16', grossReq: 350, scheduledReceipts: 330, projectedOH: 0, netReq: 320, plannedShipment: 350, plannedShipmentRelease: 370 },
            { period: 'W17', grossReq: 370, scheduledReceipts: 350, projectedOH: 0, netReq: 340, plannedShipment: 370, plannedShipmentRelease: 390 },
            { period: 'W18', grossReq: 390, scheduledReceipts: 370, projectedOH: 0, netReq: 360, plannedShipment: 390, plannedShipmentRelease: 0 },
          ] },
      ],
      plantRequirements: { grossReqs: [0,310,330,350,370,390], byDC: [
        { dc: 'DC-ATL', reqs: [0,310,330,350,370,390] },
      ] },
    },
    {
      skuCode: 'NUT-BTR', skuName: 'Almond Nut Butter',
      exceptions: [{ severity: 'warning', type: 'rebalance', message: 'DC-CHI overstocked relative to DC-LAS — consider rebalance of 80 cases' }],
      dcResults: [
        { locationCode: 'DC-ATL', safetyStock: 120, leadTime: 1, onHand: 110,
          records: [
            { period: 'W13', grossReq: 98, scheduledReceipts: 0, projectedOH: 12, netReq: 108, plannedShipment: 108, plannedShipmentRelease: 95 },
            { period: 'W14', grossReq: 95, scheduledReceipts: 108, projectedOH: 25, netReq: 95, plannedShipment: 95, plannedShipmentRelease: 92 },
            { period: 'W15', grossReq: 92, scheduledReceipts: 95, projectedOH: 28, netReq: 92, plannedShipment: 92, plannedShipmentRelease: 90 },
            { period: 'W16', grossReq: 90, scheduledReceipts: 92, projectedOH: 30, netReq: 90, plannedShipment: 90, plannedShipmentRelease: 88 },
            { period: 'W17', grossReq: 88, scheduledReceipts: 90, projectedOH: 32, netReq: 88, plannedShipment: 88, plannedShipmentRelease: 86 },
            { period: 'W18', grossReq: 86, scheduledReceipts: 88, projectedOH: 34, netReq: 0, plannedShipment: 0, plannedShipmentRelease: 0 },
          ] },
      ],
      plantRequirements: { grossReqs: [108,95,92,90,88,0], byDC: [
        { dc: 'DC-ATL', reqs: [108,95,92,90,88,0] },
      ] },
    },
  ],
};

export default function DrpPage() {
  const [tab, setTab] = useState('requirements');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSku, setSelectedSku] = useState(null);
  const [selectedDC, setSelectedDC] = useState(null);

  useEffect(() => {
    fetch('/api/drp/demo')
      .then(r => r.json())
      .then(d => {
        setData(d);
        if (d.results?.length > 0) {
          setSelectedSku(d.results[0].skuCode);
          if (d.results[0].dcResults?.length > 0) {
            setSelectedDC(d.results[0].dcResults[0].locationCode);
          }
        }
        setLoading(false);
      })
      .catch(() => {
        console.warn('DRP API unavailable, using static fallback');
        const d = STATIC_DRP;
        setData(d);
        if (d.results?.length > 0) {
          setSelectedSku(d.results[0].skuCode);
          if (d.results[0].dcResults?.length > 0) {
            setSelectedDC(d.results[0].dcResults[0].locationCode);
          }
        }
        setLoading(false);
      });
  }, []);

  const selectedResult = data?.results?.find(r => r.skuCode === selectedSku);
  const selectedDCResult = selectedResult?.dcResults?.find(dc => dc.locationCode === selectedDC);
  const allExceptions = data?.results?.flatMap(r => r.exceptions || []) || [];

  return (
    <ModuleLayout moduleContext="drp" tabs={TABS} activeTab={tab} onTabChange={setTab}>
      <PageHeader title="Distribution Requirements Planning" subtitle="DRP" />

      <div className="module-content" style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 40px' }}>

        {/* Status bar */}
        {data && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <StatusPill label="SKUs" value={data.skusPlanned} />
            <StatusPill label="Locations" value={data.locationsPlanned} />
            <StatusPill label="Exceptions" value={data.totalExceptions} color={data.totalExceptions > 0 ? T.warn : T.safe} />
            <StatusPill label="Critical" value={data.criticalExceptions} color={data.criticalExceptions > 0 ? T.risk : T.safe} />
          </div>
        )}

        {/* SKU selector */}
        {data && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {data.results?.map(r => (
              <button
                key={r.skuCode}
                onClick={() => {
                  setSelectedSku(r.skuCode);
                  if (r.dcResults?.length > 0) setSelectedDC(r.dcResults[0].locationCode);
                }}
                style={{
                  background: selectedSku === r.skuCode ? T.ink : T.white,
                  color: selectedSku === r.skuCode ? T.white : T.ink,
                  border: `1px solid ${selectedSku === r.skuCode ? T.ink : T.border}`,
                  borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
                  fontFamily: 'JetBrains Mono', fontSize: 11, transition: 'all 0.12s',
                }}
              >
                {r.skuCode}
                {r.exceptions?.length > 0 && (
                  <span style={{ marginLeft: 4, color: selectedSku === r.skuCode ? '#ff9999' : T.risk }}>
                    ({r.exceptions.length})
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* ─── DRP Records Tab ────────────────────────────────────── */}
        {tab === 'requirements' && (
          <>
            {/* DC selector */}
            {selectedResult && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {selectedResult.dcResults?.map(dc => (
                  <button
                    key={dc.locationCode}
                    onClick={() => setSelectedDC(dc.locationCode)}
                    style={{
                      background: selectedDC === dc.locationCode ? T.accent : T.white,
                      color: selectedDC === dc.locationCode ? T.white : T.inkMid,
                      border: `1px solid ${selectedDC === dc.locationCode ? T.accent : T.border}`,
                      borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
                      fontSize: 11, transition: 'all 0.12s',
                    }}
                  >
                    {dc.locationCode}
                  </button>
                ))}
              </div>
            )}

            <Card title={`Time-Phased DRP Records — ${selectedSku} @ ${selectedDC || '...'}`}>
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>Running DRP netting...</div>
              ) : selectedDCResult ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'JetBrains Mono' }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                        {['Period', 'Gross Req', 'Sched Rcpt', 'Proj OH', 'Net Req', 'Pln Shipment', 'Pln Release'].map(h => (
                          <th key={h} scope="col" style={{ textAlign: h === 'Period' ? 'left' : 'right', padding: '8px 10px', color: T.inkLight, fontWeight: 500, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDCResult.records.map(r => (
                        <tr key={r.period} style={{ borderBottom: `1px solid ${T.border}` }}>
                          <td style={{ padding: '6px 10px', color: T.inkMid }}>{r.period}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right' }}>{fmt(r.grossReq)}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: r.scheduledReceipts > 0 ? T.accent : T.inkGhost }}>{fmt(r.scheduledReceipts)}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: T.ink }}>{fmt(r.projectedOH)}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: r.netReq > 0 ? T.warn : T.inkGhost }}>{fmt(r.netReq)}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: r.plannedShipment > 0 ? T.safe : T.inkGhost }}>{fmt(r.plannedShipment)}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: r.plannedShipmentRelease > 0 ? T.accent : T.inkGhost, fontWeight: r.plannedShipmentRelease > 0 ? 600 : 400 }}>{fmt(r.plannedShipmentRelease)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>Select a SKU and DC above</div>
              )}
            </Card>
          </>
        )}

        {/* ─── Plant Requirements Tab ─────────────────────────────── */}
        {tab === 'plant' && (
          <>
            <Card title={`Plant Gross Requirements — ${selectedSku}`}>
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>Loading...</div>
              ) : selectedResult?.plantRequirements ? (
                <div style={{ padding: '16px 20px' }}>
                  <div style={{ marginBottom: 16, fontSize: 12, color: T.inkMid }}>
                    Aggregated planned shipment releases from all DCs → plant-level gross requirements.
                    This feeds into Production Planning.
                  </div>

                  {/* Aggregate bar chart */}
                  <div style={{ marginBottom: 24 }}>
                    <PlantReqChart
                      periods={data.periods}
                      grossReqs={selectedResult.plantRequirements.grossReqs}
                      byDC={selectedResult.plantRequirements.byDC}
                    />
                  </div>

                  {/* Table */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'JetBrains Mono' }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                        <th scope="col" style={{ textAlign: 'left', padding: '8px 10px', color: T.inkLight, fontWeight: 500, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>Period</th>
                        {selectedResult.plantRequirements.byDC && Object.keys(selectedResult.plantRequirements.byDC).map(dc => (
                          <th key={dc} scope="col" style={{ textAlign: 'right', padding: '8px 10px', color: T.inkLight, fontWeight: 500, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>{dc}</th>
                        ))}
                        <th scope="col" style={{ textAlign: 'right', padding: '8px 10px', color: T.ink, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.periods.map((p, i) => (
                        <tr key={p} style={{ borderBottom: `1px solid ${T.border}` }}>
                          <td style={{ padding: '6px 10px', color: T.inkMid }}>{p}</td>
                          {selectedResult.plantRequirements.byDC && Object.values(selectedResult.plantRequirements.byDC).map((releases, j) => (
                            <td key={j} style={{ padding: '6px 10px', textAlign: 'right', color: releases[i] > 0 ? T.inkMid : T.inkGhost }}>{fmt(releases[i])}</td>
                          ))}
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: selectedResult.plantRequirements.grossReqs[i] > 0 ? T.accent : T.inkGhost }}>
                            {fmt(selectedResult.plantRequirements.grossReqs[i])}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>No data</div>
              )}
            </Card>
          </>
        )}

        {/* ─── Network Tab ────────────────────────────────────────── */}
        {tab === 'network' && (
          <Card title="Distribution Network Topology">
            {data?.network ? (
              <div style={{ padding: '20px' }}>
                <NetworkDiagram
                  locations={data.network.locations}
                  lanes={data.network.lanes}
                  plantInventory={data.plantInventory}
                  dcInventory={selectedResult?.dcResults}
                />
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>Loading network...</div>
            )}
          </Card>
        )}

        {/* ─── Exceptions Tab ─────────────────────────────────────── */}
        {tab === 'exceptions' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Total', count: allExceptions.length, color: T.ink },
                { label: 'Critical', count: allExceptions.filter(e => e.severity === 'critical').length, color: T.risk },
                { label: 'Warning', count: allExceptions.filter(e => e.severity === 'warning').length, color: T.warn },
              ].map(e => (
                <div key={e.label} style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 8, padding: '14px 16px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Sora', fontSize: 28, fontWeight: 600, color: e.color }}>{e.count}</div>
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkLight, letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 }}>{e.label}</div>
                </div>
              ))}
            </div>

            <Card title={`DRP Exceptions (${allExceptions.length} total)`}>
              {allExceptions.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                        {['Severity', 'SKU', 'Location', 'Type', 'Period', 'Qty', 'Message'].map(h => (
                          <th key={h} scope="col" style={{ textAlign: 'left', padding: '8px 10px', color: T.inkLight, fontWeight: 500, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allExceptions.map((e, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${T.border}`, background: e.severity === 'critical' ? T.riskBg : 'transparent' }}>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{
                              display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                              background: e.severity === 'critical' ? T.riskBg : T.warnBg,
                              color: e.severity === 'critical' ? T.risk : T.warn,
                              border: `1px solid ${e.severity === 'critical' ? T.riskBorder : T.warnBorder}`,
                            }}>
                              {e.severity}
                            </span>
                          </td>
                          <td style={{ padding: '8px 10px', fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 500 }}>{e.skuCode}</td>
                          <td style={{ padding: '8px 10px', fontFamily: 'JetBrains Mono', fontSize: 11 }}>{e.locationCode}</td>
                          <td style={{ padding: '8px 10px', fontFamily: 'JetBrains Mono', fontSize: 11 }}>{e.type}</td>
                          <td style={{ padding: '8px 10px', fontFamily: 'JetBrains Mono', fontSize: 11 }}>{e.period || '—'}</td>
                          <td style={{ padding: '8px 10px', fontFamily: 'JetBrains Mono', fontSize: 11 }}>{e.qty || '—'}</td>
                          <td style={{ padding: '8px 10px', fontSize: 12, color: T.inkMid }}>{e.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>No exceptions — distribution plan is clean.</div>
              )}
            </Card>
          </>
        )}
      </div>
    </ModuleLayout>
  );
}

// ─── Helper Components ────────────────────────────────────────────

function StatusPill({ label, value, color }) {
  return (
    <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 16px', fontSize: 12 }}>
      <span style={{ color: T.inkLight }}>{label}:</span>{' '}
      <strong style={{ color: color || T.ink }}>{value}</strong>
    </div>
  );
}

function fmt(v) {
  if (v == null) return '—';
  const n = typeof v === 'number' ? v : parseFloat(v);
  if (isNaN(n)) return '—';
  return Math.round(n * 100) / 100;
}

// ─── SVG Plant Requirements Bar Chart ─────────────────────────────

const DC_COLORS = ['#4F46E5', '#059669', '#D97706', '#DC2626', '#7C3AED'];

function PlantReqChart({ periods, grossReqs, byDC }) {
  if (!periods || !grossReqs) return null;

  const W = 700, H = 200;
  const M = { top: 20, right: 20, bottom: 40, left: 50 };
  const innerW = W - M.left - M.right;
  const innerH = H - M.top - M.bottom;

  const maxVal = Math.max(...grossReqs, 1) * 1.15;
  const barW = innerW / periods.length * 0.7;
  const gap = innerW / periods.length;

  const dcNames = byDC ? Object.keys(byDC) : [];

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Plant gross requirements stacked bar chart by distribution center" style={{ width: '100%', maxWidth: W, height: 'auto' }}>
        {/* Y-axis grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
          const y = M.top + innerH * (1 - pct);
          const val = Math.round(maxVal * pct);
          return (
            <g key={i}>
              <line x1={M.left} y1={y} x2={W - M.right} y2={y} stroke={T.border} strokeWidth={0.5} />
              <text x={M.left - 6} y={y + 4} textAnchor="end" fontSize={9} fill={T.inkLight} fontFamily="JetBrains Mono">{val}</text>
            </g>
          );
        })}

        {/* Stacked bars */}
        {periods.map((p, i) => {
          const x = M.left + i * gap + (gap - barW) / 2;
          let yOffset = 0;

          return (
            <g key={p}>
              {dcNames.length > 0 ? (
                dcNames.map((dc, j) => {
                  const val = byDC[dc][i] || 0;
                  const barH = (val / maxVal) * innerH;
                  const y = M.top + innerH - yOffset - barH;
                  yOffset += barH;
                  return (
                    <rect key={dc} x={x} y={y} width={barW} height={barH}
                      fill={DC_COLORS[j % DC_COLORS.length]} opacity={0.85} rx={2}
                    />
                  );
                })
              ) : (
                <rect
                  x={x} y={M.top + innerH - (grossReqs[i] / maxVal) * innerH}
                  width={barW} height={(grossReqs[i] / maxVal) * innerH}
                  fill={T.accent} opacity={0.85} rx={2}
                />
              )}
              {/* X label */}
              <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize={8} fill={T.inkLight} fontFamily="JetBrains Mono">
                {p.slice(5)}
              </text>
              {/* Total label on top */}
              <text x={x + barW / 2} y={M.top + innerH - (grossReqs[i] / maxVal) * innerH - 4} textAnchor="middle" fontSize={9} fill={T.ink} fontWeight={500} fontFamily="JetBrains Mono">
                {grossReqs[i] || ''}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      {dcNames.length > 0 && (
        <div style={{ display: 'flex', gap: 16, padding: '4px 0', fontSize: 10, color: T.inkMid }}>
          {dcNames.map((dc, j) => (
            <span key={dc} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: DC_COLORS[j % DC_COLORS.length], display: 'inline-block' }} />
              {dc}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Network Diagram (SVG) ────────────────────────────────────────

function NetworkDiagram({ locations, lanes }) {
  if (!locations || !lanes) return null;

  const W = 700, H = 320;
  const plant = locations.find(l => l.type === 'plant');
  const dcs = locations.filter(l => l.type === 'dc');

  // Position plant at top center, DCs below
  const plantX = W / 2;
  const plantY = 60;
  const dcY = 220;
  const dcSpacing = W / (dcs.length + 1);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Distribution network topology diagram showing plant and DC connections" style={{ width: '100%', maxWidth: W, height: 'auto' }}>
        {/* Lanes (lines from plant to DCs) */}
        {dcs.map((dc, i) => {
          const dcX = dcSpacing * (i + 1);
          const lane = lanes.find(l => l.dest === dc.code);
          return (
            <g key={dc.code}>
              <line x1={plantX} y1={plantY + 24} x2={dcX} y2={dcY - 24}
                stroke={T.border} strokeWidth={2} strokeDasharray="6,4" />
              {/* Lane label */}
              <text
                x={(plantX + dcX) / 2 + (i === 0 ? -20 : i === dcs.length - 1 ? 20 : 0)}
                y={(plantY + dcY) / 2}
                textAnchor="middle" fontSize={9} fill={T.inkLight} fontFamily="JetBrains Mono"
              >
                {lane ? `${lane.leadTimePeriods}wk · $${lane.transitCostPerUnit}` : ''}
              </text>
            </g>
          );
        })}

        {/* Plant node */}
        <rect x={plantX - 60} y={plantY - 20} width={120} height={40} rx={8}
          fill={T.ink} stroke={T.ink} strokeWidth={1.5} />
        <text x={plantX} y={plantY - 2} textAnchor="middle" fontSize={10} fill={T.white} fontFamily="JetBrains Mono" fontWeight={600}>
          {plant?.code || 'PLANT'}
        </text>
        <text x={plantX} y={plantY + 12} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.7)" fontFamily="Inter">
          {plant?.city}, {plant?.state}
        </text>

        {/* DC nodes */}
        {dcs.map((dc, i) => {
          const dcX = dcSpacing * (i + 1);
          return (
            <g key={dc.code}>
              <rect x={dcX - 55} y={dcY - 20} width={110} height={44} rx={8}
                fill={T.white} stroke={T.accent} strokeWidth={1.5} />
              <text x={dcX} y={dcY - 2} textAnchor="middle" fontSize={10} fill={T.ink} fontFamily="JetBrains Mono" fontWeight={600}>
                {dc.code}
              </text>
              <text x={dcX} y={dcY + 12} textAnchor="middle" fontSize={8} fill={T.inkLight} fontFamily="Inter">
                {dc.city}, {dc.state}
              </text>
            </g>
          );
        })}

        {/* Title */}
        <text x={W / 2} y={H - 10} textAnchor="middle" fontSize={10} fill={T.inkLight} fontFamily="Inter">
          Demand Plan → DRP → Production Plan → MPS → MRP
        </text>
      </svg>
    </div>
  );
}
