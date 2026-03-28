import { useState, useEffect, useCallback } from 'react';
import { T } from '../styles/tokens';

const MODULES = ['all', 'demand', 'drp', 'production', 'scheduling', 'mrp'];

// ─── Static fallback data (used when API is unavailable, e.g. Vercel) ────
const STATIC_DECISIONS = [
  { id: 'DEC-001', date: '2026-03-24', module: 'drp', action: 'Expedite shipment', entity: 'MTR-100 @ DC-EAST', rationale: 'Safety stock violation projected in period 3. Current on-hand 45 units vs SS of 120.', decidedBy: 'AI recommended', status: 'accepted', financialImpact: { amount: 2400, type: 'cost-avoidance' } },
  { id: 'DEC-002', date: '2026-03-25', module: 'drp', action: 'Rebalance inventory', entity: 'MTR-100 · DC-EAST → DC-WEST', rationale: 'DC-WEST projected stockout in Week 4. DC-EAST has 180 excess units above safety stock.', decidedBy: 'AI recommended', status: 'accepted', financialImpact: { amount: 8500, type: 'cost-avoidance' } },
  { id: 'DEC-003', date: '2026-03-25', module: 'drp', action: 'Reject transfer', entity: 'MTR-700 · DC-CENTRAL → DC-EAST', rationale: 'Transfer cost $1,200 exceeds stockout risk of $900. DC-EAST demand is declining.', decidedBy: 'Planner', status: 'dismissed', financialImpact: { amount: 1200, type: 'savings' } },
  { id: 'DEC-004', date: '2026-03-26', module: 'drp', action: 'Increase safety stock', entity: 'HOUS-SM @ DC-WEST', rationale: 'Service level dropped to 91%. Demand variability coefficient increased 18%.', decidedBy: 'AI recommended', status: 'accepted', financialImpact: { amount: 3200, type: 'cost-avoidance' } },
  { id: 'DEC-005', date: '2026-03-26', module: 'drp', action: 'Defer replenishment', entity: 'WIND-LG @ DC-NORTH', rationale: 'Projected on-hand remains above SS through period 6. Deferring saves carrying cost.', decidedBy: 'AI recommended', status: 'deferred', financialImpact: { amount: 1800, type: 'savings' } },
  { id: 'DEC-006', date: '2026-03-27', module: 'mrp', action: 'Expedite PO', entity: 'MTR-200 · PLANT-SOUTH', rationale: 'Material shortage in Week 3 — ROT-B lead time exceeds schedule. Premium freight required.', decidedBy: 'AI recommended', status: 'accepted', financialImpact: { amount: 2400, type: 'cost' } },
  { id: 'DEC-007', date: '2026-03-27', module: 'mrp', action: 'Cancel planned order', entity: 'HOUS-LG · PLANT-SOUTH', rationale: 'Demand revision removed Week 6 gross requirement. Existing inventory covers remaining periods.', decidedBy: 'AI recommended', status: 'accepted', financialImpact: { amount: 1800, type: 'savings' } },
  { id: 'DEC-008', date: '2026-03-28', module: 'mrp', action: 'Reschedule in', entity: 'WIND-MED · PLANT-NORTH', rationale: 'Planned receipt in Week 5 but needed in Week 3. Pulled forward for assembly schedule.', decidedBy: 'AI recommended', status: 'accepted', financialImpact: { amount: 4500, type: 'cost-avoidance' } },
  { id: 'DEC-009', date: '2026-03-24', module: 'mrp', action: 'Reschedule out', entity: 'ROT-A · PLANT-SOUTH', rationale: 'Planned order in Week 2 no longer needed until Week 5. Pushing out frees capacity.', decidedBy: 'Planner', status: 'accepted', financialImpact: { amount: 960, type: 'savings' } },
  { id: 'DEC-010', date: '2026-03-25', module: 'mrp', action: 'Substitute material', entity: 'SHAFT-C → SHAFT-D · PLANT-NORTH', rationale: 'SHAFT-C supplier delay of 2 weeks. SHAFT-D is qualified alternate with 85 units on-hand.', decidedBy: 'AI recommended', status: 'deferred', financialImpact: { amount: 6200, type: 'cost-avoidance' } },
  { id: 'DEC-011', date: '2026-03-25', module: 'demand', action: 'Override forecast', entity: 'MTR-500 · All DCs', rationale: 'Seasonal pattern detected but exponential smoothing missed it. Manual adjustment +15% for Weeks 5-8.', decidedBy: 'Planner', status: 'accepted', financialImpact: { amount: 12000, type: 'cost-avoidance' } },
  { id: 'DEC-012', date: '2026-03-26', module: 'demand', action: 'Accept AI forecast', entity: 'HOUS-SM · Walmart channel', rationale: 'Weighted ensemble model outperformed 3-month moving average by 8.2% MAPE.', decidedBy: 'AI recommended', status: 'accepted', financialImpact: { amount: 15000, type: 'cost-avoidance' } },
  { id: 'DEC-013', date: '2026-03-26', module: 'demand', action: 'Adjust seasonality index', entity: 'WIND-LG · Northeast region', rationale: 'Climate data shows earlier spring onset. Shifting seasonal peak forward by 2 weeks.', decidedBy: 'AI recommended', status: 'accepted', financialImpact: { amount: 7800, type: 'cost-avoidance' } },
  { id: 'DEC-014', date: '2026-03-27', module: 'demand', action: 'Flag demand anomaly', entity: 'ROT-B · Amazon channel', rationale: 'Week 4 order spike 340% above baseline. Likely promotional event not in plan.', decidedBy: 'AI recommended', status: 'deferred', financialImpact: { amount: 22000, type: 'risk' } },
  { id: 'DEC-015', date: '2026-03-27', module: 'production', action: 'Switch to chase strategy', entity: 'PLANT-NORTH · Small Motors', rationale: 'Level strategy shows 23% overstock in Weeks 5-8. Chase reduces inventory carrying cost.', decidedBy: 'AI recommended', status: 'accepted', financialImpact: { amount: 4200, type: 'savings' } },
  { id: 'DEC-016', date: '2026-03-28', module: 'production', action: 'Add overtime shift', entity: 'PLANT-SOUTH · Line 2', rationale: 'Week 3-4 demand exceeds regular capacity by 140 units. Saturday shift covers gap.', decidedBy: 'AI recommended', status: 'accepted', financialImpact: { amount: 7700, type: 'cost-avoidance' } },
  { id: 'DEC-017', date: '2026-03-24', module: 'production', action: 'Defer capacity expansion', entity: 'PLANT-WEST · Assembly cell', rationale: 'Utilization trending down to 72%. Recommend monitoring for 2 more periods.', decidedBy: 'Planner', status: 'accepted', financialImpact: { amount: 45000, type: 'savings' } },
  { id: 'DEC-018', date: '2026-03-25', module: 'production', action: 'Rebalance product mix', entity: 'PLANT-NORTH · Lines 1-3', rationale: 'Moving HOUS-LG from Line 1 to Line 3 reduces changeover by 4.5 hours/week.', decidedBy: 'AI recommended', status: 'deferred', financialImpact: { amount: 3600, type: 'savings' } },
  { id: 'DEC-019', date: '2026-03-25', module: 'scheduling', action: 'Resequence EDD to SPT', entity: 'PLANT-WEST · WC-ASSEMBLY', rationale: 'SPT reduces makespan by 12h with zero additional late orders. Same due-date compliance.', decidedBy: 'Planner', status: 'deferred', financialImpact: { amount: 2800, type: 'savings' } },
  { id: 'DEC-020', date: '2026-03-26', module: 'scheduling', action: 'Split batch', entity: 'ORD-4471 · PLANT-NORTH', rationale: 'Order of 500 units split into 2x250. First batch ships on-time for priority customer.', decidedBy: 'AI recommended', status: 'accepted', financialImpact: { amount: 5400, type: 'cost-avoidance' } },
  { id: 'DEC-021', date: '2026-03-27', module: 'scheduling', action: 'Reassign work center', entity: 'ORD-4485 · WC-GRIND → WC-GRIND-2', rationale: 'WC-GRIND at 98% utilization. WC-GRIND-2 has 6h available. Avoids 1-day delay.', decidedBy: 'AI recommended', status: 'accepted', financialImpact: { amount: 3200, type: 'cost-avoidance' } },
  { id: 'DEC-022', date: '2026-03-28', module: 'scheduling', action: 'Accept schedule freeze', entity: 'PLANT-SOUTH · Week 14', rationale: 'Freezing 7-day horizon reduces nervousness. 94% on-time vs 81% without freeze.', decidedBy: 'AI recommended', status: 'dismissed', financialImpact: { amount: 1500, type: 'cost-avoidance' } },
];

