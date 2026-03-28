import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { T } from '../styles/tokens';

const SKUS = ['Oat & Honey Granola Bar', 'Peanut Butter Protein Bar', 'Classic Trail Mix', 'Lemon Sparkling Water'];
const DCNAMES = ['Atlanta', 'Chicago', 'Las Vegas'];

const SC = {
  'Oat & Honey Granola Bar':    { Atlanta: 92, Chicago: 18, 'Las Vegas': 14 },
  'Peanut Butter Protein Bar':  { Atlanta: 86, Chicago: 24, 'Las Vegas': 12 },
  'Classic Trail Mix':           { Atlanta: 54, Chicago: 16, 'Las Vegas': 38 },
  'Lemon Sparkling Water':      { Atlanta: 10, Chicago: 8,  'Las Vegas': 76 },
};

const ACTIONS = [
  {
    id: 'STO-001', urgent: true, hours: 36,
    from: 'Chicago DC', to: 'Atlanta DC',
    skus: 'Oat & Honey Granola Bar (1,200 cases) + Protein Bar (350 cases)',
    mode: 'FTL Consolidated', load: '91%', cost: '$2,640', avoided: '$118,400', score: 94,
    customers: 'Kroger (40%) · Whole Foods (28%) · Target (18%)',
    reason: 'Atlanta at 3.1 days supply. Kroger and Whole Foods fill rate at direct risk. Expedite before Friday cutoff.',
  },
  {
    id: 'STO-002', urgent: false, hours: 72,
    from: 'Chicago DC', to: 'Las Vegas DC',
    skus: 'Lemon Sparkling Water (800 cases)',
    mode: 'FTL', load: '74%', cost: '$1,860', avoided: '$34,500', score: 74,
    customers: 'Costco (30%) · Whole Foods (24%)',
    reason: 'Las Vegas running 32% above plan for 3 consecutive weeks. Summer beverage season demand accelerating.',
  },
];

const LONG_TERM = [
  {
    id: 'LT-001', type: 'Safety Stock Update', horizon: 'This week',
    title: 'Increase safety stock — Granola Bar, Atlanta DC',
    detail: 'Safety stock of 120 cases was sized at Q1 velocity of 380 cases/week. Atlanta is running 540 cases/week. Correct safety stock is approximately 210 cases.',
    owner: 'Supply Planning', effort: 'Low',
  },
  {
    id: 'LT-002', type: 'Forecast Parameter', horizon: 'This week',
    title: 'Review summer seasonal index — Beverage SKUs, all DCs',
    detail: 'Seasonal index for beverages is 1.12, last updated Q4 2025. Actual spring velocity implies a 1.48 index. Model update needed — affects Sparkling Water, Apple Juice, and Kombucha.',
    owner: 'Demand Planning', effort: 'Medium',
  },
  {
    id: 'LT-003', type: 'Inventory Repositioning', horizon: '14 days',
    title: 'Reposition Classic Trail Mix excess — Chicago DC',
    detail: 'Chicago DC has 2,840 cases at 42 days supply. Best-before window is 180 days remaining. Write-off risk in ~4 months. Transfer 1,200 cases to Atlanta DC and 800 to Las Vegas DC.',
    owner: 'Distribution Planning', effort: 'Medium',
  },
  {
    id: 'LT-004', type: 'Master Data', horizon: '30 days',
    title: 'Correct lead time master data — Granola Bar, all lanes from PLT-PDX',
    detail: 'Lead time in planning system is 14 days. Actual carrier performance is consistently 9 days on Portland to Atlanta and Chicago lanes.',
    owner: 'Supply Planning + Logistics', effort: 'Low',
  },
];

function scoreStyle(s) {
  if (s >= 75) return { bg: T.riskBg, text: T.risk, border: T.riskBorder };
  if (s >= 40) return { bg: T.warnBg, text: T.warn, border: T.warnBorder };
  return { bg: T.white, text: T.inkGhost, border: T.border };
}

