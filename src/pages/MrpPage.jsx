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

const LEVEL_COLORS = {
  0: { bg: T.ink, text: T.white, label: 'FG' },
  1: { bg: T.accent, text: T.white, label: 'SUB' },
  2: { bg: T.inkLight, text: T.white, label: 'RAW' },
};

export default function MrpPage() {
  const [tab, setTab] = useState('records');
  const [data, setData] = useState(null);
  const [bomData, setBomData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSku, setSelectedSku] = useState(null);
  const [selectedPlant, setSelectedPlant] = useState('PLANT-NORTH');
  const [expandedBom, setExpandedBom] = useState(new Set());

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/mrp/demo?plant=${selectedPlant}`).then(r => r.json()),
      fetch(`/api/mrp/bom?plant=${selectedPlant}`).then(r => r.json()),
    ])
      .then(([mrp, bom]) => {
        setData(mrp);
        setBomData(bom);
        if (mrp.results?.length > 0) setSelectedSku(mrp.results[0].skuCode);
        // Expand all FGs by default
        const expanded = new Set();
        bom.tree?.forEach(fg => expanded.add(fg.code));
        setExpandedBom(expanded);
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

  const toggleBomExpand = (code) => {
    setExpandedBom(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  return (
    <ModuleLayout moduleContext="mrp" tabs={TABS} activeTab={tab} onTabChange={setTab}>
      <PageHeader title="Material Requirements Planning" subtitle="MRP" />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 40px' }}>

        {/* Plant selector */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: T.inkLight, marginRight: 4 }}>Plant:</span>
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
          <span style={{ fontSize: 10, color: T.inkLight, marginLeft: 8 }}>
            Plant-specific BOM — different plants may have different BOMs for the same product
          </span>
        </div>

        {/* Status bar */}
        {data && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <StatusPill label="SKUs Planned" value={data.skusPlanned} />
            <StatusPill label="Exceptions" value={data.totalExceptions} color={data.criticalExceptions > 0 ? T.risk : T.safe} />
            <StatusPill label="Critical" value={data.criticalExceptions} color={data.criticalExceptions > 0 ? T.risk : T.safe} />
            {tab === 'bom' && bomData && (
              <StatusPill label="BOM Items" value={bomData.tree?.length || 0} />
            )}
          </div>
        )}

        {/* ─── BOM Tab ─────────────────────────────────────────── */}
        {tab === 'bom' && (
          <Card title={`Bill of Materials — ${selectedPlant}`}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>Loading BOM...</div>
            ) : bomData?.tree ? (
              <div style={{ padding: '12px 0' }}>
                {/* BOM Legend */}
                <div style={{ display: 'flex', gap: 16, padding: '0 20px 12px', borderBottom: `1px solid ${T.border}` }}>
                  {Object.entries(LEVEL_COLORS).map(([level, cfg]) => (
                    <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{
                        display: 'inline-block', padding: '1px 6px', borderRadius: 3,
                        background: cfg.bg, color: cfg.text, fontSize: 8, fontWeight: 600,
                        fontFamily: 'JetBrains Mono', letterSpacing: 0.5,
                      }}>{cfg.label}</span>
                      <span style={{ fontSize: 10, color: T.inkLight }}>
                        {level === '0' ? 'Finished Good' : level === '1' ? 'Subassembly' : 'Raw Material'}
                      </span>
                    </div>
                  ))}
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 10, color: T.inkGhost }}>Click to expand/collapse</span>
                </div>

                {/* BOM Tree */}
                {bomData.tree.map(fg => (
                  <BomNode
                    key={fg.code}
                    node={fg}
                    depth={0}
                    expanded={expandedBom}
                    onToggle={toggleBomExpand}
                    selectedPlant={selectedPlant}
                  />
                ))}

                {/* Dual-source callout */}
                {selectedPlant === 'PLANT-NORTH' && (
                  <div style={{
                    margin: '16px 20px 8px', padding: '10px 14px', background: T.warnBg,
                    border: `1px solid ${T.warnBorder}`, borderRadius: 8, fontSize: 11, color: T.warn,
                  }}>
                    <strong>Dual-sourced:</strong> MTR-200 uses ROT-A (standard rotor) at this plant.
                    At PLANT-SOUTH it uses ROT-B (heavy-duty) with different bearings and shaft.
                  </div>
                )}
                {selectedPlant === 'PLANT-SOUTH' && (
                  <div style={{
                    margin: '16px 20px 8px', padding: '10px 14px', background: T.warnBg,
                    border: `1px solid ${T.warnBorder}`, borderRadius: 8, fontSize: 11, color: T.warn,
                  }}>
                    <strong>Dual-sourced:</strong> MTR-200 uses ROT-B (heavy-duty rotor) at this plant.
                    At PLANT-NORTH it uses ROT-A (standard) with different bearings and shaft.
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>No BOM data available</div>
            )}
          </Card>
        )}

        {/* ─── Records Tab ─────────────────────────────────────── */}
        {tab === 'records' && (
          <>
            {/* SKU selector */}
            {data && (
              <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
                {data.results?.map(r => (
                  <button
                    key={r.skuCode}
                    onClick={() => setSelectedSku(r.skuCode)}
                    style={{
                      background: selectedSku === r.skuCode ? T.ink : T.white,
                      color: selectedSku === r.skuCode ? T.white : T.ink,
                      border: `1px solid ${selectedSku === r.skuCode ? T.ink : T.border}`,
                      borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
                      fontFamily: 'JetBrains Mono', fontSize: 10, transition: 'all 0.12s',
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
                  {/* SKU info bar */}
                  <div style={{ padding: '10px 16px', background: T.bgDark, borderBottom: `1px solid ${T.border}`, display: 'flex', gap: 20, fontSize: 11 }}>
                    <span><span style={{ color: T.inkLight }}>Name:</span> {selectedResult.skuName || selectedResult.skuCode}</span>
                    <span><span style={{ color: T.inkLight }}>Level:</span> {selectedResult.level ?? '—'}</span>
                    <span><span style={{ color: T.inkLight }}>Lead Time:</span> {selectedResult.leadTime || '—'} wk</span>
                    <span><span style={{ color: T.inkLight }}>Lot Sizing:</span> {selectedResult.lotSizing || '—'}</span>
                    <span><span style={{ color: T.inkLight }}>Safety Stock:</span> {selectedResult.safetyStock ?? '—'}</span>
                  </div>
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
                { label: 'Expedite', count: expCounts.expedite, color: T.risk, desc: 'Need sooner than planned' },
                { label: 'Reschedule In', count: expCounts['reschedule-in'], color: T.warn, desc: 'Move receipt earlier' },
                { label: 'Reschedule Out', count: expCounts['reschedule-out'], color: T.safe, desc: 'Defer — demand reduced' },
                { label: 'Cancel', count: expCounts.cancel, color: T.inkLight, desc: 'No longer needed' },
              ].map(e => (
                <div key={e.label} style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 8, padding: '14px 16px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Sora', fontSize: 28, fontWeight: 600, color: e.color }}>{e.count}</div>
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkLight, letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 }}>{e.label}</div>
                  <div style={{ fontSize: 9, color: T.inkGhost, marginTop: 2 }}>{e.desc}</div>
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

// ─── Helpers ──────────────────────────────────────────────────────

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

// ─── BOM Tree Node ────────────────────────────────────────────────

function BomNode({ node, depth, expanded, onToggle, selectedPlant }) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expanded.has(node.code);
  const levelCfg = LEVEL_COLORS[node.level] || LEVEL_COLORS[2];
  const isDualSource = node.code === 'MTR-200';

  return (
    <div>
      {/* Node row */}
      <div
        onClick={() => hasChildren && onToggle(node.code)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: `8px 20px 8px ${20 + depth * 28}px`,
          cursor: hasChildren ? 'pointer' : 'default',
          borderBottom: `1px solid ${T.border}`,
          background: depth === 0 ? T.bgDark : 'transparent',
          transition: 'background 0.1s',
        }}
        onMouseEnter={e => { if (hasChildren) e.currentTarget.style.background = T.bgDark; }}
        onMouseLeave={e => { if (depth > 0) e.currentTarget.style.background = 'transparent'; }}
      >
        {/* Expand/collapse indicator */}
        <span style={{
          width: 16, textAlign: 'center', fontSize: 10, color: T.inkLight,
          fontFamily: 'JetBrains Mono',
        }}>
          {hasChildren ? (isExpanded ? '▼' : '▶') : (depth > 0 ? '└' : '')}
        </span>

        {/* Level badge */}
        <span style={{
          display: 'inline-block', padding: '1px 6px', borderRadius: 3,
          background: levelCfg.bg, color: levelCfg.text,
          fontSize: 8, fontWeight: 600, fontFamily: 'JetBrains Mono',
          letterSpacing: 0.5, minWidth: 28, textAlign: 'center',
        }}>
          {levelCfg.label}
        </span>

        {/* Code */}
        <span style={{
          fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 600,
          color: T.ink, minWidth: 90,
        }}>
          {node.code}
          {isDualSource && (
            <span style={{ marginLeft: 6, fontSize: 9, color: T.warn, fontWeight: 400 }}>
              DUAL
            </span>
          )}
        </span>

        {/* Name */}
        <span style={{ fontSize: 12, color: T.inkMid, flex: 1 }}>
          {node.name}
        </span>

        {/* Qty per (for children) */}
        {node.qtyPer != null && (
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkMid, minWidth: 50, textAlign: 'right' }}>
            ×{node.qtyPer}
          </span>
        )}

        {/* Scrap */}
        {node.scrapPct > 0 && (
          <span style={{
            fontFamily: 'JetBrains Mono', fontSize: 9, color: T.warn,
            background: T.warnBg, padding: '1px 5px', borderRadius: 3,
          }}>
            {node.scrapPct}% scrap
          </span>
        )}

        {/* Lead time */}
        <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkLight, minWidth: 40, textAlign: 'right' }}>
          {node.leadTime}wk
        </span>

        {/* Lot sizing */}
        <span style={{
          fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkGhost,
          minWidth: 50, textAlign: 'right',
        }}>
          {node.lotSizing === 'lot-for-lot' ? 'L4L' :
           node.lotSizing === 'fixed-order-qty' ? 'FOQ' :
           node.lotSizing === 'eoq' ? 'EOQ' :
           node.lotSizing === 'period-order-qty' ? 'POQ' :
           node.lotSizing || '—'}
        </span>

        {/* On hand */}
        <span style={{
          fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkMid,
          minWidth: 50, textAlign: 'right',
        }}>
          OH:{node.onHand ?? 0}
        </span>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map(child => (
            <BomNode
              key={child.code}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              selectedPlant={selectedPlant}
            />
          ))}
        </div>
      )}
    </div>
  );
}
