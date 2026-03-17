import { T } from '../styles/tokens';

const DEMO_STACK = [
  ['React + Vite',   'Workflow, agent chat, approval queue, Leaflet map.'],
  ['Claude Sonnet',  'AI agent. Called directly from React.'],
  ['Leaflet + CartoDB', 'Real tile map. Free, no API key required.'],
  ['Vercel',         'Hosting. Auto-deploys from GitHub.'],
  ['Open-Meteo',     'Live weather per DC. Free.'],
];

const PROD_ADDITIONS = [
  ['+ Node.js',    'API layer, auth, ERP connection.'],
  ['+ PostgreSQL', 'Value Log persistence, user accounts, audit trail.'],
  ['+ Python',     'OR-Tools optimization at scale.'],
  ['+ ERP',        'Live inventory from SAP, Oracle, NetSuite.'],
  ['+ Redis',      'Cache scores and forecasts.'],
];

function Table({ rows }) {
  return (
    <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 8, overflow: 'hidden' }}>
      {rows.map(([tech, role], i) => (
        <div key={tech} style={{ display: 'grid', gridTemplateColumns: '165px 1fr', borderBottom: i < rows.length - 1 ? `1px solid ${T.border}` : 'none' }}>
          <div style={{ padding: '12px 16px', borderRight: `1px solid ${T.border}`, fontFamily: 'Sora', fontWeight: 500, fontSize: 13, color: T.ink }}>{tech}</div>
          <div style={{ padding: '12px 16px', fontSize: 13, color: T.inkLight, lineHeight: 1.55 }}>{role}</div>
        </div>
      ))}
    </div>
  );
}

export default function About() {
  return (
    <div style={{ background: T.bg, minHeight: 'calc(100vh - 54px)', padding: '44px 52px', fontFamily: 'Inter' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkLight, letterSpacing: 1.5, marginBottom: 13, textTransform: 'uppercase' }}>About this build</div>
        <h1 style={{ fontFamily: 'Sora', fontWeight: 500, fontSize: 30, color: T.ink, letterSpacing: -0.7, marginBottom: 14 }}>Built in 20 days.</h1>
        <p style={{ fontSize: 15, color: T.inkMid, lineHeight: 1.8, marginBottom: 7 }}>Working prototype. Architecture, data model, scoring engines, and agent reasoning are production-grade. Inventory and customer data are synthetic.</p>
        <div style={{ display: 'inline-block', padding: '4px 10px', background: T.bgDark, border: `1px solid ${T.border}`, borderRadius: 5, fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkLight, letterSpacing: 0.5, marginBottom: 36 }}>Not official Mars Petcare data</div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, color: T.inkLight, letterSpacing: 1.3, marginBottom: 11, textTransform: 'uppercase' }}>Demo stack</div>
          <Table rows={DEMO_STACK} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, color: T.inkLight, letterSpacing: 1.3, marginBottom: 11, textTransform: 'uppercase' }}>Production additions</div>
          <Table rows={PROD_ADDITIONS} />
        </div>

        <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 8, padding: '16px 20px' }}>
          <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 20, color: T.ink, letterSpacing: -0.4, marginBottom: 5 }}>~$5</div>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, color: T.inkLight, letterSpacing: 1, marginBottom: 7, textTransform: 'uppercase' }}>Total cost for this demo</div>
          <p style={{ fontSize: 13, color: T.inkLight, lineHeight: 1.7 }}>GitHub, Vercel, Open-Meteo, and Leaflet are free. Claude API ~$0.02 per turn. $10 covers the entire build and demo.</p>
        </div>
      </div>
    </div>
  );
}
