import { useState, useEffect } from 'react';
import { T } from '../styles/tokens';
import ModuleLayout from '../components/shared/ModuleLayout';
import PageHeader from '../components/shared/PageHeader';
import Card from '../components/shared/Card';
import TrustScore from '../components/TrustScore';

const TABS = [
  { id: 'psi', label: 'Production Plan' },
  { id: 'capacity', label: 'Capacity Utilization' },
  { id: 'strategy', label: 'Strategy Comparison' },
];

// Plant code to display name mapping
const PLANT_NAMES = {
  'PLT-PDX': 'Portland Plant',
  'PLT-ATX': 'Austin Plant',
  'PLT-NSH': 'Nashville Plant',
};

// Work center code to display name mapping
const WC_NAMES = {
  'WC-P-MIXING': 'Dry Mixing Line',
  'WC-P-BAKING': 'Baking/Forming Ovens',
  'WC-P-PACKING': 'Packaging & Case Packing',
  'WC-P-QC': 'Quality Control & Testing',
  'WC-A-BLENDING': 'Liquid Blending',
  'WC-A-FILLING': 'Bottle/Can Filling Line',
  'WC-A-PASTEUR': 'Pasteurization',
  'WC-A-PACKING': 'Case Packing',
  'WC-N-ROASTING': 'Nut Roasting',
  'WC-N-GRINDING': 'Grinding & Milling',
  'WC-N-BLENDING': 'Blending & Mixing',
  'WC-N-PACKING': 'Packaging',
};

