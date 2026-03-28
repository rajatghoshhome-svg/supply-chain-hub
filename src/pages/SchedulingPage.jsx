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
  'MTR-100': '#4F46E5', 'MTR-150': '#6366F1', 'MTR-200': '#059669',
  'MTR-300': '#10B981', 'MTR-400': '#D97706', 'MTR-500': '#F59E0B',
  'MTR-600': '#DC2626', 'MTR-700': '#7C3AED', 'MTR-800': '#8B5CF6',
  'MTR-900': '#EC4899', 'MTR-1000': '#F43F5E',
};

const PLANTS = ['PLANT-NORTH', 'PLANT-SOUTH', 'PLANT-WEST'];

export default function SchedulingPage() {
  const [tab, setTab] = useState('gantt');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rule, setRule] = useState('EDD');
  const [plant, setPlant] = useState('PLANT-NORTH');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/scheduling/demo?rule=${rule}&plant=${plant}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [rule, plant]);

  return (
    <ModuleLayout moduleContext="scheduling" tabs={TABS} activeTab={tab} onTabChange={setTab}>
      <PageHeader title="Production Scheduling" subtitle="Detailed Schedule" />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 40px' }}>

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
              <StatusPill label="Makespan" value={`${data.makespan}h`} />
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
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'JetBrains Mono' }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                      {['Order', 'SKU', 'Qty', 'Proc Time', 'Start', 'End', 'Due Date', 'Status'].map(h => (
                        <th key={h} style={{ textAlign: h === 'Order' || h === 'SKU' || h === 'Status' ? 'left' : 'right', padding: '8px 10px', color: T.inkLight, fontWeight: 500, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.schedule.map(o => (
                      <tr key={o.id} style={{ borderBottom: `1px solid ${T.border}`, background: o.late ? T.riskBg : 'transparent' }}>
                        <td style={{ padding: '6px 10px', fontWeight: 500 }}>{o.id}</td>
                        <td style={{ padding: '6px 10px' }}>
                          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: SKU_COLORS[o.skuCode] || T.inkGhost, marginRight: 6 }} />
                          {o.skuCode}
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'right' }}>{o.qty}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right' }}>{o.processingTime}h</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right' }}>{o.startTime}h</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right' }}>{o.endTime}h</td>
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
                          <div style={{ fontFamily: 'Sora', fontSize: 22, fontWeight: 600, color: ruleName === rule ? T.white : T.accent }}>{stats.makespan}h</div>
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
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, height: 'auto' }}>
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
