import { useState, useEffect } from 'react';
import { T } from '../styles/tokens';
import ModuleLayout from '../components/shared/ModuleLayout';
import PageHeader from '../components/shared/PageHeader';
import Card from '../components/shared/Card';
import TrustScore from '../components/TrustScore';
import DataSourceBadge from '../components/shared/DataSourceBadge';

const TABS = [
  { id: 'gantt', label: 'Schedule' },
  { id: 'orders', label: 'Process Orders' },
  { id: 'compare', label: 'Optimization' },
];

const SKU_COLORS = {
  'GRN-BAR': '#4F46E5', 'PRO-BAR': '#6366F1', 'TRL-MIX': '#059669',
  'VEG-CHP': '#10B981', 'RCE-CRK': '#D97706', 'SPK-WAT': '#2563EB',
  'JCE-APL': '#DC2626', 'KMB-GNG': '#7C3AED', 'NRG-CIT': '#F59E0B',
  'CLD-BRW': '#EC4899', 'NUT-BTR': '#8B5CF6',
};

const PLANTS = ['PLT-PDX', 'PLT-ATX', 'PLT-NSH'];

const PLANT_NAMES = { 'PLT-PDX': 'Portland', 'PLT-ATX': 'Austin', 'PLT-NSH': 'Nashville' };
const RULE_NAMES = { 'SPT': 'Shortest Job First', 'EDD': 'Earliest Due Date', 'CR': 'Critical Ratio' };