export default function Workflow() {
  const navigate = useNavigate();
  const [sel, setSel] = useState(null);
  const [dismissed, setDismissed] = useState(new Set());

  return (
    <div style={{ background: T.bg, minHeight: 'calc(100vh - 54px)', fontFamily: 'Inter' }}>
      {/* Header */}
      <div className="workflow-header" style={{ background: T.white, borderBottom: `1px solid ${T.border}`, padding: '16px 52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, color: T.inkLight, letterSpacing: 1.5, marginBottom: 3, textTransform: 'uppercase' }}>Supply Execution Workflow</div>
          <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 19, color: T.ink, letterSpacing: -0.4 }}>Network Risk Overview</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: T.inkLight }}>March 28, 2026</div>
          <div style={{ width: 1, height: 14, background: T.border }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.risk, animation: 'blink 2.5s infinite' }} />
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: T.risk }}>2 actions required today</span>
          </div>
          <button onClick={() => navigate('/agent')} style={{ background: T.ink, color: T.white, border: 'none', padding: '7px 18px', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontFamily: 'Sora', fontWeight: 500 }}>Ask the agent</button>
        </div>
      </div>

      <div className="workflow-body" style={{ maxWidth: 1160, margin: '0 auto', padding: '28px 52px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Heatmap */}
        <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 10 }}>
          <div style={{ padding: '16px 22px', borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, color: T.inkLight, letterSpacing: 1.3, marginBottom: 3, textTransform: 'uppercase' }}>Risk Matrix</div>
            <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 15, color: T.ink, letterSpacing: -0.2 }}>Rebalance Score — SKU × DC</div>
          </div>
          <div style={{ padding: '18px 22px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
              <thead>
                <tr>
                  <td style={{ width: 140, paddingBottom: 10 }} />
                  {DCNAMES.map(dc => <td key={dc} style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkLight, textAlign: 'center', paddingBottom: 10 }}>{dc}</td>)}
                </tr>
              </thead>
              <tbody>
                {SKUS.map(sku => (
                  <tr key={sku} className="rh">
                    <td style={{ fontFamily: 'Inter', fontSize: 12, fontWeight: 500, color: T.inkMid, paddingRight: 14, paddingTop: 3, paddingBottom: 3 }}>{sku}</td>
                    {DCNAMES.map(dc => {
                      const s = SC[sku][dc];
                      const c = scoreStyle(s);
                      const isSel = sel === `${sku}|${dc}`;
                      return (
                        <td key={dc} style={{ padding: '3px 3px', textAlign: 'center' }} onClick={() => setSel(isSel ? null : `${sku}|${dc}`)}>
                          <div style={{ background: isSel ? c.text : c.bg, color: isSel ? T.white : c.text, fontFamily: 'JetBrains Mono', fontSize: 13, fontWeight: 600, borderRadius: 5, padding: '8px 2px', cursor: 'pointer', border: `1px solid ${isSel ? c.text : c.border}`, transition: 'all 0.12s', minWidth: 46 }}>{s}</div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', gap: 22, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border}`, alignItems: 'center' }}>
              {[[T.risk, '≥ 75  Act now'], [T.warn, '40–74  Review'], [T.inkGhost, '< 40  Stable']].map(([c, l]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 7, height: 7, borderRadius: 2, background: c }} />
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkLight }}>{l}</span>
                </div>
              ))}
              {sel && (
                <div style={{ marginLeft: 'auto', fontSize: 12, color: T.inkLight }}>
                  <span style={{ color: T.ink, fontWeight: 500 }}>{sel.split('|')[0]}</span> · <span style={{ color: T.ink, fontWeight: 500 }}>{sel.split('|')[1]} DC</span> — <span style={{ color: T.accent, cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate('/agent')}>ask the agent</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* STOs */}
        <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 10 }}>
          <div style={{ padding: '16px 22px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, color: T.inkLight, letterSpacing: 1.3, marginBottom: 3, textTransform: 'uppercase' }}>Immediate Actions — Stock Transfer Orders</div>
              <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 15, color: T.ink, letterSpacing: -0.2 }}>Approve before window closes</div>
            </div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: T.inkLight }}>{ACTIONS.filter(a => !dismissed.has(a.id)).length} pending</div>
          </div>
          <div style={{ padding: '14px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ACTIONS.filter(a => !dismissed.has(a.id)).map(a => (
              <div key={a.id} style={{ border: `1px solid ${a.urgent ? T.riskBorder : T.warnBorder}`, borderLeft: `3px solid ${a.urgent ? T.risk : T.warn}`, borderRadius: 8, padding: '14px 18px', background: a.urgent ? T.riskBg : T.warnBg }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkLight }}>{a.id}</span>
                      <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: a.urgent ? T.risk : T.warn, fontWeight: 600 }}>{a.urgent ? `⚑ ${a.hours}hr window` : `${a.hours}hr window`}</span>
                    </div>
                    <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 14, color: T.ink, letterSpacing: -0.2, marginBottom: 2 }}>{a.from} → {a.to}</div>
                    <div style={{ fontSize: 12, color: T.inkLight, marginBottom: 3 }}>{a.skus} · {a.mode} · {a.load} load</div>
                    <div style={{ fontSize: 11, color: T.inkLight, fontFamily: 'JetBrains Mono' }}>Customers: {a.customers}</div>
                  </div>
                  <div style={{ textAlign: 'right', marginLeft: 20, flexShrink: 0 }}>
                    <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: 28, color: a.urgent ? T.risk : T.warn, letterSpacing: -1, lineHeight: 1 }}>{a.score}</div>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 8, color: T.inkLight, letterSpacing: 1, marginTop: 2 }}>REBALANCE SCORE</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 10 }}>
                  {[['Transfer cost', a.cost], ['Risk avoided', a.avoided], ['Window', `${a.hours} hours`]].map(([l, v]) => (
                    <div key={l} style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 6, padding: '8px 10px', border: `1px solid ${T.border}` }}>
                      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkLight, letterSpacing: 0.8, marginBottom: 3, textTransform: 'uppercase' }}>{l}</div>
                      <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 14, color: T.ink }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: T.inkLight, lineHeight: 1.55, marginBottom: 10 }}>{a.reason}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    ['Approve transfer', T.ink,      T.white, T.ink,      2],
                    ['Defer 24 hours',   T.inkMid,   T.white, T.borderMid, 1],
                    ['Dismiss',          T.inkLight, T.bg,    T.border,    1],
                  ].map(([label, col, bg, bdr, flex]) => (
                    <button key={label}
                      onClick={() => label === 'Dismiss' && setDismissed(d => new Set([...d, a.id]))}
                      style={{ flex, padding: '8px 0', borderRadius: 7, border: `1px solid ${bdr}`, background: bg, color: col, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'Sora' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Long-term actions */}
        <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 10 }}>
          <div style={{ padding: '16px 22px', borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, color: T.inkLight, letterSpacing: 1.3, marginBottom: 3, textTransform: 'uppercase' }}>Longer-Term Actions</div>
            <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 15, color: T.ink, letterSpacing: -0.2 }}>Parameter updates · Master data · Repositioning</div>
          </div>
          <div>
            {LONG_TERM.map((a, i) => (
              <div key={a.id} style={{ padding: '14px 22px', borderBottom: i < LONG_TERM.length - 1 ? `1px solid ${T.border}` : 'none', display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, color: T.inkLight }}>{a.id}</span>
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: 9, background: T.bgDark, color: T.inkLight, padding: '2px 6px', borderRadius: 4 }}>{a.type}</span>
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkLight }}>· {a.horizon}</span>
                  </div>
                  <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 13.5, color: T.ink, letterSpacing: -0.2, marginBottom: 5 }}>{a.title}</div>
                  <div style={{ fontSize: 12, color: T.inkLight, lineHeight: 1.65, marginBottom: 7, maxWidth: 620 }}>{a.detail}</div>
                  <div style={{ display: 'flex', gap: 14, fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkLight }}>
                    <span>Owner: <span style={{ color: T.inkMid }}>{a.owner}</span></span>
                    <span>Effort: <span style={{ color: T.inkMid }}>{a.effort}</span></span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 7 }}>
                  <button style={{ padding: '6px 13px', borderRadius: 6, border: `1px solid ${T.border}`, background: T.bg, color: T.inkMid, fontSize: 12, cursor: 'pointer', fontFamily: 'Inter' }}>Assign</button>
                  <button style={{ padding: '6px 13px', borderRadius: 6, border: `1px solid ${T.border}`, background: T.bg, color: T.inkMid, fontSize: 12, cursor: 'pointer', fontFamily: 'Inter' }}>Dismiss</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
