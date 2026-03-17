import { useState } from 'react';
import { T } from '../styles/tokens';

const SKUS = ['Dentastix Large', 'Greenies Medium', 'Dentastix Small', 'Cesar Softies'];
const DCNAMES = ['Memphis', 'Atlanta', 'Charlotte', 'Chicago', 'LA', 'Dallas'];

const SC = {
  'Dentastix Large': { Memphis: 8,  Atlanta: 94, Charlotte: 74, Chicago: 22, LA: 15, Dallas: 12 },
  'Greenies Medium': { Memphis: 9,  Atlanta: 88, Charlotte: 71, Chicago: 28, LA: 14, Dallas: 10 },
  'Dentastix Small': { Memphis: 7,  Atlanta: 58, Charlotte: 44, Chicago: 18, LA: 12, Dallas: 9  },
  'Cesar Softies':   { Memphis: 6,  Atlanta: 12, Charlotte: 10, Chicago: 8,  LA: 42, Dallas: 8  },
};

const ACTIONS = [
  {
    id: 'STO-001', urgent: true, hours: 36,
    from: 'Memphis DC', to: 'Atlanta DC',
    skus: 'Dentastix Large (1,400u) + Greenies Medium (380u)',
    mode: 'FTL Consolidated', load: '91%', cost: '$2,840', avoided: '$139,600', score: 94,
    customers: 'Walmart (45%) · PetSmart (30%) · Chewy (15%)',
    reason: 'Atlanta at 2.7 days supply. Storm closes window Wednesday 8pm. Walmart and PetSmart fill rate at direct risk.',
  },
  {
    id: 'STO-002', urgent: false, hours: 72,
    from: 'Memphis DC', to: 'Charlotte DC',
    skus: 'Dentastix Large (900 units)',
    mode: 'FTL', load: '74%', cost: '$1,980', avoided: '$38,200', score: 74,
    customers: 'Walmart (38%) · PetSmart (32%)',
    reason: 'Charlotte running 38% above plan for 4 consecutive weeks. Review before Nov 8.',
  },
];

const LONG_TERM = [
  {
    id: 'LT-001', type: 'Safety Stock Update', horizon: 'This week',
    title: 'Increase safety stock — Dentastix Large, Southeast DCs',
    detail: 'Safety stock of 800 units was sized at Q2 velocity of 1,200/week. Atlanta is running 1,860/week. Correct safety stock is approximately 1,430 units.',
    owner: 'Supply Planning', effort: 'Low',
  },
  {
    id: 'LT-002', type: 'Forecast Parameter', horizon: 'This week',
    title: 'Review Q4 Southeast seasonal index — Pedigree and Greenies SKUs',
    detail: 'Seasonal index for Southeast DCs is 1.08, last updated Q2 2024. Actual Q4 velocity implies a 1.55 index. Regional model issue — affects Atlanta, Charlotte, and Chicago.',
    owner: 'Demand Planning', effort: 'Medium',
  },
  {
    id: 'LT-003', type: 'Inventory Repositioning', horizon: '14 days',
    title: 'Reposition Cesar Softies excess — Los Angeles DC',
    detail: 'LA DC has 8,120 units at 79.8 days supply. Shelf life 330 days remaining. Write-off risk in ~5 months. Transfer 4,000 to Chicago DC and 2,000 to Dallas DC.',
    owner: 'Distribution Planning', effort: 'Medium',
  },
  {
    id: 'LT-004', type: 'Master Data', horizon: '30 days',
    title: 'Correct lead time master data — Dentastix Large, all lanes',
    detail: 'Lead time in planning system is 18 days. Actual carrier performance is consistently 12 days on Memphis to Southeast lanes.',
    owner: 'Supply Planning + Logistics', effort: 'Low',
  },
];

function scoreStyle(s) {
  if (s >= 75) return { bg: T.riskBg, text: T.risk, border: T.riskBorder };
  if (s >= 40) return { bg: T.warnBg, text: T.warn, border: T.warnBorder };
  return { bg: T.white, text: T.inkGhost, border: T.border };
}

export default function Workflow({ setPage }) {
  const [sel, setSel] = useState(null);
  const [dismissed, setDismissed] = useState(new Set());

  return (
    <div style={{ background: T.bg, minHeight: 'calc(100vh - 54px)', fontFamily: 'Inter' }}>
      {/* Header */}
      <div style={{ background: T.white, borderBottom: `1px solid ${T.border}`, padding: '16px 52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, color: T.inkLight, letterSpacing: 1.5, marginBottom: 3, textTransform: 'uppercase' }}>Supply Execution Workflow</div>
          <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 19, color: T.ink, letterSpacing: -0.4 }}>Network Risk Overview</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: T.inkLight }}>November 4, 2024</div>
          <div style={{ width: 1, height: 14, background: T.border }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.risk, animation: 'blink 2.5s infinite' }} />
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: T.risk }}>2 actions required today</span>
          </div>
          <button onClick={() => setPage('agent')} style={{ background: T.ink, color: T.white, border: 'none', padding: '7px 18px', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontFamily: 'Sora', fontWeight: 500 }}>Ask the agent</button>
        </div>
      </div>

      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '28px 52px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Heatmap */}
        <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 10 }}>
          <div style={{ padding: '16px 22px', borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, color: T.inkLight, letterSpacing: 1.3, marginBottom: 3, textTransform: 'uppercase' }}>Risk Matrix</div>
            <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 15, color: T.ink, letterSpacing: -0.2 }}>Rebalance Score — SKU × DC</div>
          </div>
          <div style={{ padding: '18px 22px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                  <span style={{ color: T.ink, fontWeight: 500 }}>{sel.split('|')[0]}</span> · <span style={{ color: T.ink, fontWeight: 500 }}>{sel.split('|')[1]} DC</span> — <span style={{ color: T.accent, cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setPage('agent')}>ask the agent</span>
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