// ─── Static fallback data (used when API is unavailable, e.g. Vercel) ────
const STATIC_PROD_PLAN = {
  periods: ['W13','W14','W15','W16','W17','W18'],
  plantsPlanned: 1, totalProductsPlanned: 3, strategy: 'chase',
  plantResults: [
    {
      plantCode: 'PLT-PDX', productsPlanned: 3,
      productPlans: [
        {
          skuCode: 'GRN-BAR', skuName: 'Oat & Honey Granola Bar',
          plantGrossReqs: [528,515,505,495,488,480],
          plan: {
            periods: ['W13','W14','W15','W16','W17','W18'],
            demand: [528,515,505,495,488,480],
            strategies: {
              chase: { production: [528,515,505,495,488,480], endingInventory: [0,0,0,0,0,0], workforce: [22,21,21,20,20,20], totalCost: 56800,
                rccp: [
                  { code: 'WC-P-MIXING', hoursPerUnit: 0.12, capacityHoursPerPeriod: 160, loadHours: [63,62,61,59,59,58], utilization: [40,39,38,37,37,36], overloaded: [false,false,false,false,false,false] },
                  { code: 'WC-P-BAKING', hoursPerUnit: 0.18, capacityHoursPerPeriod: 140, loadHours: [95,93,91,89,88,86], utilization: [68,66,65,64,63,62], overloaded: [false,false,false,false,false,false] },
                ] },
              level: { production: [502,502,502,502,502,502], endingInventory: [-26,13,10,17,31,53], workforce: [21,21,21,21,21,21], totalCost: 54200,
                rccp: [
                  { code: 'WC-P-MIXING', hoursPerUnit: 0.12, capacityHoursPerPeriod: 160, loadHours: [60,60,60,60,60,60], utilization: [38,38,38,38,38,38], overloaded: [false,false,false,false,false,false] },
                ] },
              hybrid: { production: [520,510,505,500,490,485], endingInventory: [-8,3,3,8,10,15], workforce: [22,21,21,21,20,20], totalCost: 55400,
                rccp: [
                  { code: 'WC-P-MIXING', hoursPerUnit: 0.12, capacityHoursPerPeriod: 160, loadHours: [62,61,61,60,59,58], utilization: [39,38,38,38,37,36], overloaded: [false,false,false,false,false,false] },
                ] },
            },
            capacity: {
              workCenters: [
                { name: 'Dry Mixing Line', available: 160, used: 63, utilization: 0.394 },
                { name: 'Baking/Forming Ovens', available: 140, used: 95, utilization: 0.679 },
                { name: 'Packaging & Case Packing', available: 180, used: 72, utilization: 0.400 },
              ],
            },
          },
        },
        {
          skuCode: 'PRO-BAR', skuName: 'Peanut Butter Protein Bar',
          plantGrossReqs: [395,385,375,368,360,352],
          plan: {
            periods: ['W13','W14','W15','W16','W17','W18'],
            demand: [395,385,375,368,360,352],
            strategies: {
              chase: { production: [395,385,375,368,360,352], endingInventory: [0,0,0,0,0,0], workforce: [16,16,15,15,15,14], totalCost: 52100,
                rccp: [{ code: 'WC-P-BAKING', hoursPerUnit: 0.20, capacityHoursPerPeriod: 140, loadHours: [79,77,75,74,72,70], utilization: [56,55,54,53,51,50], overloaded: [false,false,false,false,false,false] }] },
              level: { production: [373,373,373,373,373,373], endingInventory: [-22,12,10,15,28,49], workforce: [15,15,15,15,15,15], totalCost: 50600,
                rccp: [{ code: 'WC-P-BAKING', hoursPerUnit: 0.20, capacityHoursPerPeriod: 140, loadHours: [75,75,75,75,75,75], utilization: [53,53,53,53,53,53], overloaded: [false,false,false,false,false,false] }] },
              hybrid: { production: [390,380,375,370,362,355], endingInventory: [-5,0,0,2,4,7], workforce: [16,16,15,15,15,15], totalCost: 51200,
                rccp: [{ code: 'WC-P-BAKING', hoursPerUnit: 0.20, capacityHoursPerPeriod: 140, loadHours: [78,76,75,74,72,71], utilization: [56,54,54,53,52,51], overloaded: [false,false,false,false,false,false] }] },
            },
            capacity: { workCenters: [
              { name: 'Baking/Forming Ovens', available: 140, used: 79, utilization: 0.564 },
            ]},
          },
        },
        {
          skuCode: 'TRL-MIX', skuName: 'Classic Trail Mix',
          plantGrossReqs: [378,367,358,350,340,332],
          plan: {
            periods: ['W13','W14','W15','W16','W17','W18'],
            demand: [378,367,358,350,340,332],
            strategies: {
              chase: { production: [378,367,358,350,340,332], endingInventory: [0,0,0,0,0,0], workforce: [12,12,11,11,11,11], totalCost: 63200,
                rccp: [{ code: 'WC-P-MIXING', hoursPerUnit: 0.15, capacityHoursPerPeriod: 160, loadHours: [57,55,54,53,51,50], utilization: [35,34,34,33,32,31], overloaded: [false,false,false,false,false,false] }] },
              level: { production: [354,354,354,354,354,354], endingInventory: [-24,13,9,13,27,49], workforce: [11,11,11,11,11,11], totalCost: 61500,
                rccp: [{ code: 'WC-P-MIXING', hoursPerUnit: 0.15, capacityHoursPerPeriod: 160, loadHours: [53,53,53,53,53,53], utilization: [33,33,33,33,33,33], overloaded: [false,false,false,false,false,false] }] },
              hybrid: { production: [375,365,358,352,342,335], endingInventory: [-3,1,1,3,5,8], workforce: [12,12,11,11,11,11], totalCost: 62400,
                rccp: [{ code: 'WC-P-MIXING', hoursPerUnit: 0.15, capacityHoursPerPeriod: 160, loadHours: [56,55,54,53,51,50], utilization: [35,34,34,33,32,31], overloaded: [false,false,false,false,false,false] }] },
            },
            capacity: { workCenters: [
              { name: 'Dry Mixing Line', available: 160, used: 57, utilization: 0.356 },
            ]},
          },
        },
      ],
    },
  ],
};

const BEGINNING_INVENTORY = { 'GRN-BAR': 450, 'PRO-BAR': 280, 'TRL-MIX': 310 };

