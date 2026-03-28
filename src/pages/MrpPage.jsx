import { useState, useEffect } from 'react';
import { T } from '../styles/tokens';
import ModuleLayout from '../components/shared/ModuleLayout';
import PageHeader from '../components/shared/PageHeader';
import Card from '../components/shared/Card';

const TABS = [
  { id: 'bom', label: 'Bill of Materials' },
  { id: 'records', label: 'MRP Records' },
  { id: 'exceptions', label: 'Exceptions' },
];

const PLANTS = ['PLT-PDX', 'PLT-ATX', 'PLT-NSH'];

const LEVEL_COLORS = {
  0: { bg: T.ink, text: T.white, label: 'FG' },
  1: { bg: T.accent, text: T.white, label: 'SUB' },
  2: { bg: T.inkLight, text: T.white, label: 'RAW' },
};

// ─── Static fallback data (used when API is unavailable, e.g. Vercel) ────
const STATIC_MRP = {
  planRunId: 'static', plant: 'PLT-PDX', skusPlanned: 5, totalExceptions: 4, criticalExceptions: 1,
  results: [
    {
      skuCode: 'GRN-BAR', skuName: 'Oat & Honey Granola Bar',
      onHand: 1200, safetyStock: 300, lotSizing: 'L4L', leadTime: 1, level: 0, criticalExceptions: 1,
      records: [
        { period: 'W13', grossReq: 528, scheduledReceipts: 0, projectedOH: 672, netReq: 0, plannedOrderReceipt: 0, plannedOrderRelease: 0 },
        { period: 'W14', grossReq: 515, scheduledReceipts: 0, projectedOH: 157, netReq: 0, plannedOrderReceipt: 0, plannedOrderRelease: 648 },
        { period: 'W15', grossReq: 505, scheduledReceipts: 0, projectedOH: 0, netReq: 648, plannedOrderReceipt: 648, plannedOrderRelease: 638 },
        { period: 'W16', grossReq: 495, scheduledReceipts: 648, projectedOH: 153, netReq: 0, plannedOrderReceipt: 0, plannedOrderRelease: 630 },
        { period: 'W17', grossReq: 488, scheduledReceipts: 0, projectedOH: 0, netReq: 635, plannedOrderReceipt: 638, plannedOrderRelease: 0 },
        { period: 'W18', grossReq: 480, scheduledReceipts: 638, projectedOH: 158, netReq: 0, plannedOrderReceipt: 0, plannedOrderRelease: 0 },
      ],
      exceptions: [
        { severity: 'critical', type: 'expedite', message: 'Expedite 648 cases of Oat & Honey Granola Bar — needed W15 but lead time requires release W14' },
        { severity: 'warning', type: 'reschedule-in', message: 'Consider building ahead in W13 to smooth W15 peak demand' },
      ],
    },
    {
      skuCode: 'PRO-BAR', skuName: 'Peanut Butter Protein Bar',
      onHand: 900, safetyStock: 250, lotSizing: 'L4L', leadTime: 1, level: 0, criticalExceptions: 0,
      records: [
        { period: 'W13', grossReq: 395, scheduledReceipts: 0, projectedOH: 505, netReq: 0, plannedOrderReceipt: 0, plannedOrderRelease: 0 },
        { period: 'W14', grossReq: 385, scheduledReceipts: 0, projectedOH: 120, netReq: 0, plannedOrderReceipt: 0, plannedOrderRelease: 510 },
        { period: 'W15', grossReq: 375, scheduledReceipts: 0, projectedOH: 0, netReq: 505, plannedOrderReceipt: 510, plannedOrderRelease: 498 },
        { period: 'W16', grossReq: 368, scheduledReceipts: 510, projectedOH: 142, netReq: 0, plannedOrderReceipt: 0, plannedOrderRelease: 490 },
        { period: 'W17', grossReq: 360, scheduledReceipts: 498, projectedOH: 280, netReq: 0, plannedOrderReceipt: 0, plannedOrderRelease: 0 },
        { period: 'W18', grossReq: 352, scheduledReceipts: 0, projectedOH: 0, netReq: 72, plannedOrderReceipt: 490, plannedOrderRelease: 0 },
      ],
      exceptions: [
        { severity: 'warning', type: 'expedite', message: 'Release order for 510 cases of Protein Bar in W14 for W15 receipt' },
      ],
    },
    {
      skuCode: 'TRL-MIX', skuName: 'Classic Trail Mix',
      onHand: 650, safetyStock: 200, lotSizing: 'L4L', leadTime: 1, level: 0, criticalExceptions: 0,
      records: [
        { period: 'W13', grossReq: 378, scheduledReceipts: 0, projectedOH: 272, netReq: 0, plannedOrderReceipt: 0, plannedOrderRelease: 295 },
        { period: 'W14', grossReq: 367, scheduledReceipts: 0, projectedOH: 0, netReq: 295, plannedOrderReceipt: 295, plannedOrderRelease: 283 },
        { period: 'W15', grossReq: 358, scheduledReceipts: 295, projectedOH: 0, netReq: 263, plannedOrderReceipt: 283, plannedOrderRelease: 275 },
        { period: 'W16', grossReq: 350, scheduledReceipts: 283, projectedOH: 0, netReq: 267, plannedOrderReceipt: 275, plannedOrderRelease: 265 },
        { period: 'W17', grossReq: 340, scheduledReceipts: 275, projectedOH: 0, netReq: 265, plannedOrderReceipt: 265, plannedOrderRelease: 0 },
        { period: 'W18', grossReq: 332, scheduledReceipts: 265, projectedOH: 0, netReq: 267, plannedOrderReceipt: 267, plannedOrderRelease: 0 },
      ],
      exceptions: [
        { severity: 'warning', type: 'capacity', message: 'Trail Mix and Granola Bar compete for WC-P-MIXING in W14-W15 — check capacity' },
      ],
    },
  ],
};

