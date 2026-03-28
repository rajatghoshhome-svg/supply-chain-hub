import { useState, useEffect } from 'react';
import { T } from '../styles/tokens';
import ModuleLayout from '../components/shared/ModuleLayout';
import PageHeader from '../components/shared/PageHeader';
import Card from '../components/shared/Card';

const TABS = [
  { id: 'aggregate', label: 'Aggregate Plan' },
  { id: 'capacity', label: 'Capacity (RCCP)' },
  { id: 'strategy', label: 'Strategy Comparison' },
];

// ─── Static fallback data (used when API is unavailable, e.g. Vercel) ────
const STATIC_PROD_PLAN = {
  periods: ['W13','W14','W15','W16','W17','W18'],
  plantsPlanned: 1, totalProductsPlanned: 3, strategy: 'chase',
  plantResults: [
    {
      plantCode: 'PLANT-NORTH', productsPlanned: 3,
      productPlans: [
        {
          skuCode: 'MTR-100', skuName: '1HP Standard Motor',
          plantGrossReqs: [155,160,165,172,166,177],
          plan: {
            periods: ['W13','W14','W15','W16','W17','W18'],
            demand: [155,160,165,172,166,177],
            strategies: {
              chase: { production: [155,160,165,172,166,177], endingInventory: [0,0,0,0,0,0], workforce: [18,19,19,20,19,21], totalCost: 142500,
                rccp: [
                  { code: 'ASSY-A', hoursPerUnit: 1.2, capacityHoursPerPeriod: 240, loadHours: [186,192,198,206,199,212], utilization: [78,80,83,86,83,88], overloaded: [false,false,false,false,false,false] },
                  { code: 'WIND-1', hoursPerUnit: 0.9, capacityHoursPerPeriod: 162, loadHours: [140,144,149,155,149,159], utilization: [86,89,92,96,92,98], overloaded: [false,false,false,false,false,false] },
                ] },
              level: { production: [166,166,166,166,166,166], endingInventory: [11,17,18,12,12,1], workforce: [19,19,19,19,19,19], totalCost: 138200,
                rccp: [
                  { code: 'ASSY-A', hoursPerUnit: 1.2, capacityHoursPerPeriod: 240, loadHours: [199,199,199,199,199,199], utilization: [83,83,83,83,83,83], overloaded: [false,false,false,false,false,false] },
                ] },
              hybrid: { production: [160,160,165,172,166,172], endingInventory: [5,5,5,5,5,0], workforce: [19,19,19,20,19,20], totalCost: 140100,
                rccp: [
                  { code: 'ASSY-A', hoursPerUnit: 1.2, capacityHoursPerPeriod: 240, loadHours: [192,192,198,206,199,206], utilization: [80,80,83,86,83,86], overloaded: [false,false,false,false,false,false] },
                ] },
            },
            capacity: {
              workCenters: [
                { name: 'Assembly Line A', available: 200, used: 155, utilization: 0.775 },
                { name: 'Winding Station', available: 180, used: 165, utilization: 0.917 },
                { name: 'Test Bay', available: 220, used: 155, utilization: 0.705 },
              ],
            },
          },
        },
        {
          skuCode: 'MTR-200', skuName: '2HP Industrial Motor',
          plantGrossReqs: [35,38,28,40,32,38],
          plan: {
            periods: ['W13','W14','W15','W16','W17','W18'],
            demand: [35,38,28,40,32,38],
            strategies: {
              chase: { production: [35,38,28,40,32,38], endingInventory: [0,0,0,0,0,0], workforce: [4,5,3,5,4,5], totalCost: 48200,
                rccp: [{ code: 'ASSY-B', hoursPerUnit: 1.5, capacityHoursPerPeriod: 120, loadHours: [53,57,42,60,48,57], utilization: [44,48,35,50,40,48], overloaded: [false,false,false,false,false,false] }] },
              level: { production: [35,35,35,35,35,35], endingInventory: [0,-3,4,-1,2,-1], workforce: [4,4,4,4,4,4], totalCost: 46800,
                rccp: [{ code: 'ASSY-B', hoursPerUnit: 1.5, capacityHoursPerPeriod: 120, loadHours: [53,53,53,53,53,53], utilization: [44,44,44,44,44,44], overloaded: [false,false,false,false,false,false] }] },
              hybrid: { production: [35,38,30,40,32,36], endingInventory: [0,0,2,2,2,0], workforce: [4,5,4,5,4,4], totalCost: 47500,
                rccp: [{ code: 'ASSY-B', hoursPerUnit: 1.5, capacityHoursPerPeriod: 120, loadHours: [53,57,45,60,48,54], utilization: [44,48,38,50,40,45], overloaded: [false,false,false,false,false,false] }] },
            },
            capacity: { workCenters: [
              { name: 'Assembly Line B', available: 80, used: 40, utilization: 0.500 },
            ]},
          },
        },
        {
          skuCode: 'MTR-500', skuName: '5HP Heavy Duty Motor',
          plantGrossReqs: [18,20,12,20,16,22],
          plan: {
            periods: ['W13','W14','W15','W16','W17','W18'],
            demand: [18,20,12,20,16,22],
            strategies: {
              chase: { production: [18,20,12,20,16,22], endingInventory: [0,0,0,0,0,0], workforce: [3,3,2,3,2,3], totalCost: 32400,
                rccp: [{ code: 'HEAVY-1', hoursPerUnit: 2.5, capacityHoursPerPeriod: 75, loadHours: [45,50,30,50,40,55], utilization: [60,67,40,67,53,73], overloaded: [false,false,false,false,false,false] }] },
              level: { production: [18,18,18,18,18,18], endingInventory: [0,-2,4,2,4,0], workforce: [3,3,3,3,3,3], totalCost: 31200,
                rccp: [{ code: 'HEAVY-1', hoursPerUnit: 2.5, capacityHoursPerPeriod: 75, loadHours: [45,45,45,45,45,45], utilization: [60,60,60,60,60,60], overloaded: [false,false,false,false,false,false] }] },
              hybrid: { production: [18,20,14,20,16,20], endingInventory: [0,0,2,2,2,0], workforce: [3,3,2,3,2,3], totalCost: 31800,
                rccp: [{ code: 'HEAVY-1', hoursPerUnit: 2.5, capacityHoursPerPeriod: 75, loadHours: [45,50,35,50,40,50], utilization: [60,67,47,67,53,67], overloaded: [false,false,false,false,false,false] }] },
            },
            capacity: { workCenters: [
              { name: 'Heavy Assembly', available: 30, used: 22, utilization: 0.733 },
            ]},
          },
        },
      ],
    },
  ],
};

