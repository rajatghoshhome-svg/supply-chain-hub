import { useState, useRef, useCallback, useEffect } from 'react';
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
const BAR_PAD = 8;
const BAR_H = ROW_H - BAR_PAD * 2;

/* ─── Family options for Add Order modal ─────────────────────────────────── */
const FAMILIES = [
  { id: 'ORI-DOG-DRY', name: 'Orijen Dog Dry', brand: 'ORIJEN' },
  { id: 'ORI-CAT-DRY', name: 'Orijen Cat Dry', brand: 'ORIJEN' },
  { id: 'ORI-FD',      name: 'Orijen Freeze-Dried', brand: 'ORIJEN' },
  { id: 'ORI-TREAT',   name: 'Orijen Treats', brand: 'ORIJEN' },
  { id: 'ACA-DOG-DRY', name: 'Acana Dog Dry', brand: 'ACANA' },
  { id: 'ACA-CAT-DRY', name: 'Acana Cat Dry', brand: 'ACANA' },
  { id: 'ACA-WET-DOG', name: 'Acana Wet Dog', brand: 'ACANA' },
];

/* ─── CSS ──────────────────────────────────────────────────────────────────── */
const STYLE_TAG = `
@keyframes pulse-running {
  0%, 100% { box-shadow: 0 0 0 0 rgba(42,92,66,0.4); }
  50%      { box-shadow: 0 0 0 4px rgba(42,92,66,0.15); }
}
.gantt-bar { cursor: grab; user-select: none; touch-action: none; }
.gantt-bar:active { cursor: grabbing; }
.gantt-bar:hover { filter: brightness(1.08); }
.gantt-row-drop { background: rgba(37,99,235,0.06) !important; }
`;

