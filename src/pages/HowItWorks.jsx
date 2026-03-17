import { useState } from 'react';
import { T } from '../styles/tokens';

const PHASES = [
  {
    num: '01', label: 'Inventory Snapshot',
    body: 'Current on-hand units, allocated inventory, inbound shipments and ETAs, and holding cost per unit per day across all six DCs. Read-only ground truth.',
    data: ['On-hand units per SKU per DC', 'Allocated (committed to open orders)', 'Available = on-hand minus allocated', 'Inbound units and expected arrival', 'Holding cost per unit per day', 'Shelf life remaining'],
  },
  {
    num: '02', label: 'Three-Signal Demand Sense',
    body: 'Signal A is your existing forecast — loaded in, never rebuilt. Signal B is actual velocity this week vs. plan. Signal C is a live 7-day weather forecast per DC location.',
    data: ['Signal A: existing demand plan (read-only)', 'Signal B: actual velocity this week vs. plan', 'Signal C: Open-Meteo forecast per DC location', 'Cold weather multiplier per SKU', 'Transfer window = hours before conditions deteriorate', 'Divergence = (actual − plan) / plan × 100'],
  },
  {
    num: '03', label: 'Rebalance Score Engine',
    body: 'Every potential transfer is scored on net value: risk avoided minus execution cost. FTL vs. LTL calculated from pallet cube. Consolidation detected automatically.',
    data: ['Days of supply = available / adjusted daily velocity', 'Risk $ = days at risk × velocity × stockout penalty', 'Load factor = (units × pallet cube) / 26 pallets', 'FTL cost = lane distance × rate per mile', 'Score = (risk avoided − cost) / risk avoided × 100', 'Consolidation: bundles SKUs on same lane for FTL'],
  },
  {
    num: '04', label: 'Human Approval Queue',
    body: 'Every recommended action goes to the approval queue. Nothing executes automatically. Decisions are recorded to the Value Log with the approver and timestamp.',
    data: ['Sorted by Rebalance Score', 'Weather-urgent actions shown first', 'Customer exposure shown per card', 'Three decisions: Approve / Defer / Dismiss', 'All decisions written to Value Log'],
  },
  {
    num: '05', label: 'Supply Execution Agent',
    body: 'Claude Sonnet with full network context — inventory, demand history, weather, planning parameters, customer mix — injected on every message. All insights derived at query time.',
    data: ['Dynamic context rebuilt every message', '8-week demand history per SKU per DC', 'Planning parameters: safety stock, seasonal index, lead times', 'Customer mix per DC with at-risk flags', 'No pre-written conclusions'],
  },
  {
    num: '06', label: 'Value Log',
    body: 'Every decision is recorded with the approver, timestamp, financial impact, and retailer consequence. The accumulating record of value created by the system.',
    data: ['Cumulative risk avoided by retailer', 'Net value created (avoided minus cost)', 'Full decision history newest-first', 'Approver attribution per action', 'Retailer fill rate impact per transfer'],
  },
];

export default function HowItWorks() {
  const [active, setActive] = useState(0);
  const p = PHASES[active];

  return (
    <div style={{ background: T.bg, minHeight: 'calc(100vh - 54px)', padding: '44px 52px', fontFamily: 'Inter' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkLight, letterSpacing: 1.5, marginBottom: 11, textTransform: 'uppercase' }}>System Architecture</div>
          <h1 style={{ fontFamily: 'Sora', fontWeight: 500, fontSize: 30, color: T.ink, letterSpacing: -0.7 }}>How the Supply Execution Agent works</h1>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '192px 1fr', gap: 24 }}>
          {/* Phase list */}
          <div>
            {PHASES.map((ph, i) => (
              <div key={i} onClick={() => setActive(i)}
                style={{ display: 'flex', gap: 9, alignItems: 'center', padding: '9px 11px', borderRadius: 7, marginBottom: 2, cursor: 'pointer', background: active === i ? T.white : 'transparent', border: `1px solid ${active === i ? T.border : 'transparent'}`, transition: 'all 0.12s' }}>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, color: active === i ? T.inkMid : T.inkGhost, minWidth: 16 }}>{ph.num}</span>
                <span style={{ fontSize: 12, color: active === i ? T.ink : T.inkLight, fontWeight: active === i ? 500 : 400, lineHeight: 1.3 }}>{ph.label}</span>
              </div>
            ))}
          </div>

          {/* Detail panel */}
          <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 10, padding: '24px 28px' }}>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, color: T.inkLight, letterSpacing: 1.3, marginBottom: 11, textTransform: 'uppercase' }}>Phase {p.num} — {p.label}</div>
            <p style={{ fontSize: 14, color: T.inkMid, lineHeight: 1.85, marginBottom: 20 }}>{p.body}</p>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkLight, letterSpacing: 1.2, marginBottom: 9, textTransform: 'uppercase' }}>Data included</div>
            {p.data.map((d, i) => (
              <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginBottom: 6 }}>
                <div style={{ width: 3, height: 3, borderRadius: '50%', background: T.inkGhost, flexShrink: 0, marginTop: 7 }} />
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11.5, color: T.inkMid, lineHeight: 1.6 }}>{d}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
