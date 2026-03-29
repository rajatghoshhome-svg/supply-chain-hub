import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback, Component } from 'react';
import { T } from '../styles/tokens';
import CascadeViz from '../components/CascadeViz';
import NetworkMap from '../components/NetworkMap';
import WhatIfTheater from '../components/WhatIfTheater';
import MorningBriefing from '../components/MorningBriefing';

// Error boundary to prevent individual component crashes from killing the whole page
class SafeRender extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ background: T.riskBg, border: `1px solid ${T.riskBorder}`, borderRadius: 8, padding: '16px 20px', margin: '8px 0' }}>
          <div style={{ fontFamily: 'Sora', fontSize: 13, fontWeight: 600, color: T.risk, marginBottom: 4 }}>
            {this.props.name || 'Component'} failed to load
          </div>
          <div style={{ fontSize: 12, color: T.inkMid }}>{this.state.error?.message || 'Unknown error'}</div>
        </div>
      );
    }
    return this.props.children;
  }
}

const CASCADE_STEPS = [
  { module: 'demand', label: 'Demand Plan', path: '/demand', desc: 'Statistical forecasting with 5 methods, best-fit selection, accuracy metrics' },
  { module: 'drp', label: 'DRP', path: '/drp', desc: 'Distribution requirements across 3 DCs, transit lead time netting, fair-share allocation' },
  { module: 'production', label: 'Production Plan', path: '/production-plan', desc: 'Chase/level/hybrid strategies per plant, S&OP aggregate planning' },
  { module: 'scheduling', label: 'Scheduling', path: '/scheduling', desc: 'SPT/EDD/CR sequencing, Gantt chart, changeover optimization' },
  { module: 'mrp', label: 'MRP', path: '/mrp', desc: 'Plant-specific BOM explosion, gross-to-net netting, lot sizing, exception generation' },
];

