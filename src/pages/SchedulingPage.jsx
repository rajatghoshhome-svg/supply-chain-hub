import { useState, useEffect } from 'react';
import { T } from '../styles/tokens';
import ModuleLayout from '../components/shared/ModuleLayout';
import PageHeader from '../components/shared/PageHeader';
import Card from '../components/shared/Card';

const TABS = [
  { id: 'gantt', label: 'Gantt Chart' },
  { id: 'orders', label: 'Order List' },
  { id: 'compare', label: 'Rule Comparison' },
];

const SKU_COLORS = {
  'GRN-BAR': '#4F46E5', 'PRO-BAR': '#6366F1', 'TRL-MIX': '#059669',
  'VEG-CHP': '#10B981', 'RCE-CRK': '#D97706', 'SPK-WAT': '#2563EB',
  'JCE-APL': '#DC2626', 'KMB-GNG': '#7C3AED', 'NRG-CIT': '#F59E0B',
  'CLD-BRW': '#EC4899', 'NUT-BTR': '#8B5CF6',
};

const PLANTS = ['PLT-PDX', 'PLT-ATX', 'PLT-NSH'];

// ─── Static fallback data (used when API is unavailable, e.g. Vercel) ────
const STATIC_SCHEDULE = {
  totalOrders: 6, makespan: 28.5, lateOrders: 1,
  schedule: [
    { id: 'PO-5501', skuCode: 'GRN-BAR', qty: 528, processingTime: 4.5, startTime: 0, endTime: 4.5, dueDate: 'W14-Fri', late: false },
    { id: 'PO-5502', skuCode: 'PRO-BAR', qty: 395, processingTime: 5, startTime: 4.5, endTime: 9.5, dueDate: 'W15-Wed', late: false },
    { id: 'PO-5503', skuCode: 'TRL-MIX', qty: 378, processingTime: 5.5, startTime: 9.5, endTime: 15, dueDate: 'W15-Fri', late: false },
    { id: 'PO-5504', skuCode: 'VEG-CHP', qty: 334, processingTime: 4, startTime: 15, endTime: 19, dueDate: 'W16-Mon', late: false },
    { id: 'PO-5505', skuCode: 'RCE-CRK', qty: 240, processingTime: 3.5, startTime: 19, endTime: 22.5, dueDate: 'W16-Wed', late: false },
    { id: 'PO-5506', skuCode: 'GRN-BAR', qty: 648, processingTime: 6, startTime: 22.5, endTime: 28.5, dueDate: 'W16-Tue', late: true, lateDays: 1 },
  ],
  comparison: {
    SPT: { makespan: 26.0, lateOrders: 2, sequence: ['PO-5505','PO-5504','PO-5501','PO-5502','PO-5503','PO-5506'] },
    EDD: { makespan: 28.5, lateOrders: 1, sequence: ['PO-5501','PO-5502','PO-5503','PO-5504','PO-5505','PO-5506'] },
    CR: { makespan: 27.5, lateOrders: 1, sequence: ['PO-5501','PO-5502','PO-5504','PO-5503','PO-5505','PO-5506'] },
  },
};

