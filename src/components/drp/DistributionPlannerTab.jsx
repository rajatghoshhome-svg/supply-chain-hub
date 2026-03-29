import { useState } from 'react';
import { T } from '../../styles/tokens';
import Card from '../shared/Card';
import TransitTypePill from '../shared/TransitTypePill';

const DAY_NAMES = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function DistributionPlannerTab({ plan, onUpdateSplit, onUpdateCalendar }) {
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');

  if (!plan) return <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>Loading...</div>;

  const { summary, lanes, demandSplits, calendars, dcInventory } = plan;
  const dcCodes = Object.keys(dcInventory || {});
  const plantLanes = (lanes || []).filter(l => l.mode !== 'STO');
  const stoLanes = (lanes || []).filter(l => l.mode === 'STO');

  // ── Lane summary cards ──
  const LaneCards = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 20 }}>
      {plantLanes.map(lane => {
        const cal = calendars?.[lane.laneKey];
        const shipDayStr = cal?.shipDays?.map(d => DAY_NAMES[d] || d).join(', ') || '—';
        return (
          <div key={lane.laneKey} style={{
            background: T.white, border: `1px solid ${T.border}`, borderRadius: 8, padding: 14,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontFamily: T.fontMono, fontSize: 12, fontWeight: 600, color: T.ink }}>
                {lane.from} → {lane.to}
              </span>
              <TransitTypePill type={lane.recommendedTransitType || 'truck'} />
            </div>
            <div style={{ fontSize: 11, color: T.inkMid, fontFamily: T.fontBody, marginBottom: 4 }}>
              {lane.distanceMiles?.toLocaleString() || '—'} mi · {lane.leadTimeDays || '—'} days transit
            </div>
            <div style={{ fontSize: 11, color: T.inkMid, fontFamily: T.fontBody, marginBottom: 4 }}>
              Ship days: {shipDayStr} ({cal?.frequency || '—'})
            </div>
            <div style={{ fontSize: 11, fontFamily: T.fontMono, color: T.modDrp, fontWeight: 600 }}>
              {lane.shipmentCount || 0} open shipments
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── STO lanes ──
  const STOCards = () => stoLanes.length > 0 ? (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10, marginBottom: 20 }}>
      {stoLanes.map(lane => (
        <div key={lane.laneKey} style={{
          background: T.white, border: `1px solid ${T.border}`, borderRadius: 8, padding: 12,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 600 }}>
              {lane.from} ↔ {lane.to}
            </span>
            <TransitTypePill type="STO" />
          </div>
          <div style={{ fontSize: 11, color: T.inkMid }}>
            {lane.distanceMiles?.toLocaleString()} mi · {lane.leadTimeDays}d
          </div>
        </div>
      ))}
    </div>
  ) : null;

  // ── Demand split table ──
  const familyIds = Object.keys(demandSplits || {});

  const handleStartEdit = (familyId, dc) => {
    const val = demandSplits[familyId]?.[dc];
    setEditingCell(`${familyId}|${dc}`);
    setEditValue(String(Math.round((val || 0) * 100)));
  };

  const handleSaveEdit = (familyId, dc) => {
    const pct = parseFloat(editValue) / 100;
    if (isNaN(pct) || pct < 0 || pct > 1) {
      setEditingCell(null);
      return;
    }
    const newAllocations = { ...(demandSplits[familyId] || {}) };
    newAllocations[dc] = pct;
    // Normalize
    const total = Object.values(newAllocations).reduce((s, v) => s + v, 0);
    if (total > 0) {
      for (const k of Object.keys(newAllocations)) {
        newAllocations[k] = Math.round((newAllocations[k] / total) * 100) / 100;
      }
    }
    if (onUpdateSplit) onUpdateSplit(familyId, newAllocations);
    setEditingCell(null);
  };

  const DemandSplitTable = () => (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: T.fontBody }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${T.border}` }}>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: T.inkMid, fontWeight: 600 }}>Product Family</th>
            {dcCodes.map(dc => (
              <th key={dc} style={{ textAlign: 'center', padding: '8px 12px', color: T.inkMid, fontWeight: 600, fontFamily: T.fontMono, fontSize: 11 }}>{dc}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {familyIds.map(famId => (
            <tr key={famId} style={{ borderBottom: `1px solid ${T.border}` }}>
              <td style={{ padding: '8px 12px', fontWeight: 500 }}>{famId}</td>
              {dcCodes.map(dc => {
                const cellKey = `${famId}|${dc}`;
                const val = demandSplits[famId]?.[dc] || 0;
                const isEditing = editingCell === cellKey;
                return (
                  <td key={dc} style={{ textAlign: 'center', padding: '6px 8px' }}>
                    {isEditing ? (
                      <input
                        autoFocus
                        type="number"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={() => handleSaveEdit(famId, dc)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(famId, dc); if (e.key === 'Escape') setEditingCell(null); }}
                        style={{
                          width: 48, textAlign: 'center', border: `1.5px solid ${T.modDrp}`,
                          borderRadius: 4, padding: '3px 4px', fontSize: 12, fontFamily: T.fontMono,
                          outline: 'none',
                        }}
                      />
                    ) : (
                      <span
                        onClick={() => handleStartEdit(famId, dc)}
                        style={{
                          cursor: 'pointer', padding: '3px 8px', borderRadius: 4,
                          fontFamily: T.fontMono, fontSize: 12,
                          background: val > 0.4 ? T.safeBg : val < 0.2 ? T.riskBg : 'transparent',
                          color: T.ink,
                        }}
                      >
                        {Math.round(val * 100)}%
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // ── Shipping calendars ──
  const calendarKeys = Object.keys(calendars || {});

  const handleToggleDay = (laneKey, day) => {
    const cal = calendars[laneKey];
    if (!cal) return;
    const days = [...(cal.shipDays || [])];
    const idx = days.indexOf(day);
    if (idx >= 0) days.splice(idx, 1);
    else days.push(day);
    days.sort((a, b) => a - b);
    const freq = days.length > 0 ? `${days.length}x/week` : 'None';
    if (onUpdateCalendar) onUpdateCalendar(laneKey, { shipDays: days, frequency: freq });
  };

  const CalendarPanel = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
      {calendarKeys.map(laneKey => {
        const cal = calendars[laneKey];
        const [from, to] = laneKey.split('|');
        return (
          <div key={laneKey} style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 8, padding: 12 }}>
            <div style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 600, marginBottom: 8, color: T.ink }}>
              {from} → {to}
            </div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
              {[1, 2, 3, 4, 5, 6].map(d => {
                const active = cal?.shipDays?.includes(d);
                return (
                  <button
                    key={d}
                    onClick={() => handleToggleDay(laneKey, d)}
                    style={{
                      width: 36, height: 28, border: `1px solid ${active ? T.modDrp : T.border}`,
                      borderRadius: 4, background: active ? T.modDrp : T.white,
                      color: active ? T.white : T.inkMid, fontSize: 10, fontFamily: T.fontMono,
                      fontWeight: active ? 600 : 400, cursor: 'pointer',
                    }}
                  >
                    {DAY_NAMES[d]}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 10, color: T.inkLight, fontFamily: T.fontMono }}>
              {cal?.frequency || '—'} · {cal?.transitDays || '—'}d transit
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── DC inventory summary ──
  const DCInventoryTable = () => (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: T.fontBody }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${T.border}` }}>
            <th style={{ textAlign: 'left', padding: '6px 10px', color: T.inkMid, fontWeight: 600 }}>DC</th>
            <th style={{ textAlign: 'right', padding: '6px 10px', color: T.inkMid, fontWeight: 600 }}>SKUs</th>
            <th style={{ textAlign: 'right', padding: '6px 10px', color: T.inkMid, fontWeight: 600 }}>Total OH</th>
            <th style={{ textAlign: 'right', padding: '6px 10px', color: T.inkMid, fontWeight: 600 }}>Below SS</th>
            <th style={{ textAlign: 'right', padding: '6px 10px', color: T.inkMid, fontWeight: 600 }}>Avg DOH</th>
          </tr>
        </thead>
        <tbody>
          {dcCodes.map(dc => {
            const inv = dcInventory[dc] || {};
            const skuKeys = Object.keys(inv);
            const totalOH = skuKeys.reduce((s, k) => s + (inv[k].onHand || 0), 0);
            const belowSS = skuKeys.filter(k => inv[k].onHand < inv[k].safetyStock).length;
            const avgDOH = skuKeys.length > 0
              ? Math.round(skuKeys.reduce((s, k) => s + (inv[k].daysOfSupply || 0), 0) / skuKeys.length)
              : 0;
            return (
              <tr key={dc} style={{ borderBottom: `1px solid ${T.border}` }}>
                <td style={{ padding: '6px 10px', fontFamily: T.fontMono, fontWeight: 600 }}>{dc}</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: T.fontMono }}>{skuKeys.length}</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: T.fontMono }}>{totalOH.toLocaleString()}</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: T.fontMono, color: belowSS > 0 ? T.risk : T.safe }}>{belowSS}</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: T.fontMono }}>{avgDOH}d</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 40px' }}>
      {/* KPI header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Open Shipments', value: summary?.recommendedShipments || 0 },
          { label: 'Pending Loads', value: summary?.pendingLoads || 0 },
          { label: 'Committed Loads', value: summary?.committedLoads || 0 },
          { label: 'Move/Make Open', value: summary?.moveVsMakeScenarios || 0 },
          { label: 'Total Weight', value: `${((summary?.totalWeight || 0) / 1000).toFixed(0)}k lbs` },
        ].map(kpi => (
          <div key={kpi.label} style={{
            background: T.white, border: `1px solid ${T.border}`, borderRadius: 8,
            padding: '12px 14px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: T.fontMono, color: T.ink }}>{kpi.value}</div>
            <div style={{ fontSize: 10, color: T.inkMid, fontFamily: T.fontBody, marginTop: 2 }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Lane summary */}
      <Card title="Plant → DC Lanes">
        <LaneCards />
      </Card>

      {/* STO Lanes */}
      {stoLanes.length > 0 && (
        <Card title="DC-to-DC Transfer Lanes (STO)" style={{ marginTop: 16 }}>
          <STOCards />
        </Card>
      )}

      {/* DC Inventory */}
      <Card title="DC Inventory Position" style={{ marginTop: 16 }}>
        <DCInventoryTable />
      </Card>

      {/* Demand Splits */}
      <Card title="Demand Split by Product Family" style={{ marginTop: 16 }}>
        <div style={{ fontSize: 11, color: T.inkLight, marginBottom: 8, fontFamily: T.fontBody }}>
          Click any percentage cell to edit. Values auto-normalize to 100%.
        </div>
        <DemandSplitTable />
      </Card>

      {/* Shipping Calendars */}
      <Card title="Shipping Calendars" style={{ marginTop: 16 }}>
        <div style={{ fontSize: 11, color: T.inkLight, marginBottom: 8, fontFamily: T.fontBody }}>
          Toggle days to set shipping schedule per lane.
        </div>
        <CalendarPanel />
      </Card>
    </div>
  );
}