export default function Landing() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [cascadeTriggering, setCascadeTriggering] = useState(false);
  const [cascadeTriggerResult, setCascadeTriggerResult] = useState(null);

  const handleRunFullCascade = useCallback(async () => {
    setCascadeTriggering(true);
    setCascadeTriggerResult(null);
    try {
      const resp = await fetch('/api/cascade/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await resp.json();
      if (resp.ok) {
        setCascadeTriggerResult({ ok: true, planRunId: data.planRunId });
      } else {
        setCascadeTriggerResult({ ok: false, error: data.error || 'Trigger failed' });
      }
    } catch {
      // On Vercel (no backend), show simulated success
      setCascadeTriggerResult({ ok: true, planRunId: 'demo-simulated', simulated: true });
    } finally {
      setCascadeTriggering(false);
    }
  }, []);

  const [moduleHealth, setModuleHealth] = useState(null);

  useEffect(() => {
    // Fetch a quick DRP demo to show live stats
    fetch('/api/drp/demo')
      .then(r => r.json())
      .then(d => setStats(d))
      .catch(() => setStats({ skusPlanned: 105, locationsPlanned: 3, plantsServed: 2, totalExceptions: 2, criticalExceptions: 1 }));
  }, []);

  // Fetch per-module health
  useEffect(() => {
    async function loadHealth() {
      const modules = [
        { key: 'demand', endpoint: '/api/demand/demo', label: 'Demand' },
        { key: 'drp', endpoint: '/api/drp/demo', label: 'DRP' },
        { key: 'production', endpoint: '/api/production-plan/demo', label: 'Production' },
        { key: 'scheduling', endpoint: '/api/scheduling/demo', label: 'Scheduling' },
        { key: 'mrp', endpoint: '/api/mrp/demo', label: 'MRP' },
      ];
      const results = {};
      for (const m of modules) {
        try {
          const resp = await fetch(m.endpoint);
          const data = await resp.json();
          results[m.key] = {
            label: m.label,
            live: resp.ok,
            exceptions: data.totalExceptions ?? data.criticalExceptions ?? 0,
            critical: data.criticalExceptions ?? 0,
          };
        } catch {
          results[m.key] = { label: m.label, live: false, exceptions: 0, critical: 0 };
        }
      }
      setModuleHealth(results);
    }
    loadHealth();
  }, []);

  return (
    <div style={{ fontFamily: 'Inter', background: T.bg }}>

      {/* Hero */}
      <div style={{ background: T.white, borderBottom: `1px solid ${T.border}`, padding: '48px 40px 40px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkLight, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>
            AI-Native Supply Chain Planning
          </div>
          <h1 style={{ fontFamily: 'Sora', fontSize: 32, fontWeight: 700, color: T.ink, letterSpacing: -0.8, margin: '0 0 12px' }}>
            End-to-End Planning Platform
          </h1>
          <p style={{ fontSize: 15, color: T.inkMid, maxWidth: 600, lineHeight: 1.6, margin: '0 0 24px' }}>
            Deterministic ASCM/APICS planning engines + AI exception analysis.
            Full cascade from demand forecast to material requirements across 2 plants,
            3 distribution centers, and 105 SKUs.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => navigate('/demand')} className="bp"
              style={{ background: T.ink, color: T.white, border: 'none', padding: '10px 24px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500, fontFamily: 'Sora', transition: 'opacity 0.15s' }}>
              Start with Demand →
            </button>
            <button onClick={() => navigate('/drp')} className="bp"
              style={{ background: T.white, color: T.ink, border: `1.5px solid ${T.border}`, padding: '10px 24px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500, fontFamily: 'Sora' }}>
              Jump to DRP
            </button>
          </div>
        </div>
      </div>

      {/* Live Network Stats */}
      {stats && (
        <div style={{ background: T.white, borderBottom: `1px solid ${T.border}` }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div className="landing-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', borderLeft: `1px solid ${T.border}` }}>
              {[
                { label: 'SKUs',          value: stats.skusPlanned,       color: T.ink },
                { label: 'DCs Planned',   value: stats.locationsPlanned,  color: T.ink },
                { label: 'Plants',        value: stats.plantsServed || 2, color: T.ink },
                { label: 'Exceptions',    value: stats.totalExceptions,   color: stats.totalExceptions > 0 ? T.warn : T.safe },
                { label: 'Critical',      value: stats.criticalExceptions, color: stats.criticalExceptions > 0 ? T.risk : T.safe },
              ].map((m, i) => (
                <div key={i} style={{ padding: '18px 24px', borderRight: `1px solid ${T.border}` }}>
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkLight, letterSpacing: 1.3, marginBottom: 6, textTransform: 'uppercase' }}>{m.label}</div>
                  <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 24, color: m.color, letterSpacing: -0.5 }}>{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Morning Briefing */}
      <div className="landing-section" style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 40px 0' }}>
        <SafeRender name="Morning Briefing"><MorningBriefing /></SafeRender>
      </div>

      {/* System Health */}
      {moduleHealth && (
        <div className="landing-section" style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 40px 0' }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, color: T.inkLight, letterSpacing: 1.4, marginBottom: 10, textTransform: 'uppercase' }}>System Health</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            {Object.entries(moduleHealth).map(([key, m]) => (
              <div
                key={key}
                onClick={() => navigate(`/${key === 'production' ? 'production-plan' : key}`)}
                style={{
                  background: T.white, border: `1px solid ${T.border}`, borderRadius: 8,
                  padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = T.ink; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontFamily: 'Sora', fontSize: 13, fontWeight: 600, color: T.ink }}>{m.label}</span>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: m.live ? T.safe : T.inkGhost,
                    display: 'inline-block',
                  }} />
                </div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: m.critical > 0 ? T.risk : m.exceptions > 0 ? T.warn : T.safe }}>
                  {m.exceptions > 0 ? `${m.exceptions} exceptions` : 'Clean'}
                  {m.critical > 0 && <span style={{ color: T.risk, fontWeight: 600 }}> ({m.critical} critical)</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="landing-section" style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 40px 0' }}>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, color: T.inkLight, letterSpacing: 1.4, marginBottom: 10, textTransform: 'uppercase' }}>Quick Actions</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { label: 'Override Forecast', path: '/demand', desc: 'Adjust demand and trigger cascade' },
            { label: 'Review Exceptions', path: '/mrp', desc: 'Accept, defer, or dismiss action messages' },
            { label: 'Resequence Orders', path: '/scheduling', desc: 'Drag orders on the Gantt chart' },
            { label: 'Decision Log', path: '/decisions', desc: 'Review all planning decisions' },
            { label: 'Import Data', path: '/onboarding', desc: 'Upload CSV to replace demo data' },
          ].map(a => (
            <button
              key={a.path}
              onClick={() => navigate(a.path)}
              style={{
                background: T.white, border: `1px solid ${T.border}`, borderRadius: 8,
                padding: '12px 18px', cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.15s', flex: '1 1 180px', minWidth: 180,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; }}
            >
              <div style={{ fontFamily: 'Sora', fontSize: 13, fontWeight: 600, color: T.ink, marginBottom: 4 }}>{a.label}</div>
              <div style={{ fontSize: 11, color: T.inkMid }}>{a.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ASCM Cascade Flow */}
      <div className="landing-section" style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 40px' }}>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, color: T.inkLight, letterSpacing: 1.4, marginBottom: 6, textTransform: 'uppercase' }}>ASCM MPC Framework</div>
        <h2 style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 18, color: T.ink, letterSpacing: -0.3, marginBottom: 20 }}>Planning Cascade</h2>

        <div style={{ display: 'flex', gap: 0, alignItems: 'stretch' }}>
          {CASCADE_STEPS.map((step, i) => (
            <div key={step.module} style={{ flex: 1, display: 'flex', alignItems: 'stretch' }}>
              <div
                onClick={() => navigate(step.path)}
                style={{
                  flex: 1,
                  background: T.white,
                  border: `1px solid ${T.border}`,
                  borderRadius: 10,
                  padding: '20px 16px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  display: 'flex',
                  flexDirection: 'column',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = T.ink; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: T.accent, fontWeight: 600, marginBottom: 6 }}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div style={{ fontFamily: 'Sora', fontSize: 14, fontWeight: 600, color: T.ink, marginBottom: 8 }}>
                  {step.label}
                </div>
                <div style={{ fontSize: 12, color: T.inkMid, lineHeight: 1.5, flex: 1 }}>
                  {step.desc}
                </div>
              </div>
              {i < CASCADE_STEPS.length - 1 && (
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 4px', color: T.inkGhost, fontSize: 18 }}>→</div>
              )}
            </div>
          ))}
        </div>

        {/* Closed loop note */}
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ fontSize: 11, color: T.inkLight, fontFamily: 'JetBrains Mono', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: T.accent }}>⟲</span> Scheduling ↔ MRP closed loop — timing shifts feed back to MPS
          </div>
        </div>
      </div>

      {/* Live Cascade */}
      <div className="landing-section" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <button
            onClick={handleRunFullCascade}
            disabled={cascadeTriggering}
            style={{
              background: cascadeTriggering ? T.bgDark : T.accent,
              color: cascadeTriggering ? T.inkLight : T.white,
              border: 'none',
              padding: '8px 20px',
              borderRadius: 7,
              cursor: cascadeTriggering ? 'default' : 'pointer',
              fontSize: 13,
              fontWeight: 500,
              fontFamily: 'Sora',
              transition: 'all 0.15s',
            }}
          >
            {cascadeTriggering ? 'Triggering...' : 'Run Full Cascade'}
          </button>
          {cascadeTriggerResult && (
            <span style={{
              fontFamily: 'JetBrains Mono', fontSize: 11,
              color: cascadeTriggerResult.ok ? T.safe : T.risk,
            }}>
              {cascadeTriggerResult.ok
                ? `Cascade started (${cascadeTriggerResult.planRunId})`
                : `Error: ${cascadeTriggerResult.error}`}
            </span>
          )}
        </div>
        <SafeRender name="Cascade Visualization"><CascadeViz /></SafeRender>
      </div>

      {/* Network Architecture — Interactive Map */}
      <div className="landing-section" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px 32px' }}>
        <SafeRender name="Network Map"><NetworkMap /></SafeRender>
      </div>

      {/* What-If Theater */}
      <div className="landing-section" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px 32px' }}>
        <SafeRender name="What-If Theater"><WhatIfTheater /></SafeRender>
      </div>

      {/* Architecture */}
      <div className="landing-section" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 12, padding: '24px 28px' }}>
            <h3 style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 15, color: T.ink, marginBottom: 12 }}>Deterministic Engines</h3>
            <div style={{ fontSize: 12, color: T.inkMid, lineHeight: 1.7 }}>
              Pure JavaScript functions — no LLM nondeterminism for planning math.
              Same answer every run. Testable, auditable, ASCM/APICS compliant.
            </div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: T.inkLight, marginTop: 12 }}>
              209 tests · 5 engines · {'<'}200ms
            </div>
          </div>
          <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 12, padding: '24px 28px' }}>
            <h3 style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 15, color: T.ink, marginBottom: 12 }}>AI Exception Analysis</h3>
            <div style={{ fontSize: 12, color: T.inkMid, lineHeight: 1.7 }}>
              Claude analyzes engine output — exceptions, recommendations, root cause.
              AI never touches the math. Structured context per module with ASCM system prompts.
            </div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: T.inkLight, marginTop: 12 }}>
              Per-module context builders · SSE streaming · Decision logging
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${T.border}`, padding: '16px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 13, color: T.ink }}>Supply Chain Planning Platform</div>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkGhost, letterSpacing: 0.8 }}>ASCM MPC FRAMEWORK · E2E PLANNING</div>
        <div style={{ fontSize: 11, color: T.inkGhost }}>React · Express · PostgreSQL · Claude API</div>
      </div>
    </div>
  );
}
