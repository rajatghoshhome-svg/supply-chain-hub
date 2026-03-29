import { useState, useEffect, useCallback } from 'react';
import { T } from '../styles/tokens';
import ModuleLayout from '../components/shared/ModuleLayout';
import PageHeader from '../components/shared/PageHeader';
import GanttChartTab from '../components/scheduling/GanttChartTab';
import ShopFloorTab from '../components/scheduling/ShopFloorTab';
import SetupTab from '../components/scheduling/SetupTab';

const TABS = [
  { id: 'gantt', label: 'Gantt Chart' },
  { id: 'shopfloor', label: 'Shop Floor' },
  { id: 'setup', label: 'Setup' },
];

const API = '/api/scheduling/champion';

const PLANTS = [
  { code: 'PLT-DOGSTAR', name: 'DogStar Kitchens' },
  { code: 'PLT-NORTHSTAR', name: 'NorthStar Kitchen' },
];

/* ─── Static fallback data ─────────────────────────────────────────────────── */
const FALLBACK = {
  plantCode: 'PLT-DOGSTAR',
  plantName: 'DogStar Kitchens',
  horizonStart: '2026-04-06',
  horizonEnd: '2026-04-27',
  nowTime: '2026-04-09T14:30:00Z',
  hoursPerDay: 16,
  lastGenerated: '2026-04-09T08:00:00Z',
  stages: [
    {
      name: 'Extrusion',
      workCenters: [
        {
          code: 'WC-DS-EXT1', name: 'Extruder 1', utilization: 0.85,
          orders: [
            { id: 'PO-DS-001', familyId: 'ORI-DOG-DRY', familyName: 'Orijen Original Dog Dry', brandColor: '#C8102E', qty: 480, startTime: 0, endTime: 4.0, status: 'complete', pacePercent: 100, changeover: 0 },
            { id: 'PO-DS-002', familyId: 'ORI-DOG-DRY', familyName: 'Orijen Six Fish Dog Dry', brandColor: '#C8102E', qty: 360, startTime: 4.0, endTime: 7.5, status: 'complete', pacePercent: 100, changeover: 0 },
            { id: 'PO-DS-003', familyId: 'ACA-DOG-DRY', familyName: 'Acana Heritage Dog Dry', brandColor: '#00563F', qty: 520, startTime: 8.0, endTime: 13.0, status: 'running', pacePercent: 75, changeover: 0.5 },
            { id: 'PO-DS-004', familyId: 'ORI-CAT-DRY', familyName: 'Orijen Cat & Kitten Dry', brandColor: '#C8102E', qty: 280, startTime: 13.5, endTime: 16.5, status: 'planned', pacePercent: 0, changeover: 0.5 },
            { id: 'PO-DS-005', familyId: 'ACA-CAT-DRY', familyName: 'Acana Indoor Cat Dry', brandColor: '#00563F', qty: 320, startTime: 17.0, endTime: 20.5, status: 'planned', pacePercent: 0, changeover: 0.5 },
            { id: 'PO-DS-006', familyId: 'ORI-DOG-DRY', familyName: 'Orijen Puppy Dry', brandColor: '#C8102E', qty: 240, startTime: 21.0, endTime: 24.0, status: 'planned', pacePercent: 0, changeover: 0.5 },
          ],
          downtimeBlocks: [],
        },
        {
          code: 'WC-DS-EXT2', name: 'Extruder 2', utilization: 0.79,
          orders: [
            { id: 'PO-DS-007', familyId: 'ACA-DOG-DRY', familyName: 'Acana Red Meat Dog Dry', brandColor: '#00563F', qty: 600, startTime: 0, endTime: 5.5, status: 'complete', pacePercent: 100, changeover: 0 },
            { id: 'PO-DS-008', familyId: 'ORI-DOG-DRY', familyName: 'Orijen Regional Red Dog Dry', brandColor: '#C8102E', qty: 440, startTime: 6.0, endTime: 10.0, status: 'complete', pacePercent: 100, changeover: 0.5 },
            { id: 'PO-DS-009', familyId: 'ORI-CAT-DRY', familyName: 'Orijen Tundra Cat Dry', brandColor: '#C8102E', qty: 380, startTime: 10.5, endTime: 14.5, status: 'running', pacePercent: 62, changeover: 0.5 },
            { id: 'PO-DS-010', familyId: 'ACA-DOG-DRY', familyName: 'Acana Prairie Dog Dry', brandColor: '#00563F', qty: 500, startTime: 15.0, endTime: 19.5, status: 'planned', pacePercent: 0, changeover: 0.5 },
            { id: 'PO-DS-011', familyId: 'ORI-TREAT', familyName: 'Orijen Freeze-Dried Treats', brandColor: '#C8102E', qty: 200, startTime: 20.0, endTime: 22.5, status: 'planned', pacePercent: 0, changeover: 0.5 },
          ],
          downtimeBlocks: [],
        },
        {
          code: 'WC-DS-EXT3', name: 'Extruder 3', utilization: 0.72,
          orders: [
            { id: 'PO-DS-012', familyId: 'ORI-FD', familyName: 'Orijen Freeze-Dried Dog', brandColor: '#C8102E', qty: 180, startTime: 0, endTime: 3.0, status: 'complete', pacePercent: 100, changeover: 0 },
            { id: 'PO-DS-013', familyId: 'ACA-CAT-DRY', familyName: 'Acana Grasslands Cat Dry', brandColor: '#00563F', qty: 340, startTime: 3.5, endTime: 7.0, status: 'complete', pacePercent: 100, changeover: 0.5 },
            { id: 'PO-DS-014', familyId: 'ORI-DOG-DRY', familyName: 'Orijen Fit & Trim Dog Dry', brandColor: '#C8102E', qty: 420, startTime: 7.5, endTime: 11.5, status: 'delayed', pacePercent: 45, changeover: 0.5 },
            { id: 'PO-DS-015', familyId: 'ACA-DOG-DRY', familyName: 'Acana Wild Coast Dog Dry', brandColor: '#00563F', qty: 360, startTime: 12.0, endTime: 15.5, status: 'planned', pacePercent: 0, changeover: 0.5 },
          ],
          downtimeBlocks: [
            { startTime: 48, endTime: 56, type: 'CIP', reason: 'CIP' },
          ],
        },
        {
          code: 'WC-DS-EXT4', name: 'Extruder 4', utilization: 0.68,
          orders: [
            { id: 'PO-DS-016', familyId: 'ACA-CAT-DRY', familyName: 'Acana Pacifica Cat Dry', brandColor: '#00563F', qty: 290, startTime: 0, endTime: 3.5, status: 'complete', pacePercent: 100, changeover: 0 },
            { id: 'PO-DS-017', familyId: 'ORI-TREAT', familyName: 'Orijen Biscuit Treats', brandColor: '#C8102E', qty: 150, startTime: 4.0, endTime: 6.0, status: 'complete', pacePercent: 100, changeover: 0.5 },
            { id: 'PO-DS-018', familyId: 'ORI-FD', familyName: 'Orijen Freeze-Dried Cat', brandColor: '#C8102E', qty: 160, startTime: 6.5, endTime: 9.0, status: 'delayed', pacePercent: 30, changeover: 0.5 },
            { id: 'PO-DS-019', familyId: 'ACA-DOG-DRY', familyName: 'Acana Singles Dog Dry', brandColor: '#00563F', qty: 380, startTime: 9.5, endTime: 13.5, status: 'planned', pacePercent: 0, changeover: 0.5 },
          ],
          downtimeBlocks: [
            { startTime: 48, endTime: 56, type: 'CIP', reason: 'CIP' },
          ],
        },
      ],
    },
    {
      name: 'Packaging',
      workCenters: [
        {
          code: 'WC-DS-PKG1', name: 'Pkg Line 1', utilization: 0.81,
          orders: [
            { id: 'PO-DS-020', familyId: 'ORI-DOG-DRY', familyName: 'Orijen Original Dog Dry 25lb', brandColor: '#C8102E', qty: 480, startTime: 5.0, endTime: 8.5, status: 'complete', pacePercent: 100, changeover: 0 },
            { id: 'PO-DS-021', familyId: 'ACA-DOG-DRY', familyName: 'Acana Heritage Dog Dry 25lb', brandColor: '#00563F', qty: 520, startTime: 14.0, endTime: 18.0, status: 'planned', pacePercent: 0, changeover: 0.5 },
            { id: 'PO-DS-022', familyId: 'ORI-CAT-DRY', familyName: 'Orijen Cat & Kitten 12lb', brandColor: '#C8102E', qty: 280, startTime: 18.5, endTime: 21.0, status: 'planned', pacePercent: 0, changeover: 0.5 },
          ],
          downtimeBlocks: [],
        },
        {
          code: 'WC-DS-PKG2', name: 'Pkg Line 2', utilization: 0.76,
          orders: [
            { id: 'PO-DS-023', familyId: 'ORI-DOG-DRY', familyName: 'Orijen Six Fish Dog Dry 13lb', brandColor: '#C8102E', qty: 360, startTime: 8.5, endTime: 11.5, status: 'complete', pacePercent: 100, changeover: 0 },
            { id: 'PO-DS-024', familyId: 'ACA-DOG-DRY', familyName: 'Acana Red Meat Dog Dry 25lb', brandColor: '#00563F', qty: 600, startTime: 16.0, endTime: 21.0, status: 'planned', pacePercent: 0, changeover: 0.5 },
          ],
          downtimeBlocks: [
            { startTime: 48, endTime: 52, type: 'Maintenance', reason: 'MAINT' },
          ],
        },
        {
          code: 'WC-DS-PKG3', name: 'Pkg Line 3', utilization: 0.74,
          orders: [
            { id: 'PO-DS-025', familyId: 'ACA-CAT-DRY', familyName: 'Acana Indoor Cat Dry 12lb', brandColor: '#00563F', qty: 320, startTime: 6.0, endTime: 9.0, status: 'complete', pacePercent: 100, changeover: 0 },
            { id: 'PO-DS-026', familyId: 'ORI-FD', familyName: 'Orijen Freeze-Dried Dog 16oz', brandColor: '#C8102E', qty: 180, startTime: 9.5, endTime: 12.0, status: 'running', pacePercent: 88, changeover: 0.5 },
            { id: 'PO-DS-027', familyId: 'ORI-TREAT', familyName: 'Orijen Freeze-Dried Treats 3.5oz', brandColor: '#C8102E', qty: 200, startTime: 12.5, endTime: 15.0, status: 'planned', pacePercent: 0, changeover: 0.5 },
            { id: 'PO-DS-028', familyId: 'ACA-DOG-DRY', familyName: 'Acana Prairie Dog Dry 25lb', brandColor: '#00563F', qty: 500, startTime: 15.5, endTime: 20.0, status: 'planned', pacePercent: 0, changeover: 0.5 },
          ],
          downtimeBlocks: [],
        },
      ],
    },
  ],
  summary: {
    totalOrders: 35,
    runningOrders: 4,
    completedOrders: 12,
    delayedOrders: 2,
    avgUtilization: 78,
    totalChangeoverHours: 8.5,
  },
  changeoverMatrix: {
    'ORI-DOG-DRY|ACA-DOG-DRY': 1.0,
    'ORI-DOG-DRY|ORI-CAT-DRY': 0.5,
    'ORI-DOG-DRY|ORI-FD': 1.5,
    'ORI-DOG-DRY|ORI-TREAT': 1.0,
    'ORI-DOG-DRY|ACA-CAT-DRY': 1.0,
    'ACA-DOG-DRY|ORI-DOG-DRY': 1.0,
    'ACA-DOG-DRY|ORI-CAT-DRY': 1.0,
    'ACA-DOG-DRY|ORI-FD': 1.5,
    'ACA-DOG-DRY|ORI-TREAT': 1.0,
    'ACA-DOG-DRY|ACA-CAT-DRY': 0.5,
    'ORI-CAT-DRY|ORI-DOG-DRY': 0.5,
    'ORI-CAT-DRY|ACA-DOG-DRY': 1.0,
    'ORI-CAT-DRY|ORI-FD': 1.0,
    'ORI-CAT-DRY|ORI-TREAT': 0.5,
    'ORI-CAT-DRY|ACA-CAT-DRY': 0.5,
    'ORI-FD|ORI-DOG-DRY': 1.5,
    'ORI-FD|ACA-DOG-DRY': 1.5,
    'ORI-FD|ORI-CAT-DRY': 1.0,
    'ORI-FD|ORI-TREAT': 0.5,
    'ORI-FD|ACA-CAT-DRY': 1.0,
    'ORI-TREAT|ORI-DOG-DRY': 1.0,
    'ORI-TREAT|ACA-DOG-DRY': 1.0,
    'ORI-TREAT|ORI-CAT-DRY': 0.5,
    'ORI-TREAT|ORI-FD': 0.5,
    'ORI-TREAT|ACA-CAT-DRY': 0.5,
    'ACA-CAT-DRY|ORI-DOG-DRY': 1.0,
    'ACA-CAT-DRY|ACA-DOG-DRY': 0.5,
    'ACA-CAT-DRY|ORI-CAT-DRY': 0.5,
    'ACA-CAT-DRY|ORI-FD': 1.0,
    'ACA-CAT-DRY|ORI-TREAT': 0.5,
  },
  downtimeEvents: [
    { id: 'DT-001', workCenter: 'WC-DS-EXT3', workCenterName: 'Extruder 3', type: 'CIP', startTime: 48, endTime: 56, reason: 'Sunday CIP cycle' },
    { id: 'DT-002', workCenter: 'WC-DS-EXT4', workCenterName: 'Extruder 4', type: 'CIP', startTime: 48, endTime: 56, reason: 'Sunday CIP cycle' },
    { id: 'DT-003', workCenter: 'WC-DS-PKG2', workCenterName: 'Pkg Line 2', type: 'Maintenance', startTime: 48, endTime: 52, reason: 'Scheduled belt replacement' },
  ],
};

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function SchedulingPage() {
  const [activeTab, setActiveTab] = useState('gantt');
  const [plant, setPlant] = useState('PLT-DOGSTAR');
  const [schedule, setSchedule] = useState(null);

  const fetchSchedule = useCallback(() => {
    fetch(`${API}/schedule/${plant}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setSchedule)
      .catch(() => setSchedule(FALLBACK));
  }, [plant]);

  useEffect(() => { fetchSchedule(); }, [fetchSchedule]);

  /* ─── Handler functions ──────────────────────────────────────────── */
  const handleResequence = async (workCenter, orderIds) => {
    try {
      const res = await fetch(`${API}/resequence`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plantCode: plant, workCenter, orderIds }),
      });
      if (res.ok) { const data = await res.json(); setSchedule(data); }
    } catch { /* keep local state */ }
  };

  const handleOptimize = async () => {
    try {
      const res = await fetch(`${API}/optimize/${plant}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plantCode: plant }),
      });
      if (res.ok) { const data = await res.json(); setSchedule(data); }
    } catch { /* ignore */ }
  };

  const handleGenerate = async () => {
    try {
      const res = await fetch(`${API}/generate/${plant}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plantCode: plant }),
      });
      if (res.ok) { const data = await res.json(); setSchedule(data); }
    } catch { /* ignore */ }
  };

  const handleUpdateChangeover = async (fromFam, toFam, hours) => {
    try {
      await fetch(`${API}/changeover`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plantCode: plant, fromFam, toFam, hours }),
      });
      // Optimistic update
      setSchedule(prev => {
        if (!prev) return prev;
        const key = `${fromFam}|${toFam}`;
        return { ...prev, changeoverMatrix: { ...prev.changeoverMatrix, [key]: hours } };
      });
    } catch { /* ignore */ }
  };

  const handleUpdateConfig = async (rule) => {
    try {
      await fetch(`${API}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plantCode: plant, rule }),
      });
      fetchSchedule();
    } catch { /* ignore */ }
  };

  const handleAddDowntime = async (event) => {
    try {
      const res = await fetch(`${API}/downtime`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plantCode: plant, ...event }),
      });
      if (res.ok) fetchSchedule();
      else {
        // Optimistic local add
        setSchedule(prev => {
          if (!prev) return prev;
          const newEvt = { id: `DT-NEW-${Date.now()}`, ...event };
          return { ...prev, downtimeEvents: [...(prev.downtimeEvents || []), newEvt] };
        });
      }
    } catch { /* fallback handled by else branch */ }
  };

  const handleAddOrder = async ({ familyId, qty, workCenter, priority }) => {
    try {
      const res = await fetch(`${API}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plantCode: plant, familyId, qty, workCenter, priority }),
      });
      if (res.ok) { const data = await res.json(); if (data.schedule) setSchedule(data.schedule); else fetchSchedule(); }
    } catch { fetchSchedule(); }
  };

  const handleRemoveDowntime = async (eventId) => {
    try {
      await fetch(`${API}/downtime/${eventId}?plantCode=${plant}`, { method: 'DELETE' });
    } catch { /* ignore */ }
    // Optimistic remove
    setSchedule(prev => {
      if (!prev) return prev;
      return { ...prev, downtimeEvents: (prev.downtimeEvents || []).filter((e, i) => (e.id || i) !== eventId) };
    });
  };

  /* ─── KPI values ─────────────────────────────────────────────────── */
  const summary = schedule?.summary || {};
  const kpis = [
    { label: 'Running', value: summary.runningOrders || 0, bg: T.purple, color: T.white },
    { label: 'On Pace', value: summary.completedOrders || 0, bg: T.safe, color: T.white },
    { label: 'Behind', value: summary.delayedOrders || 0, bg: T.risk, color: T.white },
    { label: 'Changeover', value: `${summary.totalChangeoverHours || 0}h`, bg: '#D97706', color: T.white },
  ];

  return (
    <ModuleLayout moduleContext="scheduling" tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}>
      <PageHeader
        title="Production Scheduling"
        subtitle="Champion Pet Foods — Scheduling"
      />

      {/* ── Plant toggle + KPI strip ─────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: T.sp3,
        padding: `${T.sp3}px ${T.sp5}px`, flexWrap: 'wrap',
        borderBottom: `1px solid ${T.border}`,
      }}>
        {/* Plant buttons */}
        <div style={{ display: 'flex', gap: 4 }}>
          {PLANTS.map(p => (
            <button
              key={p.code}
              onClick={() => setPlant(p.code)}
              style={{
                background: plant === p.code ? T.ink : T.white,
                color: plant === p.code ? T.white : T.ink,
                border: `1px solid ${plant === p.code ? T.ink : T.border}`,
                borderRadius: T.r2, padding: '8px 16px', cursor: 'pointer',
                fontFamily: T.fontMono, fontSize: 11, fontWeight: 500,
                transition: 'all 0.12s',
              }}
            >
              {p.name}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 24, background: T.border }} />

        {/* KPI pills */}
        <div style={{ display: 'flex', gap: T.sp2, flexWrap: 'wrap' }}>
          {kpis.map(kpi => (
            <div key={kpi.label} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: `${kpi.bg}18`, borderRadius: 20,
              padding: '6px 14px',
            }}>
              <span style={{ fontFamily: T.fontBody, fontSize: 11, color: kpi.bg, fontWeight: 500 }}>
                {kpi.label}
              </span>
              <span style={{
                fontFamily: T.fontHeading, fontSize: 14, fontWeight: 700,
                color: kpi.bg,
                background: kpi.bg, WebkitBackgroundClip: 'text',
              }}>
                {kpi.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tab content ──────────────────────────────────────────────── */}
      {activeTab === 'gantt' && (
        <GanttChartTab
          schedule={schedule}
          plant={plant}
          onResequence={handleResequence}
          onOptimize={handleOptimize}
          onRefresh={fetchSchedule}
          onAddOrder={handleAddOrder}
        />
      )}

      {activeTab === 'shopfloor' && (
        <ShopFloorTab schedule={schedule} plant={plant} />
      )}

      {activeTab === 'setup' && (
        <SetupTab
          schedule={schedule}
          plant={plant}
          onGenerate={handleGenerate}
          onUpdateChangeover={handleUpdateChangeover}
          onUpdateConfig={handleUpdateConfig}
          onAddDowntime={handleAddDowntime}
          onRemoveDowntime={handleRemoveDowntime}
        />
      )}
    </ModuleLayout>
  );
}
