import { useState, useEffect } from 'react';
import { T } from '../styles/tokens';

const STATIC_TRUST = {
  overall: { total: 16, accepted: 11, deferred: 3, dismissed: 2, trustPct: 69 },
  perModule: {
    demand: { total: 3, accepted: 2, deferred: 1, dismissed: 0, trustPct: 67 },
    drp: { total: 4, accepted: 3, deferred: 1, dismissed: 0, trustPct: 75 },
    production: { total: 3, accepted: 2, deferred: 1, dismissed: 0, trustPct: 67 },
    scheduling: { total: 3, accepted: 2, deferred: 0, dismissed: 1, trustPct: 67 },
    mrp: { total: 3, accepted: 2, deferred: 0, dismissed: 1, trustPct: 67 },
  },
};

export default function TrustScore() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/decisions/trust-score')
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => setData(d))
      .catch(() => setData(STATIC_TRUST));
  }, []);

  if (!data) return null;

  const { overall, perModule } = data;

  return (
    <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 12, padding: '20px 24px' }}>
      {/* Header */}
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkLight, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 4 }}>
        AI Recommendation Trust
      </div>

      {/* Overall score */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
        <span style={{ fontFamily: 'Sora', fontSize: 36, fontWeight: 700, color: overall.trustPct >= 70 ? T.safe : overall.trustPct >= 50 ? T.warn : T.risk }}>
          {overall.trustPct}%
        </span>
        <span style={{ fontSize: 12, color: T.inkLight }}>
          {overall.accepted}/{overall.total} accepted
        </span>
      </div>

      {/* Summary bar */}
      <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 16, background: T.bgDark }}>
        {overall.total > 0 && (
          <>
            <div style={{ width: `${(overall.accepted / overall.total) * 100}%`, background: T.safe }} />
            <div style={{ width: `${(overall.deferred / overall.total) * 100}%`, background: T.warn }} />
            <div style={{ width: `${(overall.dismissed / overall.total) * 100}%`, background: T.risk }} />
          </>
        )}
      </div>

      {/* Per-module breakdown */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Object.entries(perModule).map(([mod, stats]) => (
          <div key={mod} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkMid, width: 80, textTransform: 'capitalize' }}>
              {mod}
            </span>
            <div style={{ flex: 1, display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', background: T.bgDark }}>
              {stats.total > 0 && (
                <>
                  <div style={{ width: `${(stats.accepted / stats.total) * 100}%`, background: T.safe }} />
                  <div style={{ width: `${(stats.deferred / stats.total) * 100}%`, background: T.warn }} />
                  <div style={{ width: `${(stats.dismissed / stats.total) * 100}%`, background: T.risk }} />
                </>
              )}
            </div>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: stats.trustPct >= 70 ? T.safe : stats.trustPct >= 50 ? T.warn : T.risk, width: 30, textAlign: 'right' }}>
              {stats.trustPct}%
            </span>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginTop: 12, fontSize: 10, color: T.inkLight }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: 1, background: T.safe, display: 'inline-block' }} />
          Accepted
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: 1, background: T.warn, display: 'inline-block' }} />
          Deferred
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: 1, background: T.risk, display: 'inline-block' }} />
          Dismissed
        </span>
      </div>
    </div>
  );
}