function computeTrustScore(decs) {
  const modules = ['demand', 'drp', 'production', 'scheduling', 'mrp'];
  const perModule = {};
  for (const m of modules) {
    const aiDecs = decs.filter(d => d.module === m && d.decidedBy === 'AI recommended');
    const total = aiDecs.length;
    const accepted = aiDecs.filter(d => d.status === 'accepted').length;
    const deferred = aiDecs.filter(d => d.status === 'deferred').length;
    const dismissed = aiDecs.filter(d => d.status === 'dismissed').length;
    perModule[m] = { total, accepted, deferred, dismissed, trustPct: total > 0 ? Math.round((accepted / total) * 100) : 0 };
  }
  const allAi = decs.filter(d => d.decidedBy === 'AI recommended');
  const overall = {
    total: allAi.length,
    accepted: allAi.filter(d => d.status === 'accepted').length,
    deferred: allAi.filter(d => d.status === 'deferred').length,
    dismissed: allAi.filter(d => d.status === 'dismissed').length,
    trustPct: allAi.length > 0 ? Math.round((allAi.filter(d => d.status === 'accepted').length / allAi.length) * 100) : 0,
  };
  return { overall, perModule };
}

const MODULE_COLORS = {
  demand: '#4F46E5',
  drp: '#059669',
  production: '#D97706',
  scheduling: '#7C3AED',
  mrp: '#DC2626',
};

