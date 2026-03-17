import { T } from '../styles/tokens';
import { CC } from '../data/dcs';
import { LOG } from '../data/log';

function statusStyle(s) {
  if (s === 'approved') return { color: T.safe,     bg: T.safeBg, border: '#BBF7D0' };
  if (s === 'deferred') return { color: T.warn,     bg: T.warnBg, border: T.warnBorder };
  return                       { color: T.inkLight, bg: T.bgDark, border: T.border };
}

export default function ValueLog() {
  const approved = LOG.filter(r => r.status === 'approved');
  const totalAvoided = approved.reduce((s, r) => s + r.avoided, 0);
  const totalCost    = approved.reduce((s, r) => s + r.cost,    0);
  const netValue     = totalAvoided - totalCost;
  const statusCounts = LOG.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});

  // Retailer fill-rate protection (split evenly across retailers per transfer)
  const RP = { Walmart: 0, Chewy: 0, PetSmart: 0, Amazon: 0 };
  approved.forEach(r => {
    const parts = r.customers.split(' · ');
    const share = r.avoided / parts.length;
    parts.forEach(p => { const n = p.split(' ')[0]; if (RP[n] !== undefined) RP[n] += share; });
  });

  return (
    <div style={{ background: T.bg, minHeight: 'calc(100vh - 54px)', fontFamily: 'Inter' }}>
      {/* Header */}
      <div style={{ background: T.white, borderBottom: `1px solid ${T.border}`, padding: '16px 52px' }}>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, color: T.inkLight, letterSpacing: 1.5, marginBottom: 3, textTransform: 'uppercase' }}>Value Log</div>
        <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 19, color: T.ink, letterSpacing: -0.4 }}>Decision History · Value Created</div>
      </div>

      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '28px 52px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Summary KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', background: T.white, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
          {[
            { label: 'Total Risk Avoided',  value: `${(totalAvoided / 1000).toFixed(0)}K`, sub: 'cumulative — approved STOs only', color: T.safe    },
            { label: 'Total Transfer Cost', value: `${(totalCost    / 1000).toFixed(1)}K`, sub: 'freight spend to protect fill rate', color: T.inkMid },
            { label: 'Net Value Created',   value: `${(netValue     / 1000).toFixed(0)}K`, sub: 'risk avoided minus cost to act',   color: T.safe    },
            { label: 'STO Decisions', value: `${statusCounts.approved || 0}A · ${statusCounts.deferred || 0}D · ${statusCounts.dismissed || 0}X`, sub: 'approved · deferred · dismissed', color: T.inkMid },
          ].map((m, i) => (
            <div key={i} style={{ padding: '20px 24px', borderRight: i < 3 ? `1px solid ${T.border}` : 'none' }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, color: T.inkLight, letterSpacing: 1.3, marginBottom: 7, textTransform: 'uppercase' }}>{m.label}</div>
              <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 22, color: m.color, letterSpacing: -0.7, marginBottom: 3 }}>{m.value}</div>
              <div style={{ fontSize: 11, color: T.inkLight }}>{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Fill rate by retailer */}
        <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 10, padding: '18px 24px' }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, color: T.inkLight, letterSpacing: 1.3, marginBottom: 14, textTransform: 'uppercase' }}>Fill Rate Protected by Retailer</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {Object.entries(RP).map(([name, val]) => (
              <div key={name} style={{ padding: '14px 16px', background: T.bgDark, borderRadius: 8, borderLeft: `3px solid ${CC[name]}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: CC[name] }} />
                  <span style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 13, color: T.ink }}>{name}</span>
                </div>
                <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: 20, color: CC[name], letterSpacing: -0.5 }}>${(val / 1000).toFixed(0)}K</div>
                <div style={{ fontSize: 11, color: T.inkLight, marginTop: 3 }}>exposure protected</div>
              </div>
            ))}
          </div>
        </div>

        {/* History table */}
        <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 10 }}>
          <div style={{ padding: '16px 22px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, color: T.inkLight, letterSpacing: 1.3, marginBottom: 3, textTransform: 'uppercase' }}>Transfer History</div>
              <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 15, color: T.ink, letterSpacing: -0.2 }}>All decisions — newest first</div>
            </div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: T.inkLight }}>{LOG.length} records</div>
          </div>
          <div>
            {LOG.map((r, i) => {
              const s = statusStyle(r.status);
              return (
                <div key={r.id} className="rh" style={{ padding: '13px 22px', borderBottom: i < LOG.length - 1 ? `1px solid ${T.border}` : 'none', display: 'grid', gridTemplateColumns: '110px 1fr 100px 120px 1fr 100px', gap: 14, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkLight, marginBottom: 2 }}>{r.date}</div>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, color: T.inkGhost }}>{r.id}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'Sora', fontWeight: 500, fontSize: 13, color: T.ink, marginBottom: 2 }}>{r.from} → {r.to}</div>
                    <div style={{ fontSize: 11, color: T.inkLight, marginBottom: 2 }}>{r.skus} · {r.mode}</div>
                    <div style={{ fontSize: 10, color: T.inkLight, fontFamily: 'JetBrains Mono' }}>{r.customers}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkLight, marginBottom: 2 }}>COST</div>
                    <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: 13, color: T.inkMid }}>${r.cost.toLocaleString()}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkLight, marginBottom: 2 }}>AVOIDED</div>
                    <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: 13, color: T.safe }}>${r.avoided.toLocaleString()}</div>
                  </div>
                  <div style={{ fontSize: 11, color: T.inkLight, lineHeight: 1.4 }}>{r.impact}</div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ display: 'inline-block', background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 5, padding: '3px 10px', fontFamily: 'JetBrains Mono', fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{r.status}</div>
                    <div style={{ fontSize: 10, color: T.inkLight, marginTop: 4 }}>{r.approvedBy}</div>
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
