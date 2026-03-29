import { useState, useRef, useEffect } from 'react';
import { T } from '../../styles/tokens';

/* ─── Zoom presets ─────────────────────────────────────────────────────────── */
const ZOOM = {
  shift: { label: 'Shift', hoursPerSegment: 8, pxPerHour: 10 },
  day:   { label: 'Day',   hoursPerSegment: 24, pxPerHour: 80 / 24 },
  week:  { label: 'Week',  hoursPerSegment: 168, pxPerHour: 80 / 168 },
};

const LEFT_COL = 180;
const ROW_H = 52;
const HEADER_H = 40;

const PULSE_STYLE = `
@keyframes pulse-running {
  0%, 100% { box-shadow: 0 0 0 0 rgba(42,92,66,0.4); }
  50%      { box-shadow: 0 0 0 4px rgba(42,92,66,0.15); }
}
`;

/* ─── Helpers ──────────────────────────────────────────────────────────────── */
function parseDate(str) { return new Date(str); }

function hoursBetween(a, b) {
  return (parseDate(b) - parseDate(a)) / (1000 * 60 * 60);
}

function dayLabel(hourOffset, horizonStart) {
  const d = new Date(parseDate(horizonStart).getTime() + hourOffset * 3600000);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${days[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`;
}

function shortFamily(name) {
  if (!name) return '';
  const parts = name.split(' ');
  if (parts.length >= 2) return parts[0].slice(0, 3).toUpperCase() + '-' + parts[1].slice(0, 3).toUpperCase();
  return name.slice(0, 8);
}

/* ─── Legend Item ───────────────────────────────────────────────────────────── */
function LegendItem({ color, border, label, dashed }) {
  const boxStyle = {
    width: 14, height: 14, borderRadius: 3, display: 'inline-block',
    background: color || 'transparent',
    border: border || 'none',
    ...(dashed ? { borderStyle: 'dashed' } : {}),
  };
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: T.inkMid, fontFamily: T.fontMono }}>
      <span style={boxStyle} /> {label}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function GanttChartTab({ schedule, plant, onResequence, onOptimize, onRefresh }) {
  const [zoom, setZoom] = useState('day');
  const scrollRef = useRef(null);
  const [dragState, setDragState] = useState(null); // { orderId, workCenter, originalIdx }
  const [dropIdx, setDropIdx] = useState(null);

  if (!schedule) {
    return <div style={{ padding: 60, textAlign: 'center', color: T.inkLight, fontFamily: T.fontBody }}>No schedule data available.</div>;
  }

  const { horizonStart, horizonEnd, nowTime, stages } = schedule;
  const totalHours = hoursBetween(horizonStart, horizonEnd);
  const nowHour = hoursBetween(horizonStart, nowTime);
  const z = ZOOM[zoom];
  const chartW = Math.max(totalHours * z.pxPerHour, 600);

  /* ─── Time ticks ──────────────────────────────────────────────────────── */
  const ticks = [];
  const tickInterval = z.hoursPerSegment;
  for (let h = 0; h <= totalHours; h += tickInterval) {
    ticks.push(h);
  }

  /* ─── Sub-ticks for shift view ────────────────────────────────────────── */
  const subTicks = [];
  if (zoom === 'shift') {
    for (let h = 0; h <= totalHours; h += 24) {
      subTicks.push(h);
    }
  }

  /* ─── Scroll to now ───────────────────────────────────────────────────── */
  const scrollToNow = () => {
    if (scrollRef.current) {
      const nowPx = nowHour * z.pxPerHour;
      scrollRef.current.scrollLeft = Math.max(0, nowPx - 300);
    }
  };

  /* ─── Collect all rows ────────────────────────────────────────────────── */
  const allRows = [];
  (stages || []).forEach(stage => {
    allRows.push({ type: 'stage', name: stage.name });
    (stage.workCenters || []).forEach(wc => {
      allRows.push({ type: 'wc', ...wc, stageName: stage.name });
    });
  });

  const totalRows = allRows.length;
  const svgH = HEADER_H + totalRows * ROW_H + 20;

  /* ─── Drag handlers ───────────────────────────────────────────────────── */
  const handleDragStart = (orderId, wcCode, idx) => {
    setDragState({ orderId, workCenter: wcCode, originalIdx: idx });
  };

  const handleDragOver = (e, wcCode, idx) => {
    e.preventDefault();
    if (dragState && dragState.workCenter === wcCode) {
      setDropIdx(idx);
    }
  };

  const handleDrop = (e, wcCode, orders) => {
    e.preventDefault();
    if (!dragState || dragState.workCenter !== wcCode) { setDragState(null); setDropIdx(null); return; }
    const fromIdx = dragState.originalIdx;
    const toIdx = dropIdx;
    if (fromIdx === null || toIdx === null || fromIdx === toIdx) { setDragState(null); setDropIdx(null); return; }
    const newOrders = [...orders.map(o => o.id)];
    const [moved] = newOrders.splice(fromIdx, 1);
    newOrders.splice(toIdx, 0, moved);
    if (onResequence) onResequence(wcCode, newOrders);
    setDragState(null);
    setDropIdx(null);
  };

  const handleDragEnd = () => { setDragState(null); setDropIdx(null); };

  /* ─── Render ──────────────────────────────────────────────────────────── */
  return (
    <div style={{ fontFamily: T.fontBody }}>
      <style>{PULSE_STYLE}</style>

      {/* ── Controls bar ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: T.sp3, padding: `${T.sp3}px ${T.sp4}px`,
        borderBottom: `1px solid ${T.border}`, flexWrap: 'wrap', background: T.white,
      }}>
        {/* Zoom */}
        <div style={{ display: 'flex', gap: 2, background: T.bgDark, borderRadius: T.r2, padding: 2 }}>
          {Object.entries(ZOOM).map(([key, val]) => (
            <button key={key} onClick={() => setZoom(key)} style={{
              background: zoom === key ? T.ink : 'transparent',
              color: zoom === key ? T.white : T.inkMid,
              border: 'none', borderRadius: T.r1, padding: '6px 14px',
              cursor: 'pointer', fontFamily: T.fontMono, fontSize: 11, fontWeight: 500,
              transition: 'all 0.12s',
            }}>
              {val.label}
            </button>
          ))}
        </div>

        <button onClick={scrollToNow} style={{
          background: T.white, color: T.purple, border: `1px solid ${T.purple}`,
          borderRadius: T.r2, padding: '6px 14px', cursor: 'pointer',
          fontFamily: T.fontMono, fontSize: 11, fontWeight: 500,
        }}>
          Scroll to Now
        </button>

        <button onClick={onOptimize} style={{
          background: T.purple, color: T.white, border: 'none',
          borderRadius: T.r2, padding: '8px 18px', cursor: 'pointer',
          fontFamily: T.fontHeading, fontSize: 12, fontWeight: 600,
        }}>
          Optimize
        </button>

        <button onClick={onRefresh} style={{
          background: T.white, color: T.inkMid, border: `1px solid ${T.border}`,
          borderRadius: T.r2, padding: '6px 14px', cursor: 'pointer',
          fontFamily: T.fontMono, fontSize: 11,
        }}>
          Refresh
        </button>

        <div style={{ flex: 1 }} />

        {/* Legend */}
        <div style={{ display: 'flex', gap: T.sp3, flexWrap: 'wrap', alignItems: 'center' }}>
          <LegendItem color={T.orijen} label="ORIJEN" />
          <LegendItem color={T.acana} label="ACANA" />
          <LegendItem color="transparent" border={`2px solid ${T.safe}`} label="Running" />
          <LegendItem color="transparent" border={`2px solid ${T.risk}`} label="Late" />
          <LegendItem color={T.border} label="Downtime" />
          <LegendItem color="#D97706" label="Changeover" />
          <LegendItem color="transparent" border={`2px dashed ${T.purple}`} label="Now" dashed />
        </div>
      </div>

      {/* ── Chart area ───────────────────────────────────────────────────── */}
      <div ref={scrollRef} style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 700, position: 'relative' }}>
        <div style={{ display: 'flex', minWidth: LEFT_COL + chartW + 40 }}>

          {/* ── Fixed left column ──────────────────────────────────────── */}
          <div style={{
            width: LEFT_COL, minWidth: LEFT_COL, flexShrink: 0,
            position: 'sticky', left: 0, zIndex: 3, background: T.white,
            borderRight: `1px solid ${T.border}`,
          }}>
            {/* Header spacer */}
            <div style={{ height: HEADER_H, borderBottom: `1px solid ${T.border}` }} />

            {allRows.map((row, idx) => {
              if (row.type === 'stage') {
                return (
                  <div key={`stage-${idx}`} style={{
                    height: ROW_H, display: 'flex', alignItems: 'center',
                    padding: `0 ${T.sp4}px`, background: T.bgDark,
                    fontFamily: T.fontHeading, fontSize: 11, fontWeight: 700,
                    color: T.inkMid, textTransform: 'uppercase', letterSpacing: 1.5,
                  }}>
                    {row.name}
                  </div>
                );
              }
              return (
                <div key={`wc-${row.code}`} style={{
                  height: ROW_H, display: 'flex', flexDirection: 'column',
                  justifyContent: 'center', padding: `0 ${T.sp4}px`,
                  borderBottom: `1px solid ${T.border}`,
                  background: T.white,
                }}>
                  <div style={{ fontFamily: T.fontHeading, fontSize: 12, fontWeight: 600, color: T.ink }}>{row.name}</div>
                  <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.inkLight, marginTop: 2 }}>{row.code}</div>
                </div>
              );
            })}
          </div>

          {/* ── Chart body ─────────────────────────────────────────────── */}
          <div style={{ flex: 1, position: 'relative' }}>

            {/* Time scale header */}
            <div style={{
              height: HEADER_H, position: 'sticky', top: 0, zIndex: 2,
              background: T.white, borderBottom: `1px solid ${T.border}`,
              display: 'flex', alignItems: 'flex-end',
            }}>
              {ticks.map(h => {
                const x = h * z.pxPerHour;
                return (
                  <div key={h} style={{
                    position: 'absolute', left: x, bottom: 4,
                    fontFamily: T.fontMono, fontSize: 9, color: T.inkLight,
                    transform: 'translateX(-50%)', whiteSpace: 'nowrap',
                  }}>
                    {zoom === 'week' ? `Wk ${Math.floor(h / 168) + 1}` : dayLabel(h, horizonStart)}
                  </div>
                );
              })}
              {/* Sub-tick day labels for shift zoom */}
              {zoom === 'shift' && subTicks.map(h => {
                const x = h * z.pxPerHour;
                return (
                  <div key={`sub-${h}`} style={{
                    position: 'absolute', left: x, top: 2,
                    fontFamily: T.fontMono, fontSize: 8, color: T.inkGhost,
                    transform: 'translateX(-50%)', whiteSpace: 'nowrap',
                  }}>
                    {dayLabel(h, horizonStart)}
                  </div>
                );
              })}
            </div>

            {/* Rows */}
            {allRows.map((row, rowIdx) => {
              if (row.type === 'stage') {
                return (
                  <div key={`stage-row-${rowIdx}`} style={{
                    height: ROW_H, background: T.bgDark, borderBottom: `1px solid ${T.border}`,
                    position: 'relative',
                  }}>
                    {/* Grid lines through stage rows */}
                    {ticks.map(h => (
                      <div key={h} style={{
                        position: 'absolute', left: h * z.pxPerHour, top: 0,
                        width: 1, height: ROW_H, background: T.border, opacity: 0.5,
                      }} />
                    ))}
                  </div>
                );
              }

              const orders = row.orders || [];
              const downtimeBlocks = row.downtimeBlocks || [];
              const sortedOrders = [...orders].sort((a, b) => a.startTime - b.startTime);

              return (
                <div
                  key={`wc-row-${row.code}`}
                  style={{
                    height: ROW_H, position: 'relative',
                    borderBottom: `1px solid ${T.border}`,
                    background: T.white,
                  }}
                  onDragOver={(e) => handleDragOver(e, row.code, null)}
                  onDrop={(e) => handleDrop(e, row.code, sortedOrders)}
                >
                  {/* Grid lines */}
                  {ticks.map(h => (
                    <div key={h} style={{
                      position: 'absolute', left: h * z.pxPerHour, top: 0,
                      width: 1, height: ROW_H, background: T.border, opacity: 0.3,
                    }} />
                  ))}

                  {/* Downtime blocks */}
                  {downtimeBlocks.map((dt, dtIdx) => {
                    const x = dt.startTime * z.pxPerHour;
                    const w = Math.max((dt.endTime - dt.startTime) * z.pxPerHour, 8);
                    return (
                      <div key={`dt-${dtIdx}`} style={{
                        position: 'absolute', left: x, top: 6,
                        width: w, height: ROW_H - 12,
                        background: T.border, borderRadius: T.r1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ fontFamily: T.fontMono, fontSize: 9, color: T.inkMid, fontWeight: 500 }}>
                          {dt.reason || dt.type || 'DOWN'}
                        </span>
                      </div>
                    );
                  })}

                  {/* Order bars */}
                  {sortedOrders.map((order, oIdx) => {
                    const x = order.startTime * z.pxPerHour;
                    const w = Math.max((order.endTime - order.startTime) * z.pxPerHour, 6);
                    const isComplete = order.status === 'complete';
                    const isRunning = order.status === 'running';
                    const isDelayed = order.status === 'delayed';
                    const isDragging = dragState && dragState.orderId === order.id;
                    const isDropTarget = dragState && dragState.workCenter === row.code && dropIdx === oIdx;

                    // Changeover: different family from previous
                    const prevOrder = oIdx > 0 ? sortedOrders[oIdx - 1] : null;
                    const hasChangeover = order.changeover > 0 || (prevOrder && prevOrder.familyId !== order.familyId);
                    const changeoverWidth = order.changeover ? order.changeover * z.pxPerHour : 2;

                    return (
                      <div key={order.id} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }}>
                        {/* Changeover indicator */}
                        {hasChangeover && x > 0 && (
                          <div style={{
                            position: 'absolute', left: x - Math.max(changeoverWidth, 2),
                            top: 8, width: Math.max(changeoverWidth, 2), height: ROW_H - 16,
                            background: '#D97706', borderRadius: 1, opacity: 0.7,
                          }} />
                        )}

                        {/* Drop indicator */}
                        {isDropTarget && (
                          <div style={{
                            position: 'absolute', left: x - 1, top: 2,
                            width: 2, height: ROW_H - 4,
                            background: T.blue, borderRadius: 1,
                          }} />
                        )}

                        {/* Order bar */}
                        <div
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = 'move';
                            handleDragStart(order.id, row.code, oIdx);
                          }}
                          onDragOver={(e) => handleDragOver(e, row.code, oIdx)}
                          onDragEnd={handleDragEnd}
                          title={`${order.id}: ${order.familyName}\n${order.qty} units | ${order.status}\n${order.startTime}h - ${order.endTime}h`}
                          style={{
                            position: 'absolute',
                            left: x, top: 8,
                            width: w, height: ROW_H - 16,
                            background: order.brandColor || T.inkGhost,
                            borderRadius: T.r1,
                            opacity: isComplete ? 0.6 : isDragging ? 0.4 : 1,
                            cursor: 'grab',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            overflow: 'hidden',
                            borderLeft: isDelayed ? `3px solid ${T.risk}` : 'none',
                            animation: isRunning ? 'pulse-running 2s ease-in-out infinite' : 'none',
                            border: isRunning ? `2px solid ${T.safe}` : isDelayed ? 'none' : 'none',
                            boxSizing: 'border-box',
                            transition: 'opacity 0.1s',
                          }}
                        >
                          {w > 40 && (
                            <span style={{
                              fontFamily: T.fontMono, fontSize: 11, fontWeight: 700,
                              color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden',
                              textOverflow: 'ellipsis', padding: '0 4px',
                              textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                            }}>
                              {shortFamily(order.familyName)} {order.qty}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* NOW line */}
                  {nowHour >= 0 && nowHour <= totalHours && (
                    <div style={{
                      position: 'absolute',
                      left: nowHour * z.pxPerHour, top: 0,
                      width: 0, height: ROW_H,
                      borderLeft: `2px dashed ${T.purple}`,
                      zIndex: 2, pointerEvents: 'none',
                    }} />
                  )}
                </div>
              );
            })}

            {/* NOW line in header */}
            {nowHour >= 0 && nowHour <= totalHours && (
              <div style={{
                position: 'absolute',
                left: nowHour * z.pxPerHour, top: 0,
                width: 0, height: HEADER_H,
                borderLeft: `2px dashed ${T.purple}`,
                zIndex: 4, pointerEvents: 'none',
              }}>
                <div style={{
                  position: 'absolute', top: 0, left: -16,
                  background: T.purple, color: T.white,
                  fontFamily: T.fontMono, fontSize: 8, fontWeight: 600,
                  padding: '1px 4px', borderRadius: 2, whiteSpace: 'nowrap',
                }}>
                  NOW
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Summary footer ─────────────────────────────────────────────── */}
      {schedule.summary && (
        <div style={{
          display: 'flex', gap: T.sp4, padding: `${T.sp3}px ${T.sp4}px`,
          borderTop: `1px solid ${T.border}`, background: T.bgDark,
          flexWrap: 'wrap',
        }}>
          <SummaryChip label="Total Orders" value={schedule.summary.totalOrders} />
          <SummaryChip label="Running" value={schedule.summary.runningOrders} color={T.purple} />
          <SummaryChip label="Completed" value={schedule.summary.completedOrders} color={T.safe} />
          <SummaryChip label="Delayed" value={schedule.summary.delayedOrders} color={T.risk} />
          <SummaryChip label="Avg Utilization" value={`${Math.round(schedule.summary.avgUtilization)}%`} />
          <SummaryChip label="Changeover" value={`${schedule.summary.totalChangeoverHours}h`} color="#D97706" />
        </div>
      )}
    </div>
  );
}

/* ─── Summary chip ─────────────────────────────────────────────────────────── */
function SummaryChip({ label, value, color }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      fontFamily: T.fontMono, fontSize: 11,
    }}>
      <span style={{ color: T.inkLight }}>{label}:</span>
      <span style={{ fontWeight: 700, color: color || T.ink }}>{value}</span>
    </div>
  );
}