export default function SchedulingPage() {
  const [tab, setTab] = useState('gantt');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rule, setRule] = useState('EDD');
  const [plant, setPlant] = useState('PLT-PDX');
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [resequencing, setResequencing] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/scheduling/demo?rule=${rule}&plant=${plant}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { console.warn('Scheduling API unavailable, using static fallback'); setData(STATIC_SCHEDULE); setLoading(false); });
  }, [rule, plant]);

  return (
    <ModuleLayout moduleContext="scheduling" tabs={TABS} activeTab={tab} onTabChange={setTab}>
      <PageHeader title="Production Scheduling" subtitle="Detailed Schedule" />

      <div className="module-content" style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 40px' }}>

        {/* Plant + Rule selector + stats */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {PLANTS.map(p => (
              <button
                key={p}
                onClick={() => setPlant(p)}
                style={{
                  background: plant === p ? T.ink : T.white,
                  color: plant === p ? T.white : T.ink,
                  border: `1px solid ${plant === p ? T.ink : T.border}`,
                  borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
                  fontFamily: 'JetBrains Mono', fontSize: 10, transition: 'all 0.12s',
                }}
              >
                {p}
              </button>
            ))}
          </div>
          <div style={{ width: 1, height: 20, background: T.border }} />
          <div style={{ display: 'flex', gap: 4 }}>
            {['SPT', 'EDD', 'CR'].map(r => (
              <button
                key={r}
                onClick={() => setRule(r)}
                style={{
                  background: rule === r ? T.ink : T.white,
                  color: rule === r ? T.white : T.ink,
                  border: `1px solid ${rule === r ? T.ink : T.border}`,
                  borderRadius: 6, padding: '5px 12px', cursor: 'pointer',
                  fontFamily: 'JetBrains Mono', fontSize: 11, transition: 'all 0.12s',
                }}
              >
                {r}
              </button>
            ))}
          </div>
          {data && (
            <>
              <StatusPill label="Orders" value={data.totalOrders} />
              <StatusPill label="Makespan" value={`${Math.round(data.makespan * 10) / 10}h`} />
              <StatusPill label="Late" value={data.lateOrders} color={data.lateOrders > 0 ? T.risk : T.safe} />
            </>
          )}
        </div>

        {/* ─── Gantt Chart Tab ─────────────────────────────────── */}
        {tab === 'gantt' && (
          <Card title={`Gantt Chart — ${rule} Sequencing`}>
            {loading ? (
              <div style={{ padding: 60, textAlign: 'center', color: T.inkLight }}>Scheduling...</div>
            ) : data?.schedule ? (
              <div style={{ padding: '16px 20px', overflowX: 'auto' }}>
                <GanttChart schedule={data.schedule} makespan={data.makespan} />
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>No schedule data</div>
            )}
          </Card>
        )}

        {/* ─── Order List Tab ──────────────────────────────────── */}
        {tab === 'orders' && (
          <Card title="Scheduled Production Orders">
            {data?.schedule ? (
              <div style={{ overflowX: 'auto' }}>
                {/* Reset + resequence info */}
                <div style={{ display: 'flex', gap: 8, padding: '8px 10px', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: T.inkLight, fontFamily: 'JetBrains Mono' }}>
                    Drag rows to resequence
                  </span>
                  <button
                    onClick={() => {
                      setLoading(true);
                      fetch(`/api/scheduling/demo?rule=${rule}&plant=${plant}`)
                        .then(r => { if (!r.ok) throw new Error(); return r.json(); })
                        .then(d => { setData(d); setLoading(false); })
                        .catch(() => { setData(STATIC_SCHEDULE); setLoading(false); });
                    }}
                    style={{
                      background: T.white, color: T.ink, border: `1px solid ${T.border}`,
                      borderRadius: 4, padding: '3px 10px', fontSize: 10, cursor: 'pointer',
                      fontFamily: 'JetBrains Mono', fontWeight: 500,
                    }}
                  >
                    Reset to {rule}
                  </button>
                  {resequencing && (
                    <span style={{ fontSize: 10, color: T.accent, fontFamily: 'JetBrains Mono' }}>Saving...</span>
                  )}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'JetBrains Mono' }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                      {['#', 'Order', 'SKU', 'Qty', 'Proc Time', 'Start', 'End', 'Due Date', 'Status'].map(h => (
                        <th key={h} scope="col" style={{ textAlign: h === '#' || h === 'Order' || h === 'SKU' || h === 'Status' ? 'left' : 'right', padding: '8px 10px', color: T.inkLight, fontWeight: 500, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.schedule.map((o, idx) => (
                      <tr
                        key={o.id}
                        draggable="true"
                        onDragStart={() => setDraggedIdx(idx)}
                        onDragEnd={() => { setDraggedIdx(null); setDragOverIdx(null); }}
                        onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx); }}
                        onDrop={async (e) => {
                          e.preventDefault();
                          if (draggedIdx === null || draggedIdx === idx) return;
                          const newSchedule = [...data.schedule];
                          const [moved] = newSchedule.splice(draggedIdx, 1);
                          newSchedule.splice(idx, 0, moved);
                          // Recalculate start/end times
                          let cumTime = 0;
                          const resequenced = newSchedule.map(item => {
                            const start = cumTime;
                            const end = cumTime + item.processingTime;
                            cumTime = end;
                            return { ...item, startTime: start, endTime: end };
                          });
                          setData(prev => ({ ...prev, schedule: resequenced, makespan: cumTime }));
                          setDraggedIdx(null);
                          setDragOverIdx(null);
                          // Call backend
                          setResequencing(true);
                          try {
                            const res = await fetch('/api/scheduling/resequence', {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ plant, orderIds: resequenced.map(r => r.id), orders: resequenced }),
                            });
                            if (res.ok) {
                              const updated = await res.json();
                              setData(prev => ({ ...prev, schedule: updated.schedule, makespan: updated.makespan, lateOrders: updated.lateOrders, totalOrders: updated.totalOrders }));
                            }
                          } catch {
                            // keep local resequenced data as fallback
                          }
                          setResequencing(false);
                        }}
                        style={{
                          borderBottom: `1px solid ${T.border}`,
                          background: o.late ? T.riskBg : draggedIdx === idx ? `${T.accent}10` : 'transparent',
                          cursor: 'grab',
                          position: 'relative',
                          borderTop: dragOverIdx === idx && draggedIdx !== null && draggedIdx !== idx ? `2px solid ${T.blue}` : 'none',
                          opacity: draggedIdx === idx ? 0.5 : 1,
                          transition: 'opacity 0.1s',
                        }}
                      >
                        <td style={{ padding: '6px 10px', color: T.inkGhost, fontSize: 10 }}>{idx + 1}</td>
                        <td style={{ padding: '6px 10px', fontWeight: 500 }}>{o.id}</td>
                        <td style={{ padding: '6px 10px' }}>
                          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: SKU_COLORS[o.skuCode] || T.inkGhost, marginRight: 6 }} />
                          {o.skuCode}
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'right' }}>{o.qty}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right' }}>{o.processingTime}h</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right' }}>{Math.round(o.startTime * 10) / 10}h</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right' }}>{Math.round(o.endTime * 10) / 10}h</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', color: T.inkMid }}>{o.dueDate}</td>
                        <td style={{ padding: '6px 10px' }}>
                          {o.late ? (
                            <span style={{ color: T.risk, fontWeight: 600 }}>LATE (+{o.lateDays}d)</span>
                          ) : (
                            <span style={{ color: T.safe }}>On Time</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>No orders</div>
            )}
          </Card>
        )}

        {/* ─── Rule Comparison Tab ─────────────────────────────── */}
        {tab === 'compare' && (
          <Card title="Sequencing Rule Comparison">
            {data?.comparison ? (
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {Object.entries(data.comparison).map(([ruleName, stats]) => (
                    <div key={ruleName} style={{
                      background: ruleName === rule ? T.ink : T.bgDark,
                      border: `1px solid ${ruleName === rule ? T.ink : T.border}`,
                      borderRadius: 10, padding: '20px',
                    }}>
                      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 14, fontWeight: 600, color: ruleName === rule ? T.white : T.ink, marginBottom: 12 }}>
                        {ruleName}
                        <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 6, color: ruleName === rule ? 'rgba(255,255,255,0.6)' : T.inkLight }}>
                          {ruleName === 'SPT' && '(Shortest Processing Time)'}
                          {ruleName === 'EDD' && '(Earliest Due Date)'}
                          {ruleName === 'CR' && '(Critical Ratio)'}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 8, color: ruleName === rule ? 'rgba(255,255,255,0.5)' : T.inkLight, letterSpacing: 1, textTransform: 'uppercase' }}>Makespan</div>
                          <div style={{ fontFamily: 'Sora', fontSize: 22, fontWeight: 600, color: ruleName === rule ? T.white : T.accent }}>{Math.round(stats.makespan * 10) / 10}h</div>
                        </div>
                        <div>
                          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 8, color: ruleName === rule ? 'rgba(255,255,255,0.5)' : T.inkLight, letterSpacing: 1, textTransform: 'uppercase' }}>Late Orders</div>
                          <div style={{ fontFamily: 'Sora', fontSize: 22, fontWeight: 600, color: stats.lateOrders > 0 ? T.risk : (ruleName === rule ? T.white : T.safe) }}>{stats.lateOrders}</div>
                        </div>
                      </div>
                      <div style={{ marginTop: 12, fontSize: 10, color: ruleName === rule ? 'rgba(255,255,255,0.6)' : T.inkLight }}>
                        Sequence: {stats.sequence.join(' → ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>Run scheduler to compare rules</div>
            )}
          </Card>
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