/* ─── Helpers ──────────────────────────────────────────────────────────────── */
function parseDate(str) { return new Date(str); }
function hoursBetween(a, b) { return (parseDate(b) - parseDate(a)) / 3600000; }
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
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: T.inkMid, fontFamily: T.fontMono }}>
      <span style={{
        width: 14, height: 14, borderRadius: 3, display: 'inline-block',
        background: color || 'transparent',
        border: border || 'none',
        ...(dashed ? { borderStyle: 'dashed' } : {}),
      }} />
      {label}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function GanttChartTab({ schedule, plant, onResequence, onOptimize, onRefresh, onAddOrder }) {
  const [zoom, setZoom] = useState('day');
  const scrollRef = useRef(null);

  /* ── Drag state ─────────────────────────────────────────────────────── */
  const [dragging, setDragging] = useState(null);       // { orderId, wcCode, orderIdx, startX, barStartTime }
  const [dragDeltaHr, setDragDeltaHr] = useState(0);    // hours offset during drag
  const [dropTarget, setDropTarget] = useState(null);    // { wcCode, insertIdx }

  /* ── Add Order modal ────────────────────────────────────────────────── */
  const [showAddModal, setShowAddModal] = useState(false);
  const [newOrder, setNewOrder] = useState({ familyId: 'ORI-DOG-DRY', qty: 500, workCenter: '', priority: 'medium' });

  if (!schedule) {
    return <div style={{ padding: 60, textAlign: 'center', color: T.inkLight, fontFamily: T.fontBody }}>No schedule data available.</div>;
  }

  const { horizonStart, horizonEnd, nowTime, stages } = schedule;
  const totalHours = hoursBetween(horizonStart, horizonEnd);
  const nowHour = hoursBetween(horizonStart, nowTime);
  const z = ZOOM[zoom];
  const chartW = Math.max(totalHours * z.pxPerHour, 600);

  /* ─── Time ticks ──────────────────────────────────────────────────── */
  const ticks = [];
  for (let h = 0; h <= totalHours; h += z.hoursPerSegment) ticks.push(h);
  const subTicks = [];
  if (zoom === 'shift') { for (let h = 0; h <= totalHours; h += 24) subTicks.push(h); }

  /* ─── Scroll to now ───────────────────────────────────────────────── */
  const scrollToNow = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = Math.max(0, nowHour * z.pxPerHour - 300);
    }
  };

  /* ─── Collect all rows ──────────────────────────────────────────────── */
  const allRows = [];
  const allWorkCenters = [];
  (stages || []).forEach(stage => {
    allRows.push({ type: 'stage', name: stage.name });
    (stage.workCenters || []).forEach(wc => {
      allRows.push({ type: 'wc', ...wc, stageName: stage.name });
      allWorkCenters.push(wc);
    });
  });

  /* ─── Pointer-based drag handlers ───────────────────────────────────── */
  const handlePointerDown = (e, order, wcCode, orderIdx) => {
    // Don't drag completed orders
    if (order.status === 'complete') return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    setDragging({
      orderId: order.id,
      wcCode,
      orderIdx,
      startX: e.clientX,
      barStartTime: order.startTime,
    });
    setDragDeltaHr(0);
  };

  const handlePointerMove = (e) => {
    if (!dragging) return;
    e.preventDefault();
    const dx = e.clientX - dragging.startX;
    const dHr = dx / z.pxPerHour;
    setDragDeltaHr(dHr);

    // Calculate where the drop would land — find the insertion point
    const newTime = dragging.barStartTime + dHr;

    // Find which work center row we're over (check Y position)
    const container = scrollRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      const scrollTop = container.scrollTop;
      const relY = e.clientY - rect.top + scrollTop - HEADER_H;
      let rowIdx = 0;
      let targetWC = null;
      let targetWCOrders = null;
      for (const row of allRows) {
        if (row.type === 'wc') {
          const rowTop = rowIdx * ROW_H;
          if (relY >= rowTop && relY < rowTop + ROW_H) {
            // Only allow drop on same work center type (same stage)
            if (row.stageName === allRows.find(r => r.code === dragging.wcCode)?.stageName || row.code === dragging.wcCode) {
              targetWC = row.code;
              targetWCOrders = row.orders || [];
            }
            break;
          }
        }
        rowIdx++;
      }

      if (targetWC) {
        // Find insert position based on time
        const sorted = [...targetWCOrders].sort((a, b) => a.startTime - b.startTime);
        let insertIdx = sorted.length;
        for (let i = 0; i < sorted.length; i++) {
          if (sorted[i].id === dragging.orderId) continue;
          const midpoint = (sorted[i].startTime + sorted[i].endTime) / 2;
          if (newTime < midpoint) { insertIdx = i; break; }
        }
        setDropTarget({ wcCode: targetWC, insertIdx });
      } else {
        setDropTarget(null);
      }
    }
  };

  const handlePointerUp = (e) => {
    if (!dragging) return;
    e.preventDefault();

    // Execute the resequence if we have a valid drop target
    if (dropTarget && onResequence) {
      const targetRow = allRows.find(r => r.code === dropTarget.wcCode);
      if (targetRow) {
        const sorted = [...(targetRow.orders || [])].sort((a, b) => a.startTime - b.startTime);
        // Build new order: remove dragged order, insert at new position
        const filtered = sorted.filter(o => o.id !== dragging.orderId).map(o => o.id);
        const clampedIdx = Math.min(dropTarget.insertIdx, filtered.length);
        filtered.splice(clampedIdx, 0, dragging.orderId);
        onResequence(dropTarget.wcCode, filtered);
      }
    }

    setDragging(null);
    setDragDeltaHr(0);
    setDropTarget(null);
  };

  /* ─── Add Order submit ─────────────────────────────────────────────── */
  const handleAddOrderSubmit = () => {
    if (onAddOrder && newOrder.familyId && newOrder.qty > 0) {
      onAddOrder({
        familyId: newOrder.familyId,
        qty: Number(newOrder.qty),
        workCenter: newOrder.workCenter || undefined,
        priority: newOrder.priority,
      });
      setShowAddModal(false);
      setNewOrder({ familyId: 'ORI-DOG-DRY', qty: 500, workCenter: '', priority: 'medium' });
    }
  };

  /* ─── Render ──────────────────────────────────────────────────────── */
  return (
    <div style={{ fontFamily: T.fontBody }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <style>{STYLE_TAG}</style>

      {/* ── Controls bar ──────────────────────────────────────────────── */}
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

        <button onClick={() => setShowAddModal(true)} style={{
          background: T.safe, color: T.white, border: 'none',
          borderRadius: T.r2, padding: '8px 18px', cursor: 'pointer',
          fontFamily: T.fontHeading, fontSize: 12, fontWeight: 600,
        }}>
          + Add Order
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

      {/* ── Drag instruction banner ───────────────────────────────────── */}
      <div style={{
        padding: '4px 16px', background: T.bgDark, borderBottom: `1px solid ${T.border}`,
        fontFamily: T.fontMono, fontSize: 10, color: T.inkLight,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 14 }}>↔</span>
        Drag order bars to resequence production runs on the same work center
        {dragging && (
          <span style={{ color: T.purple, fontWeight: 600, marginLeft: 8 }}>
            Dragging... drop to resequence
          </span>
        )}
      </div>

      {/* ── Chart area ──────────────────────────────────────────────── */}
      <div ref={scrollRef} style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 700, position: 'relative' }}>
        <div style={{ display: 'flex', minWidth: LEFT_COL + chartW + 40 }}>

          {/* ── Fixed left column ───────────────────────────────────── */}
          <div style={{
            width: LEFT_COL, minWidth: LEFT_COL, flexShrink: 0,
            position: 'sticky', left: 0, zIndex: 3, background: T.white,
            borderRight: `1px solid ${T.border}`,
          }}>
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
                  borderBottom: `1px solid ${T.border}`, background: T.white,
                }}>
                  <div style={{ fontFamily: T.fontHeading, fontSize: 12, fontWeight: 600, color: T.ink }}>{row.name}</div>
                  <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.inkLight, marginTop: 2 }}>{row.code}</div>
                </div>
              );
            })}
          </div>

          {/* ── Chart body ──────────────────────────────────────────── */}
          <div style={{ flex: 1, position: 'relative' }}>

            {/* Time scale header */}
            <div style={{
              height: HEADER_H, position: 'sticky', top: 0, zIndex: 2,
              background: T.white, borderBottom: `1px solid ${T.border}`,
              display: 'flex', alignItems: 'flex-end',
            }}>
              {ticks.map(h => (
                <div key={h} style={{
                  position: 'absolute', left: h * z.pxPerHour, bottom: 4,
                  fontFamily: T.fontMono, fontSize: 9, color: T.inkLight,
                  transform: 'translateX(-50%)', whiteSpace: 'nowrap',
                }}>
                  {zoom === 'week' ? `Wk ${Math.floor(h / 168) + 1}` : dayLabel(h, horizonStart)}
                </div>
              ))}
              {zoom === 'shift' && subTicks.map(h => (
                <div key={`sub-${h}`} style={{
                  position: 'absolute', left: h * z.pxPerHour, top: 2,
                  fontFamily: T.fontMono, fontSize: 8, color: T.inkGhost,
                  transform: 'translateX(-50%)', whiteSpace: 'nowrap',
                }}>
                  {dayLabel(h, horizonStart)}
                </div>
              ))}
            </div>

            {/* Rows */}
            {allRows.map((row, rowIdx) => {
              if (row.type === 'stage') {
                return (
                  <div key={`stage-row-${rowIdx}`} style={{
                    height: ROW_H, background: T.bgDark, borderBottom: `1px solid ${T.border}`,
                    position: 'relative',
                  }}>
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
              const isDropRow = dropTarget?.wcCode === row.code;

              return (
                <div
                  key={`wc-row-${row.code}`}
                  className={isDropRow ? 'gantt-row-drop' : ''}
                  style={{
                    height: ROW_H, position: 'relative',
                    borderBottom: `1px solid ${T.border}`,
                    background: isDropRow ? 'rgba(37,99,235,0.04)' : T.white,
                    transition: 'background 0.1s',
                  }}
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
                    const x = (dt.startHr ?? dt.startTime ?? 0) * z.pxPerHour;
                    const dtEnd = dt.endHr ?? dt.endTime ?? 0;
                    const dtStart = dt.startHr ?? dt.startTime ?? 0;
                    const w = Math.max((dtEnd - dtStart) * z.pxPerHour, 8);
                    return (
                      <div key={`dt-${dtIdx}`} style={{
                        position: 'absolute', left: x, top: 6,
                        width: w, height: ROW_H - 12,
                        background: T.border, borderRadius: T.r1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 0,
                      }}>
                        <span style={{ fontFamily: T.fontMono, fontSize: 9, color: T.inkMid, fontWeight: 500 }}>
                          {dt.reason || dt.type || 'DOWN'}
                        </span>
                      </div>
                    );
                  })}

                  {/* Drop position indicator */}
                  {isDropRow && dropTarget.insertIdx != null && (() => {
                    const sorted = [...sortedOrders].filter(o => o.id !== dragging?.orderId);
                    const targetOrder = sorted[dropTarget.insertIdx];
                    const indicatorX = targetOrder
                      ? targetOrder.startTime * z.pxPerHour - 2
                      : (sorted.length > 0 ? sorted[sorted.length - 1].endTime * z.pxPerHour + 4 : 20);
                    return (
                      <div style={{
                        position: 'absolute', left: indicatorX, top: 2,
                        width: 3, height: ROW_H - 4,
                        background: T.blue, borderRadius: 2, zIndex: 5,
                        boxShadow: `0 0 8px ${T.blue}`,
                      }} />
                    );
                  })()}

                  {/* Order bars */}
                  {sortedOrders.map((order, oIdx) => {
                    const isDraggedOrder = dragging?.orderId === order.id;
                    const isComplete = order.status === 'complete';
                    const isRunning = order.status === 'running';
                    const isDelayed = order.status === 'delayed';

                    // If this is the dragged order, offset its position
                    let x = order.startTime * z.pxPerHour;
                    if (isDraggedOrder) x += dragDeltaHr * z.pxPerHour;
                    const w = Math.max((order.endTime - order.startTime) * z.pxPerHour, 6);

                    // Changeover indicator
                    const prevOrder = oIdx > 0 ? sortedOrders[oIdx - 1] : null;
                    const hasChangeover = order.changeover?.hours > 0 || (prevOrder && prevOrder.familyId !== order.familyId);
                    const changeoverHrs = order.changeover?.hours || 0.5;

                    return (
                      <div key={order.id}>
                        {/* Changeover amber bar */}
                        {hasChangeover && !isDraggedOrder && order.startTime > 0 && (
                          <div style={{
                            position: 'absolute',
                            left: order.startTime * z.pxPerHour - Math.max(changeoverHrs * z.pxPerHour, 2),
                            top: BAR_PAD, width: Math.max(changeoverHrs * z.pxPerHour, 2), height: BAR_H,
                            background: '#D97706', borderRadius: 1, opacity: 0.6, zIndex: 1,
                          }} />
                        )}

                        {/* Order bar */}
                        <div
                          className="gantt-bar"
                          onPointerDown={(e) => handlePointerDown(e, order, row.code, oIdx)}
                          title={[
                            `${order.id}: ${order.familyName}`,
                            `${order.qty} units | ${order.status}`,
                            `${Math.round(order.startTime * 10) / 10}h → ${Math.round(order.endTime * 10) / 10}h`,
                            isComplete ? '' : 'Drag to resequence',
                          ].filter(Boolean).join('\n')}
                          style={{
                            position: 'absolute',
                            left: x, top: BAR_PAD,
                            width: w, height: BAR_H,
                            background: order.brandColor || T.inkGhost,
                            borderRadius: T.r1,
                            opacity: isComplete ? 0.5 : isDraggedOrder ? 0.85 : 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            overflow: 'hidden', boxSizing: 'border-box',
                            borderLeft: isDelayed ? `3px solid ${T.risk}` : 'none',
                            border: isRunning ? `2px solid ${T.safe}` : isDraggedOrder ? `2px solid ${T.blue}` : 'none',
                            animation: isRunning ? 'pulse-running 2s ease-in-out infinite' : 'none',
                            transition: isDraggedOrder ? 'none' : 'opacity 0.15s',
                            zIndex: isDraggedOrder ? 10 : 2,
                            boxShadow: isDraggedOrder ? '0 4px 16px rgba(0,0,0,0.25)' : 'none',
                            transform: isDraggedOrder ? 'scale(1.03)' : 'none',
                          }}
                        >
                          {w > 40 && (
                            <span style={{
                              fontFamily: T.fontMono, fontSize: 11, fontWeight: 700,
                              color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden',
                              textOverflow: 'ellipsis', padding: '0 4px',
                              textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                              pointerEvents: 'none',
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
                      position: 'absolute', left: nowHour * z.pxPerHour, top: 0,
                      width: 0, height: ROW_H,
                      borderLeft: `2px dashed ${T.purple}`,
                      zIndex: 3, pointerEvents: 'none',
                    }} />
                  )}
                </div>
              );
            })}

            {/* NOW line in header */}
            {nowHour >= 0 && nowHour <= totalHours && (
              <div style={{
                position: 'absolute', left: nowHour * z.pxPerHour, top: 0,
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

      {/* ── Summary footer ──────────────────────────────────────────── */}
      {schedule.summary && (
        <div style={{
          display: 'flex', gap: T.sp4, padding: `${T.sp3}px ${T.sp4}px`,
          borderTop: `1px solid ${T.border}`, background: T.bgDark, flexWrap: 'wrap',
        }}>
          <SummaryChip label="Total Orders" value={schedule.summary.totalOrders} />
          <SummaryChip label="Running" value={schedule.summary.runningOrders} color={T.purple} />
          <SummaryChip label="Completed" value={schedule.summary.completedOrders} color={T.safe} />
          <SummaryChip label="Delayed" value={schedule.summary.delayedOrders} color={T.risk} />
          <SummaryChip label="Avg Utilization" value={`${Math.round(schedule.summary.avgUtilization)}%`} />
          <SummaryChip label="Changeover" value={`${schedule.summary.totalChangeoverHours}h`} color="#D97706" />
        </div>
      )}

      {/* ── Add Order Modal ─────────────────────────────────────────── */}
      {showAddModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}
        >
          <div style={{
            background: T.white, borderRadius: T.r4, padding: T.sp6,
            width: 420, maxWidth: '90vw', boxShadow: T.shadow3,
          }}>
            <div style={{ fontFamily: T.fontHeading, fontSize: 18, fontWeight: 700, marginBottom: T.sp4 }}>
              Add Production Order
            </div>

            {/* Product family */}
            <div style={{ marginBottom: T.sp3 }}>
              <label style={{ fontFamily: T.fontMono, fontSize: 10, color: T.inkLight, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 4 }}>
                Product Family
              </label>
              <select
                value={newOrder.familyId}
                onChange={e => setNewOrder(p => ({ ...p, familyId: e.target.value }))}
                style={{
                  width: '100%', padding: '10px 12px', border: `1px solid ${T.border}`,
                  borderRadius: T.r2, fontFamily: T.fontBody, fontSize: 14,
                  background: T.white, color: T.ink, outline: 'none',
                  cursor: 'pointer', minHeight: 44,
                }}
              >
                {FAMILIES.map(f => (
                  <option key={f.id} value={f.id}>{f.name} ({f.brand})</option>
                ))}
              </select>
            </div>

            {/* Quantity */}
            <div style={{ marginBottom: T.sp3 }}>
              <label style={{ fontFamily: T.fontMono, fontSize: 10, color: T.inkLight, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 4 }}>
                Quantity (units)
              </label>
              <input
                type="number" min="100" step="100"
                value={newOrder.qty}
                onChange={e => setNewOrder(p => ({ ...p, qty: e.target.value }))}
                style={{
                  width: '100%', padding: '10px 12px', border: `1px solid ${T.border}`,
                  borderRadius: T.r2, fontFamily: T.fontMono, fontSize: 16, fontWeight: 600,
                  background: T.white, color: T.ink, outline: 'none',
                  minHeight: 44, boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Work center (optional) */}
            <div style={{ marginBottom: T.sp3 }}>
              <label style={{ fontFamily: T.fontMono, fontSize: 10, color: T.inkLight, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 4 }}>
                Work Center (optional — auto-assigns if empty)
              </label>
              <select
                value={newOrder.workCenter}
                onChange={e => setNewOrder(p => ({ ...p, workCenter: e.target.value }))}
                style={{
                  width: '100%', padding: '10px 12px', border: `1px solid ${T.border}`,
                  borderRadius: T.r2, fontFamily: T.fontBody, fontSize: 14,
                  background: T.white, color: T.ink, outline: 'none',
                  cursor: 'pointer', minHeight: 44,
                }}
              >
                <option value="">Auto-assign (least loaded)</option>
                {allWorkCenters.map(wc => (
                  <option key={wc.code} value={wc.code}>{wc.name} ({wc.code})</option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div style={{ marginBottom: T.sp5 }}>
              <label style={{ fontFamily: T.fontMono, fontSize: 10, color: T.inkLight, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 4 }}>
                Priority
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['high', 'medium', 'normal'].map(p => (
                  <button key={p} onClick={() => setNewOrder(prev => ({ ...prev, priority: p }))}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: T.r2,
                      border: newOrder.priority === p ? 'none' : `1px solid ${T.border}`,
                      background: newOrder.priority === p ? (p === 'high' ? T.risk : p === 'medium' ? '#D97706' : T.safe) : T.white,
                      color: newOrder.priority === p ? T.white : T.ink,
                      fontFamily: T.fontMono, fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', textTransform: 'capitalize',
                      minHeight: 44, transition: 'all 0.12s',
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: T.sp3, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAddModal(false)} style={{
                padding: '10px 20px', borderRadius: T.r2,
                border: `1px solid ${T.border}`, background: T.white, color: T.ink,
                fontFamily: T.fontBody, fontSize: 13, cursor: 'pointer', minHeight: 44,
              }}>
                Cancel
              </button>
              <button onClick={handleAddOrderSubmit} style={{
                padding: '10px 28px', borderRadius: T.r2,
                border: 'none', background: T.purple, color: T.white,
                fontFamily: T.fontHeading, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', minHeight: 44,
                boxShadow: T.shadow2,
              }}>
                Add to Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Summary chip ─────────────────────────────────────────────────────────── */
function SummaryChip({ label, value, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: T.fontMono, fontSize: 11 }}>
      <span style={{ color: T.inkLight }}>{label}:</span>
      <span style={{ fontWeight: 700, color: color || T.ink }}>{value}</span>
    </div>
  );
}