const STATIC_BOM = {
  plant: 'PLT-PDX',
  tree: [
    { code: 'GRN-BAR', name: 'Oat & Honey Granola Bar', level: 0, children: [
      { code: 'MIX-OAT', name: 'Oat Dry Mix', level: 1, qtyPer: 1, children: [
        { code: 'OAT-RLD', name: 'Rolled Oats', level: 2, qtyPer: 3.5, children: [] },
        { code: 'HNY-RAW', name: 'Raw Honey', level: 2, qtyPer: 0.8, children: [] },
        { code: 'SGR-ORG', name: 'Organic Cane Sugar', level: 2, qtyPer: 0.5, children: [] },
      ]},
      { code: 'PKG-FLM', name: 'Packaging Film (bar wrap)', level: 1, qtyPer: 24, children: [] },
      { code: 'LBL-PRN', name: 'Printed Labels', level: 1, qtyPer: 1, children: [] },
      { code: 'CTN-CSE', name: 'Corrugated Cases', level: 1, qtyPer: 1, children: [] },
    ]},
    { code: 'PRO-BAR', name: 'Peanut Butter Protein Bar', level: 0, children: [
      { code: 'MIX-PRO', name: 'Protein Blend', level: 1, qtyPer: 1, children: [
        { code: 'PNT-BTR', name: 'Peanut Butter (bulk)', level: 2, qtyPer: 2.0, children: [] },
        { code: 'WHY-PRO', name: 'Whey Protein Isolate', level: 2, qtyPer: 1.5, children: [] },
        { code: 'COCO-PWD', name: 'Cocoa Powder', level: 2, qtyPer: 0.4, children: [] },
      ]},
      { code: 'PKG-FLM', name: 'Packaging Film (bar wrap)', level: 1, qtyPer: 24, children: [] },
      { code: 'CTN-CSE', name: 'Corrugated Cases', level: 1, qtyPer: 1, children: [] },
    ]},
    { code: 'TRL-MIX', name: 'Classic Trail Mix', level: 0, children: [
      { code: 'MIX-TRL', name: 'Trail Mix Blend', level: 1, qtyPer: 1, children: [
        { code: 'ALM-RAW', name: 'Raw Almonds', level: 2, qtyPer: 2.0, children: [] },
        { code: 'PNT-BTR', name: 'Peanut Butter (bulk)', level: 2, qtyPer: 0.5, children: [] },
        { code: 'COCO-PWD', name: 'Cocoa Powder', level: 2, qtyPer: 0.3, children: [] },
      ]},
      { code: 'PKG-FLM', name: 'Packaging Film (bag)', level: 1, qtyPer: 12, children: [] },
      { code: 'CTN-CSE', name: 'Corrugated Cases', level: 1, qtyPer: 1, children: [] },
    ]},
  ],
};

