import { useState, useEffect } from 'react';
import { T } from '../../styles/tokens';

/* ─── Helpers ──────────────────────────────────────────────────────────────── */
function paceColor(pct) {
  if (pct >= 80) return T.safe;
  if (pct >= 50) return '#D97706';
  return T.risk;
}

function statusMeta(order, downtimeBlocks) {
  if (downtimeBlocks && downtimeBlocks.length > 0) {
    const active = downtimeBlocks.find(dt => dt.active);
    if (active) return { status: 'downtime', label: `DOWNTIME - ${active.reason || active.type || 'CIP'}`, color: '#D97706', borderColor: '#D97706' };
  }
  if (!order) return { status: 'idle', label: 'IDLE', color: T.inkLight, borderColor: T.border };
  if (order.status === 'running' && (order.pacePercent || 100) >= 80) {
    return { status: 'running', label: 'RUNNING', color: T.safe, borderColor: T.safe };
  }
  if (order.status === 'running') {
    return { status: 'behind', label: 'BEHIND PACE', color: T.risk, borderColor: T.risk };
  }
  return { status: 'idle', label: 'IDLE', color: T.inkLight, borderColor: T.border };
}

function formatTime(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}

/* ─── Blink animation ──────────────────────────────────────────────────────── */
const BLINK_STYLE = `
@keyframes blink-dot {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.2; }
}
`;

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function ShopFloorTab({ schedule, plant }) {
  const [refreshCountdown, setRefreshCountdown] = useState(10);

  useEffect(() => {
    const timer = setInterval(() => {
      setRefreshCountdown(prev => (prev <= 1 ? 10 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!schedule) {
    return <div style={{ padding: 60, textAlign: 'center', color: T.inkLight, fontFamily: T.fontBody }}>No schedule data available.</div>;
  }

  /* Collect all work centers */
  const workCenters = [];
  (schedule.stages || []).forEach(stage => {
    (stage.workCenters || []).forEach(wc => {
      workCenters.push({ ...wc, stageName: stage.name });
    });
  });

  return (
    <div style={{ fontFamily: T.fontBody, padding: T.sp4 }}>
      <style>{BLINK_STYLE}</style>

      {/* Auto-refresh indicator */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: T.sp4,
        fontFamily: T.fontMono, fontSize: 11, color: T.inkLight,
      }}>
        <span style={{
          display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
          background: T.safe, animation: 'blink-dot 2s ease-in-out infinite',
        }} />
        Auto-refresh: {refreshCountdown}s
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: T.inkGhost }}>{plant}</span>
      </div>

      {/* Work center grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
        gap: T.sp4,
      }}>
        {workCenters.map(wc => {
          const orders = wc.orders || [];
          const running = orders.find(o => o.status === 'running');
          const planned = orders.filter(o => o.status === 'planned').slice(0, 3);
          const downtimeBlocks = wc.downtimeBlocks || [];
          const meta = statusMeta(running, downtimeBlocks.filter(d => d.active));

          // Calculate progress for running order
          let progressPct = 0;
          let completedQty = 0;
          let rate = 0;
          let estComplete = '';
          if (running) {
            progressPct = running.pacePercent || 0;
            completedQty = Math.round((progressPct / 100) * running.qty);
            const duration = running.endTime - running.startTime;
            rate = duration > 0 ? Math.round(running.qty / duration) : 0;
            // Estimate completion time in hours from start of day
            const remainHours = duration * (1 - progressPct / 100);
            estComplete = formatTime(14.5 + remainHours); // 2:30 PM base + remaining
          }

          return (
            <div key={wc.code} style={{
              background: T.white,
              border: `1px solid ${T.border}`,
              borderLeft: `4px solid ${meta.borderColor}`,
              borderRadius: T.r4,
              boxShadow: T.shadow1,
              overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: `${T.sp3}px ${T.sp4}px`,
                borderBottom: `1px solid ${T.border}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                    background: meta.color,
                  }} />
                  <span style={{
                    fontFamily: T.fontHeading, fontSize: 14, fontWeight: 700, color: T.ink,
                    textTransform: 'uppercase',
                  }}>
                    {wc.name}
                  </span>
                </div>
                <span style={{
                  fontFamily: T.fontMono, fontSize: 10, fontWeight: 600,
                  color: meta.color, background: `${meta.color}15`,
                  padding: '3px 10px', borderRadius: 20,
                }}>
                  {meta.label}
                </span>
              </div>

              {/* Body */}
              <div style={{ padding: `${T.sp4}px` }}>
                {meta.status === 'idle' && !running && (
                  <div style={{
                    textAlign: 'center', padding: `${T.sp6}px 0`,
                    color: T.inkLight, fontFamily: T.fontBody, fontSize: 14,
                  }}>
                    No active production
                  </div>
                )}

                {meta.status === 'downtime' && (
                  <div style={{
                    textAlign: 'center', padding: `${T.sp6}px 0`,
                    color: '#D97706', fontFamily: T.fontHeading, fontSize: 16, fontWeight: 600,
                  }}>
                    {meta.label}
                  </div>
                )}

                {running && (
                  <>
                    {/* Product name */}
                    <div style={{
                      fontFamily: T.fontHeading, fontSize: 16, fontWeight: 700,
                      color: T.ink, marginBottom: T.sp3,
                    }}>
                      {running.familyName}
                    </div>

                    {/* Pace bar */}
                    <div style={{
                      height: 20, borderRadius: T.r3, background: T.bgDark,
                      overflow: 'hidden', marginBottom: T.sp2,
                      position: 'relative',
                    }}>
                      <div style={{
                        height: '100%', width: `${Math.min(progressPct, 100)}%`,
                        background: paceColor(progressPct),
                        borderRadius: T.r3,
                        transition: 'width 0.5s ease',
                      }} />
                      <span style={{
                        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                        fontFamily: T.fontMono, fontSize: 11, fontWeight: 700,
                        color: progressPct > 60 ? T.white : T.ink,
                      }}>
                        {progressPct}%
                      </span>
                    </div>

                    {/* Big metrics */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                      marginBottom: T.sp2,
                    }}>
                      <div style={{
                        fontFamily: T.fontHeading, fontSize: 28, fontWeight: 700, color: T.ink,
                      }}>
                        {completedQty} <span style={{ fontSize: 14, color: T.inkLight, fontWeight: 400 }}>/ {running.qty} units</span>
                      </div>
                    </div>

                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <span style={{ fontFamily: T.fontMono, fontSize: 12, color: T.inkLight }}>
                        {rate} u/hr
                      </span>
                      <span style={{ fontFamily: T.fontMono, fontSize: 12, color: T.inkLight }}>
                        Est. complete: {estComplete}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Next up */}
              {planned.length > 0 && (
                <div style={{
                  borderTop: `1px solid ${T.border}`,
                  padding: `${T.sp3}px ${T.sp4}px`,
                  background: T.bg,
                }}>
                  <div style={{
                    fontFamily: T.fontMono, fontSize: 10, fontWeight: 700,
                    color: T.inkMid, letterSpacing: 1, textTransform: 'uppercase',
                    marginBottom: T.sp2,
                  }}>
                    NEXT UP
                  </div>
                  {planned.map((order, idx) => (
                    <div key={order.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: `${T.sp1}px 0`,
                      fontSize: 12, fontFamily: T.fontBody, color: T.inkMid,
                    }}>
                      <span>
                        <span style={{ color: T.inkLight, fontFamily: T.fontMono, fontSize: 10, marginRight: 6 }}>{idx + 1}.</span>
                        <span style={{
                          display: 'inline-block', width: 8, height: 8, borderRadius: 2,
                          background: order.brandColor || T.inkGhost, marginRight: 6,
                          verticalAlign: 'middle',
                        }} />
                        {order.familyName}
                      </span>
                      <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.inkLight }}>
                        {order.qty} units
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Utilization footer */}
              {wc.utilization != null && (
                <div style={{
                  padding: `${T.sp2}px ${T.sp4}px`,
                  borderTop: `1px solid ${T.border}`,
                  display: 'flex', justifyContent: 'space-between',
                  fontFamily: T.fontMono, fontSize: 10, color: T.inkLight,
                }}>
                  <span>Utilization</span>
                  <span style={{ fontWeight: 600, color: wc.utilization >= 80 ? T.safe : wc.utilization >= 50 ? '#D97706' : T.risk }}>
                    {Math.round(wc.utilization)}%
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