// ─── SVG Gantt Chart ──────────────────────────────────────────────

function GanttChart({ schedule, makespan }) {
  if (!schedule || schedule.length === 0) return null;

  const W = 800, rowH = 32, headerH = 30;
  const M = { left: 80, right: 20 };
  const H = headerH + schedule.length * rowH + 10;
  const chartW = W - M.left - M.right;

  const timeScale = (t) => M.left + (t / makespan) * chartW;

  // Time gridlines
  const gridInterval = Math.max(1, Math.ceil(makespan / 15));
  const gridLines = [];
  for (let t = 0; t <= makespan; t += gridInterval) {
    gridLines.push(t);
  }

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Gantt chart showing production schedule with ${schedule.length} orders over ${Math.round(makespan)}h makespan`} style={{ width: '100%', maxWidth: W, height: 'auto' }}>
        {/* Grid lines */}
        {gridLines.map(t => (
          <g key={t}>
            <line x1={timeScale(t)} y1={headerH} x2={timeScale(t)} y2={H} stroke={T.border} strokeWidth={0.5} />
            <text x={timeScale(t)} y={headerH - 6} textAnchor="middle" fontSize={8} fill={T.inkLight} fontFamily="JetBrains Mono">{t}h</text>
          </g>
        ))}

        {/* Bars */}
        {schedule.map((o, i) => {
          const y = headerH + i * rowH + 4;
          const barH = rowH - 8;
          const x1 = timeScale(o.startTime);
          const barW = timeScale(o.endTime) - x1;
          const color = SKU_COLORS[o.skuCode] || T.inkGhost;

          return (
            <g key={o.id}>
              {/* Row label */}
              <text x={M.left - 6} y={y + barH / 2 + 4} textAnchor="end" fontSize={9} fill={T.inkMid} fontFamily="JetBrains Mono">
                {o.id}
              </text>
              {/* Bar */}
              <rect x={x1} y={y} width={Math.max(barW, 2)} height={barH}
                fill={color} opacity={o.late ? 0.5 : 0.85} rx={3}
                stroke={o.late ? T.risk : 'none'} strokeWidth={o.late ? 1.5 : 0}
              />
              {/* Bar label */}
              {barW > 40 && (
                <text x={x1 + barW / 2} y={y + barH / 2 + 3} textAnchor="middle" fontSize={8} fill="#fff" fontFamily="JetBrains Mono" fontWeight={500}>
                  {o.skuCode} ({o.qty})
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, padding: '8px 0', fontSize: 10, color: T.inkMid }}>
        {Object.entries(SKU_COLORS).map(([sku, color]) => (
          <span key={sku} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: 'inline-block' }} />
            {sku}
          </span>
        ))}
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, border: `1.5px solid ${T.risk}`, display: 'inline-block' }} />
          Late
        </span>
      </div>
    </div>
  );
}