export default function MrpPage() {
  const [tab, setTab] = useState('records');
  const [data, setData] = useState(null);
  const [bomData, setBomData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSku, setSelectedSku] = useState(null);
  const [selectedPlant, setSelectedPlant] = useState('PLT-PDX');
  const [expandedBom, setExpandedBom] = useState(new Set());
  const [suggestions, setSuggestions] = useState({});
  const [editingBomLine, setEditingBomLine] = useState(null); // { parentCode, childCode }
  const [editBomValues, setEditBomValues] = useState({ qtyPer: '', scrapPct: '' });
  const [addingTo, setAddingTo] = useState(null); // parentCode
  const [newBomLine, setNewBomLine] = useState({ code: '', name: '', qtyPer: 1, scrapPct: 0 });
  const [bomSaving, setBomSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/mrp/demo?plant=${selectedPlant}`).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
      fetch(`/api/mrp/bom?plant=${selectedPlant}`).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
    ])
      .then(([mrp, bom]) => {
        setData(mrp);
        setBomData(bom);
        if (mrp.results?.length > 0) setSelectedSku(mrp.results[0].skuCode);
        // Expand all FGs by default
        const expanded = new Set();
        bom.tree?.forEach(fg => expanded.add(fg.code));
        setExpandedBom(expanded);
        setLoading(false);
      })
      .catch(() => {
        console.warn('MRP API unavailable, using static fallback');
        setData(STATIC_MRP);
        setBomData(STATIC_BOM);
        if (STATIC_MRP.results?.length > 0) setSelectedSku(STATIC_MRP.results[0].skuCode);
        const expanded = new Set();
        STATIC_BOM.tree?.forEach(fg => expanded.add(fg.code));
        setExpandedBom(expanded);
        setLoading(false);
      });
  }, [selectedPlant]);

  // Fetch AI suggestions when switching to exceptions tab
  useEffect(() => {
    if (tab !== 'exceptions' || !data?.results) return;
    const allExc = data.results.flatMap(r => r.exceptions);
    if (allExc.length === 0) return;
    const payload = allExc.map(e => ({
      module: 'mrp',
      severity: e.severity,
      message: e.message,
      type: e.type,
    }));
    fetch('/api/decisions/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exceptions: payload }),
    })
      .then(r => r.json())
      .then(results => {
        const map = {};
        results.forEach((r, i) => {
          if (r.suggestion && r.suggestion.confidence > 0) {
            map[i] = r.suggestion;
          }
        });
        setSuggestions(map);
      })
      .catch(() => {});
  }, [tab, data]);

  const allExceptions = data?.results?.flatMap(r => r.exceptions) || [];
  const expCounts = {
    expedite: allExceptions.filter(e => e.type === 'expedite').length,
    'reschedule-in': allExceptions.filter(e => e.type === 'reschedule-in').length,
    'reschedule-out': allExceptions.filter(e => e.type === 'reschedule-out').length,
    cancel: allExceptions.filter(e => e.type === 'cancel').length,
  };

  const selectedResult = data?.results?.find(r => r.skuCode === selectedSku);

  const toggleBomExpand = (code) => {
    setExpandedBom(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const refetchBom = async () => {
    try {
      const r = await fetch(`/api/mrp/bom?plant=${selectedPlant}`);
      if (!r.ok) throw new Error();
      const bom = await r.json();
      setBomData(bom);
    } catch {
      // keep current data on failure
    }
  };

  const startEditBomLine = (parentCode, child) => {
    setEditingBomLine({ parentCode, childCode: child.code });
    setEditBomValues({ qtyPer: child.qtyPer ?? '', scrapPct: child.scrapPct ?? 0 });
    setAddingTo(null);
  };

  const saveBomEdit = async () => {
    if (!editingBomLine) return;
    setBomSaving(true);
    try {
      const res = await fetch('/api/mrp/bom', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plant: selectedPlant,
          parentCode: editingBomLine.parentCode,
          childCode: editingBomLine.childCode,
          qtyPer: parseFloat(editBomValues.qtyPer),
          scrapPct: parseFloat(editBomValues.scrapPct) || 0,
        }),
      });
      if (res.ok) await refetchBom();
    } catch {
      // silently fail for static/Vercel mode
    }
    setEditingBomLine(null);
    setBomSaving(false);
  };

  const deleteBomLine = async (parentCode, childCode) => {
    if (!window.confirm(`Delete component ${childCode} from ${parentCode}?`)) return;
    setBomSaving(true);
    try {
      const res = await fetch('/api/mrp/bom', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plant: selectedPlant, parentCode, childCode }),
      });
      if (res.ok) await refetchBom();
    } catch {
      // silently fail for static/Vercel mode
    }
    setBomSaving(false);
  };

  const addBomLine = async (parentCode) => {
    if (!newBomLine.code) return;
    setBomSaving(true);
    try {
      const res = await fetch('/api/mrp/bom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plant: selectedPlant,
          parentCode,
          childCode: newBomLine.code,
          childName: newBomLine.name,
          qtyPer: parseFloat(newBomLine.qtyPer) || 1,
          scrapPct: parseFloat(newBomLine.scrapPct) || 0,
        }),
      });
      if (res.ok) await refetchBom();
    } catch {
      // silently fail for static/Vercel mode
    }
    setAddingTo(null);
    setNewBomLine({ code: '', name: '', qtyPer: 1, scrapPct: 0 });
    setBomSaving(false);
  };

  return (
    <ModuleLayout moduleContext="mrp" tabs={TABS} activeTab={tab} onTabChange={setTab}>
      <PageHeader title="Material Requirements Planning" subtitle="MRP" />

      <div className="module-content" style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 40px' }}>

        {/* Plant selector */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: T.inkLight, marginRight: 4 }}>Plant:</span>
          {PLANTS.map(p => (
            <button
              key={p}
              onClick={() => setSelectedPlant(p)}
              style={{
                background: selectedPlant === p ? T.ink : T.white,
                color: selectedPlant === p ? T.white : T.ink,
                border: `1px solid ${selectedPlant === p ? T.ink : T.border}`,
                borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
                fontFamily: 'JetBrains Mono', fontSize: 10, transition: 'all 0.12s',
              }}
            >
              {p}
            </button>
          ))}
          <span style={{ fontSize: 10, color: T.inkLight, marginLeft: 8 }}>
            Plant-specific BOM — different plants may have different BOMs for the same product
          </span>
        </div>

        {/* Status bar */}
        {data && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <StatusPill label="SKUs Planned" value={data.skusPlanned} />
            <StatusPill label="Exceptions" value={data.totalExceptions} color={data.criticalExceptions > 0 ? T.risk : T.safe} />
            <StatusPill label="Critical" value={data.criticalExceptions} color={data.criticalExceptions > 0 ? T.risk : T.safe} />
            {tab === 'bom' && bomData && (
              <StatusPill label="BOM Items" value={bomData.tree?.length || 0} />
            )}
          </div>
        )}

        {/* ─── BOM Tab ─────────────────────────────────────────── */}
        {tab === 'bom' && (
          <Card title={`Bill of Materials — ${selectedPlant}`}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>Loading BOM...</div>
            ) : bomData?.tree ? (
              <div style={{ padding: '12px 0' }}>
                {/* BOM Legend */}
                <div style={{ display: 'flex', gap: 16, padding: '0 20px 12px', borderBottom: `1px solid ${T.border}` }}>
                  {Object.entries(LEVEL_COLORS).map(([level, cfg]) => (
                    <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{
                        display: 'inline-block', padding: '1px 6px', borderRadius: 3,
                        background: cfg.bg, color: cfg.text, fontSize: 8, fontWeight: 600,
                        fontFamily: 'JetBrains Mono', letterSpacing: 0.5,
                      }}>{cfg.label}</span>
                      <span style={{ fontSize: 10, color: T.inkLight }}>
                        {level === '0' ? 'Finished Good' : level === '1' ? 'Subassembly' : 'Raw Material'}
                      </span>
                    </div>
                  ))}
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 10, color: T.inkGhost }}>Click to expand/collapse</span>
                </div>

                {/* BOM Tree */}
                {bomData.tree.map(fg => (
                  <BomNode
                    key={fg.code}
                    node={fg}
                    depth={0}
                    expanded={expandedBom}
                    onToggle={toggleBomExpand}
                    selectedPlant={selectedPlant}
                    editingBomLine={editingBomLine}
                    editBomValues={editBomValues}
                    setEditBomValues={setEditBomValues}
                    onStartEdit={startEditBomLine}
                    onSaveEdit={saveBomEdit}
                    onCancelEdit={() => setEditingBomLine(null)}
                    onDelete={deleteBomLine}
                    addingTo={addingTo}
                    setAddingTo={setAddingTo}
                    newBomLine={newBomLine}
                    setNewBomLine={setNewBomLine}
                    onAddLine={addBomLine}
                    bomSaving={bomSaving}
                  />
                ))}

                {/* Dual-source callout */}
                {selectedPlant === 'PLT-PDX' && (
                  <div style={{
                    margin: '16px 20px 8px', padding: '10px 14px', background: T.warnBg,
                    border: `1px solid ${T.warnBorder}`, borderRadius: 8, fontSize: 11, color: T.warn,
                  }}>
                    <strong>Dual-sourced:</strong> PRO-BAR uses MIX-PRO (whey protein blend) at Portland.
                    At PLT-NSH it uses NUT-RST (roasted nut base) with different protein source.
                  </div>
                )}
                {selectedPlant === 'PLT-NSH' && (
                  <div style={{
                    margin: '16px 20px 8px', padding: '10px 14px', background: T.warnBg,
                    border: `1px solid ${T.warnBorder}`, borderRadius: 8, fontSize: 11, color: T.warn,
                  }}>
                    <strong>Dual-sourced:</strong> PRO-BAR uses NUT-RST (roasted nut base) at Nashville.
                    At PLT-PDX it uses MIX-PRO (whey protein blend) with different protein source.
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>No BOM data available</div>
            )}
          </Card>
        )}

        {/* ─── Records Tab ─────────────────────────────────────── */}
        {tab === 'records' && (
          <>
            {/* SKU selector */}
            {data && (
              <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
                {data.results?.map(r => (
                  <button
                    key={r.skuCode}
                    onClick={() => setSelectedSku(r.skuCode)}
                    style={{
                      background: selectedSku === r.skuCode ? T.ink : T.white,
                      color: selectedSku === r.skuCode ? T.white : T.ink,
                      border: `1px solid ${selectedSku === r.skuCode ? T.ink : T.border}`,
                      borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
                      fontFamily: 'JetBrains Mono', fontSize: 10, transition: 'all 0.12s',
                    }}
                  >
                    {r.skuCode}
                    {r.criticalExceptions > 0 && (
                      <span style={{ marginLeft: 4, color: selectedSku === r.skuCode ? '#ff9999' : T.risk }}>
                        ({r.criticalExceptions})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            <Card title={`Time-Phased MRP Records — ${selectedSku || '...'}`}>
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>Running MRP explosion...</div>
              ) : selectedResult ? (
                <div style={{ overflowX: 'auto' }}>
                  {/* SKU info bar */}
                  <div style={{ padding: '10px 16px', background: T.bgDark, borderBottom: `1px solid ${T.border}`, display: 'flex', gap: 20, fontSize: 11 }}>
                    <span><span style={{ color: T.inkLight }}>Name:</span> {selectedResult.skuName || selectedResult.skuCode}</span>
                    <span><span style={{ color: T.inkLight }}>Level:</span> {selectedResult.level ?? '—'}</span>
                    <span><span style={{ color: T.inkLight }}>Lead Time:</span> {selectedResult.leadTime || '—'} wk</span>
                    <span><span style={{ color: T.inkLight }}>Lot Sizing:</span> {selectedResult.lotSizing || '—'}</span>
                    <span><span style={{ color: T.inkLight }}>Safety Stock:</span> {selectedResult.safetyStock ?? '—'}</span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'JetBrains Mono' }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                        {['Period', 'Gross Req', 'Sched Rcpt', 'Proj OH', 'Net Req', 'Pln Rcpt', 'Pln Release'].map(h => (
                          <th key={h} scope="col" style={{ textAlign: h === 'Period' ? 'left' : 'right', padding: '8px 10px', color: T.inkLight, fontWeight: 500, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedResult.records.map(r => (
                        <tr key={r.period} style={{ borderBottom: `1px solid ${T.border}` }}>
                          <td style={{ padding: '6px 10px', color: T.inkMid }}>{r.period}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right' }}>{fmt(r.grossReq)}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: r.scheduledReceipts > 0 ? T.accent : T.inkGhost }}>{fmt(r.scheduledReceipts)}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: r.projectedOH < 0 ? T.risk : T.ink, fontWeight: r.projectedOH < 0 ? 600 : 400 }}>{fmt(r.projectedOH)}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: r.netReq > 0 ? T.warn : T.inkGhost }}>{fmt(r.netReq)}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: r.plannedOrderReceipt > 0 ? T.safe : T.inkGhost }}>{fmt(r.plannedOrderReceipt)}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: r.plannedOrderRelease > 0 ? T.accent : T.inkGhost, fontWeight: r.plannedOrderRelease > 0 ? 600 : 400 }}>{fmt(r.plannedOrderRelease)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>Select a SKU above</div>
              )}
            </Card>
          </>
        )}

        {/* ─── Exceptions Tab ──────────────────────────────────── */}
        {tab === 'exceptions' && (
          <>
            <div className="mrp-exceptions-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Expedite', count: expCounts.expedite, color: T.risk, desc: 'Need sooner than planned' },
                { label: 'Reschedule In', count: expCounts['reschedule-in'], color: T.warn, desc: 'Move receipt earlier' },
                { label: 'Reschedule Out', count: expCounts['reschedule-out'], color: T.safe, desc: 'Defer — demand reduced' },
                { label: 'Cancel', count: expCounts.cancel, color: T.inkLight, desc: 'No longer needed' },
              ].map(e => (
                <div key={e.label} style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 8, padding: '14px 16px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Sora', fontSize: 28, fontWeight: 600, color: e.color }}>{e.count}</div>
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkLight, letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 }}>{e.label}</div>
                  <div style={{ fontSize: 9, color: T.inkGhost, marginTop: 2 }}>{e.desc}</div>
                </div>
              ))}
            </div>

            <Card title={`Exception Details (${allExceptions.length} total)`}>
              {allExceptions.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                        {['Severity', 'SKU', 'Type', 'Period', 'Qty', 'Message', 'AI Suggestion'].map(h => (
                          <th key={h} scope="col" style={{ textAlign: 'left', padding: '8px 10px', color: T.inkLight, fontWeight: 500, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allExceptions.map((e, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${T.border}`, background: e.severity === 'critical' ? T.riskBg : 'transparent' }}>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{
                              display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                              background: e.severity === 'critical' ? T.riskBg : e.severity === 'warning' ? T.warnBg : T.bgDark,
                              color: e.severity === 'critical' ? T.risk : e.severity === 'warning' ? T.warn : T.inkMid,
                              border: `1px solid ${e.severity === 'critical' ? T.riskBorder : e.severity === 'warning' ? T.warnBorder : T.border}`,
                            }}>
                              {e.severity}
                            </span>
                          </td>
                          <td style={{ padding: '8px 10px', fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 500 }}>{e.skuCode}</td>
                          <td style={{ padding: '8px 10px', fontFamily: 'JetBrains Mono', fontSize: 11 }}>{e.type}</td>
                          <td style={{ padding: '8px 10px', fontFamily: 'JetBrains Mono', fontSize: 11 }}>{e.period || e.fromPeriod || '—'}</td>
                          <td style={{ padding: '8px 10px', fontFamily: 'JetBrains Mono', fontSize: 11 }}>{e.qty || '—'}</td>
                          <td style={{ padding: '8px 10px', fontSize: 12, color: T.inkMid }}>{e.message}</td>
                          <td style={{ padding: '8px 10px' }}>
                            {suggestions[i] && suggestions[i].confidence >= 30 && (
                              <span style={{
                                display: 'inline-block',
                                padding: '3px 8px',
                                borderRadius: 4,
                                fontSize: 10,
                                fontWeight: 500,
                                fontFamily: 'JetBrains Mono',
                                background: suggestions[i].confidence >= 60 ? '#e6f4ea' : '#fef3e0',
                                color: suggestions[i].confidence >= 60 ? '#1a7f37' : '#9a6700',
                                border: `1px solid ${suggestions[i].confidence >= 60 ? '#a7d9b2' : '#f0c87a'}`,
                                whiteSpace: 'nowrap',
                              }}>
                                AI: {suggestions[i].suggestedAction} ({suggestions[i].confidence}%)
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>No exceptions — plan is clean.</div>
              )}
            </Card>
          </>
        )}
      </div>
    </ModuleLayout>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

