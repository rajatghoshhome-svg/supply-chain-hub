import { useState, useRef, useCallback, useMemo } from 'react';
import { T } from '../../styles/tokens';

/**
 * PlanningGrid — Scrollable planning spreadsheet
 *
 * Frozen left columns (label + total) next to scrollable period columns.
 * Row types: History (gray), Stat Forecast (blue tint), Final Forecast (editable).
 */

export default function PlanningGrid({
  historyPeriods = [],
  forecastPeriods = [],
  history = [],
  statForecast = [],
  finalForecast = [],
  readOnly = false,
  onOverride,
  level,
  skuCount = 0,
}) {
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');

  // Build period labels
  const allPeriods = useMemo(() => {
    const periods = [];
    for (let i = 0; i < historyPeriods.length; i++) {
      const d = new Date(historyPeriods[i] + 'T00:00:00');
      periods.push({
        date: historyPeriods[i],
        label: `W${(i % 52) + 1}`,
        month: d.toLocaleString('en', { month: 'short' }),
        year: d.getFullYear(),
        isHistory: true,
        index: i,
      });
    }
    for (let i = 0; i < forecastPeriods.length; i++) {
      const d = new Date(forecastPeriods[i] + 'T00:00:00');
      periods.push({
        date: forecastPeriods[i],
        label: `W${((historyPeriods.length + i) % 52) + 1}`,
        month: d.toLocaleString('en', { month: 'short' }),
        year: d.getFullYear(),
        isHistory: false,
        index: i,
      });
    }
    return periods;
  }, [historyPeriods, forecastPeriods]);

  // Month groups for header
  const monthGroups = useMemo(() => {
    const groups = [];
    let current = null;
    for (const p of allPeriods) {
      const key = `${p.year}-${p.month}`;
      if (!current || current.key !== key) {
        current = { key, label: `${p.month} ${p.year}`, count: 0, isHistory: p.isHistory };
        groups.push(current);
      }
      current.count++;
    }
    return groups;
  }, [allPeriods]);

  // Data rows
  const rows = useMemo(() => {
    const r = [];
    r.push({
      id: 'history', label: 'Actuals / History', type: 'history',
      values: history, offset: 0,
      total: history.reduce((s, v) => s + v, 0),
    });
    if (statForecast.length > 0) {
      r.push({
        id: 'stat', label: 'Statistical Forecast', type: 'stat',
        values: statForecast, offset: historyPeriods.length,
        total: statForecast.reduce((s, v) => s + v, 0),
      });
    }
    if (!readOnly) {
      r.push({
        id: 'final', label: 'Final Forecast', type: 'final',
        values: finalForecast, offset: historyPeriods.length,
        total: finalForecast.reduce((s, v) => s + v, 0),
      });
      const variance = statForecast.map((v, i) => (finalForecast[i] || 0) - v);
      r.push({
        id: 'variance', label: 'Variance', type: 'variance',
        values: variance, offset: historyPeriods.length,
        total: variance.reduce((s, v) => s + v, 0),
      });
    }
    return r;
  }, [history, statForecast, finalForecast, historyPeriods.length, readOnly]);

  const handleCellClick = useCallback((rowId, col) => {
    if (readOnly) return;
    const row = rows.find(r => r.id === rowId);
    if (!row || row.type !== 'final') return;
    const valueIndex = col - row.offset;
    if (valueIndex < 0 || valueIndex >= row.values.length) return;
    setEditingCell({ rowId, col });
    setEditValue(String(row.values[valueIndex]));
  }, [readOnly, rows]);

  const handleCellSave = useCallback(() => {
    if (!editingCell || !onOverride) return;
    const row = rows.find(r => r.id === editingCell.rowId);
    if (!row) return;
    const periodIndex = editingCell.col - row.offset;
    const newVal = parseInt(editValue);
    if (!isNaN(newVal)) onOverride(periodIndex, newVal);
    setEditingCell(null);
  }, [editingCell, editValue, onOverride, rows]);

  const COL_W = 58;
  const LABEL_W = 150;
  const TOTAL_W = 76;

  return (
    <div style={{ background: T.white, borderRadius: T.r3, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
      {/* Disaggregation notice */}
      {level && level !== 'sku' && !readOnly && (
        <div style={{
          background: T.warnBg, borderBottom: `1px solid ${T.warnBorder}`,
          padding: '6px 16px', fontSize: 11, color: T.warn, fontFamily: T.fontBody,
        }}>
          Editing at <strong>{level}</strong> level — changes will be disaggregated across {skuCount} SKU{skuCount !== 1 ? 's' : ''}
        </div>
      )}

      <div style={{ display: 'flex', overflow: 'hidden' }}>
        {/* ─── Frozen left columns ─── */}
        <div style={{ flexShrink: 0, borderRight: `2px solid ${T.borderMid}` }}>
          {/* Month header spacer */}
          <div style={{ height: 22, background: T.bgDark, borderBottom: `1px solid ${T.border}` }} />
          {/* Week header spacer */}
          <div style={{ height: 20, background: T.bg, borderBottom: `1px solid ${T.border}` }} />
          {/* Row labels */}
          {rows.map(row => (
            <div key={row.id} style={{ display: 'flex', height: 28 }}>
              <div style={{
                width: LABEL_W, display: 'flex', alignItems: 'center', padding: '0 10px',
                fontSize: 11, fontWeight: 500, fontFamily: T.fontBody,
                background: T.white, borderBottom: `1px solid ${T.border}`,
                color: row.type === 'history' ? T.inkMid : row.type === 'stat' ? T.modDemand : row.type === 'final' ? T.ink : T.inkLight,
              }}>
                {row.label}
              </div>
              <div style={{
                width: TOTAL_W, display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                padding: '0 8px', fontSize: 11, fontWeight: 600, fontFamily: T.fontMono,
                background: T.white, borderBottom: `1px solid ${T.border}`,
                color: T.ink,
              }}>
                {fmtNum(row.total)}
              </div>
            </div>
          ))}
        </div>

        {/* ─── Scrollable period columns ─── */}
        <div style={{ overflow: 'auto', flex: 1 }}>
          {/* Month headers */}
          <div style={{ display: 'flex', minWidth: allPeriods.length * COL_W }}>
            {monthGroups.map((mg, i) => (
              <div key={i} style={{
                width: mg.count * COL_W, textAlign: 'center', fontSize: 10, fontWeight: 500,
                padding: '4px 0', background: mg.isHistory ? T.bgDark : '#EEF0FF',
                borderBottom: `1px solid ${T.border}`, borderRight: `1px solid ${T.border}`,
                color: mg.isHistory ? T.inkMid : T.modDemand, fontFamily: T.fontBody,
                height: 22, boxSizing: 'border-box',
              }}>
                {mg.label}
              </div>
            ))}
          </div>
          {/* Week labels */}
          <div style={{ display: 'flex', minWidth: allPeriods.length * COL_W }}>
            {allPeriods.map((p, i) => (
              <div key={i} style={{
                width: COL_W, textAlign: 'center', fontSize: 9, padding: '3px 0',
                background: p.isHistory ? T.bg : '#F5F6FF',
                borderBottom: `1px solid ${T.border}`, borderRight: `1px solid ${T.border}`,
                color: T.inkLight, fontFamily: T.fontMono, height: 20, boxSizing: 'border-box',
              }}>
                {p.label}
              </div>
            ))}
          </div>
          {/* Data rows */}
          {rows.map(row => (
            <div key={row.id} style={{ display: 'flex', minWidth: allPeriods.length * COL_W }}>
              {allPeriods.map((p, colIdx) => {
                const isInRange = p.isHistory ? (row.type === 'history') : (row.type !== 'history');
                const valueIndex = isInRange ? p.index : -1;
                const value = isInRange && valueIndex >= 0 ? row.values[valueIndex] : null;
                const isEditing = editingCell?.rowId === row.id && editingCell?.col === colIdx;
                const isEditable = row.type === 'final' && !p.isHistory && !readOnly;
                const isVariance = row.type === 'variance';
                const hasOverride = row.type === 'final' && value != null &&
                  statForecast[p.index] != null && value !== statForecast[p.index] && !p.isHistory;

                return (
                  <div
                    key={colIdx}
                    onClick={() => isEditable ? handleCellClick(row.id, colIdx) : null}
                    style={{
                      width: COL_W, height: 28, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 11, fontFamily: T.fontMono,
                      borderBottom: `1px solid ${T.border}`, borderRight: `1px solid ${T.border}`,
                      cursor: isEditable ? 'pointer' : 'default',
                      background: isEditing ? '#FFF8E1' :
                        isVariance && value > 0 ? '#F0FFF4' : isVariance && value < 0 ? '#FFF5F5' :
                        hasOverride ? '#FFFCE5' :
                        row.type === 'history' ? T.bg : row.type === 'stat' ? '#F8F9FF' :
                        row.type === 'final' && !p.isHistory ? '#FAFBFF' : T.bg,
                      color: value === null ? T.inkGhost :
                        isVariance && value > 0 ? T.safe : isVariance && value < 0 ? T.risk : T.ink,
                      borderLeft: hasOverride ? `2px solid ${T.warn}` : 'none',
                      boxSizing: 'border-box',
                    }}
                  >
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={handleCellSave}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleCellSave();
                          if (e.key === 'Escape') setEditingCell(null);
                        }}
                        style={{
                          width: COL_W - 8, border: 'none', outline: 'none',
                          textAlign: 'center', fontSize: 11, fontFamily: T.fontMono, background: 'transparent',
                        }}
                      />
                    ) : (
                      value !== null ? fmtNum(value) : ''
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function fmtNum(n) {
  if (n == null) return '';
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}
