import { useState, useEffect } from 'react';
import { T } from '../styles/tokens';

const MODULES = ['all', 'demand', 'drp', 'production', 'scheduling', 'mrp'];

const SAMPLE_DECISIONS = [
  { id: 'DEC-001', date: '2026-04-07', module: 'mrp', action: 'Expedite PO', entity: 'MTR-200 · PLANT-SOUTH', rationale: 'Material shortage in Week 3 — ROT-B lead time exceeds schedule. Expedited from supplier SUP-STEEL.', impact: '+$2,400 freight', status: 'accepted', decidedBy: 'Planner' },
  { id: 'DEC-002', date: '2026-04-07', module: 'drp', action: 'Rebalance inventory', entity: 'MTR-100 · DC-EAST → DC-WEST', rationale: 'DC-WEST projected stockout in Week 4. DC-EAST has 180 excess units above safety stock.', impact: '-$8,500 stockout risk', status: 'accepted', decidedBy: 'AI recommended' },
  { id: 'DEC-003', date: '2026-04-07', module: 'production', action: 'Switch to chase', entity: 'PLANT-NORTH · Small Motors', rationale: 'Level strategy shows 23% overstock in Weeks 5-8. Chase reduces inventory carrying cost by $4,200.', impact: '-$4,200 carrying cost', status: 'accepted', decidedBy: 'AI recommended' },
  { id: 'DEC-004', date: '2026-04-07', module: 'scheduling', action: 'Resequence EDD→SPT', entity: 'PLANT-WEST · WC-ASSEMBLY', rationale: 'SPT reduces makespan by 12h with zero additional late orders. Same due-date compliance.', impact: '-12h makespan', status: 'deferred', decidedBy: 'Planner' },
  { id: 'DEC-005', date: '2026-04-08', module: 'mrp', action: 'Cancel planned order', entity: 'HOUS-LG · PLANT-SOUTH', rationale: 'Demand revision removed Week 6 gross requirement. Existing inventory covers remaining periods.', impact: '-$1,800 material cost', status: 'accepted', decidedBy: 'AI recommended' },
  { id: 'DEC-006', date: '2026-04-08', module: 'demand', action: 'Override forecast', entity: 'MTR-500 · All DCs', rationale: 'Seasonal pattern detected but exponential smoothing missed it. Manual adjustment +15% for Weeks 5-8.', impact: 'Forecast accuracy +3.2%', status: 'accepted', decidedBy: 'Planner' },
  { id: 'DEC-007', date: '2026-04-08', module: 'drp', action: 'Reject transfer', entity: 'MTR-700 · DC-CENTRAL → DC-EAST', rationale: 'Transfer cost exceeds stockout risk. DC-EAST demand is declining. Monitor instead.', impact: 'Saved $1,200 freight', status: 'dismissed', decidedBy: 'Planner' },
  { id: 'DEC-008', date: '2026-04-09', module: 'mrp', action: 'Reschedule in', entity: 'WIND-MED · PLANT-NORTH', rationale: 'Planned receipt in Week 5 but needed in Week 3. Pulled forward to align with parent MTR-300 schedule.', impact: 'Prevents cascade delay', status: 'accepted', decidedBy: 'AI recommended' },
];

function statusStyle(s) {
  if (s === 'accepted')  return { color: T.safe, bg: T.safeBg, border: '#BBF7D0' };
  if (s === 'deferred')  return { color: T.warn, bg: T.warnBg, border: T.warnBorder };
  if (s === 'dismissed') return { color: T.inkLight, bg: T.bgDark, border: T.border };
  return { color: T.inkLight, bg: T.bgDark, border: T.border };
}

function moduleColor(m) {
  const colors = { demand: '#4F46E5', drp: '#059669', production: '#D97706', scheduling: '#7C3AED', mrp: '#DC2626' };
  return colors[m] || T.inkLight;
}