// ─── Static fallback data ────────────────────────────────────────────────
const STATIC_SCHEDULE = {
  totalOrders: 6, makespan: 28.5, lateOrders: 1,
  schedule: [
    { id: 'PO-5501', skuCode: 'GRN-BAR', skuName: 'Oat & Honey Granola Bar', qty: 528, processingTime: 4.5, startTime: 0, endTime: 4.5, dueDate: 'W14-Fri', late: false, workCenter: 'WC-P-BAKING', workCenterName: 'Baking/Forming Ovens' },
    { id: 'PO-5502', skuCode: 'PRO-BAR', skuName: 'Peanut Butter Protein Bar', qty: 395, processingTime: 5, startTime: 4.5, endTime: 9.5, dueDate: 'W15-Wed', late: false, workCenter: 'WC-P-BAKING', workCenterName: 'Baking/Forming Ovens' },
    { id: 'PO-5503', skuCode: 'TRL-MIX', skuName: 'Classic Trail Mix', qty: 378, processingTime: 5.5, startTime: 9.5, endTime: 15, dueDate: 'W15-Fri', late: false, workCenter: 'WC-P-MIXING', workCenterName: 'Dry Mixing Line' },
    { id: 'PO-5504', skuCode: 'VEG-CHP', skuName: 'Veggie Chips', qty: 334, processingTime: 4, startTime: 15, endTime: 19, dueDate: 'W16-Mon', late: false, workCenter: 'WC-P-BAKING', workCenterName: 'Baking/Forming Ovens' },
    { id: 'PO-5505', skuCode: 'RCE-CRK', skuName: 'Rice Crackers', qty: 240, processingTime: 3.5, startTime: 19, endTime: 22.5, dueDate: 'W16-Wed', late: false, workCenter: 'WC-P-BAKING', workCenterName: 'Baking/Forming Ovens' },
    { id: 'PO-5506', skuCode: 'GRN-BAR', skuName: 'Oat & Honey Granola Bar', qty: 648, processingTime: 6, startTime: 22.5, endTime: 28.5, dueDate: 'W16-Tue', late: true, lateDays: 1, workCenter: 'WC-P-BAKING', workCenterName: 'Baking/Forming Ovens' },
  ],
  workCenters: [
    { code: 'WC-P-MIXING', name: 'Dry Mixing Line', capacityHoursPerWeek: 160 },
    { code: 'WC-P-BAKING', name: 'Baking/Forming Ovens', capacityHoursPerWeek: 140 },
    { code: 'WC-P-PACKING', name: 'Packaging & Case Packing', capacityHoursPerWeek: 180 },
    { code: 'WC-P-QC', name: 'Quality Control & Testing', capacityHoursPerWeek: 80 },
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
  const [isLive, setIsLive] = useState(false);
  const [resolvedOrders, setResolvedOrders] = useState({});
  const [orderActionLoading, setOrderActionLoading] = useState(null);

  const handleOrderAction = async (order, action) => {
    setOrderActionLoading(order.id);
    try {
      const statusMap = { accept: 'accepted', escalate: 'deferred' };
      const actionLabel = action === 'accept' ? `Accept delay: ${order.id}` : `Escalate: ${order.id}`;
      await fetch('/api/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: 'scheduling',
          action: actionLabel,
          entityType: 'exception',
          entity: `${order.id} — ${order.skuCode} (${order.qty} units, +${order.lateDays}d late)`,
          rationale: action === 'accept'
            ? `Planner accepted ${order.lateDays}-day delay for ${order.skuCode}`
            : `Planner escalated late order ${order.id} for management review`,
          decidedBy: 'Planner',
          financialImpact: { amount: 500 * (order.lateDays || 1), type: action === 'accept' ? 'cost' : 'risk' },
          status: statusMap[action],
        }),
      });
      setResolvedOrders(prev => ({ ...prev, [order.id]: { status: statusMap[action], action } }));
    } catch (err) {
      console.error('Failed to log decision:', err);
    }
    setOrderActionLoading(null);
  };

  useEffect(() => {
    setLoading(true);
    fetch(`/api/scheduling/demo?rule=${rule}&plant=${plant}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setData(d); setIsLive(true); setLoading(false); })
      .catch(() => { console.warn('Scheduling API unavailable, using static fallback'); setData(STATIC_SCHEDULE); setIsLive(false); setLoading(false); });
  }, [rule, plant]);

  return (
    <ModuleLayout moduleContext="scheduling" tabs={TABS} activeTab={tab} onTabChange={setTab}>
      <PageHeader title="Production Scheduling" subtitle="Detailed Schedule">
        <DataSourceBadge isLive={isLive} />
        <TrustScore module="scheduling" compact />
      </PageHeader>
      <div className="module-content" style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 40px' }}>
        {/* Plant + Rule selector + stats */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {PLANTS.map(p => (
              <button key={p} onClick={() => setPlant(p)}
                style={{ background: plant === p ? T.ink : T.white, color: plant === p ? T.white : T.ink, border: `1px solid ${plant === p ? T.ink : T.border}`, borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontFamily: 'JetBrains Mono', fontSize: 10, transition: 'all 0.12s' }}>
                {PLANT_NAMES[p] || p}
                <span style={{ marginLeft: 4, fontSize: 9, color: plant === p ? 'rgba(255,255,255,0.5)' : T.inkLight }}>({p})</span>
              </button>
            ))}
          </div>
          <div style={{ width: 1, height: 20, background: T.border }} />
          <div style={{ display: 'flex', gap: 4 }}>
            {['SPT', 'EDD', 'CR'].map(r => (
              <button key={r} onClick={() => setRule(r)}
                style={{ background: rule === r ? T.ink : T.white, color: rule === r ? T.white : T.ink, border: `1px solid ${rule === r ? T.ink : T.border}`, borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontFamily: 'JetBrains Mono', fontSize: 11, transition: 'all 0.12s' }}>
                {RULE_NAMES[r] || r}
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

        {/* Schedule (Gantt) Tab */}
        {tab === 'gantt' && (
          <Card title={`Schedule \u2014 ${RULE_NAMES[rule] || rule} Sequencing`}>
            {loading ? (
              <div style={{ padding: 60, textAlign: 'center', color: T.inkLight }}>Scheduling...</div>
            ) : data?.schedule ? (
              <div style={{ padding: '16px 20px', overflowX: 'auto' }}>
                <GanttChart schedule={data.schedule} makespan={data.makespan} workCenters={data.workCenters} />
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>No schedule data</div>
            )}
          </Card>
        )}

        {/* Process Orders Tab */}
        {tab === 'orders' && (
          <Card title="Process Orders">
            {data?.schedule ? (
              <div style={{ overflowX: 'auto' }}>
                <div style={{ display: 'flex', gap: 8, padding: '8px 10px', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: T.inkLight, fontFamily: 'JetBrains Mono' }}>Drag rows to resequence</span>
                  <button onClick={() => { setLoading(true); fetch(`/api/scheduling/demo?rule=${rule}&plant=${plant}`).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(d => { setData(d); setLoading(false); }).catch(() => { setData(STATIC_SCHEDULE); setLoading(false); }); }}
                    style={{ background: T.white, color: T.ink, border: `1px solid ${T.border}`, borderRadius: 4, padding: '3px 10px', fontSize: 10, cursor: 'pointer', fontFamily: 'JetBrains Mono', fontWeight: 500 }}>
                    Reset to {RULE_NAMES[rule] || rule}
                  </button>
                  {resequencing && (<span style={{ fontSize: 10, color: T.accent, fontFamily: 'JetBrains Mono' }}>Saving...</span>)}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'JetBrains Mono' }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                      {['#', 'Order', 'SKU', 'Quantity', 'Processing Time', 'Rate', 'Start', 'End', 'Due Date', 'Work Center', 'Status', 'Actions'].map(h => (
                        <th key={h} scope="col" style={{ textAlign: h === '#' || h === 'Order' || h === 'SKU' || h === 'Status' || h === 'Work Center' || h === 'Actions' ? 'left' : 'right', padding: '8px 10px', color: T.inkLight, fontWeight: 500, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.schedule.map((o, idx) => {
                      const rate = o.processingTime > 0 ? Math.round(o.qty / o.processingTime * 10) / 10 : 0;
                      return (
                        <tr key={o.id} draggable="true"
                          onDragStart={() => setDraggedIdx(idx)}
                          onDragEnd={() => { setDraggedIdx(null); setDragOverIdx(null); }}
                          onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx); }}
                          onDrop={async (e) => {
                            e.preventDefault();
                            if (draggedIdx === null || draggedIdx === idx) return;
                            const newSchedule = [...data.schedule];
                            const [moved] = newSchedule.splice(draggedIdx, 1);
                            newSchedule.splice(idx, 0, moved);
                            let cumTime = 0;
                            const resequenced = newSchedule.map(item => { const start = cumTime; const end = cumTime + item.processingTime; cumTime = end; return { ...item, startTime: start, endTime: end }; });
                            setData(prev => ({ ...prev, schedule: resequenced, makespan: cumTime }));
                            setDraggedIdx(null); setDragOverIdx(null);
                            setResequencing(true);
                            try {
                              const res = await fetch('/api/scheduling/resequence', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plant, orderIds: resequenced.map(r => r.id), orders: resequenced }) });
                              if (res.ok) { const updated = await res.json(); setData(prev => ({ ...prev, schedule: updated.schedule, makespan: updated.makespan, lateOrders: updated.lateOrders, totalOrders: updated.totalOrders })); }
                            } catch { /* keep local */ }
                            setResequencing(false);
                          }}
                          style={{ borderBottom: `1px solid ${T.border}`, background: o.late ? T.riskBg : draggedIdx === idx ? `${T.accent}10` : 'transparent', cursor: 'grab', position: 'relative', borderTop: dragOverIdx === idx && draggedIdx !== null && draggedIdx !== idx ? `2px solid ${T.blue}` : 'none', opacity: draggedIdx === idx ? 0.5 : 1, transition: 'opacity 0.1s' }}>
                          <td style={{ padding: '6px 10px', color: T.inkGhost, fontSize: 10 }}>{idx + 1}</td>
                          <td style={{ padding: '6px 10px', fontWeight: 500 }}>{o.id}</td>
                          <td style={{ padding: '6px 10px' }}>
                            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: SKU_COLORS[o.skuCode] || T.inkGhost, marginRight: 6 }} />
                            {o.skuCode}
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'right' }}>{o.qty}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right' }}>{o.processingTime}h</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: T.inkLight }}>{rate} units/h</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right' }}>{Math.round(o.startTime * 10) / 10}h</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right' }}>{Math.round(o.endTime * 10) / 10}h</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: T.inkMid }}>{o.dueDate}</td>
                          <td style={{ padding: '6px 10px', fontSize: 10, color: T.inkMid }}>{o.workCenterName || o.workCenter || '\u2014'}</td>
                          <td style={{ padding: '6px 10px' }}>
                            {o.late ? (<span style={{ color: T.risk, fontWeight: 600 }}>LATE (+{o.lateDays}d)</span>) : (<span style={{ color: T.safe }}>On Time</span>)}
                          </td>
                          <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                            {o.late ? (
                              resolvedOrders[o.id] ? (
                                <span style={{
                                  display: 'inline-block', padding: '3px 10px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                                  background: resolvedOrders[o.id].status === 'accepted' ? '#fef3e0' : '#fce4ec',
                                  color: resolvedOrders[o.id].status === 'accepted' ? '#9a6700' : '#c62828',
                                }}>
                                  {resolvedOrders[o.id].action === 'accept' ? '⏳ Delay Accepted' : '🔺 Escalated'}
                                </span>
                              ) : (
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button onClick={() => handleOrderAction(o, 'accept')} disabled={orderActionLoading === o.id}
                                    style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 500, cursor: 'pointer', background: '#fef3e0', color: '#9a6700', border: '1px solid #f0c87a', opacity: orderActionLoading === o.id ? 0.5 : 1 }}>
                                    {orderActionLoading === o.id ? '...' : 'Accept Delay'}
                                  </button>
                                  <button onClick={() => handleOrderAction(o, 'escalate')} disabled={orderActionLoading === o.id}
                                    style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 500, cursor: 'pointer', background: '#fce4ec', color: '#c62828', border: '1px solid #ef9a9a', opacity: orderActionLoading === o.id ? 0.5 : 1 }}>
                                    {orderActionLoading === o.id ? '...' : 'Escalate'}
                                  </button>
                                </div>
                              )
                            ) : (
                              <span style={{ color: T.inkGhost, fontSize: 10 }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>No orders</div>
            )}
          </Card>
        )}

        {/* Optimization (Rule Comparison) Tab */}
        {tab === 'compare' && (
          <Card title="Sequencing Optimization">
            {data?.comparison ? (
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {Object.entries(data.comparison).map(([ruleName, stats]) => (
                    <div key={ruleName} style={{ background: ruleName === rule ? T.ink : T.bgDark, border: `1px solid ${ruleName === rule ? T.ink : T.border}`, borderRadius: 10, padding: '20px' }}>
                      <div style={{ fontFamily: 'Sora', fontSize: 14, fontWeight: 600, color: ruleName === rule ? T.white : T.ink, marginBottom: 4 }}>{RULE_NAMES[ruleName] || ruleName}</div>
                      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 400, marginBottom: 12, color: ruleName === rule ? 'rgba(255,255,255,0.6)' : T.inkLight }}>
                        {ruleName === 'SPT' && 'Minimizes average flow time by scheduling shortest jobs first'}
                        {ruleName === 'EDD' && 'Minimizes maximum tardiness by scheduling earliest due dates first'}
                        {ruleName === 'CR' && 'Prioritizes orders with lowest ratio of remaining time to processing time'}
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
                      <div style={{ marginTop: 12, fontSize: 10, color: ruleName === rule ? 'rgba(255,255,255,0.6)' : T.inkLight }}>Sequence: {stats.sequence.join(' \u2192 ')}</div>
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

function StatusPill({ label, value, color }) {
  return (
    <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 16px', fontSize: 12 }}>
      <span style={{ color: T.inkLight }}>{label}:</span>{' '}
      <strong style={{ color: color || T.ink }}>{value}</strong>
    </div>
  );
}

function GanttChart({ schedule, makespan, workCenters }) {
  if (!schedule || schedule.length === 0) return null;

  const wcMap = {};
  schedule.forEach(o => {
    const wc = o.workCenter || 'UNASSIGNED';
    if (!wcMap[wc]) wcMap[wc] = { code: wc, name: o.workCenterName || wc, orders: [] };
    wcMap[wc].orders.push(o);
  });

  if (workCenters) {
    workCenters.forEach(wc => {
      if (!wcMap[wc.code]) { wcMap[wc.code] = { code: wc.code, name: wc.name, orders: [] }; }
      else { wcMap[wc.code].name = wc.name; }
    });
  }

  const activeWCs = Object.values(wcMap).filter(wc => wc.orders.length > 0).sort((a, b) => a.code.localeCompare(b.code));
  if (activeWCs.length === 0) return null;

  const W = 800, rowH = 48, headerH = 30;
  const M = { left: 160, right: 20 };
  const H = headerH + activeWCs.length * rowH + 10;
  const chartW = W - M.left - M.right;
  const timeScale = (t) => M.left + (t / makespan) * chartW;

  const gridInterval = Math.max(1, Math.ceil(makespan / 15));
  const gridLines = [];
  for (let t = 0; t <= makespan; t += gridInterval) gridLines.push(t);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Schedule showing ${schedule.length} process orders across ${activeWCs.length} work centers over ${Math.round(makespan)}h`} style={{ width: '100%', maxWidth: W, height: 'auto' }}>
        {gridLines.map(t => (
          <g key={t}>
            <line x1={timeScale(t)} y1={headerH} x2={timeScale(t)} y2={H} stroke={T.border} strokeWidth={0.5} />
            <text x={timeScale(t)} y={headerH - 6} textAnchor="middle" fontSize={8} fill={T.inkLight} fontFamily="JetBrains Mono">{t}h</text>
          </g>
        ))}
        {activeWCs.map((wc, wcIdx) => {
          const rowY = headerH + wcIdx * rowH;
          const sortedOrders = [...wc.orders].sort((a, b) => a.startTime - b.startTime);
          return (
            <g key={wc.code}>
              {wcIdx % 2 === 1 && (<rect x={0} y={rowY} width={W} height={rowH} fill={T.bgDark} opacity={0.3} />)}
              <text x={M.left - 8} y={rowY + rowH / 2 - 4} textAnchor="end" fontSize={9} fill={T.ink} fontFamily="JetBrains Mono" fontWeight={500}>
                {wc.name.length > 18 ? wc.name.slice(0, 18) + '\u2026' : wc.name}
              </text>
              <text x={M.left - 8} y={rowY + rowH / 2 + 8} textAnchor="end" fontSize={7} fill={T.inkLight} fontFamily="JetBrains Mono">{wc.code}</text>
              {sortedOrders.map((o, orderIdx) => {
                const barH = rowH - 16;
                const y = rowY + 8;
                const x1 = timeScale(o.startTime);
                const barW = Math.max(timeScale(o.endTime) - x1, 2);
                const color = SKU_COLORS[o.skuCode] || T.inkGhost;
                const prevOrder = orderIdx > 0 ? sortedOrders[orderIdx - 1] : null;
                const hasChangeover = prevOrder && prevOrder.skuCode !== o.skuCode;
                const tooltipText = [`Order: ${o.id}`, `Product: ${o.skuName || o.skuCode}`, `Quantity: ${o.qty}`, `Processing Time: ${o.processingTime}h`, `Due: ${o.dueDate}`, `Work Center: ${wc.name}`, o.late ? `Late by ${o.lateDays} days` : 'On Time'].join('\n');
                return (
                  <g key={o.id}>
                    {hasChangeover && (<g><polygon points={`${x1 - 4},${y + barH} ${x1},${y + barH - 6} ${x1 + 4},${y + barH}`} fill={T.risk} opacity={0.8} /><title>1h changeover ({prevOrder.skuCode} to {o.skuCode})</title></g>)}
                    <rect x={x1} y={y} width={barW} height={barH} fill={color} opacity={o.late ? 0.5 : 0.85} rx={3} stroke={o.late ? T.risk : 'none'} strokeWidth={o.late ? 1.5 : 0}><title>{tooltipText}</title></rect>
                    {barW > 50 && (<text x={x1 + barW / 2} y={y + barH / 2 + 3} textAnchor="middle" fontSize={8} fill="#fff" fontFamily="JetBrains Mono" fontWeight={500}><title>{tooltipText}</title>{o.skuCode} {o.qty}</text>)}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', gap: 16, padding: '8px 0', fontSize: 10, color: T.inkMid, flexWrap: 'wrap' }}>
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
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
          <span style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: `8px solid ${T.risk}`, display: 'inline-block' }} />
          Changeover
        </span>
      </div>
    </div>
  );
}
