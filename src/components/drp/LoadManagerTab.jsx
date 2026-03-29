import { useState, useCallback } from 'react';
import { T } from '../../styles/tokens';
import Card from '../shared/Card';
import LaneSelector from '../shared/LaneSelector';
import ShipmentCard from '../shared/ShipmentCard';
import LoadSlot from '../shared/LoadSlot';
import TransitTypePill from '../shared/TransitTypePill';

const API = '/api/drp';

export default function LoadManagerTab({ shipmentData, onRefresh }) {
  const [activeLane, setActiveLane] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [localShipmentData, setLocalShipmentData] = useState(null);

  // Use local state so client-side mutations persist
  const effectiveData = localShipmentData || shipmentData;

  const handleSelectShipment = useCallback((shipment) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(shipment.id)) next.delete(shipment.id);
      else next.add(shipment.id);
      return next;
    });
  }, []);

  const handleShiftClick = useCallback((shipment) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.add(shipment.id);
      return next;
    });
  }, []);

  if (!effectiveData) return <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>Loading...</div>;

  const { shipments = [], pendingLoads = [], committedLoads = [] } = effectiveData;

  // Build lane list from shipments
  const laneMap = {};
  for (const s of shipments) {
    if (!laneMap[s.laneKey]) {
      laneMap[s.laneKey] = { id: s.laneKey, from: s.fromCode, to: s.toCode, type: 'plant', count: 0 };
    }
    laneMap[s.laneKey].count++;
  }
  const lanes = Object.values(laneMap);

  // Use first lane if none selected
  const currentLane = activeLane || lanes[0]?.id || null;
  const filtered = currentLane ? shipments.filter(s => s.laneKey === currentLane) : shipments;

  const combineLocally = (ids) => {
    const src = localShipmentData || shipmentData;
    if (!src) return;
    const combined = src.shipments.filter(s => ids.has(s.id));
    if (combined.length === 0) return;
    const loadId = `LOAD-${Date.now()}`;
    const totalWeight = combined.reduce((s, sh) => s + (sh.weight || sh.weightLbs || 0), 0);
    const totalPallets = combined.reduce((s, sh) => s + (sh.pallets || 0), 0);
    const FTL_WEIGHT = 40000;
    const FTL_PALLETS = 26;
    const newLoad = {
      id: loadId, laneKey: combined[0].laneKey, fromCode: combined[0].fromCode, toCode: combined[0].toCode,
      shipments: combined, totalWeight, totalPallets, status: 'pending',
      weightPct: Math.round((totalWeight / FTL_WEIGHT) * 100),
      palletPct: Math.round((totalPallets / FTL_PALLETS) * 100),
      createdAt: new Date().toISOString(),
    };
    setLocalShipmentData({
      shipments: src.shipments.filter(s => !ids.has(s.id)),
      pendingLoads: [...(src.pendingLoads || []), newLoad],
      committedLoads: src.committedLoads || [],
    });
    setSelectedIds(new Set());
  };

  const handleCombineSelected = async () => {
    if (selectedIds.size === 0) return;
    combineLocally(selectedIds);
    try {
      await fetch(`${API}/combine-shipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipmentIds: [...selectedIds] }),
      });
    } catch { /* API unavailable, local state handles it */ }
  };

  const handleDropOnLoad = async (shipmentId) => {
    const ids = selectedIds.has(shipmentId) ? selectedIds : new Set([shipmentId]);
    combineLocally(ids);
    try {
      await fetch(`${API}/combine-shipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipmentIds: [...ids] }),
      });
    } catch { /* API unavailable */ }
  };

  const handleCommitLoad = async (load) => {
    const src = localShipmentData || shipmentData;
    if (!src) return;
    setLocalShipmentData({
      shipments: src.shipments,
      pendingLoads: (src.pendingLoads || []).filter(l => l.id !== load.id),
      committedLoads: [...(src.committedLoads || []), { ...load, status: 'committed', committedAt: new Date().toISOString() }],
    });
    try {
      await fetch(`${API}/commit-load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loadId: load.id }),
      });
    } catch { /* API unavailable */ }
  };

  const handleRemoveLoad = async (load) => {
    const src = localShipmentData || shipmentData;
    if (!src) return;
    // Return shipments back to available pool
    const returnedShipments = load.shipments || [];
    setLocalShipmentData({
      shipments: [...src.shipments, ...returnedShipments],
      pendingLoads: (src.pendingLoads || []).filter(l => l.id !== load.id),
      committedLoads: src.committedLoads || [],
    });
    try {
      await fetch(`${API}/pending-load/${load.id}`, { method: 'DELETE' });
    } catch { /* API unavailable */ }
  };

  // Selected shipments stats
  const selectedShipments = filtered.filter(s => selectedIds.has(s.id));
  const selWeight = selectedShipments.reduce((s, sh) => s + sh.weightLbs, 0);
  const selPallets = selectedShipments.reduce((s, sh) => s + sh.pallets, 0);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 40px' }}>
      {error && (
        <div style={{
          background: T.riskBg, border: `1px solid ${T.riskBorder}`, borderRadius: 6,
          padding: '8px 14px', marginBottom: 12, fontSize: 12, color: T.risk,
        }}>
          {error}
          <button onClick={() => setError(null)} style={{
            float: 'right', background: 'none', border: 'none', color: T.risk,
            cursor: 'pointer', fontSize: 12,
          }}>✕</button>
        </div>
      )}

      {/* Recommendations pool */}
      <Card title={`Recommended Shipments (${filtered.length})`}>
        <LaneSelector
          lanes={lanes.map(l => ({ ...l, from: l.from, to: l.to }))}
          activeLane={currentLane}
          onSelect={id => { setActiveLane(id); setSelectedIds(new Set()); }}
        />

        {/* Selection bar */}
        {selectedIds.size > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
            background: T.safeBg, borderRadius: 6, marginBottom: 12,
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: T.safe }}>
              {selectedIds.size} selected
            </span>
            <span style={{ fontSize: 11, color: T.inkMid, fontFamily: T.fontMono }}>
              {selWeight.toLocaleString()} lbs · {selPallets} pallets
              {selWeight > 40000 && <span style={{ color: T.risk, marginLeft: 6 }}>⚠ Over FTL limit</span>}
            </span>
            <button
              onClick={handleCombineSelected}
              disabled={busy || selectedIds.size < 2}
              style={{
                marginLeft: 'auto', background: T.modDrp, color: T.white,
                border: 'none', borderRadius: 4, padding: '5px 14px',
                fontSize: 11, fontWeight: 600, cursor: busy ? 'wait' : 'pointer',
                opacity: (busy || selectedIds.size < 2) ? 0.5 : 1,
              }}
            >
              Combine into Load
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              style={{
                background: 'none', border: `1px solid ${T.border}`, borderRadius: 4,
                padding: '5px 10px', fontSize: 11, cursor: 'pointer', color: T.inkMid,
              }}
            >
              Clear
            </button>
          </div>
        )}

        {/* Shipment grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 8, maxHeight: 400, overflowY: 'auto', paddingRight: 4,
        }}>
          {filtered.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', padding: 30, textAlign: 'center', color: T.inkLight, fontSize: 13 }}>
              No recommended shipments for this lane
            </div>
          ) : filtered.map(s => (
            <ShipmentCard
              key={s.id}
              shipment={{ ...s, product: s.skuName, weight: s.weightLbs }}
              selected={selectedIds.has(s.id)}
              onClick={handleSelectShipment}
              onShiftClick={handleShiftClick}
              draggable
            />
          ))}
        </div>

        {filtered.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 10, color: T.inkLight, fontFamily: T.fontBody }}>
            Click to select · Shift+click to multi-select · Drag to load slot below
          </div>
        )}
      </Card>

      {/* Load building area */}
      <Card title={`Pending Loads (${pendingLoads.length})`} style={{ marginTop: 16 }}>
        {pendingLoads.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: T.inkLight, fontSize: 12, border: `1.5px dashed ${T.border}`, borderRadius: 8 }}>
            Select shipments above and click "Combine into Load" to create pending loads
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 10 }}>
            {pendingLoads.map(load => (
              <div key={load.id} style={{ background: T.white, border: `1.5px dashed ${T.border}`, borderRadius: 8, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontFamily: T.fontMono, fontSize: 12, fontWeight: 600 }}>{load.id}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <TransitTypePill type={load.classification || 'Partial'} />
                    <TransitTypePill type={load.transitType || 'truck'} />
                  </div>
                </div>
                <div style={{ fontSize: 11, color: T.inkMid, marginBottom: 4 }}>
                  {load.fromCode} → {load.toCode}
                </div>

                {/* Capacity gauge */}
                <div style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.inkMid, marginBottom: 2 }}>
                    <span>Weight: {load.totalWeight?.toLocaleString()} lbs</span>
                    <span>{load.weightPct}%</span>
                  </div>
                  <div style={{ height: 4, background: T.bgDark, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${Math.min(load.weightPct || 0, 100)}%`,
                      background: (load.weightPct || 0) > 95 ? T.risk : (load.weightPct || 0) > 75 ? T.warn : T.safe,
                      borderRadius: 2,
                    }} />
                  </div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.inkMid, marginBottom: 2 }}>
                    <span>Pallets: {load.totalPallets}</span>
                    <span>{load.palletPct}%</span>
                  </div>
                  <div style={{ height: 4, background: T.bgDark, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${Math.min(load.palletPct || 0, 100)}%`,
                      background: (load.palletPct || 0) > 95 ? T.risk : (load.palletPct || 0) > 75 ? T.warn : T.safe,
                      borderRadius: 2,
                    }} />
                  </div>
                </div>

                {/* Shipments in load */}
                <div style={{ fontSize: 10, color: T.inkMid, marginBottom: 6 }}>
                  {load.shipments?.map(s => s.skuName).join(', ') || `${load.shipmentIds?.length || 0} shipments`}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => handleCommitLoad(load)} disabled={busy} style={{
                    flex: 1, background: T.safe, color: T.white, border: 'none', borderRadius: 4,
                    padding: '6px 0', fontSize: 11, fontWeight: 600, cursor: busy ? 'wait' : 'pointer',
                  }}>
                    Commit Load
                  </button>
                  <button onClick={() => handleRemoveLoad(load)} disabled={busy} style={{
                    flex: 1, background: 'none', color: T.risk, border: `1px solid ${T.riskBorder}`,
                    borderRadius: 4, padding: '6px 0', fontSize: 11, cursor: busy ? 'wait' : 'pointer',
                  }}>
                    Uncombine
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Committed loads */}
      {committedLoads.length > 0 && (
        <Card title={`Committed Loads (${committedLoads.length})`} style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {committedLoads.map(load => (
              <div key={load.id} style={{
                background: T.safeBg, border: `1px solid ${T.safe}`, borderRadius: 8, padding: 12,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontFamily: T.fontMono, fontSize: 12, fontWeight: 600 }}>{load.id}</span>
                  <span style={{ fontSize: 10, color: T.safe, fontWeight: 600, fontFamily: T.fontMono }}>✓ COMMITTED</span>
                </div>
                <div style={{ fontSize: 11, color: T.inkMid, marginBottom: 2 }}>
                  {load.fromCode} → {load.toCode} · {load.totalWeight?.toLocaleString()} lbs · {load.totalPallets} pallets
                </div>
                <div style={{ fontSize: 10, color: T.inkLight, fontFamily: T.fontMono }}>
                  {load.committedAt ? new Date(load.committedAt).toLocaleString() : ''}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
