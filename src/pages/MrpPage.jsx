import { useState, useEffect } from 'react';
import { T } from '../styles/tokens';
import ModuleLayout from '../components/shared/ModuleLayout';
import PageHeader from '../components/shared/PageHeader';
import Card from '../components/shared/Card';

const TABS = [
  { id: 'bom', label: 'Bill of Materials' },
  { id: 'records', label: 'MRP Records' },
  { id: 'exceptions', label: 'Exceptions' },
];

const PLANTS = ['PLANT-NORTH', 'PLANT-SOUTH', 'PLANT-WEST'];

export default function MrpPage() {
  const [tab, setTab] = useState('records');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSku, setSelectedSku] = useState(null);
  const [selectedPlant, setSelectedPlant] = useState('PLANT-NORTH');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/mrp/demo?plant=${selectedPlant}`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        if (d.results?.length > 0) setSelectedSku(d.results[0].skuCode);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedPlant]);

  const allExceptions = data?.results?.flatMap(r => r.exceptions) || [];
  const expCounts = {
    expedite: allExceptions.filter(e => e.type === 'expedite').length,
    'reschedule-in': allExceptions.filter(e => e.type === 'reschedule-in').length,
    'reschedule-out': allExceptions.filter(e => e.type === 'reschedule-out').length,
    cancel: allExceptions.filter(e => e.type === 'cancel').length,
  };

  const selectedResult = data?.results?.find(r => r.skuCode === selectedSku);

  // BOM derived from MRP results — shows what components each SKU uses
  // This is plant-specific: selecting a different plant shows different BOMs
  const bomData = {};
  if (data?.results) {
    for (const r of data.results) {
      if (r.level === 0 || r.level === 1) {
        bomData[r.skuCode] = {
          name: r.skuName || r.skuCode,
          level: r.level,
          children: [], // will be populated when we have BOM API
        };
      }
    }
  }

  return (
    <ModuleLayout moduleContext="mrp" tabs={TABS} activeTab={tab} onTabChange={setTab}>
      <PageHeader title="Material Requirements Planning" subtitle="MRP" />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 40px' }}>

        {/* Plant selector */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          <span style={{ fontSize: 11, color: T.inkLight, alignSelf: 'center', marginRight: 4 }}>Plant:</span>
          {PLANTS.map(p => (
            <button
              key={p}
              onClick={() => setSelectedPlant(p)}
              style={{
                background: selectedPlant === p ? T.ink : T.white,
                color: selectedPlant === p ? T.white : T.ink,
                border: `1px solid ${selectedPlant === p ? T.ink : T.border}`,
                borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
                fontFamily: 'JetBrains Mono', fontSize: 10, transition: 'all 0.12s',
              }}
            >
              {p}
            </button>
          ))}
          <span style={{ fontSize: 10, color: T.inkLight, alignSelf: 'center', marginLeft: 8 }}>
            MRP uses plant-specific BOM — different plants may have different BOMs for the same product
          </span>
        </div>

        {/* Status bar */}
        {data && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 16px', fontSize: 12 }}>
              <span style={{ color: T.inkLight }}>SKUs Planned:</span> <strong>{data.skusPlanned}</strong>
            </div>
            <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 16px', fontSize: 12 }}>
              <span style={{ color: T.inkLight }}>Exceptions:</span> <strong style={{ color: data.criticalExceptions > 0 ? T.risk : T.safe }}>{data.totalExceptions}</strong>
            </div>
            <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 16px', fontSize: 12 }}>
              <span style={{ color: T.inkLight }}>Critical:</span> <strong style={{ color: T.risk }}>{data.criticalExceptions}</strong>
            </div>
          </div>
        )}

        {/* ─── BOM Tab ─────────────────────────────────────────── */}
        {tab === 'bom' && (
          <Card title="Bill of Materials — Electric Motor Product Line">
            <div style={{ padding: '20px' }}>
              {Object.entries(bomData).map(([code, item]) => (
                <div key={code} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: code.startsWith('MTR') ? T.ink : code.startsWith('STAT') || code.startsWith('ROT') ? T.accent : T.inkGhost }} />
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: 13, fontWeight: 600, color: T.ink }}>{code}</span>
                    <span style={{ fontSize: 12, color: T.inkLight }}>{item.name}</span>
                  </div>
                  <div style={{ paddingLeft: 24, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {item.children.map(child => (
                      <span key={child} style={{
                        background: T.bgDark, border: `1px solid ${T.border}`, borderRadius: 4,
                        padding: '3px 8px', fontSize: 11, fontFamily: 'JetBrains Mono', color: T.inkMid,
                      }}>
                        {child}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ─── Records Tab ─────────────────────────────────────── */}
        {tab === 'records' && (
          <>
            {/* SKU selector */}
            {data && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                {data.results?.map(r => (
                  <button
                    key={r.skuCode}
                    onClick={() => setSelectedSku(r.skuCode)}
                    style={{
                      background: selectedSku === r.skuCode ? T.ink : T.white,
                      color: selectedSku === r.skuCode ? T.white : T.ink,
                      border: `1px solid ${selectedSku === r.skuCode ? T.ink : T.border}`,
                      borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
                      fontFamily: 'JetBrains Mono', fontSize: 11, transition: 'all 0.12s',
                    }}
                  >
                    {r.skuCode}
                    {r.criticalExceptions > 0 && (
                      <span style={{ marginLeft: 4, color: selectedSku === r.skuCode ? '#ff9999' : T.risk }}>
                        ({r.criticalExceptions})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            <Card title={`Time-Phased MRP Records — ${selectedSku || '...'}`}>
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>Running MRP explosion...</div>
              ) : selectedResult ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'JetBrains Mono' }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                        {['Period', 'Gross Req', 'Sched Rcpt', 'Proj OH', 'Net Req', 'Pln Rcpt', 'Pln Release'].map(h => (
                          <th key={h} style={{ textAlign: h === 'Period' ? 'left' : 'right', padding: '8px 10px', color: T.inkLight, fontWeight: 500, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedResult.records.map(r => (
                        <tr key={r.period} style={{ borderBottom: `1px solid ${T.border}` }}>
                          <td style={{ padding: '6px 10px', color: T.inkMid }}>{r.period}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right' }}>{fmt(r.grossReq)}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: r.scheduledReceipts > 0 ? T.accent : T.inkGhost }}>{fmt(r.scheduledReceipts)}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: r.projectedOH < 0 ? T.risk : T.ink, fontWeight: r.projectedOH < 0 ? 600 : 400 }}>{fmt(r.projectedOH)}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: r.netReq > 0 ? T.warn : T.inkGhost }}>{fmt(r.netReq)}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: r.plannedOrderReceipt > 0 ? T.safe : T.inkGhost }}>{fmt(r.plannedOrderReceipt)}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: r.plannedOrderRelease > 0 ? T.accent : T.inkGhost, fontWeight: r.plannedOrderRelease > 0 ? 600 : 400 }}>{fmt(r.plannedOrderRelease)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>Select a SKU above</div>
              )}
            </Card>
          </>
        )}

        {/* ─── Exceptions Tab ──────────────────────────────────── */}
        {tab === 'exceptions' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Expedite', count: expCounts.expedite, color: T.risk },
                { label: 'Reschedule In', count: expCounts['reschedule-in'], color: T.warn },
                { label: 'Reschedule Out', count: expCounts['reschedule-out'], color: T.safe },
                { label: 'Cancel', count: expCounts.cancel, color: T.inkLight },
              ].map(e => (
                <div key={e.label} style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 8, padding: '14px 16px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Sora', fontSize: 28, fontWeight: 600, color: e.color }}>{e.count}</div>
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkLight, letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 }}>{e.label}</div>
                </div>
              ))}
            </div>

            <Card title={`Exception Details (${allExceptions.length} total)`}>
              {allExceptions.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                        {['Severity', 'SKU', 'Type', 'Period', 'Qty', 'Message'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: T.inkLight, fontWeight: 500, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allExceptions.map((e, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${T.border}`, background: e.severity === 'critical' ? T.riskBg : 'transparent' }}>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{
                              display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                              background: e.severity === 'critical' ? T.riskBg : e.severity === 'warning' ? T.warnBg : T.bgDark,
                              color: e.severity === 'critical' ? T.risk : e.severity === 'warning' ? T.warn : T.inkMid,
                              border: `1px solid ${e.severity === 'critical' ? T.riskBorder : e.severity === 'warning' ? T.warnBorder : T.border}`,
                            }}>
                              {e.severity}
                            </span>
                          </td>
                          <td style={{ padding: '8px 10px', fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 500 }}>{e.skuCode}</td>
                          <td style={{ padding: '8px 10px', fontFamily: 'JetBrains Mono', fontSize: 11 }}>{e.type}</td>
                          <td style={{ padding: '8px 10px', fontFamily: 'JetBrains Mono', fontSize: 11 }}>{e.period || e.fromPeriod || '—'}</td>
                          <td style={{ padding: '8px 10px', fontFamily: 'JetBrains Mono', fontSize: 11 }}>{e.qty || '—'}</td>
                          <td style={{ padding: '8px 10px', fontSize: 12, color: T.inkMid }}>{e.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>No exceptions — plan is clean.</div>
              )}
            </Card>
          </>
        )}
      </div>
    </ModuleLayout>
  );
}

function fmt(v) {
  if (v == null) return '—';
  const n = typeof v === 'number' ? v : parseFloat(v);
  if (isNaN(n)) return '—';
  return Math.round(n * 100) / 100;
}