export default function DecisionsPage() {
  const [filter, setFilter] = useState('all');
  const [decisions, setDecisions] = useState(SAMPLE_DECISIONS);

  const filtered = filter === 'all' ? decisions : decisions.filter(d => d.module === filter);
  const accepted = decisions.filter(d => d.status === 'accepted').length;
  const deferred = decisions.filter(d => d.status === 'deferred').length;
  const dismissed = decisions.filter(d => d.status === 'dismissed').length;
  const aiRecommended = decisions.filter(d => d.decidedBy === 'AI recommended').length;
  const aiAccepted = decisions.filter(d => d.decidedBy === 'AI recommended' && d.status === 'accepted').length;

  return (
    <div style={{ background: T.bg, minHeight: 'calc(100vh - 54px)', fontFamily: 'Inter' }}>
      {/* Header */}
      <div style={{ background: T.white, borderBottom: `1px solid ${T.border}`, padding: '16px 52px' }}>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, color: T.inkLight, letterSpacing: 1.5, marginBottom: 3, textTransform: 'uppercase' }}>Decision Log</div>
        <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 19, color: T.ink, letterSpacing: -0.4 }}>Planning Decisions · Audit Trail</div>
      </div>

      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '28px 52px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Summary KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', background: T.white, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
          {[
            { label: 'Total Decisions', value: decisions.length, color: T.ink },
            { label: 'Accepted', value: accepted, color: T.safe },
            { label: 'Deferred', value: deferred, color: T.warn },
            { label: 'Dismissed', value: dismissed, color: T.inkLight },
            { label: 'AI Trust Score', value: aiRecommended > 0 ? `${Math.round(aiAccepted / aiRecommended * 100)}%` : '—', sub: `${aiAccepted}/${aiRecommended} accepted`, color: T.accent },
          ].map((m, i) => (
            <div key={i} style={{ padding: '18px 20px', borderRight: i < 4 ? `1px solid ${T.border}` : 'none' }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkLight, letterSpacing: 1.3, marginBottom: 6, textTransform: 'uppercase' }}>{m.label}</div>
              <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 22, color: m.color, letterSpacing: -0.5 }}>{m.value}</div>
              {m.sub && <div style={{ fontSize: 10, color: T.inkLight, marginTop: 2 }}>{m.sub}</div>}
            </div>
          ))}
        </div>

        {/* Module filter */}
        <div style={{ display: 'flex', gap: 4 }}>
          {MODULES.map(m => (
            <button
              key={m}
              onClick={() => setFilter(m)}
              style={{
                background: filter === m ? T.ink : T.white,
                color: filter === m ? T.white : T.ink,
                border: `1px solid ${filter === m ? T.ink : T.border}`,
                borderRadius: 6, padding: '5px 12px', cursor: 'pointer',
                fontFamily: 'JetBrains Mono', fontSize: 10, transition: 'all 0.12s',
                textTransform: 'capitalize',
              }}
            >
              {m === 'all' ? 'All Modules' : m}
            </button>
          ))}
        </div>

        {/* Decision table */}
        <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 10 }}>
          <div style={{ padding: '16px 22px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, color: T.inkLight, letterSpacing: 1.3, marginBottom: 3, textTransform: 'uppercase' }}>Decision History</div>
              <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 15, color: T.ink, letterSpacing: -0.2 }}>All decisions — newest first</div>
            </div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: T.inkLight }}>{filtered.length} records</div>
          </div>
          <div>
            {filtered.map((d, i) => {
              const s = statusStyle(d.status);
              return (
                <div key={d.id} style={{ padding: '14px 22px', borderBottom: i < filtered.length - 1 ? `1px solid ${T.border}` : 'none', display: 'grid', gridTemplateColumns: '100px 1fr 130px 100px', gap: 16, alignItems: 'start' }}>
                  <div>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkLight, marginBottom: 3 }}>{d.date}</div>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkGhost }}>{d.id}</div>
                    <div style={{ marginTop: 6 }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 6px', borderRadius: 3,
                        fontSize: 9, fontWeight: 600, fontFamily: 'JetBrains Mono',
                        color: moduleColor(d.module), background: `${moduleColor(d.module)}11`,
                        border: `1px solid ${moduleColor(d.module)}33`,
                        textTransform: 'uppercase', letterSpacing: 0.5,
                      }}>
                        {d.module}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'Sora', fontWeight: 500, fontSize: 13, color: T.ink, marginBottom: 3 }}>{d.action}</div>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: T.accent, marginBottom: 5 }}>{d.entity}</div>
                    <div style={{ fontSize: 12, color: T.inkMid, lineHeight: 1.5 }}>{d.rationale}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkLight, marginBottom: 3, textTransform: 'uppercase' }}>Impact</div>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: T.ink, fontWeight: 500 }}>{d.impact}</div>
                    <div style={{ fontSize: 10, color: T.inkLight, marginTop: 6 }}>{d.decidedBy}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      display: 'inline-block', background: s.bg, color: s.color,
                      border: `1px solid ${s.border}`, borderRadius: 5,
                      padding: '3px 10px', fontFamily: 'JetBrains Mono', fontSize: 9.5,
                      fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
                    }}>
                      {d.status}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