function StatusPill({ label, value, color }) {
  return (
    <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 16px', fontSize: 12 }}>
      <span style={{ color: T.inkLight }}>{label}:</span>{' '}
      <strong style={{ color: color || T.ink }}>{value}</strong>
    </div>
  );
}

function fmt(v) {
  if (v == null) return '—';
  const n = typeof v === 'number' ? v : parseFloat(v);
  if (isNaN(n)) return '—';
  return Math.round(n * 100) / 100;
}

// ─── BOM Tree Node ────────────────────────────────────────────────

function BomNode({ node, depth, expanded, onToggle, selectedPlant, parentCode,
  editingBomLine, editBomValues, setEditBomValues, onStartEdit, onSaveEdit, onCancelEdit,
  onDelete, addingTo, setAddingTo, newBomLine, setNewBomLine, onAddLine, bomSaving,
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expanded.has(node.code);
  const levelCfg = LEVEL_COLORS[node.level] || LEVEL_COLORS[2];
  const isDualSource = node.code === 'PRO-BAR';
  const isEditing = editingBomLine && editingBomLine.parentCode === parentCode && editingBomLine.childCode === node.code;
  const isChild = depth > 0;

  return (
    <div>
      {/* Edit inline row */}
      {isEditing ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: `6px 20px 6px ${20 + depth * 28}px`,
          borderBottom: `1px solid ${T.border}`, background: `${T.accent}08`,
        }}>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 600, color: T.ink, minWidth: 90 }}>
            {node.code}
          </span>
          <span style={{ fontSize: 11, color: T.inkMid }}>{node.name}</span>
          <span style={{ fontSize: 10, color: T.inkLight, marginLeft: 8 }}>Qty:</span>
          <input
            type="number"
            step="0.1"
            value={editBomValues.qtyPer}
            onChange={e => setEditBomValues(prev => ({ ...prev, qtyPer: e.target.value }))}
            style={{
              width: 60, fontFamily: 'JetBrains Mono', fontSize: 11, padding: '3px 6px',
              border: `1px solid ${T.accent}`, borderRadius: 4, textAlign: 'right',
            }}
          />
          <span style={{ fontSize: 10, color: T.inkLight }}>Scrap%:</span>
          <input
            type="number"
            step="0.1"
            value={editBomValues.scrapPct}
            onChange={e => setEditBomValues(prev => ({ ...prev, scrapPct: e.target.value }))}
            style={{
              width: 50, fontFamily: 'JetBrains Mono', fontSize: 11, padding: '3px 6px',
              border: `1px solid ${T.accent}`, borderRadius: 4, textAlign: 'right',
            }}
          />
          <button
            onClick={onSaveEdit}
            disabled={bomSaving}
            style={{
              background: T.safe, color: T.white, border: 'none', borderRadius: 4,
              padding: '3px 10px', fontSize: 10, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'JetBrains Mono',
            }}
          >Save</button>
          <button
            onClick={onCancelEdit}
            style={{
              background: T.bgDark, color: T.inkMid, border: `1px solid ${T.border}`, borderRadius: 4,
              padding: '3px 10px', fontSize: 10, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'JetBrains Mono',
            }}
          >Cancel</button>
        </div>
      ) : (
        /* Node row */
        <div
          onClick={() => hasChildren && onToggle(node.code)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: `8px 20px 8px ${20 + depth * 28}px`,
            cursor: hasChildren ? 'pointer' : 'default',
            borderBottom: `1px solid ${T.border}`,
            background: depth === 0 ? T.bgDark : 'transparent',
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => { if (hasChildren) e.currentTarget.style.background = T.bgDark; }}
          onMouseLeave={e => { if (depth > 0) e.currentTarget.style.background = 'transparent'; }}
        >
          {/* Expand/collapse indicator */}
          <span style={{
            width: 16, textAlign: 'center', fontSize: 10, color: T.inkLight,
            fontFamily: 'JetBrains Mono',
          }}>
            {hasChildren ? (isExpanded ? '\u25BC' : '\u25B6') : (depth > 0 ? '\u2514' : '')}
          </span>

          {/* Level badge */}
          <span style={{
            display: 'inline-block', padding: '1px 6px', borderRadius: 3,
            background: levelCfg.bg, color: levelCfg.text,
            fontSize: 8, fontWeight: 600, fontFamily: 'JetBrains Mono',
            letterSpacing: 0.5, minWidth: 28, textAlign: 'center',
          }}>
            {levelCfg.label}
          </span>

          {/* Code */}
          <span style={{
            fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 600,
            color: T.ink, minWidth: 90,
          }}>
            {node.code}
            {isDualSource && (
              <span style={{ marginLeft: 6, fontSize: 9, color: T.warn, fontWeight: 400 }}>
                DUAL
              </span>
            )}
          </span>

          {/* Name */}
          <span style={{ fontSize: 12, color: T.inkMid, flex: 1 }}>
            {node.name}
          </span>

          {/* Qty per (for children) */}
          {node.qtyPer != null && (
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkMid, minWidth: 50, textAlign: 'right' }}>
              \u00D7{node.qtyPer}
            </span>
          )}

          {/* Scrap */}
          {node.scrapPct > 0 && (
            <span style={{
              fontFamily: 'JetBrains Mono', fontSize: 9, color: T.warn,
              background: T.warnBg, padding: '1px 5px', borderRadius: 3,
            }}>
              {node.scrapPct}% scrap
            </span>
          )}

          {/* Lead time */}
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkLight, minWidth: 40, textAlign: 'right' }}>
            {node.leadTime}wk
          </span>

          {/* Lot sizing */}
          <span style={{
            fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkGhost,
            minWidth: 50, textAlign: 'right',
          }}>
            {node.lotSizing === 'lot-for-lot' ? 'L4L' :
             node.lotSizing === 'fixed-order-qty' ? 'FOQ' :
             node.lotSizing === 'eoq' ? 'EOQ' :
             node.lotSizing === 'period-order-qty' ? 'POQ' :
             node.lotSizing || '\u2014'}
          </span>

          {/* On hand */}
          <span style={{
            fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkMid,
            minWidth: 50, textAlign: 'right',
          }}>
            OH:{node.onHand ?? 0}
          </span>

          {/* Edit / Delete buttons for child nodes */}
          {isChild && parentCode && (
            <span style={{ display: 'flex', gap: 4, marginLeft: 8 }} onClick={e => e.stopPropagation()}>
              <button
                onClick={() => onStartEdit(parentCode, node)}
                style={{
                  background: T.white, color: T.accent, border: `1px solid ${T.accent}33`,
                  borderRadius: 3, padding: '2px 6px', fontSize: 9, cursor: 'pointer',
                  fontFamily: 'JetBrains Mono', fontWeight: 600,
                }}
              >Edit</button>
              <button
                onClick={() => onDelete(parentCode, node.code)}
                style={{
                  background: T.white, color: T.risk, border: `1px solid ${T.risk}33`,
                  borderRadius: 3, padding: '2px 6px', fontSize: 9, cursor: 'pointer',
                  fontFamily: 'JetBrains Mono', fontWeight: 600,
                }}
              >Del</button>
            </span>
          )}
        </div>
      )}

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map(child => (
            <BomNode
              key={child.code}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              selectedPlant={selectedPlant}
              parentCode={node.code}
              editingBomLine={editingBomLine}
              editBomValues={editBomValues}
              setEditBomValues={setEditBomValues}
              onStartEdit={onStartEdit}
              onSaveEdit={onSaveEdit}
              onCancelEdit={onCancelEdit}
              onDelete={onDelete}
              addingTo={addingTo}
              setAddingTo={setAddingTo}
              newBomLine={newBomLine}
              setNewBomLine={setNewBomLine}
              onAddLine={onAddLine}
              bomSaving={bomSaving}
            />
          ))}

          {/* Add Component row */}
          {addingTo === node.code ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: `6px 20px 6px ${20 + (depth + 1) * 28}px`,
              borderBottom: `1px solid ${T.border}`, background: `${T.safe}08`,
            }}>
              <input
                placeholder="Code"
                value={newBomLine.code}
                onChange={e => setNewBomLine(prev => ({ ...prev, code: e.target.value }))}
                style={{
                  width: 80, fontFamily: 'JetBrains Mono', fontSize: 11, padding: '3px 6px',
                  border: `1px solid ${T.border}`, borderRadius: 4,
                }}
              />
              <input
                placeholder="Name"
                value={newBomLine.name}
                onChange={e => setNewBomLine(prev => ({ ...prev, name: e.target.value }))}
                style={{
                  width: 140, fontSize: 11, padding: '3px 6px',
                  border: `1px solid ${T.border}`, borderRadius: 4,
                }}
              />
              <span style={{ fontSize: 10, color: T.inkLight }}>Qty:</span>
              <input
                type="number"
                step="0.1"
                value={newBomLine.qtyPer}
                onChange={e => setNewBomLine(prev => ({ ...prev, qtyPer: e.target.value }))}
                style={{
                  width: 50, fontFamily: 'JetBrains Mono', fontSize: 11, padding: '3px 6px',
                  border: `1px solid ${T.border}`, borderRadius: 4, textAlign: 'right',
                }}
              />
              <span style={{ fontSize: 10, color: T.inkLight }}>Scrap%:</span>
              <input
                type="number"
                step="0.1"
                value={newBomLine.scrapPct}
                onChange={e => setNewBomLine(prev => ({ ...prev, scrapPct: e.target.value }))}
                style={{
                  width: 45, fontFamily: 'JetBrains Mono', fontSize: 11, padding: '3px 6px',
                  border: `1px solid ${T.border}`, borderRadius: 4, textAlign: 'right',
                }}
              />
              <button
                onClick={() => onAddLine(node.code)}
                disabled={bomSaving || !newBomLine.code}
                style={{
                  background: T.safe, color: T.white, border: 'none', borderRadius: 4,
                  padding: '3px 10px', fontSize: 10, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'JetBrains Mono', opacity: !newBomLine.code ? 0.5 : 1,
                }}
              >Add</button>
              <button
                onClick={() => setAddingTo(null)}
                style={{
                  background: T.bgDark, color: T.inkMid, border: `1px solid ${T.border}`, borderRadius: 4,
                  padding: '3px 10px', fontSize: 10, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'JetBrains Mono',
                }}
              >Cancel</button>
            </div>
          ) : (
            <div
              style={{
                padding: `4px 20px 4px ${20 + (depth + 1) * 28}px`,
                borderBottom: `1px solid ${T.border}`,
              }}
            >
              <button
                onClick={() => { setAddingTo(node.code); setNewBomLine({ code: '', name: '', qtyPer: 1, scrapPct: 0 }); }}
                style={{
                  background: 'transparent', color: T.accent, border: `1px dashed ${T.accent}44`,
                  borderRadius: 4, padding: '2px 10px', fontSize: 10, cursor: 'pointer',
                  fontFamily: 'JetBrains Mono', fontWeight: 500,
                }}
              >+ Add Component</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
