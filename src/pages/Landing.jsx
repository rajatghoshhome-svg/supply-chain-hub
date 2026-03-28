import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { T } from '../styles/tokens';
import CascadeViz from '../components/CascadeViz';
import NetworkMap from '../components/NetworkMap';
import WhatIfTheater from '../components/WhatIfTheater';
import MorningBriefing from '../components/MorningBriefing';

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
    } catch (err) {
      setCascadeTriggerResult({ ok: false, error: err.message });
    } finally {
      setCascadeTriggering(false);
    }
  }, []);

  useEffect(() => {
    // Fetch a quick DRP demo to show live stats
    fetch('/api/drp/demo')
      .then(r => r.json())
      .then(d => setStats(d))
      .catch(() => {});
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
            Full cascade from demand forecast to material requirements across 3 plants,
            3 distribution centers, and 11 products.
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', borderLeft: `1px solid ${T.border}` }}>
              {[
                { label: 'Products',     value: stats.skusPlanned,       color: T.ink },
                { label: 'DCs Planned',   value: stats.locationsPlanned,  color: T.ink },
                { label: 'Plants',        value: stats.plantsServed || 3, color: T.ink },
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
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 40px 0' }}>
        <MorningBriefing />
      </div>

      {/* ASCM Cascade Flow */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 40px' }}>
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
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px 32px' }}>
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
        <CascadeViz />
      </div>

      {/* Network Architecture — Interactive Map */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px 32px' }}>
        <NetworkMap />
      </div>

      {/* What-If Theater */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px 32px' }}>
        <WhatIfTheater />
      </div>

      {/* Architecture */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px 32px' }}>
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
