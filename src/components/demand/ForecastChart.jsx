/**
 * SVG Forecast Chart
 *
 * Renders actual vs forecast demand as an SVG line chart.
 * No external charting library — matches the inline-style pattern.
 */

import { T } from '../../styles/tokens';

const CHART_WIDTH = 800;
const CHART_HEIGHT = 280;
const MARGIN = { top: 20, right: 30, bottom: 40, left: 55 };
const INNER_W = CHART_WIDTH - MARGIN.left - MARGIN.right;
const INNER_H = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;

export default function ForecastChart({ historyPeriods, historyDemand, forecastPeriods, forecastDemand, fitted, method }) {
  if (!historyDemand || historyDemand.length === 0) return null;

  const allValues = [
    ...historyDemand,
    ...(forecastDemand || []),
    ...(fitted || []).filter(v => v != null),
  ];
  const maxVal = Math.max(...allValues) * 1.15;
  const minVal = 0;

  const totalPeriods = historyDemand.length + (forecastDemand?.length || 0);

  function xScale(i) {
    return MARGIN.left + (i / (totalPeriods - 1)) * INNER_W;
  }

  function yScale(v) {
    return MARGIN.top + INNER_H - ((v - minVal) / (maxVal - minVal)) * INNER_H;
  }

  // Build paths
  function linePath(data, offset = 0) {
    return data
      .map((v, i) => (v != null ? `${i === 0 || data[i - 1] == null ? 'M' : 'L'} ${xScale(i + offset)} ${yScale(v)}` : ''))
      .filter(Boolean)
      .join(' ');
  }

  const historyPath = linePath(historyDemand, 0);
  const fittedPath = fitted ? linePath(fitted, 0) : '';
  const forecastPath = forecastDemand
    ? `M ${xScale(historyDemand.length - 1)} ${yScale(historyDemand[historyDemand.length - 1])} ` +
      forecastDemand.map((v, i) => `L ${xScale(historyDemand.length + i)} ${yScale(v)}`).join(' ')
    : '';

  // Y-axis ticks
  const yTicks = [];
  const tickCount = 5;
  for (let i = 0; i <= tickCount; i++) {
    const val = minVal + ((maxVal - minVal) * i) / tickCount;
    yTicks.push(val);
  }

  // X-axis labels (show every 8th period)
  const allPeriodLabels = [...(historyPeriods || []), ...(forecastPeriods || [])];
  const xLabelStep = Math.max(1, Math.floor(totalPeriods / 10));

  // Forecast divider line
  const dividerX = xScale(historyDemand.length - 1);

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label={`Forecast chart showing actual demand and ${method || 'forecast'} predictions`} style={{ width: '100%', maxWidth: CHART_WIDTH, height: 'auto' }}>
        {/* Grid lines */}
        {yTicks.map((val, i) => (
          <g key={i}>
            <line
              x1={MARGIN.left} y1={yScale(val)}
              x2={CHART_WIDTH - MARGIN.right} y2={yScale(val)}
              stroke={T.border} strokeWidth={0.5}
            />
            <text x={MARGIN.left - 8} y={yScale(val) + 4} textAnchor="end" fontSize={10} fill={T.inkLight} fontFamily="JetBrains Mono">
              {Math.round(val)}
            </text>
          </g>
        ))}

        {/* Forecast zone background */}
        {forecastDemand && (
          <rect
            x={dividerX} y={MARGIN.top}
            width={CHART_WIDTH - MARGIN.right - dividerX}
            height={INNER_H}
            fill={T.bgDark} opacity={0.5}
          />
        )}

        {/* Forecast divider */}
        {forecastDemand && (
          <line
            x1={dividerX} y1={MARGIN.top}
            x2={dividerX} y2={MARGIN.top + INNER_H}
            stroke={T.inkGhost} strokeWidth={1} strokeDasharray="4,3"
          />
        )}

        {/* Fitted line (dashed) */}
        {fittedPath && (
          <path d={fittedPath} fill="none" stroke={T.warn} strokeWidth={1.5} strokeDasharray="3,3" opacity={0.6} />
        )}

        {/* Actual demand line */}
        <path d={historyPath} fill="none" stroke={T.ink} strokeWidth={2} />

        {/* Forecast line */}
        {forecastPath && (
          <path d={forecastPath} fill="none" stroke={T.accent} strokeWidth={2} strokeDasharray="6,3" />
        )}

        {/* Dots on actuals */}
        {historyDemand.map((v, i) => (
          <circle key={`h-${i}`} cx={xScale(i)} cy={yScale(v)} r={2} fill={T.ink} />
        ))}

        {/* Dots on forecast */}
        {forecastDemand?.map((v, i) => (
          <circle key={`f-${i}`} cx={xScale(historyDemand.length + i)} cy={yScale(v)} r={3} fill={T.accent} />
        ))}

        {/* X-axis labels */}
        {allPeriodLabels.map((label, i) => {
          if (i % xLabelStep !== 0) return null;
          return (
            <text key={i} x={xScale(i)} y={CHART_HEIGHT - 8} textAnchor="middle" fontSize={9} fill={T.inkLight} fontFamily="JetBrains Mono">
              {label?.slice(5) /* show MM-DD */}
            </text>
          );
        })}

        {/* Labels */}
        {forecastDemand && (
          <text x={dividerX + 6} y={MARGIN.top + 14} fontSize={10} fill={T.accent} fontFamily="Inter" fontWeight={500}>
            Forecast →
          </text>
        )}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, padding: '8px 0', fontSize: 11, color: T.inkMid }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 20, height: 2, background: T.ink, display: 'inline-block' }} /> Actual
        </span>
        {fitted && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 20, height: 2, background: T.warn, display: 'inline-block', borderTop: '1px dashed' }} /> Fitted ({method})
          </span>
        )}
        {forecastDemand && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 20, height: 2, background: T.accent, display: 'inline-block', borderTop: '1px dashed' }} /> Forecast
          </span>
        )}
      </div>
    </div>
  );
}
