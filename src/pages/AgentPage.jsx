import { useNavigate } from 'react-router-dom';
import { T } from '../styles/tokens';
import AgentChat from '../components/AgentChat';

const GROUPED = {
  Risk:      ["What's our biggest risk right now?", "What's total exposure if we do nothing today?"],
  Action:    ["What should I approve today and what can wait?", "Why consolidate onto one truck instead of two shipments?"],
  Customers: ["Which retailer is most at risk?", "What's the fill rate situation?"],
  Analysis:  ["Where are the forecast gaps?", "Which DCs need attention?"],
  Planning:  ["What parameters need updating?", "Where should we rebalance inventory?"],
};

const CONTEXT = [
  ['At risk',          '$221,300',          T.risk],
  ['Fill rate',        '91.8%',             T.warn],
  ['Pending',          '2 STOs',            T.safe],
  ['At-risk retailers','Walmart · PetSmart', T.risk],
];

export default function AgentPage() {
  const navigate = useNavigate();
  return (
    <div style={{ background: T.bg, height: 'calc(100vh - 54px)', display: 'flex', fontFamily: 'Inter' }}>
      {/* Sidebar */}
      <div style={{ width: 248, flexShrink: 0, background: T.white, borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '18px 18px 10px' }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkGhost, letterSpacing: 1.5, textTransform: 'uppercase' }}>Suggested questions</div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 10px 16px' }}>
          {Object.entries(GROUPED).map(([cat, qs]) => (
            <div key={cat} style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 8.5, color: T.inkGhost, letterSpacing: 1.2, marginBottom: 5, paddingLeft: 6, textTransform: 'uppercase' }}>{cat}</div>
              {qs.map((q, i) => (
                <div key={i} className="sg" style={{ padding: '8px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12.5, color: T.inkMid, lineHeight: 1.45, marginBottom: 1, transition: 'background 0.1s' }}>{q}</div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ borderTop: `1px solid ${T.border}`, padding: '12px 18px' }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 8.5, color: T.inkGhost, letterSpacing: 1.2, marginBottom: 7, textTransform: 'uppercase' }}>Live context</div>
          {CONTEXT.map(([l, v, c]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: T.inkLight }}>{l}</span>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: c, fontWeight: 500 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ borderBottom: `1px solid ${T.border}`, padding: '11px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.white, flexShrink: 0 }}>
          <div style={{ fontFamily: 'Sora', fontWeight: 500, fontSize: 14, color: T.ink }}>Supply Chain Agent</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkLight }}>Claude Sonnet · 6 DCs · 4 SKUs · 4 retailers</div>
            <button onClick={() => navigate('/drp')} style={{ background: 'none', border: `1px solid ${T.border}`, color: T.inkLight, padding: '5px 13px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'Inter' }}>DRP</button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <AgentChat moduleContext="general" />
        </div>
      </div>
    </div>
  );
}