export default function ProductionPlanPage() {
  const [tab, setTab] = useState('psi');
  const [rawData, setRawData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [selectedSku, setSelectedSku] = useState(null);
  const [selectedStrategy, setSelectedStrategy] = useState('chase');
  const [lockedPeriods, setLockedPeriods] = useState({});
  const [editedCells, setEditedCells] = useState({});
  const [editingCell, setEditingCell] = useState(null);

  useEffect(() => {
    fetch('/api/production-plan/demo')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => {
        setRawData(d);
        if (d.plantResults?.length > 0) {
          setSelectedPlant(d.plantResults[0].plantCode);
          if (d.plantResults[0].productPlans?.length > 0) {
            setSelectedSku(d.plantResults[0].productPlans[0].skuCode);
          }
        }
        setLoading(false);
      })
      .catch(() => {
        console.warn('Production Plan API unavailable, using static fallback');
        const d = STATIC_PROD_PLAN;
        setRawData(d);
        if (d.plantResults?.length > 0) {
          setSelectedPlant(d.plantResults[0].plantCode);
          if (d.plantResults[0].productPlans?.length > 0) {
            setSelectedSku(d.plantResults[0].productPlans[0].skuCode);
          }
        }
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedPlant) return;
    fetch(`/api/production-plan/locked-periods?plant=${selectedPlant}`)
      .then(r => r.ok ? r.json() : { lockedPeriods: [] })
      .then(d => {
        const map = {};
        (d.lockedPeriods || []).forEach(lp => { map[lp.period] = true; });
        setLockedPeriods(map);
      })
      .catch(() => {});
  }, [selectedPlant]);

  const toggleLockPeriod = (period) => {
    const isLocked = !!lockedPeriods[period];
    const newLocked = { ...lockedPeriods, [period]: !isLocked };
    if (!newLocked[period]) delete newLocked[period];
    setLockedPeriods(newLocked);
    fetch('/api/production-plan/lock-period', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plant: selectedPlant, period, locked: !isLocked }),
    }).catch(() => {});
  };

  const handleCellEdit = (periodIdx, value) => {
    const key = `${selectedSku}-${periodIdx}`;
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < 0) return;
    setEditedCells(prev => ({ ...prev, [key]: parsed }));
    setEditingCell(null);
  };

  const currentPlant = rawData?.plantResults?.find(p => p.plantCode === selectedPlant);
  const results = currentPlant?.productPlans || [];
  const selectedResult = results.find(r => r.skuCode === selectedSku);
  const plan = selectedResult?.plan;
  const strategy = plan?.strategies?.[selectedStrategy];

  return (
    <ModuleLayout moduleContext="production_plan" tabs={TABS} activeTab={tab} onTabChange={setTab}>
      <PageHeader title="Production Planning" subtitle="Aggregate & Capacity">
        <TrustScore module="production" compact />
      </PageHeader>

      <div className="module-content" style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 40px' }}>

        {/* Plant selector */}
        {rawData?.plantResults && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {rawData.plantResults.map(p => (
              <button
                key={p.plantCode}
                onClick={() => {
                  setSelectedPlant(p.plantCode);
                  if (p.productPlans?.length > 0) setSelectedSku(p.productPlans[0].skuCode);
                }}
                style={{
                  background: selectedPlant === p.plantCode ? T.ink : T.white,
                  color: selectedPlant === p.plantCode ? T.white : T.ink,
                  border: `1px solid ${selectedPlant === p.plantCode ? T.ink : T.border}`,
                  borderRadius: 6, padding: '6px 14px', cursor: 'pointer',
                  fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 500, transition: 'all 0.12s',
                }}
              >
                {PLANT_NAMES[p.plantCode] || p.plantCode}
                <span style={{ marginLeft: 6, fontSize: 9, color: selectedPlant === p.plantCode ? 'rgba(255,255,255,0.5)' : T.inkLight, fontFamily: 'JetBrains Mono' }}>({p.plantCode})</span>
                <span style={{ marginLeft: 6, fontSize: 10, color: selectedPlant === p.plantCode ? 'rgba(255,255,255,0.6)' : T.inkLight }}>
                  {p.productsPlanned} products
                </span>
              </button>
            ))}
          </div>
        )}

        {/* SKU selector */}
        {results.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {results.map(r => (
              <button
                key={r.skuCode}
                onClick={() => setSelectedSku(r.skuCode)}
                style={{
                  background: selectedSku === r.skuCode ? T.ink : T.white,
                  color: selectedSku === r.skuCode ? T.white : T.ink,
                  border: `1px solid ${selectedSku === r.skuCode ? T.ink : T.border}`,
                  borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
                  fontFamily: 'JetBrains Mono', fontSize: 11, transition: 'all 0.12s',
                }}
              >
                {r.skuCode}
              </button>
            ))}
          </div>
        )}

        {/* ─── Strategy Comparison Tab ─────────────────────────── */}
        {tab === 'strategy' && (
          <>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>Running production plan...</div>
            ) : plan ? (
              <>
                <div className="strategy-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                  {['chase', 'level', 'hybrid'].map(s => {
                    const st = plan.strategies[s];
                    const isRecommended = plan.recommended === s;
                    return (
                      <div key={s} onClick={() => setSelectedStrategy(s)}
                        style={{ background: selectedStrategy === s ? T.ink : T.white, border: `2px solid ${isRecommended ? T.safe : selectedStrategy === s ? T.ink : T.border}`, borderRadius: 10, padding: '20px', cursor: 'pointer', transition: 'all 0.15s' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ fontFamily: 'Sora', fontSize: 15, fontWeight: 600, color: selectedStrategy === s ? T.white : T.ink, textTransform: 'capitalize' }}>{s}</div>
                          {isRecommended && (
                            <span style={{ background: T.safeBg, color: T.safe, border: `1px solid ${T.safe}`, padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 600 }}>RECOMMENDED</span>
                          )}
                        </div>
                        <div style={{ fontFamily: 'Sora', fontSize: 24, fontWeight: 600, color: selectedStrategy === s ? T.white : T.accent, marginBottom: 8 }}>${Math.round(st?.totalCost || 0).toLocaleString()}</div>
                        <div style={{ fontSize: 11, color: selectedStrategy === s ? 'rgba(255,255,255,0.7)' : T.inkLight }}>
                          {s === 'chase' && 'Match demand exactly. Higher workforce change costs.'}
                          {s === 'level' && 'Constant rate. Higher inventory costs.'}
                          {s === 'hybrid' && 'Base rate + overtime for peaks.'}
                        </div>
                        {st?.exceptions?.length > 0 && (
                          <div style={{ marginTop: 8, fontSize: 10, color: T.risk, fontWeight: 500 }}>{st.exceptions.length} exception(s)</div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {strategy && (
                  <Card title={`${selectedStrategy.charAt(0).toUpperCase() + selectedStrategy.slice(1)} Strategy \u2014 ${selectedSku}`}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'JetBrains Mono' }}>
                        <thead>
                          <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                            <th scope="col" style={thStyle('left')}>Period</th>
                            <th scope="col" style={thStyle('right')}>Demand</th>
                            <th scope="col" style={thStyle('right')}>Production</th>
                            {strategy.overtime && <th scope="col" style={thStyle('right')}>Overtime</th>}
                            {strategy.subcontract && <th scope="col" style={thStyle('right')}>Subcontract</th>}
                            <th scope="col" style={thStyle('right')}>Ending Inventory</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rawData?.periods.map((p, i) => (
                            <tr key={p} style={{ borderBottom: `1px solid ${T.border}` }}>
                              <td style={tdStyle()}>{p}</td>
                              <td style={tdStyle('right')}>{selectedResult.plantGrossReqs[i]}</td>
                              <td style={{ ...tdStyle('right'), color: T.accent, fontWeight: 500 }}>{strategy.production[i]}</td>
                              {strategy.overtime && (<td style={{ ...tdStyle('right'), color: strategy.overtime[i] > 0 ? T.warn : T.inkGhost }}>{strategy.overtime[i]}</td>)}
                              {strategy.subcontract && (<td style={{ ...tdStyle('right'), color: strategy.subcontract[i] > 0 ? T.risk : T.inkGhost }}>{strategy.subcontract[i]}</td>)}
                              <td style={{ ...tdStyle('right'), color: strategy.endingInventory[i] < 0 ? T.risk : T.ink, fontWeight: strategy.endingInventory[i] < 0 ? 600 : 400 }}>{strategy.endingInventory[i]}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {strategy.costBreakdown && (
                      <div style={{ display: 'flex', gap: 16, padding: '16px 20px', flexWrap: 'wrap' }}>
                        {Object.entries(strategy.costBreakdown).map(([k, v]) => (
                          <div key={k} style={{ background: T.bgDark, borderRadius: 6, padding: '8px 14px' }}>
                            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 8, color: T.inkLight, letterSpacing: 1, textTransform: 'uppercase' }}>{k.replace(/([A-Z])/g, ' $1').trim()}</div>
                            <div style={{ fontFamily: 'Sora', fontSize: 16, fontWeight: 600, color: v > 0 ? T.ink : T.inkGhost }}>${Math.round(v).toLocaleString()}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )}
              </>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>No data</div>
            )}
          </>
        )}

        {/* ─── Production Plan (PSI) Tab ────────────────────────── */}
        {tab === 'psi' && (
          <>
            {strategy ? (
              <>
                <Card title={`Production Plan \u2014 ${selectedSku || '...'} (${selectedStrategy})`}>
                  <div style={{ padding: '16px 20px' }}>
                    <PSIChart periods={rawData?.periods} demand={selectedResult?.plantGrossReqs} production={strategy.production} beginningInventory={BEGINNING_INVENTORY[selectedSku] || 0} endingInventory={strategy.endingInventory} />
                  </div>
                </Card>
                <Card title="Production, Sales & Inventory" style={{ marginTop: 16 }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'JetBrains Mono' }}>
                      <thead>
                        <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                          <th scope="col" style={thStyle('left')}>Metric</th>
                          {rawData?.periods.map((p) => {
                            const isLocked = !!lockedPeriods[p];
                            return (
                              <th key={p} scope="col" style={{ ...thStyle('right'), background: isLocked ? T.bgDeep : 'transparent' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                                  <button onClick={() => toggleLockPeriod(p)} title={isLocked ? 'Unlock period (allow cascade changes)' : 'Lock period (confirm plan)'}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', fontSize: 11, lineHeight: 1, color: isLocked ? T.ink : T.inkGhost }}
                                  >{isLocked ? '\u{1F512}' : '\u{1F513}'}</button>
                                  <span>{p}</span>
                                </div>
                              </th>
                            );
                          })}
                          <th scope="col" style={thStyle('right')}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ borderBottom: `1px solid ${T.border}`, background: T.bgDark }}>
                          <td style={{ ...tdStyle(), fontSize: 10, color: T.inkLight, fontWeight: 500 }}>Working Days</td>
                          {rawData?.periods.map((p) => (
                            <td key={p} style={{ ...tdStyle('right'), fontSize: 10, color: T.inkLight, background: lockedPeriods[p] ? T.bgDeep : 'transparent' }}>5 days</td>
                          ))}
                          <td style={{ ...tdStyle('right'), fontSize: 10, color: T.inkLight }}></td>
                        </tr>
                        <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                          <td style={tdStyle()}>Beginning Inventory</td>
                          {rawData?.periods.map((p, i) => {
                            const bi = i === 0 ? (BEGINNING_INVENTORY[selectedSku] || 0) : strategy.endingInventory[i - 1];
                            return (<td key={p} style={{ ...tdStyle('right'), background: lockedPeriods[p] ? T.bgDeep : 'transparent' }}>{bi}</td>);
                          })}
                          <td style={tdStyle('right')}></td>
                        </tr>
                        <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                          <td style={{ ...tdStyle(), color: T.accent, fontWeight: 500 }}>Production</td>
                          {rawData?.periods.map((p, i) => {
                            const isLocked = !!lockedPeriods[p];
                            const cellKey = `${selectedSku}-${i}`;
                            const isEdited = editedCells[cellKey] !== undefined;
                            const originalValue = strategy.production[i];
                            const displayValue = isEdited ? editedCells[cellKey] : originalValue;
                            const isEditingThis = editingCell === cellKey;
                            return (
                              <td key={p} onClick={() => { if (!isLocked) setEditingCell(cellKey); }}
                                style={{ ...tdStyle('right'), color: T.accent, fontWeight: 500, background: isEdited ? '#E8F0FE' : isLocked ? T.bgDeep : 'transparent', cursor: isLocked ? 'default' : 'pointer', padding: isEdited ? '2px 10px 6px' : '6px 10px' }}>
                                {isEditingThis ? (
                                  <input type="number" autoFocus defaultValue={displayValue}
                                    onBlur={(e) => handleCellEdit(i, e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleCellEdit(i, e.target.value); if (e.key === 'Escape') setEditingCell(null); }}
                                    style={{ width: '100%', border: `1px solid ${T.accent}`, borderRadius: 3, padding: '2px 4px', fontSize: 12, fontFamily: 'JetBrains Mono', textAlign: 'right', background: '#fff', color: T.accent, outline: 'none' }} />
                                ) : (
                                  <>
                                    {isEdited && (<div style={{ fontSize: 9, color: T.inkGhost, textDecoration: 'line-through', lineHeight: 1, marginBottom: 1 }}>{originalValue}</div>)}
                                    {displayValue}
                                  </>
                                )}
                              </td>
                            );
                          })}
                          <td style={{ ...tdStyle('right'), color: T.accent, fontWeight: 500 }}>
                            {rawData?.periods.map((_, i) => { const ck = `${selectedSku}-${i}`; return editedCells[ck] !== undefined ? editedCells[ck] : strategy.production[i]; }).reduce((s, v) => s + v, 0).toLocaleString()}
                          </td>
                        </tr>
                        <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                          <td style={tdStyle()}>Sales (Demand)</td>
                          {rawData?.periods.map((p, i) => (
                            <td key={p} style={{ ...tdStyle('right'), background: lockedPeriods[p] ? T.bgDeep : 'transparent' }}>{selectedResult.plantGrossReqs[i]}</td>
                          ))}
                          <td style={tdStyle('right')}>{selectedResult.plantGrossReqs.reduce((s, v) => s + v, 0).toLocaleString()}</td>
                        </tr>
                        <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                          <td style={tdStyle()}>Ending Inventory</td>
                          {rawData?.periods.map((p, i) => {
                            const ei = strategy.endingInventory[i];
                            return (<td key={p} style={{ ...tdStyle('right'), color: ei < 0 ? T.risk : ei < 50 ? T.warn : T.ink, fontWeight: ei < 0 ? 600 : 400, background: lockedPeriods[p] ? T.bgDeep : 'transparent' }}>{ei}</td>);
                          })}
                          <td style={tdStyle('right')}></td>
                        </tr>
                        <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                          <td style={tdStyle()}>Workforce</td>
                          {rawData?.periods.map((p, i) => (
                            <td key={p} style={{ ...tdStyle('right'), background: lockedPeriods[p] ? T.bgDeep : 'transparent' }}>{strategy.workforce?.[i] ?? '\u2014'}</td>
                          ))}
                          <td style={tdStyle('right')}></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </Card>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 16 }}>
                  {['chase', 'level', 'hybrid'].map(s => {
                    const st = plan?.strategies?.[s];
                    if (!st) return null;
                    const avgInv = Math.round(st.endingInventory.reduce((a, v) => a + v, 0) / st.endingInventory.length);
                    const maxWf = st.workforce ? Math.max(...st.workforce) : '\u2014';
                    return (
                      <div key={s} onClick={() => setSelectedStrategy(s)}
                        style={{ background: selectedStrategy === s ? T.ink : T.white, border: `1px solid ${selectedStrategy === s ? T.ink : T.border}`, borderRadius: 8, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s' }}>
                        <div style={{ fontFamily: 'Sora', fontSize: 13, fontWeight: 600, color: selectedStrategy === s ? T.white : T.ink, textTransform: 'capitalize', marginBottom: 10 }}>{s}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                          {[
                            { label: 'Total Cost', value: `$${(st.totalCost || 0).toLocaleString()}` },
                            { label: 'Average Inventory', value: avgInv },
                            { label: 'Max Workforce', value: maxWf },
                          ].map(m => (
                            <div key={m.label}>
                              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 8, color: selectedStrategy === s ? 'rgba(255,255,255,0.5)' : T.inkLight, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>{m.label}</div>
                              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 14, fontWeight: 600, color: selectedStrategy === s ? T.white : T.accent }}>{m.value}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <Card><div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>Select a strategy to see production plan</div></Card>
            )}
          </>
        )}

        {/* ─── Capacity Utilization Tab ─────────────────────────── */}
        {tab === 'capacity' && (
          <Card title={`Rough-Cut Capacity \u2014 ${selectedSku || '...'} (${selectedStrategy})`}>
            {strategy?.rccp ? (
              <div style={{ padding: '16px 20px' }}>
                {strategy.rccp.map(wc => {
                  const ratePerHour = wc.hoursPerUnit > 0 ? Math.round(1 / wc.hoursPerUnit) : 0;
                  const dailyCapacity = ratePerHour * 8;
                  return (
                    <div key={wc.code} style={{ marginBottom: 24 }}>
                      <div style={{ fontFamily: 'Sora', fontSize: 13, fontWeight: 600, color: T.ink, marginBottom: 4 }}>
                        {WC_NAMES[wc.code] || wc.code}
                        <span style={{ marginLeft: 8, fontSize: 10, color: T.inkLight, fontWeight: 400, fontFamily: 'JetBrains Mono' }}>({wc.code})</span>
                      </div>
                      <div style={{ display: 'flex', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: T.inkMid, fontFamily: 'JetBrains Mono' }}>Rate: {ratePerHour} units/hour</span>
                        <span style={{ fontSize: 11, color: T.inkMid, fontFamily: 'JetBrains Mono' }}>Daily Capacity: {dailyCapacity} units</span>
                        <span style={{ fontSize: 11, color: T.inkLight, fontFamily: 'JetBrains Mono' }}>{wc.capacityHoursPerPeriod} hours capacity/period</span>
                      </div>
                      <CapacityChart periods={rawData?.periods} loadHours={wc.loadHours} capacity={wc.capacityHoursPerPeriod} utilization={wc.utilization} overloaded={wc.overloaded} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>No capacity data for this strategy</div>
            )}
          </Card>
        )}
      </div>
    </ModuleLayout>
  );
}

function thStyle(align = 'left') {
  return { textAlign: align, padding: '8px 10px', color: T.inkLight, fontWeight: 500, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 };
}

function tdStyle(align = 'left') {
  return { padding: '6px 10px', textAlign: align, color: T.inkMid };
}

function PSIChart({ periods, demand, production, beginningInventory, endingInventory }) {
  if (!periods) return null;
  const W = 700, H = 260;
  const M = { top: 20, right: 30, bottom: 50, left: 55 };
  const iW = W - M.left - M.right;
  const iH = H - M.top - M.bottom;
  const invLine = [beginningInventory, ...(endingInventory || [])];
  const allVals = [...(demand || []), ...(production || []), ...invLine];
  const maxV = Math.max(...allVals.map(Math.abs), 1) * 1.15;
  const minV = Math.min(0, ...allVals) * 1.15;
  const range = maxV - minV || 1;
  const groupW = iW / periods.length;
  const barW = groupW * 0.3;
  const barGap = groupW * 0.04;
  const yScale = (v) => M.top + iH - ((v - minV) / range) * iH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Production plan chart showing production and demand as grouped bars with inventory line overlay" style={{ width: '100%', maxWidth: W, height: 'auto' }}>
      <line x1={M.left} y1={yScale(0)} x2={W - M.right} y2={yScale(0)} stroke={T.border} strokeWidth={1} />
      {[0, Math.round(maxV / 2), Math.round(maxV)].map(v => (
        <text key={v} x={M.left - 8} y={yScale(v) + 3} textAnchor="end" fontSize={8} fill={T.inkLight} fontFamily="JetBrains Mono">{v}</text>
      ))}
      {periods.map((p, i) => {
        const cx = M.left + i * groupW + groupW / 2;
        const prodX = cx - barW - barGap / 2;
        const demX = cx + barGap / 2;
        const prodH = ((production[i] || 0) / range) * iH;
        const demH = ((demand[i] || 0) / range) * iH;
        return (
          <g key={p}>
            <rect x={prodX} y={yScale(0) - prodH} width={barW} height={prodH} fill={T.accent} opacity={0.85} rx={2} />
            <rect x={demX} y={yScale(0) - demH} width={barW} height={demH} fill={T.inkLight} opacity={0.5} rx={2} />
            <text x={cx} y={H - 28} textAnchor="middle" fontSize={9} fill={T.inkLight} fontFamily="JetBrains Mono">{p}</text>
          </g>
        );
      })}
      <path d={invLine.map((v, i) => { const px = i === 0 ? M.left : M.left + (i - 0.5) * groupW + groupW / 2; return `${i === 0 ? 'M' : 'L'} ${px} ${yScale(v)}`; }).join(' ')} fill="none" stroke={T.safe} strokeWidth={2.5} />
      {invLine.map((v, i) => { const px = i === 0 ? M.left : M.left + (i - 0.5) * groupW + groupW / 2; return <circle key={i} cx={px} cy={yScale(v)} r={3.5} fill={T.safe} />; })}
      <g transform={`translate(${M.left}, ${H - 10})`}>
        <rect x={0} y={-6} width={10} height={10} fill={T.accent} opacity={0.85} rx={1} />
        <text x={14} y={3} fontSize={9} fill={T.inkMid} fontFamily="Inter">Production</text>
        <rect x={90} y={-6} width={10} height={10} fill={T.inkLight} opacity={0.5} rx={1} />
        <text x={104} y={3} fontSize={9} fill={T.inkMid} fontFamily="Inter">Demand</text>
        <line x1={180} y1={0} x2={200} y2={0} stroke={T.safe} strokeWidth={2.5} />
        <circle cx={190} cy={0} r={3} fill={T.safe} />
        <text x={206} y={3} fontSize={9} fill={T.inkMid} fontFamily="Inter">Inventory</text>
      </g>
    </svg>
  );
}

function CapacityChart({ periods, loadHours, capacity, utilization, overloaded }) {
  if (!periods) return null;
  const W = 700, H = 160;
  const M = { top: 10, right: 20, bottom: 30, left: 50 };
  const iW = W - M.left - M.right;
  const iH = H - M.top - M.bottom;
  const maxLoad = Math.max(capacity, ...loadHours) * 1.1;
  const barW = iW / periods.length * 0.6;
  const gap = iW / periods.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Capacity utilization bar chart showing load hours versus available capacity" style={{ width: '100%', maxWidth: W, height: 'auto' }}>
      <line x1={M.left} y1={M.top + iH - (capacity / maxLoad) * iH} x2={W - M.right} y2={M.top + iH - (capacity / maxLoad) * iH} stroke={T.risk} strokeWidth={1} strokeDasharray="6,3" />
      <text x={W - M.right + 4} y={M.top + iH - (capacity / maxLoad) * iH + 4} fontSize={8} fill={T.risk} fontFamily="JetBrains Mono">Capacity: {capacity}h</text>
      {periods.map((p, i) => {
        const bx = M.left + i * gap + (gap - barW) / 2;
        const bh = (loadHours[i] / maxLoad) * iH;
        const by = M.top + iH - bh;
        return (
          <g key={p}>
            <rect x={bx} y={by} width={barW} height={bh} fill={overloaded[i] ? T.risk : T.accent} opacity={0.8} rx={2} />
            <text x={bx + barW / 2} y={by - 4} textAnchor="middle" fontSize={8} fill={overloaded[i] ? T.risk : T.ink} fontFamily="JetBrains Mono" fontWeight={500}>{Math.round(utilization[i])}%</text>
            <text x={bx + barW / 2} y={H - 6} textAnchor="middle" fontSize={7} fill={T.inkLight} fontFamily="JetBrains Mono">{p.slice(5)}</text>
          </g>
        );
      })}
    </svg>
  );
}