function statusStyle(s) {
  if (s === 'accepted')  return { color: T.safe, bg: T.safeBg, border: '#BBF7D0' };
  if (s === 'deferred')  return { color: T.warn, bg: T.warnBg, border: T.warnBorder };
  if (s === 'dismissed') return { color: T.inkLight, bg: T.bgDark, border: T.border };
  if (s === 'pending')   return { color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' };
  return { color: T.inkLight, bg: T.bgDark, border: T.border };
}

function moduleColor(m) {
  return MODULE_COLORS[m] || T.inkLight;
}

function formatImpact(fi) {
  if (!fi) return '—';
  const prefix = fi.type === 'cost' ? '+' : '-';
  const label = fi.type === 'risk' ? 'at risk' : fi.type === 'cost' ? 'cost' : fi.type === 'savings' ? 'saved' : 'avoided';
  return `${prefix}$${fi.amount.toLocaleString()} ${label}`;
}

function impactColor(fi) {
  if (!fi) return T.inkLight;
  if (fi.type === 'cost') return T.risk;
  if (fi.type === 'risk') return T.warn;
  return T.safe;
}

export default function DecisionsPage() {
  const [filter, setFilter] = useState('all');
  const [decisions, setDecisions] = useState([]);
  const [trustScore, setTrustScore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null); // id of decision being updated

  const fetchData = useCallback(async () => {
    try {
      const [decRes, tsRes] = await Promise.all([
        fetch('/api/decisions'),
        fetch('/api/decisions/trust-score'),
      ]);
      if (decRes.ok && tsRes.ok) {
        setDecisions(await decRes.json());
        setTrustScore(await tsRes.json());
      } else {
        throw new Error('API returned non-ok');
      }
    } catch (err) {
      // Fallback to static data (e.g. on Vercel where no Express server runs)
      console.warn('Decisions API unavailable, using static fallback data');
      setDecisions(STATIC_DECISIONS);
      setTrustScore(computeTrustScore(STATIC_DECISIONS));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateStatus = async (id, status) => {
    setUpdating(id);
    try {
      const res = await fetch(`/api/decisions/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        await fetchData(); // refresh all data including trust scores
      }
    } catch (err) {
      console.error('Failed to update decision:', err);
    } finally {
      setUpdating(null);
    }
  };

  const filtered = filter === 'all' ? decisions : decisions.filter(d => d.module === filter);
  const accepted = decisions.filter(d => d.status === 'accepted').length;
  const deferred = decisions.filter(d => d.status === 'deferred').length;
  const dismissed = decisions.filter(d => d.status === 'dismissed').length;
  const pending = decisions.filter(d => d.status === 'pending').length;

  const overallTrust = trustScore?.overall || { total: 0, accepted: 0, trustPct: 0 };

  // Financial summary
  const totalSavings = decisions
    .filter(d => d.status === 'accepted' && d.financialImpact && d.financialImpact.type !== 'cost')
    .reduce((sum, d) => sum + (d.financialImpact?.amount || 0), 0);

  if (loading) {
    return (
      <div style={{ background: T.bg, minHeight: 'calc(100vh - 54px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: T.inkLight }}>Loading decisions...</div>
      </div>
    );
  }

  return (
    <div style={{ background: T.bg, minHeight: 'calc(100vh - 54px)', fontFamily: 'Inter' }}>
      {/* Header */}
      <div className="decisions-header" style={{ background: T.white, borderBottom: `1px solid ${T.border}`, padding: '16px 52px' }}>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, color: T.inkLight, letterSpacing: 1.5, marginBottom: 3, textTransform: 'uppercase' }}>Decision Log</div>
        <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 19, color: T.ink, letterSpacing: -0.4 }}>Planning Decisions · Audit Trail</div>
      </div>

      <div className="decisions-body" style={{ maxWidth: 1160, margin: '0 auto', padding: '28px 52px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Summary KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', background: T.white, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
          {[
            { label: 'Total Decisions', value: decisions.length, color: T.ink },
            { label: 'Accepted', value: accepted, color: T.safe },
            { label: 'Deferred', value: deferred, color: T.warn },
            { label: 'Dismissed', value: dismissed, color: T.inkLight },
            { label: 'AI Trust Score', value: overallTrust.total > 0 ? `${overallTrust.trustPct}%` : '—', sub: `${overallTrust.accepted}/${overallTrust.total} accepted`, color: T.accent },
          ].map((m, i) => (
            <div key={i} style={{ padding: '18px 20px', borderRight: i < 4 ? `1px solid ${T.border}` : 'none' }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkLight, letterSpacing: 1.3, marginBottom: 6, textTransform: 'uppercase' }}>{m.label}</div>
              <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 22, color: m.color, letterSpacing: -0.5 }}>{m.value}</div>
              {m.sub && <div style={{ fontSize: 10, color: T.inkLight, marginTop: 2 }}>{m.sub}</div>}
            </div>
          ))}
        </div>

        {/* Trust Score per Module */}
        {trustScore?.perModule && (
          <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 10, padding: '18px 22px' }}>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, color: T.inkLight, letterSpacing: 1.3, marginBottom: 14, textTransform: 'uppercase' }}>Planner Trust Score by Module</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
              {Object.entries(trustScore.perModule).map(([mod, data]) => (
                <div key={mod} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{
                      fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 600,
                      color: moduleColor(mod), textTransform: 'uppercase', letterSpacing: 0.5,
                    }}>{mod}</span>
                    <span style={{
                      fontFamily: 'Sora', fontWeight: 600, fontSize: 14, color: T.ink,
                    }}>{data.total > 0 ? `${data.trustPct}%` : '—'}</span>
                  </div>
                  {/* Bar chart */}
                  <div style={{ height: 6, borderRadius: 3, background: T.bgDark, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3,
                      width: `${data.trustPct}%`,
                      background: data.trustPct >= 80 ? T.safe : data.trustPct >= 50 ? T.warn : T.risk,
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkLight }}>
                    {data.accepted}A / {data.deferred}D / {data.dismissed}X · {data.total} total
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Financial Impact Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkLight, letterSpacing: 1.3, marginBottom: 6, textTransform: 'uppercase' }}>Financial Impact (Accepted)</div>
            <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 22, color: T.safe, letterSpacing: -0.5 }}>${totalSavings.toLocaleString()}</div>
            <div style={{ fontSize: 10, color: T.inkLight, marginTop: 2 }}>savings + cost avoidance</div>
          </div>
          <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkLight, letterSpacing: 1.3, marginBottom: 6, textTransform: 'uppercase' }}>Pending Review</div>
            <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 22, color: '#2563EB', letterSpacing: -0.5 }}>{pending}</div>
            <div style={{ fontSize: 10, color: T.inkLight, marginTop: 2 }}>decisions awaiting planner action</div>
          </div>
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
          <div className="decisions-table-scroll">
            {filtered.map((d, i) => {
              const s = statusStyle(d.status);
              const isUpdating = updating === d.id;
              return (
                <div key={d.id} style={{ padding: '14px 22px', borderBottom: i < filtered.length - 1 ? `1px solid ${T.border}` : 'none', display: 'grid', gridTemplateColumns: '100px 1fr 120px 100px 140px', gap: 14, alignItems: 'start', opacity: isUpdating ? 0.5 : 1, transition: 'opacity 0.15s' }}>
                  {/* Date & Module */}
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

                  {/* Action & Rationale */}
                  <div>
                    <div style={{ fontFamily: 'Sora', fontWeight: 500, fontSize: 13, color: T.ink, marginBottom: 3 }}>{d.action}</div>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: T.accent, marginBottom: 5 }}>{d.entity}</div>
                    <div style={{ fontSize: 12, color: T.inkMid, lineHeight: 1.5 }}>{d.rationale}</div>
                  </div>

                  {/* Financial Impact */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkLight, marginBottom: 3, textTransform: 'uppercase' }}>Impact</div>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: impactColor(d.financialImpact), fontWeight: 500 }}>
                      {formatImpact(d.financialImpact)}
                    </div>
                    <div style={{ fontSize: 10, color: T.inkLight, marginTop: 6 }}>{d.decidedBy}</div>
                  </div>

                  {/* Status badge */}
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

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'start' }}>
                    {d.status !== 'accepted' && (
                      <ActionBtn label="Accept" color={T.safe} bg={T.safeBg} onClick={() => updateStatus(d.id, 'accepted')} disabled={isUpdating} />
                    )}
                    {d.status !== 'deferred' && (
                      <ActionBtn label="Defer" color={T.warn} bg={T.warnBg} onClick={() => updateStatus(d.id, 'deferred')} disabled={isUpdating} />
                    )}
                    {d.status !== 'dismissed' && (
                      <ActionBtn label="Dismiss" color={T.inkLight} bg={T.bgDark} onClick={() => updateStatus(d.id, 'dismissed')} disabled={isUpdating} />
                    )}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ padding: '40px 22px', textAlign: 'center', fontFamily: 'JetBrains Mono', fontSize: 12, color: T.inkLight }}>
                No decisions found for this module.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ label, color, bg, onClick, disabled }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? color : bg,
        color: hover ? '#fff' : color,
        border: `1px solid ${color}33`,
        borderRadius: 4, padding: '3px 8px', cursor: disabled ? 'wait' : 'pointer',
        fontFamily: 'JetBrains Mono', fontSize: 9, fontWeight: 600,
        letterSpacing: 0.3, textTransform: 'uppercase',
        transition: 'all 0.12s',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  );
}