export default function ProductionPlanPage() {
  const [tab, setTab] = useState('aggregate');
  const [rawData, setRawData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [selectedSku, setSelectedSku] = useState(null);
  const [selectedStrategy, setSelectedStrategy] = useState('chase');

  useEffect(() => {
    fetch('/api/production-plan/demo')
      .then(r => r.json())
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

  const currentPlant = rawData?.plantResults?.find(p => p.plantCode === selectedPlant);
  const results = currentPlant?.productPlans || [];
  const data = rawData ? { ...rawData, results } : null;
  const selectedResult = results.find(r => r.skuCode === selectedSku);
  const plan = selectedResult?.plan;
  const strategy = plan?.strategies?.[selectedStrategy];

  return (
    <ModuleLayout moduleContext="production_plan" tabs={TABS} activeTab={tab} onTabChange={setTab}>
      <PageHeader title="Production Planning" subtitle="Aggregate & Capacity" />

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
                {p.plantCode}
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
                {/* Strategy cards */}
                <div className="strategy-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                  {['chase', 'level', 'hybrid'].map(s => {
                    const st = plan.strategies[s];
                    const isRecommended = plan.recommended === s;
                    return (
                      <div
                        key={s}
                        onClick={() => setSelectedStrategy(s)}
                        style={{
                          background: selectedStrategy === s ? T.ink : T.white,
                          border: `2px solid ${isRecommended ? T.safe : selectedStrategy === s ? T.ink : T.border}`,
                          borderRadius: 10, padding: '20px', cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ fontFamily: 'Sora', fontSize: 15, fontWeight: 600, color: selectedStrategy === s ? T.white : T.ink, textTransform: 'capitalize' }}>
                            {s}
                          </div>
                          {isRecommended && (
                            <span style={{
                              background: T.safeBg, color: T.safe, border: `1px solid ${T.safe}`,
                              padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 600,
                            }}>
                              RECOMMENDED
                            </span>
                          )}
                        </div>
                        <div style={{ fontFamily: 'Sora', fontSize: 24, fontWeight: 600, color: selectedStrategy === s ? T.white : T.accent, marginBottom: 8 }}>
                          ${Math.round(st?.totalCost || 0).toLocaleString()}
                        </div>
                        <div style={{ fontSize: 11, color: selectedStrategy === s ? 'rgba(255,255,255,0.7)' : T.inkLight }}>
                          {s === 'chase' && 'Match demand exactly. Higher workforce change costs.'}
                          {s === 'level' && 'Constant rate. Higher inventory costs.'}
                          {s === 'hybrid' && 'Base rate + overtime for peaks.'}
                        </div>
                        {st?.exceptions?.length > 0 && (
                          <div style={{ marginTop: 8, fontSize: 10, color: T.risk, fontWeight: 500 }}>
                            ⚠ {st.exceptions.length} exception(s)
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Selected strategy detail */}
                {strategy && (
                  <Card title={`${selectedStrategy.charAt(0).toUpperCase() + selectedStrategy.slice(1)} Strategy — ${selectedSku}`}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'JetBrains Mono' }}>
                        <thead>
                          <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                            <th scope="col" style={thStyle('left')}>Period</th>
                            <th scope="col" style={thStyle('right')}>Demand</th>
                            <th scope="col" style={thStyle('right')}>Production</th>
                            {strategy.overtime && <th scope="col" style={thStyle('right')}>Overtime</th>}
                            {strategy.subcontract && <th scope="col" style={thStyle('right')}>Subcontract</th>}
                            <th scope="col" style={thStyle('right')}>End Inv</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rawData?.periods.map((p, i) => (
                            <tr key={p} style={{ borderBottom: `1px solid ${T.border}` }}>
                              <td style={tdStyle()}>{p}</td>
                              <td style={tdStyle('right')}>{selectedResult.plantGrossReqs[i]}</td>
                              <td style={{ ...tdStyle('right'), color: T.accent, fontWeight: 500 }}>{strategy.production[i]}</td>
                              {strategy.overtime && (
                                <td style={{ ...tdStyle('right'), color: strategy.overtime[i] > 0 ? T.warn : T.inkGhost }}>{strategy.overtime[i]}</td>
                              )}
                              {strategy.subcontract && (
                                <td style={{ ...tdStyle('right'), color: strategy.subcontract[i] > 0 ? T.risk : T.inkGhost }}>{strategy.subcontract[i]}</td>
                              )}
                              <td style={{ ...tdStyle('right'), color: strategy.endingInventory[i] < 0 ? T.risk : T.ink, fontWeight: strategy.endingInventory[i] < 0 ? 600 : 400 }}>
                                {strategy.endingInventory[i]}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Cost breakdown */}
                    {strategy.costBreakdown && (
                      <div style={{ display: 'flex', gap: 16, padding: '16px 20px', flexWrap: 'wrap' }}>
                        {Object.entries(strategy.costBreakdown).map(([k, v]) => (
                          <div key={k} style={{ background: T.bgDark, borderRadius: 6, padding: '8px 14px' }}>
                            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 8, color: T.inkLight, letterSpacing: 1, textTransform: 'uppercase' }}>
                              {k.replace(/([A-Z])/g, ' $1').trim()}
                            </div>
                            <div style={{ fontFamily: 'Sora', fontSize: 16, fontWeight: 600, color: v > 0 ? T.ink : T.inkGhost }}>
                              ${Math.round(v).toLocaleString()}
                            </div>
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

        {/* ─── Aggregate Plan Tab ──────────────────────────────── */}
        {tab === 'aggregate' && (
          <Card title={`Aggregate Plan — ${selectedSku || '...'} (${selectedStrategy})`}>
            {strategy ? (
              <div style={{ padding: '16px 20px' }}>
                <ProdChart
                  periods={rawData?.periods}
                  demand={selectedResult?.plantGrossReqs}
                  production={strategy.production}
                  inventory={strategy.endingInventory}
                />
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>Select a strategy</div>
            )}
          </Card>
        )}

        {/* ─── Capacity (RCCP) Tab ─────────────────────────────── */}
        {tab === 'capacity' && (
          <Card title={`Rough-Cut Capacity — ${selectedSku || '...'} (${selectedStrategy})`}>
            {strategy?.rccp ? (
              <div style={{ padding: '16px 20px' }}>
                {strategy.rccp.map(wc => (
                  <div key={wc.code} style={{ marginBottom: 24 }}>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 8 }}>
                      {wc.code}
                      <span style={{ marginLeft: 8, fontSize: 10, color: T.inkLight, fontWeight: 400 }}>
                        ({wc.hoursPerUnit} hrs/unit, {wc.capacityHoursPerPeriod} hrs capacity/period)
                      </span>
                    </div>
                    <CapacityChart
                      periods={rawData?.periods}
                      loadHours={wc.loadHours}
                      capacity={wc.capacityHoursPerPeriod}
                      utilization={wc.utilization}
                      overloaded={wc.overloaded}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>No RCCP data for this strategy</div>
            )}
          </Card>
        )}
      </div>
    </ModuleLayout>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

function thStyle(align = 'left') {
  return { textAlign: align, padding: '8px 10px', color: T.inkLight, fontWeight: 500, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 };
}

function tdStyle(align = 'left') {
  return { padding: '6px 10px', textAlign: align, color: T.inkMid };
}

// ─── SVG Production Chart ─────────────────────────────────────────

function ProdChart({ periods, demand, production, inventory }) {
  if (!periods) return null;
  const W = 700, H = 220;
  const M = { top: 20, right: 30, bottom: 40, left: 50 };
  const iW = W - M.left - M.right;
  const iH = H - M.top - M.bottom;

  const allVals = [...(demand || []), ...(production || []), ...(inventory || [])];
  const maxV = Math.max(...allVals.map(Math.abs), 1) * 1.15;
  const minV = Math.min(0, ...allVals) * 1.15;
  const range = maxV - minV;

  const x = (i) => M.left + (i / (periods.length - 1)) * iW;
  const y = (v) => M.top + iH - ((v - minV) / range) * iH;

  const line = (data) => data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Production plan chart showing demand, production, and inventory levels over time" style={{ width: '100%', maxWidth: W, height: 'auto' }}>
      {/* Zero line */}
      <line x1={M.left} y1={y(0)} x2={W - M.right} y2={y(0)} stroke={T.border} strokeWidth={1} />
      {/* Demand */}
      {demand && <path d={line(demand)} fill="none" stroke={T.inkLight} strokeWidth={1.5} strokeDasharray="4,3" />}
      {/* Production */}
      {production && <path d={line(production)} fill="none" stroke={T.accent} strokeWidth={2} />}
      {/* Inventory */}
      {inventory && <path d={line(inventory)} fill="none" stroke={T.safe} strokeWidth={1.5} />}
      {/* X labels */}
      {periods.map((p, i) => (
        <text key={p} x={x(i)} y={H - 8} textAnchor="middle" fontSize={8} fill={T.inkLight} fontFamily="JetBrains Mono">{p.slice(5)}</text>
      ))}
      {/* Legend */}
      <text x={M.left} y={H - 22} fontSize={9} fill={T.inkLight} fontFamily="Inter">
        <tspan fill={T.inkLight}>--- Demand</tspan>  <tspan fill={T.accent} dx={12}>— Production</tspan>  <tspan fill={T.safe} dx={12}>— Inventory</tspan>
      </text>
    </svg>
  );
}

// ─── SVG Capacity Chart ───────────────────────────────────────────

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
      {/* Capacity line */}
      <line x1={M.left} y1={M.top + iH - (capacity / maxLoad) * iH} x2={W - M.right} y2={M.top + iH - (capacity / maxLoad) * iH}
        stroke={T.risk} strokeWidth={1} strokeDasharray="6,3" />
      <text x={W - M.right + 4} y={M.top + iH - (capacity / maxLoad) * iH + 4} fontSize={8} fill={T.risk} fontFamily="JetBrains Mono">
        Cap: {capacity}h
      </text>
      {/* Bars */}
      {periods.map((p, i) => {
        const bx = M.left + i * gap + (gap - barW) / 2;
        const bh = (loadHours[i] / maxLoad) * iH;
        const by = M.top + iH - bh;
        return (
          <g key={p}>
            <rect x={bx} y={by} width={barW} height={bh}
              fill={overloaded[i] ? T.risk : T.accent} opacity={0.8} rx={2} />
            <text x={bx + barW / 2} y={by - 4} textAnchor="middle" fontSize={8} fill={overloaded[i] ? T.risk : T.ink} fontFamily="JetBrains Mono" fontWeight={500}>
              {Math.round(utilization[i])}%
            </text>
            <text x={bx + barW / 2} y={H - 6} textAnchor="middle" fontSize={7} fill={T.inkLight} fontFamily="JetBrains Mono">{p.slice(5)}</text>
          </g>
        );
      })}
    </svg>
  );
}
