import { useNavigate } from 'react-router-dom';
import { T } from '../styles/tokens';
import { DCS } from '../data/dcs';
import Logo from '../components/Logo';
import LeafletMap from '../components/LeafletMap';
import AgentChat from '../components/AgentChat';

export default function Landing() {
  const navigate = useNavigate();
  const atRisk = [...new Set(DCS.flatMap(dc => dc.customers.filter(c => c.atRisk).map(c => c.name)))];
  const avgFR = (DCS.reduce((s, dc) => s + dc.fillRate, 0) / DCS.length).toFixed(1);

  return (
    <div style={{ fontFamily: 'Inter', background: T.bg }}>
      {/* KPIs */}
      <div style={{ background: T.white, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', borderLeft: `1px solid ${T.border}` }}>
            {[
              { label: 'Network Exposure',    value: '$221,300',  sub: 'if no action today',         color: T.risk },
              { label: 'DCs in Crisis',        value: '2 of 6',    sub: 'Atlanta · Charlotte',        color: T.risk },
              { label: 'Customer Fill Rate',   value: `${avgFR}%`, sub: 'network average',            color: T.warn },
              { label: 'Retailers at Risk',    value: String(atRisk.length), sub: atRisk.join(' · '), color: T.risk },
              { label: 'FTL Savings Available',value: '$4,360',    sub: 'via load consolidation',     color: T.safe },
            ].map((m, i) => (
              <div key={i} style={{ padding: '20px 24px', borderRight: `1px solid ${T.border}` }}>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, color: T.inkLight, letterSpacing: 1.3, marginBottom: 7, textTransform: 'uppercase' }}>{m.label}</div>
                <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 23, color: m.color, letterSpacing: -0.7, marginBottom: 3 }}>{m.value}</div>
                <div style={{ fontSize: 11, color: T.inkLight }}>{m.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Map */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 40px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, color: T.inkLight, letterSpacing: 1.4, marginBottom: 3, textTransform: 'uppercase' }}>Live Network — November 4, 2024</div>
            <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 18, color: T.ink, letterSpacing: -0.4 }}>Distribution Network · Customer Exposure</div>
          </div>
          <button onClick={() => navigate('/drp')} className="bp"
            style={{ background: T.ink, color: T.white, border: 'none', padding: '9px 20px', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'Sora', transition: 'opacity 0.15s' }}>
            Open Workflow
          </button>
        </div>
        <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '12px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, color: T.inkLight, letterSpacing: 1.3, textTransform: 'uppercase' }}>Hover any DC to see customer order detail</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, color: T.inkLight }}>Pie chart = customer volume mix · Click DC to open workflow</div>
          </div>
          <LeafletMap navigate={navigate} />
        </div>
      </div>

      {/* Agent */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 40px 40px' }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, color: T.inkLight, letterSpacing: 1.4, marginBottom: 3, textTransform: 'uppercase' }}>Supply Execution Agent</div>
          <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 18, color: T.ink, letterSpacing: -0.4 }}>Ask anything about the network</div>
        </div>
        <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', height: 480, display: 'flex', flexDirection: 'column' }}>
          <AgentChat />
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${T.border}`, padding: '16px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Logo compact />
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkGhost, letterSpacing: 0.8 }}>SUPPLY CHAIN HUB · PLANNING PLATFORM</div>
        <div style={{ fontSize: 12, color: T.inkGhost }}>React · Claude API · Vercel</div>
      </div>
    </div>
  );
}
