import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { T } from '../styles/tokens';
import ModuleLayout from '../components/shared/ModuleLayout';
import PageHeader from '../components/shared/PageHeader';
import Card from '../components/shared/Card';
import TrustScore from '../components/TrustScore';
import DataSourceBadge from '../components/shared/DataSourceBadge';

const TABS = [
  { id: 'bom', label: 'Bill of Materials' },
  { id: 'records', label: 'Material Requirements' },
  { id: 'exceptions', label: 'Action Messages' },
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
  const navigate = useNavigate();
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
  const [requirementsView, setRequirementsView] = useState('summary'); // 'summary' or 'explosion'
  const [isLive, setIsLive] = useState(false);
  const [resolvedExceptions, setResolvedExceptions] = useState({}); // { index: { status, decidedBy } }
  const [actionLoading, setActionLoading] = useState(null); // index being acted on

  const handleExceptionAction = async (exception, index, action) => {
    setActionLoading(index);
    try {
      const statusMap = { accept: 'accepted', defer: 'deferred', dismiss: 'dismissed' };
      const actionLabel = action === 'accept' ? `Accept: ${exception.type}` : action === 'defer' ? `Defer: ${exception.type}` : `Dismiss: ${exception.type}`;
      const resp = await fetch('/api/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: 'mrp',
          action: actionLabel,
          entityType: 'exception',
          entity: `${exception.skuCode || 'Unknown'} — ${exception.message?.slice(0, 60)}`,
          rationale: suggestions[index]?.suggestedAction
            ? `AI suggested: ${suggestions[index].suggestedAction} (${suggestions[index].confidence}% confidence)`
            : 'Planner decision',
          decidedBy: action === 'accept' && suggestions[index]?.confidence >= 60 ? 'AI recommended' : 'Planner',
          financialImpact: exception.qty ? {
            amount: exception.type === 'expedite' ? exception.qty * 15 : exception.type === 'cancel' ? exception.qty * 7.5 : exception.qty * 10,
            type: action === 'accept' ? 'cost-avoidance' : 'cost',
          } : null,
          status: statusMap[action],
        }),
      });
      if (!resp.ok) throw new Error(`Decision API returned ${resp.status}`);
    } catch {
      /* API unavailable — proceed with optimistic update */
    }
    setResolvedExceptions(prev => ({ ...prev, [index]: { status: statusMap[action], action } }));
    setActionLoading(null);
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/mrp/demo?plant=${selectedPlant}`).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
      fetch(`/api/mrp/bom?plant=${selectedPlant}`).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
    ])
      .then(([mrp, bom]) => {
        setData(mrp);
        setBomData(bom);
        setIsLive(true);
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
        setIsLive(false);
        if (STATIC_MRP.results?.length > 0) setSelectedSku(STATIC_MRP.results[0].skuCode);
        const expanded = new Set();
        STATIC_BOM.tree?.forEach(fg => expanded.add(fg.code));
        setExpandedBom(expanded);
        setLoading(false);
      });
  }, [selectedPlant]);

  // Fetch AI suggestions when switching to action messages tab
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
      <PageHeader title="Material Planning" subtitle="Requirements & Bill of Materials">
        <DataSourceBadge isLive={isLive} />
        <TrustScore module="mrp" compact />
      </PageHeader>

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
            <StatusPill label="Items Planned" value={data.skusPlanned} />
            <StatusPill label="Action Messages" value={data.totalExceptions} color={data.criticalExceptions > 0 ? T.risk : T.safe} />
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
                    allPlants={PLANTS}
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

        {/* ─── Material Requirements Tab ─────────────────────── */}
        {tab === 'records' && (
          <>
            {/* Sub-view toggle */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
              {[
                { id: 'summary', label: 'Requirements Summary' },
                { id: 'explosion', label: 'Full Explosion' },
              ].map(v => (
                <button
                  key={v.id}
                  onClick={() => setRequirementsView(v.id)}
                  style={{
                    background: requirementsView === v.id ? T.ink : T.white,
                    color: requirementsView === v.id ? T.white : T.ink,
                    border: `1px solid ${requirementsView === v.id ? T.ink : T.border}`,
                    borderRadius: 6, padding: '5px 12px', cursor: 'pointer',
                    fontFamily: 'JetBrains Mono', fontSize: 10, transition: 'all 0.12s',
                  }}
                >
                  {v.label}
                </button>
              ))}
            </div>

            {/* Requirements Summary sub-view */}
            {requirementsView === 'summary' && (
              <>
                {/* Item selector */}
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
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        {r.skuCode}
                        <span style={{
                          fontSize: 8, opacity: 0.7, fontWeight: 400,
                          padding: '0 4px', borderRadius: 2,
                          background: selectedSku === r.skuCode ? 'rgba(255,255,255,0.15)' : T.bgDark,
                        }}>
                          {formatLotSizing(r.lotSizing)}
                        </span>
                        {r.criticalExceptions > 0 && (
                          <span style={{ color: selectedSku === r.skuCode ? '#ff9999' : T.risk }}>
                            ({r.criticalExceptions})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                <Card title={`Time-Phased Requirements — ${selectedSku || '...'}`}>
                  {loading ? (
                    <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>Running material explosion...</div>
                  ) : selectedResult ? (
                    <div style={{ overflowX: 'auto' }}>
                      {/* Item info bar */}
                      <div style={{ padding: '10px 16px', background: T.bgDark, borderBottom: `1px solid ${T.border}`, display: 'flex', gap: 20, fontSize: 11, alignItems: 'center' }}>
                        <span><span style={{ color: T.inkLight }}>Name:</span> {selectedResult.skuName || selectedResult.skuCode}</span>
                        <span><span style={{ color: T.inkLight }}>Level:</span> {selectedResult.level ?? '\u2014'}</span>
                        <span><span style={{ color: T.inkLight }}>Lead Time:</span> {selectedResult.leadTime || '\u2014'} wk</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ color: T.inkLight }}>Lot Sizing:</span>
                          <span style={{
                            display: 'inline-block', padding: '1px 6px', borderRadius: 3,
                            background: T.accent + '12', color: T.accent, fontSize: 9, fontWeight: 600,
                            fontFamily: 'JetBrains Mono', border: `1px solid ${T.accent}33`,
                          }}>{formatLotSizing(selectedResult.lotSizing)}</span>
                        </span>
                        <span><span style={{ color: T.inkLight }}>Safety Stock:</span> {selectedResult.safetyStock ?? '\u2014'}</span>
                      </div>
                      {/* Inventory Projection Chart */}
                      <div style={{ padding: '12px 16px 4px' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, fontFamily: 'Sora', color: T.ink, marginBottom: 8 }}>
                          Inventory Projection
                        </div>
                        <svg viewBox="0 0 700 140" style={{ width: '100%', maxWidth: 700 }}>
                          {(() => {
                            const recs = selectedResult.records;
                            const ss = selectedResult.safetyStock || 0;
                            const maxVal = Math.max(...recs.map(r => Math.max(r.grossReq, r.projectedOH, r.plannedOrderReceipt)), ss, 1) * 1.2;
                            const n = recs.length;
                            const barW = Math.min(50, (640 / n) * 0.4);
                            const gap = (640 - n * barW * 2) / (n + 1);
                            return (
                              <>
                                {[0.25, 0.5, 0.75, 1].map(f => (
                                  <g key={f}>
                                    <line x1="50" y1={120 - f * 100} x2="690" y2={120 - f * 100} stroke={T.border} strokeDasharray="2,3" />
                                    <text x="46" y={124 - f * 100} textAnchor="end" fontSize="8" fill={T.inkLight} fontFamily="JetBrains Mono">{Math.round(maxVal * f)}</text>
                                  </g>
                                ))}
                                <line x1="50" y1="120" x2="690" y2="120" stroke={T.border} />
                                {ss > 0 && (
                                  <>
                                    <line x1="50" y1={120 - (ss / maxVal) * 100} x2="690" y2={120 - (ss / maxVal) * 100} stroke={T.risk} strokeDasharray="4,3" strokeWidth="1" opacity="0.5" />
                                    <text x="692" y={124 - (ss / maxVal) * 100} fontSize="7" fill={T.risk} fontFamily="JetBrains Mono" opacity="0.7">SS</text>
                                  </>
                                )}
                                {recs.map((r, i) => {
                                  const x = 55 + i * (barW * 2 + gap);
                                  const gH = (r.grossReq / maxVal) * 100;
                                  const pH = (Math.max(r.projectedOH, 0) / maxVal) * 100;
                                  return (
                                    <g key={i}>
                                      <rect x={x} y={120 - gH} width={barW - 1} height={gH} rx="2" fill={T.risk} opacity="0.2" />
                                      <rect x={x + barW} y={120 - pH} width={barW - 1} height={pH} rx="2" fill={r.projectedOH < ss ? T.warn : T.safe} opacity="0.65" />
                                      <text x={x + barW} y="132" textAnchor="middle" fontSize="7" fill={T.inkLight} fontFamily="JetBrains Mono">{r.period}</text>
                                    </g>
                                  );
                                })}
                                <rect x="420" y="2" width="8" height="8" rx="1" fill={T.risk} opacity="0.2" />
                                <text x="432" y="10" fontSize="8" fill={T.inkMid} fontFamily="JetBrains Mono">Gross Req</text>
                                <rect x="510" y="2" width="8" height="8" rx="1" fill={T.safe} opacity="0.65" />
                                <text x="522" y="10" fontSize="8" fill={T.inkMid} fontFamily="JetBrains Mono">Projected OH</text>
                              </>
                            );
                          })()}
                        </svg>
                      </div>

                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'JetBrains Mono' }}>
                        <thead>
                          <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                            {['Period', 'Total Need', 'On Order', 'Projected Avail', 'Net Need', 'Planned Receipt', 'Planned Release'].map(h => (
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
                    <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>Select an item above</div>
                  )}
                </Card>
              </>
            )}

            {/* Full Explosion View */}
            {requirementsView === 'explosion' && (
              <BomExplosionView bomData={bomData} mrpData={data} loading={loading} />
            )}
          </>
        )}

        {/* ─── Action Messages Tab ─────────────────────────────── */}
        {tab === 'exceptions' && (
          <>
            <div className="mrp-exceptions-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Expedite', count: expCounts.expedite, color: T.risk, desc: 'Need sooner than planned' },
                { label: 'Reschedule In', count: expCounts['reschedule-in'], color: T.warn, desc: 'Move receipt earlier' },
                { label: 'Reschedule Out', count: expCounts['reschedule-out'], color: T.safe, desc: 'Defer \u2014 demand reduced' },
                { label: 'Cancel', count: expCounts.cancel, color: T.inkLight, desc: 'No longer needed' },
              ].map(e => (
                <div key={e.label} style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 8, padding: '14px 16px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Sora', fontSize: 28, fontWeight: 600, color: e.color }}>{e.count}</div>
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkLight, letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 }}>{e.label}</div>
                  <div style={{ fontSize: 9, color: T.inkGhost, marginTop: 2 }}>{e.desc}</div>
                </div>
              ))}
            </div>

            <Card title={`Action Message Details (${allExceptions.length} total)`}>
              {allExceptions.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                        {['Severity', 'Item', 'Type', 'Period', 'Qty', '$ Impact', 'Source', 'Message', 'AI Suggestion', 'Actions'].map(h => (
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
                          <td style={{ padding: '8px 10px', fontFamily: 'JetBrains Mono', fontSize: 11 }}>{e.period || e.fromPeriod || '\u2014'}</td>
                          <td style={{ padding: '8px 10px', fontFamily: 'JetBrains Mono', fontSize: 11 }}>{e.qty || '\u2014'}</td>
                          <td style={{ padding: '8px 10px', fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', color: e.financialImpact?.type === 'cost' || e.financialImpact?.type === 'risk' ? T.risk : e.financialImpact?.type === 'cost-avoidance' || e.financialImpact?.type === 'savings' ? T.safe : T.inkMid }}>
                            {e.financialImpact ? `$${e.financialImpact.amount.toLocaleString()}` : '—'}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            {e.sourceModule && (
                              <button
                                onClick={() => navigate(`/${e.sourceModule}?sku=${e.sourceSku || e.skuCode}`)}
                                style={{
                                  background: 'none', border: `1px solid ${T.accent}`, borderRadius: 4,
                                  padding: '2px 8px', fontSize: 10, fontFamily: 'JetBrains Mono', color: T.accent,
                                  cursor: 'pointer', whiteSpace: 'nowrap',
                                }}
                              >
                                DRP {e.sourceDCs?.[0] ? `· ${e.sourceDCs[0]}` : ''}
                              </button>
                            )}
                          </td>
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
                          <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                            {resolvedExceptions[i] ? (
                              <span style={{
                                display: 'inline-block', padding: '3px 10px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                                background: resolvedExceptions[i].status === 'accepted' ? '#e6f4ea' : resolvedExceptions[i].status === 'deferred' ? '#fef3e0' : T.bgDark,
                                color: resolvedExceptions[i].status === 'accepted' ? '#1a7f37' : resolvedExceptions[i].status === 'deferred' ? '#9a6700' : T.inkMid,
                              }}>
                                {resolvedExceptions[i].status === 'accepted' ? '✓ Accepted' : resolvedExceptions[i].status === 'deferred' ? '⏳ Deferred' : '✕ Dismissed'}
                              </span>
                            ) : (
                              <div style={{ display: 'flex', gap: 4 }}>
                                {[
                                  { key: 'accept', label: 'Accept', bg: '#e6f4ea', color: '#1a7f37', border: '#a7d9b2' },
                                  { key: 'defer', label: 'Defer', bg: '#fef3e0', color: '#9a6700', border: '#f0c87a' },
                                  { key: 'dismiss', label: 'Dismiss', bg: T.bgDark, color: T.inkMid, border: T.border },
                                ].map(btn => (
                                  <button key={btn.key} onClick={() => handleExceptionAction(e, i, btn.key)}
                                    disabled={actionLoading === i}
                                    style={{
                                      padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 500, cursor: 'pointer',
                                      background: btn.bg, color: btn.color, border: `1px solid ${btn.border}`,
                                      opacity: actionLoading === i ? 0.5 : 1,
                                    }}>
                                    {actionLoading === i ? '...' : btn.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>No action messages \u2014 plan is clean.</div>
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

function formatLotSizing(ls) {
  if (!ls) return '\u2014';
  if (ls === 'L4L' || ls === 'lot-for-lot') return 'Lot-for-Lot';
  if (ls === 'FOQ' || ls === 'fixed-order-qty') return 'Fixed Order Qty';
  if (ls === 'EOQ' || ls === 'eoq') return 'EOQ';
  if (ls === 'POQ' || ls === 'period-order-qty') return 'Period Order Qty';
  return ls;
}

function fmt(v) {
  if (v == null) return '\u2014';
  const n = typeof v === 'number' ? v : parseFloat(v);
  if (isNaN(n)) return '\u2014';
  return Math.round(n * 100) / 100;
}

// ─── BOM Explosion View ───────────────────────────────────────────

function BomExplosionView({ bomData, mrpData, loading }) {
  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>Loading explosion...</div>;
  if (!bomData?.tree || !mrpData?.results) return <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>No data available</div>;

  // Build explosion rows from BOM tree and MRP data
  const rows = [];
  const mrpByCode = {};
  (mrpData.results || []).forEach(r => { mrpByCode[r.skuCode] = r; });

  bomData.tree.forEach(fg => {
    const fgMrp = mrpByCode[fg.code];
    const fgGross = fgMrp ? fgMrp.records.reduce((s, r) => s + (r.grossReq || 0), 0) : 0;
    const fgNet = fgMrp ? fgMrp.records.reduce((s, r) => s + (r.netReq || 0), 0) : 0;
    rows.push({ level: 0, code: fg.code, name: fg.name, qtyPer: '\u2014', scrapPct: '\u2014', gross: Math.round(fgGross), net: Math.round(fgNet) });

    (fg.children || []).forEach(child => {
      const scrap = child.scrapPct || 0;
      const scrapFactor = scrap > 0 ? 1 / (1 - scrap / 100) : 1;
      const childGross = Math.round(fgGross * (child.qtyPer || 0) * scrapFactor);
      const childMrp = mrpByCode[child.code];
      const childNet = childMrp ? childMrp.records.reduce((s, r) => s + (r.netReq || 0), 0) : childGross;
      rows.push({ level: 1, code: child.code, name: child.name, qtyPer: child.qtyPer, scrapPct: scrap, gross: childGross, net: Math.round(childNet) });

      (child.children || []).forEach(gc => {
        const gcScrap = gc.scrapPct || 0;
        const gcScrapFactor = gcScrap > 0 ? 1 / (1 - gcScrap / 100) : 1;
        const gcGross = Math.round(childGross * (gc.qtyPer || 0) * gcScrapFactor);
        const gcMrp = mrpByCode[gc.code];
        const gcNet = gcMrp ? gcMrp.records.reduce((s, r) => s + (r.netReq || 0), 0) : gcGross;
        rows.push({ level: 2, code: gc.code, name: gc.name, qtyPer: gc.qtyPer, scrapPct: gcScrap, gross: gcGross, net: Math.round(gcNet) });
      });
    });
  });

  return (
    <Card title="Full BOM Explosion \u2014 Parent-Child Requirements">
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'JetBrains Mono' }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${T.border}` }}>
              {['Level', 'Item', 'Description', 'Qty Per', 'Scrap %', 'Gross Requirement', 'Net Requirement'].map(h => (
                <th key={h} scope="col" style={{
                  textAlign: ['Qty Per', 'Scrap %', 'Gross Requirement', 'Net Requirement'].includes(h) ? 'right' : 'left',
                  padding: '8px 10px', color: T.inkLight, fontWeight: 500, fontSize: 9,
                  textTransform: 'uppercase', letterSpacing: 1,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const levelCfg = LEVEL_COLORS[r.level] || LEVEL_COLORS[2];
              return (
                <tr key={`${r.code}-${i}`} style={{
                  borderBottom: `1px solid ${T.border}`,
                  background: r.level === 0 ? T.bgDark : 'transparent',
                }}>
                  <td style={{ padding: '6px 10px' }}>
                    <span style={{
                      display: 'inline-block', padding: '1px 6px', borderRadius: 3,
                      background: levelCfg.bg, color: levelCfg.text,
                      fontSize: 8, fontWeight: 600, fontFamily: 'JetBrains Mono',
                      letterSpacing: 0.5, minWidth: 22, textAlign: 'center',
                    }}>{r.level}</span>
                  </td>
                  <td style={{ padding: '6px 10px', paddingLeft: 10 + r.level * 20, fontWeight: r.level === 0 ? 600 : 400, color: T.ink }}>
                    {r.code}
                  </td>
                  <td style={{ padding: '6px 10px', color: T.inkMid }}>{r.name}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', color: T.inkMid }}>{r.qtyPer}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', color: r.scrapPct > 0 ? T.warn : T.inkGhost }}>{r.scrapPct === '\u2014' ? '\u2014' : `${r.scrapPct}%`}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 500 }}>{r.gross.toLocaleString()}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', color: r.net > 0 ? T.warn : T.inkGhost, fontWeight: r.net > 0 ? 600 : 400 }}>{r.net.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── BOM Tree Node ────────────────────────────────────────────────

function BomNode({ node, depth, expanded, onToggle, selectedPlant, parentCode,
  editingBomLine, editBomValues, setEditBomValues, onStartEdit, onSaveEdit, onCancelEdit,
  onDelete, addingTo, setAddingTo, newBomLine, setNewBomLine, onAddLine, bomSaving,
  allPlants,
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

          {/* Name + Primary/Secondary badge for root nodes */}
          <span style={{ fontSize: 12, color: T.inkMid, flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            {node.name}
            {depth === 0 && (
              <>
                <span style={{
                  display: 'inline-block', padding: '1px 6px', borderRadius: 3,
                  background: T.safeBg, color: T.safe, fontSize: 8, fontWeight: 600,
                  fontFamily: 'JetBrains Mono', letterSpacing: 0.5,
                  border: `1px solid ${T.safe}33`,
                }}>Primary</span>
                <span style={{
                  fontSize: 9, color: T.inkLight, fontFamily: 'JetBrains Mono',
                }}>Active at: {(allPlants || []).join(', ')}</span>
              </>
            )}
          </span>

          {/* Qty per (for children) */}
          {node.qtyPer != null && (
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkMid, minWidth: 50, textAlign: 'right' }}>
              {'\u00D7'}{node.qtyPer}
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
              allPlants={allPlants}
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
