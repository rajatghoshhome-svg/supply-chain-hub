import { useMemo } from 'react';
import { T } from '../../styles/tokens';

/**
 * AccuracyChart — Grouped bar chart for forecast accuracy
 *
 * Three bars per period: stat forecast (blue), final forecast (green), actual (gray).
 * Summary KPI cards above: MAPE, Bias, Tracking Signal.
 * Pure SVG, no library dependency.
 */

const BAR_COLORS = {
  stat: T.modDemand,     // indigo
  final: T.safe,         // green
  actual: '#9CA3AF',     // gray
};

export default function AccuracyChart({ metrics, bars = [] }) {
  const { mape = 0, bias = 0, trackingSignal = 0, mad = 0 } = metrics || {};

  // Only show periods that have at least one non-null value
  const visibleBars = useMemo(() =>
    bars.filter(b => b.actual != null || b.stat != null || b.final != null),
  [bars]);

  const maxValue = useMemo(() => {
    let max = 0;
    for (const b of visibleBars) {
      if (b.actual != null && b.actual > max) max = b.actual;
      if (b.stat != null && b.stat > max) max = b.stat;
      if (b.final != null && b.final > max) max = b.final;
    }
    return max || 1;
  }, [visibleBars]);

  const chartWidth = Math.max(visibleBars.length * 24, 600);
  const chartHeight = 200;
  const padding = { top: 10, right: 20, bottom: 30, left: 50 };
  const plotW = chartWidth - padding.left - padding.right;
  const plotH = chartHeight - padding.top - padding.bottom;
  const groupWidth = plotW / Math.max(visibleBars.length, 1);
  const barWidth = Math.min(groupWidth * 0.25, 8);
  const barGap = 2;

  const yScale = (v) => plotH - (v / maxValue) * plotH;

  // Y-axis ticks
  const yTicks = useMemo(() => {
    const ticks = [];
    const step = maxValue > 5000 ? 2000 : maxValue > 1000 ? 500 : maxValue > 100 ? 100 : 20;
    for (let v = 0; v <= maxValue * 1.1; v += step) {
      ticks.push(v);
    }
    return ticks.slice(0, 6);
  }, [maxValue]);

  return (
    <div>
      {/* KPI cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <KpiCard label="MAPE" value={`${mape.toFixed(1)}%`} status={mape < 15 ? 'good' : mape < 30 ? 'warn' : 'bad'} />
        <KpiCard label="Bias" value={bias.toFixed(0)} status={Math.abs(bias) < 50 ? 'good' : Math.abs(bias) < 200 ? 'warn' : 'bad'} />
        <KpiCard label="Tracking Signal" value={trackingSignal.toFixed(1)} status={Math.abs(trackingSignal) < 4 ? 'good' : Math.abs(trackingSignal) < 8 ? 'warn' : 'bad'} />
        <KpiCard label="MAD" value={formatNum(mad)} status="neutral" />
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 8, paddingLeft: 4 }}>
        <Legend color={BAR_COLORS.actual} label="Actual" />
        <Legend color={BAR_COLORS.stat} label="Stat Forecast" />
        <Legend color={BAR_COLORS.final} label="Final Forecast" />
      </div>

      {/* Chart */}
      <div style={{
        background: T.white,
        border: `1px solid ${T.border}`,
        borderRadius: T.r3,
        overflow: 'auto',
        padding: '8px 0',
      }}>
        <svg width={chartWidth} height={chartHeight} style={{ display: 'block' }}>
          <g transform={`translate(${padding.left},${padding.top})`}>
            {/* Y-axis grid lines */}
            {yTicks.map(v => (
              <g key={v}>
                <line x1={0} y1={yScale(v)} x2={plotW} y2={yScale(v)} stroke={T.border} strokeDasharray="2,2" />
                <text x={-6} y={yScale(v) + 3} textAnchor="end" fontSize={9} fill={T.inkLight} fontFamily={T.fontMono}>
                  {formatNum(v)}
                </text>
              </g>
            ))}

            {/* Bars */}
            {visibleBars.map((b, i) => {
              const gx = i * groupWidth + groupWidth / 2;
              return (
                <g key={i}>
                  {/* Actual bar */}
                  {b.actual != null && (
                    <rect
                      x={gx - barWidth * 1.5 - barGap}
                      y={yScale(b.actual)}
                      width={barWidth}
                      height={plotH - yScale(b.actual)}
                      fill={BAR_COLORS.actual}
                      rx={1}
                    />
                  )}
                  {/* Stat forecast bar */}
                  {b.stat != null && (
                    <rect
                      x={gx - barWidth / 2}
                      y={yScale(b.stat)}
                      width={barWidth}
                      height={plotH - yScale(b.stat)}
                      fill={BAR_COLORS.stat}
                      rx={1}
                    />
                  )}
                  {/* Final forecast bar */}
                  {b.final != null && (
                    <rect
                      x={gx + barWidth / 2 + barGap}
                      y={yScale(b.final)}
                      width={barWidth}
                      height={plotH - yScale(b.final)}
                      fill={BAR_COLORS.final}
                      rx={1}
                    />
                  )}
                  {/* Period label */}
                  {i % 4 === 0 && (
                    <text x={gx} y={plotH + 14} textAnchor="middle" fontSize={8} fill={T.inkLight} fontFamily={T.fontMono}>
                      W{(b.period % 52) + 1}
                    </text>
                  )}
                </g>
              );
            })}

            {/* X-axis line */}
            <line x1={0} y1={plotH} x2={plotW} y2={plotH} stroke={T.border} />

            {/* Forecast boundary line */}
            {(() => {
              const historyCount = visibleBars.filter(b => b.actual != null).length;
              if (historyCount > 0 && historyCount < visibleBars.length) {
                const x = historyCount * groupWidth;
                return (
                  <g>
                    <line x1={x} y1={0} x2={x} y2={plotH} stroke={T.modDemand} strokeDasharray="4,3" strokeWidth={1.5} />
                    <text x={x + 4} y={12} fontSize={9} fill={T.modDemand} fontFamily={T.fontBody}>Forecast →</text>
                  </g>
                );
              }
              return null;
            })()}
          </g>
        </svg>
      </div>
    </div>
  );
}

function KpiCard({ label, value, status }) {
  const bg = status === 'good' ? T.safeBg : status === 'warn' ? T.warnBg : status === 'bad' ? T.riskBg : T.bg;
  const color = status === 'good' ? T.safe : status === 'warn' ? T.warn : status === 'bad' ? T.risk : T.ink;
  const borderColor = status === 'good' ? '#B7E4C7' : status === 'warn' ? T.warnBorder : status === 'bad' ? T.riskBorder : T.border;

  return (
    <div style={{
      background: bg,
      border: `1px solid ${borderColor}`,
      borderRadius: T.r3,
      padding: '8px 14px',
      minWidth: 90,
    }}>
      <div style={{ fontSize: 10, color: T.inkLight, fontFamily: T.fontBody, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color, fontFamily: T.fontMono }}>{value}</div>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
      <span style={{ fontSize: 11, color: T.inkMid, fontFamily: T.fontBody }}>{label}</span>
    </div>
  );
}

function formatNum(n) {
  if (n == null) return '';
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}
