import { useState, useEffect, useCallback } from 'react';
import { T } from '../styles/tokens';
import ModuleLayout from '../components/shared/ModuleLayout';
import PageHeader from '../components/shared/PageHeader';

const TABS = [
  { id: 'plan', label: 'Production Plan' },
  { id: 'rccp', label: 'RCCP' },
  { id: 'inputs', label: 'Inputs & Heuristics' },
];

const API = '/api/production-plan/champion';

// ─── Static fallback data (Vercel / no backend) ──────────────────────────────
const PERIODS = ['W1','W2','W3','W4','W5','W6','W7','W8','W9','W10','W11','W12'];
const mkStrategy = (prod, ei, cost, excCount, overtime, rccp) => ({
  production: prod, endingInventory: ei, totalCost: cost, overtime,
  costBreakdown: { regularLabor: cost * 0.45, materials: cost * 0.35, overtime: cost * 0.08, inventory: cost * 0.07, subcontract: cost * 0.05 },
  exceptions: Array.from({ length: excCount }, (_, i) => ({ id: `S-${i}` })),
  rccp: rccp || [
    { code: 'EXT-1', capacityHoursPerPeriod: 120, hoursPerUnit: 0.0053, utilization: [78,82,85,94,98,102,96,88,84,80,77,75], overloaded: [false,false,false,false,false,true,false,false,false,false,false,false], loadHours: [94,98,102,113,118,122,115,106,101,96,92,90] },
    { code: 'COAT-1', capacityHoursPerPeriod: 80, hoursPerUnit: 0.0035, utilization: [65,68,72,78,82,88,80,74,70,66,64,62], overloaded: Array(12).fill(false), loadHours: [52,54,58,62,66,70,64,59,56,53,51,50] },
    { code: 'PKG-1', capacityHoursPerPeriod: 100, hoursPerUnit: 0.0018, utilization: [58,62,65,72,76,80,74,68,64,60,58,55], overloaded: Array(12).fill(false), loadHours: [58,62,65,72,76,80,74,68,64,60,58,55] },
  ],
});
const grossReqsA = [23252,21957,22508,23092,32052,34800,28500,24100,22800,21400,20900,21500];
const FALLBACK = {
  summary: { familiesPlanned: 9, totalExceptions: 52, criticalExceptions: 7 },
  plants: { plants: [
    { plantCode: 'PLT-DOGSTAR', plantName: 'DogStar Kitchens', familyPlans: [
      { familyId: 'ORI-DOG-DRY', familyName: 'Orijen Dry Dog Food', plan: { periods: PERIODS, grossReqs: grossReqsA, recommended: 'chase', strategies: {
        chase: mkStrategy([23252,21957,22508,23092,32052,34800,28500,24100,22800,21400,20900,21500], [0,0,0,0,0,0,0,0,0,0,0,0], 926278, 0),
        level: mkStrategy(Array(12).fill(21518), [0,-2266,-5018,-8352,-14586,-21804,-28786,-33368,-36650,-38632,-40014,-42032], 912418, 2),
        hybrid: mkStrategy([21518,21518,21518,21518,28000,32000,26000,23000,21518,21518,21518,21518], [0,-2266,-5018,-8352,-12704,-15504,-18004,-19104,-20386,-20268,-19650,-20632], 966223, 2, [0,0,0,0,6482,10482,4482,1482,0,0,0,0]),
      }}},
      { familyId: 'ORI-CAT-DRY', familyName: 'Orijen Dry Cat Food', plan: { periods: PERIODS, grossReqs: grossReqsA.map(v => Math.round(v * 0.6)), recommended: 'chase', strategies: {
        chase: mkStrategy(grossReqsA.map(v => Math.round(v * 0.6)), Array(12).fill(0), 548200, 0),
        level: mkStrategy(Array(12).fill(12911), grossReqsA.map((v, i) => Math.round(12911 * (i + 1) - grossReqsA.slice(0, i + 1).reduce((s, x) => s + Math.round(x * 0.6), 0))), 534800, 1),
        hybrid: mkStrategy(grossReqsA.map(v => Math.round(v * 0.58)), grossReqsA.map(v => Math.round(v * -0.02)), 572100, 1, grossReqsA.map(() => 0)),
      }}},
      { familyId: 'ORI-FD', familyName: 'Orijen Freeze-Dried', plan: { periods: PERIODS, grossReqs: grossReqsA.map(v => Math.round(v * 0.3)), recommended: 'hybrid', strategies: {
        chase: mkStrategy(grossReqsA.map(v => Math.round(v * 0.3)), Array(12).fill(0), 412000, 0),
        level: mkStrategy(Array(12).fill(6456), Array(12).fill(200), 398000, 0),
        hybrid: mkStrategy(grossReqsA.map(v => Math.round(v * 0.29)), Array(12).fill(100), 405000, 0, grossReqsA.map(() => 0)),
      }}},
      { familyId: 'ORI-TREATS', familyName: 'Orijen Treats', plan: { periods: PERIODS, grossReqs: grossReqsA.map(v => Math.round(v * 0.15)), recommended: 'chase', strategies: {
        chase: mkStrategy(grossReqsA.map(v => Math.round(v * 0.15)), Array(12).fill(0), 198000, 0),
        level: mkStrategy(Array(12).fill(3228), Array(12).fill(100), 192000, 0),
        hybrid: mkStrategy(grossReqsA.map(v => Math.round(v * 0.145)), Array(12).fill(50), 195000, 0, grossReqsA.map(() => 0)),
      }}},
      { familyId: 'ACA-DOG-DRY', familyName: 'Acana Dry Dog Food', plan: { periods: PERIODS, grossReqs: grossReqsA.map(v => Math.round(v * 0.8)), recommended: 'chase', strategies: {
        chase: mkStrategy(grossReqsA.map(v => Math.round(v * 0.8)), Array(12).fill(0), 745000, 0),
        level: mkStrategy(Array(12).fill(17214), Array(12).fill(-500), 728000, 1),
        hybrid: mkStrategy(grossReqsA.map(v => Math.round(v * 0.78)), Array(12).fill(-200), 762000, 1, grossReqsA.map(() => 0)),
      }}},
      { familyId: 'ACA-CAT-DRY', familyName: 'Acana Dry Cat Food', plan: { periods: PERIODS, grossReqs: grossReqsA.map(v => Math.round(v * 0.4)), recommended: 'chase', strategies: {
        chase: mkStrategy(grossReqsA.map(v => Math.round(v * 0.4)), Array(12).fill(0), 365000, 0),
        level: mkStrategy(Array(12).fill(8607), Array(12).fill(100), 355000, 0),
        hybrid: mkStrategy(grossReqsA.map(v => Math.round(v * 0.39)), Array(12).fill(50), 360000, 0, grossReqsA.map(() => 0)),
      }}},
    ]},
    { plantCode: 'PLT-NORTHSTAR', plantName: 'NorthStar Kitchen', familyPlans: [
      { familyId: 'ACA-WET-DOG', familyName: 'Acana Wet Dog Food', plan: { periods: PERIODS, grossReqs: grossReqsA.map(v => Math.round(v * 0.5)), recommended: 'hybrid', strategies: {
        chase: mkStrategy(grossReqsA.map(v => Math.round(v * 0.5)), Array(12).fill(0), 482000, 0),
        level: mkStrategy(Array(12).fill(10759), Array(12).fill(-300), 468000, 1),
        hybrid: mkStrategy(grossReqsA.map(v => Math.round(v * 0.48)), Array(12).fill(-100), 475000, 1, grossReqsA.map(() => 0)),
      }}},
      { familyId: 'ACA-WET-CAT', familyName: 'Acana Wet Cat Food', plan: { periods: PERIODS, grossReqs: grossReqsA.map(v => Math.round(v * 0.25)), recommended: 'level', strategies: {
        chase: mkStrategy(grossReqsA.map(v => Math.round(v * 0.25)), Array(12).fill(0), 248000, 0),
        level: mkStrategy(Array(12).fill(5379), Array(12).fill(200), 238000, 0),
        hybrid: mkStrategy(grossReqsA.map(v => Math.round(v * 0.24)), Array(12).fill(100), 242000, 0, grossReqsA.map(() => 0)),
      }}},
      { familyId: 'ACA-SINGLES', familyName: 'Acana Singles', plan: { periods: PERIODS, grossReqs: grossReqsA.map(v => Math.round(v * 0.35)), recommended: 'chase', strategies: {
        chase: mkStrategy(grossReqsA.map(v => Math.round(v * 0.35)), Array(12).fill(0), 328000, 0),
        level: mkStrategy(Array(12).fill(7531), Array(12).fill(-100), 318000, 0),
        hybrid: mkStrategy(grossReqsA.map(v => Math.round(v * 0.34)), Array(12).fill(0), 322000, 0, grossReqsA.map(() => 0)),
      }}},
    ]},
  ]},
  exceptions: [
    { id: 'EXC-001', type: 'capacity-overload', severity: 'critical', status: 'open', message: 'EXT-1 at DogStar exceeds capacity in W6 (102% utilization)', plant: 'PLT-DOGSTAR', familyId: 'ORI-DOG-DRY', period: 'W6', recommendation: 'Shift 4,800 units to NorthStar or authorize Saturday overtime at DogStar.' },
    { id: 'EXC-002', type: 'capacity-overload', severity: 'critical', status: 'open', message: 'EXT-1 at DogStar near capacity in W5 (98% utilization)', plant: 'PLT-DOGSTAR', familyId: 'ORI-DOG-DRY', period: 'W5', recommendation: 'Pre-build in W3-W4 to reduce W5 peak load.' },
    { id: 'EXC-003', type: 'stockout-risk', severity: 'critical', status: 'open', message: 'Orijen Dry Dog Food projected stockout in W4 under level strategy', plant: 'PLT-DOGSTAR', familyId: 'ORI-DOG-DRY', period: 'W4', recommendation: 'Switch to chase or hybrid strategy for this family.' },
    { id: 'EXC-004', type: 'demand-spike', severity: 'warning', status: 'open', message: 'Orijen Dry Dog Food demand increases 39% in W5 vs W4', plant: 'PLT-DOGSTAR', familyId: 'ORI-DOG-DRY', period: 'W5', recommendation: 'Verify promotional forecast accuracy. Consider pre-build.' },
    { id: 'EXC-005', type: 'demand-spike', severity: 'warning', status: 'open', message: 'Orijen Freeze-Dried demand surge in W5-W6 (promotional period)', plant: 'PLT-DOGSTAR', familyId: 'ORI-FD', period: 'W5-W6', recommendation: 'Confirm promotional lift with demand planning. Begin pre-build in W3.' },
    { id: 'EXC-006', type: 'inventory-excess', severity: 'warning', status: 'open', message: 'Acana Wet Cat Food projected 6.2 weeks of supply under level strategy', plant: 'PLT-NORTHSTAR', familyId: 'ACA-WET-CAT', period: 'W8', recommendation: 'Reduce production rate by 8% for W6-W8.' },
    { id: 'EXC-007', type: 'capacity-overload', severity: 'critical', status: 'open', message: 'Retort line at NorthStar at 96% in W5 across all families', plant: 'PLT-NORTHSTAR', familyId: 'ACA-WET-DOG', period: 'W5', recommendation: 'Prioritize Acana Wet Dog over Acana Wet Cat due to higher stockout risk.' },
    { id: 'EXC-008', type: 'smoothing-violation', severity: 'warning', status: 'open', message: 'Chase strategy requires 39% production increase W4→W5 for Orijen Dry Dog', plant: 'PLT-DOGSTAR', familyId: 'ORI-DOG-DRY', period: 'W5', recommendation: 'Smoothing policy limits ±20%. Use hybrid strategy or adjust time fence.' },
    { id: 'EXC-009', type: 'safety-stock', severity: 'warning', status: 'acknowledged', message: 'Acana Dry Dog Food below safety stock target in W6-W7', plant: 'PLT-DOGSTAR', familyId: 'ACA-DOG-DRY', period: 'W6-W7', recommendation: 'Increase production by 2,000 units in W5 to rebuild buffer.' },
    { id: 'EXC-010', type: 'capacity-overload', severity: 'critical', status: 'open', message: 'Packaging line PKG-1 at DogStar near limit in W5-W6 (combined families)', plant: 'PLT-DOGSTAR', familyId: 'ORI-DOG-DRY', period: 'W5-W6', recommendation: 'Add Saturday packaging shift or redistribute to NorthStar.' },
    { id: 'EXC-011', type: 'changeover', severity: 'info', status: 'open', message: 'High changeover frequency at DogStar EXT-1: 6 changeovers in W5', plant: 'PLT-DOGSTAR', familyId: null, period: 'W5', recommendation: 'Consolidate runs: batch Orijen Dry Dog + Cat together.' },
    { id: 'EXC-012', type: 'lead-time', severity: 'info', status: 'open', message: 'Fresh chicken supplier lead time increased to 5 days (was 3)', plant: 'PLT-DOGSTAR', familyId: null, period: 'W3+', recommendation: 'Adjust material receipt dates. Consider safety stock increase for chicken-based products.' },
    { id: 'EXC-013', type: 'capacity-overload', severity: 'critical', status: 'open', message: 'Combined extrusion load at DogStar exceeds 105% in W6', plant: 'PLT-DOGSTAR', familyId: null, period: 'W6', recommendation: 'Critical: authorize overtime or transfer 15% of Acana Dry volume to NorthStar.' },
    { id: 'EXC-014', type: 'demand-spike', severity: 'warning', status: 'open', message: 'Acana Wet Dog Food summer seasonal ramp begins W5', plant: 'PLT-NORTHSTAR', familyId: 'ACA-WET-DOG', period: 'W5-W8', recommendation: 'Begin production ramp in W4. Ensure retort capacity reserved.' },
  ],
  calendars: { calendars: {
    'PLT-DOGSTAR': { plantName: 'DogStar Kitchens', workingDaysPerWeek: 5, shifts: 2, hoursPerShift: 8, effectiveHoursPerWeek: 80, overtimeAvailable: true, overtimeNotes: 'Saturday shifts available (max 8hrs)', holidays: ['Easter Monday', 'Memorial Day'] },
    'PLT-NORTHSTAR': { plantName: 'NorthStar Kitchen', workingDaysPerWeek: 5, shifts: 2, hoursPerShift: 8, effectiveHoursPerWeek: 80, overtimeAvailable: true, overtimeNotes: 'Saturday + Sunday available (12hrs max)', holidays: ['Good Friday', 'Victoria Day'] },
  }},
  rates: { rates: [
    { plantCode: 'PLT-DOGSTAR', familyId: 'ORI-DOG-DRY', familyName: 'Orijen Dry Dog Food', unitsPerHour: 4200, setupTimeHrs: 1.5, changeoverTimeHrs: 0.75, minRunSize: 5000, maxRunSize: 50000 },
    { plantCode: 'PLT-DOGSTAR', familyId: 'ORI-CAT-DRY', familyName: 'Orijen Dry Cat Food', unitsPerHour: 3800, setupTimeHrs: 1.5, changeoverTimeHrs: 0.75, minRunSize: 3000, maxRunSize: 35000 },
    { plantCode: 'PLT-DOGSTAR', familyId: 'ORI-FD', familyName: 'Orijen Freeze-Dried', unitsPerHour: 1200, setupTimeHrs: 2.0, changeoverTimeHrs: 1.0, minRunSize: 1000, maxRunSize: 15000 },
    { plantCode: 'PLT-DOGSTAR', familyId: 'ORI-TREATS', familyName: 'Orijen Treats', unitsPerHour: 5500, setupTimeHrs: 0.5, changeoverTimeHrs: 0.5, minRunSize: 2000, maxRunSize: 25000 },
    { plantCode: 'PLT-DOGSTAR', familyId: 'ACA-DOG-DRY', familyName: 'Acana Dry Dog Food', unitsPerHour: 4500, setupTimeHrs: 1.5, changeoverTimeHrs: 0.75, minRunSize: 5000, maxRunSize: 55000 },
    { plantCode: 'PLT-DOGSTAR', familyId: 'ACA-CAT-DRY', familyName: 'Acana Dry Cat Food', unitsPerHour: 4000, setupTimeHrs: 1.5, changeoverTimeHrs: 0.75, minRunSize: 3000, maxRunSize: 40000 },
    { plantCode: 'PLT-NORTHSTAR', familyId: 'ACA-WET-DOG', familyName: 'Acana Wet Dog Food', unitsPerHour: 2800, setupTimeHrs: 2.0, changeoverTimeHrs: 1.5, minRunSize: 3000, maxRunSize: 30000 },
    { plantCode: 'PLT-NORTHSTAR', familyId: 'ACA-WET-CAT', familyName: 'Acana Wet Cat Food', unitsPerHour: 2600, setupTimeHrs: 2.0, changeoverTimeHrs: 1.5, minRunSize: 2000, maxRunSize: 25000 },
    { plantCode: 'PLT-NORTHSTAR', familyId: 'ACA-SINGLES', familyName: 'Acana Singles', unitsPerHour: 3200, setupTimeHrs: 1.0, changeoverTimeHrs: 1.0, minRunSize: 2000, maxRunSize: 28000 },
  ]},
  heuristics: { heuristics: { lotSizing: 'LFL', safetyStock: 'wos', timeFence: 'moderate', capacityPriority: 'stockout', smoothing: 'light', inventoryTarget: 'balanced' }},
};

// Severity dot colors
const SEV = { critical: T.risk, warning: T.warn, info: T.inkLight };
const SEV_BG = { critical: T.riskBg, warning: T.warnBg, info: '#F0F0EE' };

// ─── Helper styles ───────────────────────────────────────────────────────────

function thStyle(align = 'left') {
  return { textAlign: align, padding: '8px 10px', color: T.inkLight, fontWeight: 500, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'JetBrains Mono', whiteSpace: 'nowrap' };
}

function tdStyle(align = 'left') {
  return { padding: '6px 10px', textAlign: align, color: T.inkMid, fontFamily: 'JetBrains Mono', fontSize: 12 };
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ProductionPlanPage() {
  const [tab, setTab] = useState('plan');
  const [plants, setPlants] = useState(null);
  const [exceptions, setExceptions] = useState([]);
  const [calendars, setCalendars] = useState(null);
  const [rates, setRates] = useState(null);
  const [summary, setSummary] = useState(null);
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [selectedStrategy, setSelectedStrategy] = useState('hybrid');
  const [firmedPeriods, setFirmedPeriods] = useState(new Set());
  const [heuristics, setHeuristics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exceptionFilter, setExceptionFilter] = useState('all'); // all, critical, warning, info
  const [expandedExceptions, setExpandedExceptions] = useState(new Set());

  // ─── Data fetching ─────────────────────────────────────────────────────────

  const fetchSummary = useCallback(() => {
    fetch(`${API}/summary`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setSummary)
      .catch(() => setSummary(FALLBACK.summary));
  }, []);

  const fetchPlants = useCallback(() => {
    fetch(`${API}/plants`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => {
        setPlants(data);
        if (data?.plants?.length > 0 && !selectedPlant) {
          setSelectedPlant(data.plants[0].plantCode);
          const fams = data.plants[0].familyPlans;
          if (fams?.length > 0) setSelectedFamily(fams[0].familyId);
        }
        setLoading(false);
      })
      .catch(() => {
        const data = FALLBACK.plants;
        setPlants(data);
        if (!selectedPlant) {
          setSelectedPlant(data.plants[0].plantCode);
          setSelectedFamily(data.plants[0].familyPlans[0].familyId);
        }
        setLoading(false);
      });
  }, [selectedPlant]);

  const fetchExceptions = useCallback(() => {
    const params = exceptionFilter !== 'all' ? `?severity=${exceptionFilter}` : '';
    fetch(`${API}/exceptions${params}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => setExceptions(data.exceptions || []))
      .catch(() => {
        const all = FALLBACK.exceptions;
        setExceptions(exceptionFilter === 'all' ? all : all.filter(e => e.severity === exceptionFilter));
      });
  }, [exceptionFilter]);

  const fetchCalendars = useCallback(() => {
    fetch(`${API}/calendars`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setCalendars)
      .catch(() => setCalendars(FALLBACK.calendars));
  }, []);

  const fetchRates = useCallback(() => {
    fetch(`${API}/rates`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setRates)
      .catch(() => setRates(FALLBACK.rates));
  }, []);

  const fetchHeuristics = useCallback(() => {
    fetch(`${API}/heuristics`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setHeuristics)
      .catch(() => setHeuristics(FALLBACK.heuristics));
  }, []);

  const fetchFirmed = useCallback(() => {
    if (!selectedPlant || !selectedFamily) return;
    fetch(`${API}/firm/${selectedPlant}/${selectedFamily}`)
      .then(r => r.json())
      .then(data => setFirmedPeriods(new Set(data.firmedPeriods || [])))
      .catch(() => setFirmedPeriods(new Set([0, 1])));
  }, [selectedPlant, selectedFamily]);

  useEffect(() => {
    fetchSummary();
    fetchPlants();
    fetchExceptions();
  }, [fetchSummary, fetchPlants, fetchExceptions]);

  useEffect(() => {
    if (tab === 'inputs') {
      fetchCalendars();
      fetchRates();
      fetchHeuristics();
    }
  }, [tab, fetchCalendars, fetchRates, fetchHeuristics]);

  useEffect(() => { fetchFirmed(); }, [fetchFirmed]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handleFirmPeriod = async (periodIndex) => {
    const isFirmed = firmedPeriods.has(periodIndex);
    const method = isFirmed ? 'DELETE' : 'POST';
    // Optimistic update
    setFirmedPeriods(prev => {
      const next = new Set(prev);
      isFirmed ? next.delete(periodIndex) : next.add(periodIndex);
      return next;
    });
    try {
      await fetch(`${API}/firm`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plantCode: selectedPlant, familyId: selectedFamily, periodIndex }),
      });
    } catch { /* API unavailable, local state already updated */ }
  };

  const handleAcknowledge = async (excId) => {
    setExceptions(prev => prev.map(e => e.id === excId ? { ...e, status: 'acknowledged' } : e));
    try {
      await fetch(`${API}/exception/${excId}/acknowledge`, { method: 'PUT' });
    } catch { /* API unavailable, local state already updated */ }
  };

  const handleResolve = async (excId, resolution) => {
    setExceptions(prev => prev.map(e => e.id === excId ? { ...e, status: 'resolved', resolution } : e));
    try {
      await fetch(`${API}/exception/${excId}/resolve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution }),
      });
    } catch { /* API unavailable, local state already updated */ }
  };

  const updateHeuristic = async (key, value) => {
    // Optimistic update so UI responds immediately
    setHeuristics(prev => ({
      ...prev,
      heuristics: { ...prev.heuristics, [key]: value },
    }));
    try {
      await fetch(`${API}/heuristics`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
    } catch { /* API unavailable, local state already updated */ }
  };

  // ─── Derived data ──────────────────────────────────────────────────────────

  const currentPlant = plants?.plants?.find(p => p.plantCode === selectedPlant);
  const familyPlans = currentPlant?.familyPlans || [];
  const currentFamilyPlan = familyPlans.find(f => f.familyId === selectedFamily);
  const strategy = currentFamilyPlan?.plan?.strategies?.[selectedStrategy];
  const periods = currentFamilyPlan?.plan?.periods || [];
  const grossReqs = currentFamilyPlan?.plan?.grossReqs || [];

  const openExceptions = exceptions.filter(e => e.status === 'open');
  const critCount = openExceptions.filter(e => e.severity === 'critical').length;
  const warnCount = openExceptions.filter(e => e.severity === 'warning').length;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <ModuleLayout moduleContext="production_plan" tabs={TABS} activeTab={tab} onTabChange={setTab}>
      <PageHeader title="Production Planning" subtitle="CHAMPION PET FOODS — 2 PLANTS × 8 WORK CENTERS">
        {summary && (
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {[
              { label: 'Families', value: summary.familiesPlanned, color: T.ink },
              { label: 'Exceptions', value: summary.totalExceptions, color: summary.totalExceptions > 0 ? T.warn : T.safe },
              { label: 'Critical', value: summary.criticalExceptions, color: summary.criticalExceptions > 0 ? T.risk : T.safe },
            ].map(kpi => (
              <div key={kpi.label} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 8, color: T.inkLight, letterSpacing: 1.2, textTransform: 'uppercase' }}>{kpi.label}</div>
                <div style={{ fontFamily: 'Sora', fontSize: 18, fontWeight: 600, color: kpi.color }}>{kpi.value}</div>
              </div>
            ))}
          </div>
        )}
      </PageHeader>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 40px' }}>

        {/* ─── Plant selector ─── */}
        {plants?.plants && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {plants.plants.map(p => (
              <button key={p.plantCode} onClick={() => {
                setSelectedPlant(p.plantCode);
                const fams = p.familyPlans;
                if (fams?.length > 0) setSelectedFamily(fams[0].familyId);
              }}
                style={{
                  background: selectedPlant === p.plantCode ? T.ink : T.white,
                  color: selectedPlant === p.plantCode ? T.white : T.ink,
                  border: `1px solid ${selectedPlant === p.plantCode ? T.ink : T.border}`,
                  borderRadius: 6, padding: '6px 14px', cursor: 'pointer',
                  fontFamily: 'Sora', fontSize: 12, fontWeight: 500, transition: 'all 0.12s',
                }}>
                {p.plantName}
                <span style={{ marginLeft: 8, fontSize: 10, opacity: 0.6, fontFamily: 'JetBrains Mono' }}>
                  {p.familyPlans?.length || 0} families
                </span>
              </button>
            ))}
          </div>
        )}

        {/* ─── Family selector ─── */}
        {familyPlans.length > 0 && (
          <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' }}>
            {familyPlans.map(fp => {
              const hasExc = exceptions.some(e => e.familyId === fp.familyId && e.status === 'open');
              return (
                <button key={fp.familyId} onClick={() => setSelectedFamily(fp.familyId)}
                  style={{
                    background: selectedFamily === fp.familyId ? T.modProduction : T.white,
                    color: selectedFamily === fp.familyId ? T.white : T.ink,
                    border: `1px solid ${selectedFamily === fp.familyId ? T.modProduction : hasExc ? T.warn : T.border}`,
                    borderRadius: 5, padding: '4px 10px', cursor: 'pointer',
                    fontFamily: 'JetBrains Mono', fontSize: 11, transition: 'all 0.12s',
                  }}>
                  {fp.familyName || fp.familyId}
                  {hasExc && <span style={{ marginLeft: 4, color: selectedFamily === fp.familyId ? '#FFD' : T.risk, fontSize: 10 }}>●</span>}
                </button>
              );
            })}
          </div>
        )}

        {loading && <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>Loading production plans...</div>}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ─── TAB: Production Plan ─────────────────────────────────────── */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {tab === 'plan' && !loading && (
          <>
            {/* Strategy selector cards */}
            {currentFamilyPlan?.plan?.strategies && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                {['chase', 'level', 'hybrid'].map(s => {
                  const st = currentFamilyPlan.plan.strategies[s];
                  if (!st) return null;
                  const isRec = currentFamilyPlan.plan.recommended === s;
                  const excCount = (st.exceptions || []).length;
                  return (
                    <div key={s} onClick={() => setSelectedStrategy(s)}
                      style={{
                        background: selectedStrategy === s ? T.ink : T.white,
                        border: `2px solid ${isRec ? T.safe : selectedStrategy === s ? T.ink : T.border}`,
                        borderRadius: 10, padding: '16px 18px', cursor: 'pointer', transition: 'all 0.15s',
                      }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontFamily: 'Sora', fontSize: 14, fontWeight: 600, color: selectedStrategy === s ? T.white : T.ink, textTransform: 'capitalize' }}>{s}</span>
                        {isRec && <span style={{ background: T.safeBg, color: T.safe, border: `1px solid ${T.safe}`, padding: '1px 7px', borderRadius: 4, fontSize: 9, fontWeight: 600 }}>REC</span>}
                      </div>
                      <div style={{ fontFamily: 'Sora', fontSize: 22, fontWeight: 600, color: selectedStrategy === s ? T.white : T.modProduction, marginBottom: 4 }}>
                        ${Math.round(st.totalCost || 0).toLocaleString()}
                      </div>
                      <div style={{ fontSize: 11, color: selectedStrategy === s ? 'rgba(255,255,255,0.6)' : T.inkLight }}>
                        {s === 'chase' && 'Match demand. Variable workforce.'}
                        {s === 'level' && 'Constant rate. Inventory buffers.'}
                        {s === 'hybrid' && 'Base + overtime for peaks.'}
                      </div>
                      {excCount > 0 && (
                        <div style={{ marginTop: 6, fontSize: 10, color: selectedStrategy === s ? '#FFB4B4' : T.risk, fontWeight: 500 }}>
                          ⚠ {excCount} exception{excCount > 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Demand vs Production Chart */}
            {strategy && (
              <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 10, padding: 20, marginBottom: 20 }}>
                <div style={{ fontFamily: 'Sora', fontSize: 13, fontWeight: 600, color: T.ink, marginBottom: 12 }}>
                  Demand vs Production — {selectedStrategy}
                </div>
                <svg viewBox="0 0 760 200" style={{ width: '100%', maxWidth: 760 }}>
                  {(() => {
                    const gross = grossReqs || [];
                    const prod = strategy.production || [];
                    const maxVal = Math.max(...gross, ...prod, 1) * 1.15;
                    const barW = 56 / (gross.length > 8 ? 1.5 : 1);
                    const gap = (720 - gross.length * barW * 2) / (gross.length + 1);
                    return (
                      <>
                        {/* Grid lines */}
                        {[0.25, 0.5, 0.75, 1].map(f => (
                          <g key={f}>
                            <line x1="40" y1={180 - f * 160} x2="750" y2={180 - f * 160} stroke={T.border} strokeDasharray="3,3" />
                            <text x="36" y={184 - f * 160} textAnchor="end" fontSize="9" fill={T.inkLight} fontFamily="JetBrains Mono">
                              {Math.round(maxVal * f / 1000)}k
                            </text>
                          </g>
                        ))}
                        <line x1="40" y1="180" x2="750" y2="180" stroke={T.border} />
                        {/* Bars */}
                        {gross.map((g, i) => {
                          const x = 45 + i * (barW * 2 + gap);
                          const gH = (g / maxVal) * 160;
                          const pH = ((prod[i] || 0) / maxVal) * 160;
                          const isOT = (strategy.overtime?.[i] || 0) > 0;
                          return (
                            <g key={i}>
                              <rect x={x} y={180 - gH} width={barW - 2} height={gH} rx="3" fill={T.risk} opacity="0.25" />
                              <rect x={x + barW} y={180 - pH} width={barW - 2} height={pH} rx="3" fill={isOT ? T.warn : T.safe} opacity="0.7" />
                              <text x={x + barW} y="194" textAnchor="middle" fontSize="8" fill={T.inkLight} fontFamily="JetBrains Mono">
                                W{i + 1}
                              </text>
                            </g>
                          );
                        })}
                        {/* Legend */}
                        <rect x="580" y="4" width="10" height="10" rx="2" fill={T.risk} opacity="0.25" />
                        <text x="594" y="13" fontSize="9" fill={T.inkMid} fontFamily="JetBrains Mono">Demand</text>
                        <rect x="650" y="4" width="10" height="10" rx="2" fill={T.safe} opacity="0.7" />
                        <text x="664" y="13" fontSize="9" fill={T.inkMid} fontFamily="JetBrains Mono">Production</text>
                      </>
                    );
                  })()}
                </svg>
              </div>
            )}

            {/* PSI Table */}
            {strategy && (
              <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
                <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontFamily: 'Sora', fontSize: 14, fontWeight: 600, color: T.ink }}>
                    Production Plan — {currentFamilyPlan?.familyName || selectedFamily}
                    <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: T.inkLight }}>({selectedStrategy})</span>
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkLight }}>
                    Click 🔒 to firm periods
                  </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                        <th style={thStyle('left')}>Metric</th>
                        {periods.map((p, i) => {
                          const isFirmed = firmedPeriods.has(i);
                          return (
                            <th key={p} style={{ ...thStyle('right'), background: isFirmed ? '#E8F5E9' : 'transparent' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                                <button onClick={(e) => { e.stopPropagation(); handleFirmPeriod(i); }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 10, lineHeight: 1, color: isFirmed ? T.safe : T.inkGhost }}
                                  title={isFirmed ? 'Unfirm period' : 'Firm period'}>
                                  {isFirmed ? '🔒' : '🔓'}
                                </button>
                                <span>{typeof p === 'string' && p.length > 5 ? `W${i + 1}` : p}</span>
                              </div>
                            </th>
                          );
                        })}
                        <th style={thStyle('right')}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Gross Requirements */}
                      <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                        <td style={tdStyle()}>Gross Requirements</td>
                        {periods.map((p, i) => (
                          <td key={p} style={{ ...tdStyle('right'), background: firmedPeriods.has(i) ? '#E8F5E9' : 'transparent' }}>
                            {grossReqs[i]?.toLocaleString()}
                          </td>
                        ))}
                        <td style={{ ...tdStyle('right'), fontWeight: 500 }}>{grossReqs.reduce((s, v) => s + (v || 0), 0).toLocaleString()}</td>
                      </tr>

                      {/* Production */}
                      <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                        <td style={{ ...tdStyle(), color: T.modProduction, fontWeight: 500 }}>Production</td>
                        {periods.map((p, i) => (
                          <td key={p} style={{ ...tdStyle('right'), color: T.modProduction, fontWeight: 500, background: firmedPeriods.has(i) ? '#E8F5E9' : 'transparent' }}>
                            {strategy.production[i]?.toLocaleString()}
                          </td>
                        ))}
                        <td style={{ ...tdStyle('right'), color: T.modProduction, fontWeight: 600 }}>
                          {strategy.production.reduce((s, v) => s + (v || 0), 0).toLocaleString()}
                        </td>
                      </tr>

                      {/* Overtime (hybrid only) */}
                      {strategy.overtime && (
                        <tr style={{ borderBottom: `1px solid ${T.border}`, background: T.bgDark }}>
                          <td style={{ ...tdStyle(), fontSize: 11 }}>↳ Overtime</td>
                          {periods.map((p, i) => (
                            <td key={p} style={{ ...tdStyle('right'), fontSize: 11, color: strategy.overtime[i] > 0 ? T.warn : T.inkGhost }}>
                              {strategy.overtime[i] || '—'}
                            </td>
                          ))}
                          <td style={{ ...tdStyle('right'), fontSize: 11 }}>{strategy.overtime.reduce((s, v) => s + (v || 0), 0)}</td>
                        </tr>
                      )}

                      {/* Subcontract (hybrid only) */}
                      {strategy.subcontract && strategy.subcontract.some(v => v > 0) && (
                        <tr style={{ borderBottom: `1px solid ${T.border}`, background: T.bgDark }}>
                          <td style={{ ...tdStyle(), fontSize: 11 }}>↳ Subcontract</td>
                          {periods.map((p, i) => (
                            <td key={p} style={{ ...tdStyle('right'), fontSize: 11, color: strategy.subcontract[i] > 0 ? T.risk : T.inkGhost }}>
                              {strategy.subcontract[i] || '—'}
                            </td>
                          ))}
                          <td style={{ ...tdStyle('right'), fontSize: 11, color: T.risk }}>{strategy.subcontract.reduce((s, v) => s + (v || 0), 0)}</td>
                        </tr>
                      )}

                      {/* Ending Inventory */}
                      <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                        <td style={tdStyle()}>Ending Inventory</td>
                        {periods.map((p, i) => {
                          const ei = strategy.endingInventory[i];
                          const isNeg = ei < 0;
                          const isLow = ei >= 0 && ei < 50;
                          return (
                            <td key={p} style={{
                              ...tdStyle('right'),
                              color: isNeg ? T.risk : isLow ? T.warn : T.ink,
                              fontWeight: isNeg ? 600 : 400,
                              background: isNeg ? T.riskBg : firmedPeriods.has(i) ? '#E8F5E9' : 'transparent',
                            }}>
                              {ei?.toLocaleString()}
                              {isNeg && <span style={{ marginLeft: 2, fontSize: 9 }}>⚠</span>}
                            </td>
                          );
                        })}
                        <td style={tdStyle('right')}></td>
                      </tr>

                      {/* Cost */}
                      {strategy.costBreakdown && (
                        <tr style={{ borderBottom: `1px solid ${T.border}`, background: T.bgDark }}>
                          <td colSpan={periods.length + 2} style={{ padding: '10px 10px' }}>
                            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                              {Object.entries(strategy.costBreakdown).map(([k, v]) => (
                                <div key={k} style={{ fontFamily: 'JetBrains Mono', fontSize: 11 }}>
                                  <span style={{ color: T.inkLight, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                                    {k.replace(/([A-Z])/g, ' $1').trim()}
                                  </span>
                                  <span style={{ marginLeft: 6, color: v > 0 ? T.ink : T.inkGhost, fontWeight: 500 }}>
                                    ${Math.round(v).toLocaleString()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ─── Exception Management Panel ─── */}
            <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontFamily: 'Sora', fontSize: 14, fontWeight: 600, color: T.ink }}>
                  Exception Management
                  {critCount > 0 && <span style={{ marginLeft: 8, fontSize: 11, color: T.risk, fontWeight: 500 }}>{critCount} critical</span>}
                  {warnCount > 0 && <span style={{ marginLeft: 8, fontSize: 11, color: T.warn, fontWeight: 500 }}>{warnCount} warning</span>}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {['all', 'critical', 'warning', 'info'].map(f => (
                    <button key={f} onClick={() => setExceptionFilter(f)}
                      style={{
                        background: exceptionFilter === f ? T.ink : T.white,
                        color: exceptionFilter === f ? T.white : T.inkMid,
                        border: `1px solid ${exceptionFilter === f ? T.ink : T.border}`,
                        borderRadius: 4, padding: '3px 10px', cursor: 'pointer',
                        fontSize: 10, fontFamily: 'JetBrains Mono', textTransform: 'uppercase', fontWeight: 500,
                      }}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {exceptions.length === 0 ? (
                  <div style={{ padding: 30, textAlign: 'center', color: T.inkLight, fontSize: 13 }}>No exceptions</div>
                ) : (
                  exceptions.map(exc => {
                    const isExpanded = expandedExceptions.has(exc.id);
                    return (
                      <div key={exc.id} style={{
                        borderBottom: `1px solid ${T.border}`,
                        background: exc.status === 'resolved' ? T.bgDark : exc.severity === 'critical' ? T.riskBg : 'transparent',
                        opacity: exc.status === 'resolved' ? 0.6 : 1,
                      }}>
                        <div
                          onClick={() => setExpandedExceptions(prev => {
                            const next = new Set(prev);
                            isExpanded ? next.delete(exc.id) : next.add(exc.id);
                            return next;
                          })}
                          style={{ padding: '10px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                          {/* Severity dot */}
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: SEV[exc.severity], flexShrink: 0 }} />

                          {/* ID */}
                          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkLight, minWidth: 60 }}>{exc.id}</span>

                          {/* Type badge */}
                          <span style={{
                            fontFamily: 'JetBrains Mono', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5,
                            padding: '1px 6px', borderRadius: 3, fontWeight: 500,
                            background: SEV_BG[exc.severity], color: SEV[exc.severity],
                            border: `1px solid ${SEV[exc.severity]}20`,
                          }}>
                            {exc.type}
                          </span>

                          {/* Message */}
                          <span style={{ fontSize: 12, color: T.ink, flex: 1 }}>{exc.message}</span>

                          {/* Status */}
                          <span style={{
                            fontSize: 9, fontFamily: 'JetBrains Mono', textTransform: 'uppercase',
                            color: exc.status === 'open' ? T.risk : exc.status === 'acknowledged' ? T.warn : T.safe,
                            fontWeight: 600, letterSpacing: 0.5,
                          }}>
                            {exc.status}
                          </span>

                          {/* Expand arrow */}
                          <span style={{ color: T.inkGhost, fontSize: 11 }}>{isExpanded ? '▾' : '▸'}</span>
                        </div>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <div style={{ padding: '0 20px 14px 40px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 10 }}>
                              {exc.plant && (
                                <div>
                                  <div style={{ fontSize: 9, color: T.inkLight, fontFamily: 'JetBrains Mono', textTransform: 'uppercase', letterSpacing: 0.8 }}>Plant</div>
                                  <div style={{ fontSize: 12, color: T.ink }}>{exc.plant}</div>
                                </div>
                              )}
                              {exc.familyId && (
                                <div>
                                  <div style={{ fontSize: 9, color: T.inkLight, fontFamily: 'JetBrains Mono', textTransform: 'uppercase', letterSpacing: 0.8 }}>Family</div>
                                  <div style={{ fontSize: 12, color: T.ink }}>{exc.familyId}</div>
                                </div>
                              )}
                              {exc.period && (
                                <div>
                                  <div style={{ fontSize: 9, color: T.inkLight, fontFamily: 'JetBrains Mono', textTransform: 'uppercase', letterSpacing: 0.8 }}>Period</div>
                                  <div style={{ fontSize: 12, color: T.ink }}>{exc.period}</div>
                                </div>
                              )}
                            </div>

                            {exc.recommendation && (
                              <div style={{ background: T.bgDark, borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: T.inkMid, lineHeight: 1.5 }}>
                                <span style={{ fontWeight: 500, color: T.ink }}>Recommendation: </span>
                                {exc.recommendation}
                              </div>
                            )}

                            {exc.status !== 'resolved' && (
                              <div style={{ display: 'flex', gap: 8 }}>
                                {exc.status === 'open' && (
                                  <button onClick={(e) => { e.stopPropagation(); handleAcknowledge(exc.id); }}
                                    style={{ background: T.warnBg, color: T.warn, border: `1px solid ${T.warnBorder}`, borderRadius: 5, padding: '4px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>
                                    Acknowledge
                                  </button>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); handleResolve(exc.id, 'Accepted recommendation'); }}
                                  style={{ background: T.safeBg, color: T.safe, border: `1px solid ${T.safe}`, borderRadius: 5, padding: '4px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>
                                  Resolve
                                </button>
                              </div>
                            )}

                            {exc.status === 'resolved' && exc.resolution && (
                              <div style={{ fontSize: 11, color: T.safe, fontFamily: 'JetBrains Mono' }}>
                                ✓ {exc.resolution}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ─── TAB: RCCP (Rough-Cut Capacity Planning) ─────────────────── */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {tab === 'rccp' && !loading && (
          <>
            {/* Aggregate RCCP for selected plant */}
            {currentPlant && (
              <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
                <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ fontFamily: 'Sora', fontSize: 14, fontWeight: 600, color: T.ink }}>
                    Capacity Feasibility — {currentPlant.plantName}
                  </div>
                  <div style={{ fontSize: 11, color: T.inkMid, marginTop: 2 }}>
                    Aggregate load across all product families for the selected strategy
                  </div>
                </div>

                {/* Per work-center capacity bars */}
                {currentFamilyPlan?.plan?.strategies?.[selectedStrategy]?.rccp?.map(wc => (
                  <WorkCenterCapacity key={wc.code} wc={wc} periods={periods} />
                ))}

                {!currentFamilyPlan?.plan?.strategies?.[selectedStrategy]?.rccp?.length && (
                  <div style={{ padding: 30, textAlign: 'center', color: T.inkLight }}>No RCCP data for this family/strategy</div>
                )}
              </div>
            )}

            {/* Strategy RCCP comparison */}
            {currentFamilyPlan?.plan?.strategies && (
              <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ fontFamily: 'Sora', fontSize: 14, fontWeight: 600, color: T.ink }}>
                    Strategy Capacity Comparison — {currentFamilyPlan.familyName}
                  </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                        <th style={thStyle('left')}>Work Center</th>
                        <th style={thStyle('center')}>Chase Peak %</th>
                        <th style={thStyle('center')}>Level Peak %</th>
                        <th style={thStyle('center')}>Hybrid Peak %</th>
                        <th style={thStyle('center')}>Capacity/Period</th>
                        <th style={thStyle('center')}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(currentFamilyPlan.plan.strategies.chase?.rccp || []).map((wc, idx) => {
                        const chaseMax = Math.max(...(wc.utilization || [0]));
                        const levelMax = Math.max(...(currentFamilyPlan.plan.strategies.level?.rccp?.[idx]?.utilization || [0]));
                        const hybridMax = Math.max(...(currentFamilyPlan.plan.strategies.hybrid?.rccp?.[idx]?.utilization || [0]));
                        const worstCase = Math.max(chaseMax, levelMax, hybridMax);
                        return (
                          <tr key={wc.code} style={{ borderBottom: `1px solid ${T.border}` }}>
                            <td style={tdStyle()}>
                              <div style={{ fontWeight: 500, color: T.ink }}>{wc.code}</div>
                              <div style={{ fontSize: 10, color: T.inkLight }}>{wc.capacityHoursPerPeriod}h capacity</div>
                            </td>
                            <td style={{ ...tdStyle('center'), color: chaseMax > 100 ? T.risk : chaseMax > 85 ? T.warn : T.safe }}>{chaseMax.toFixed(0)}%</td>
                            <td style={{ ...tdStyle('center'), color: levelMax > 100 ? T.risk : levelMax > 85 ? T.warn : T.safe }}>{levelMax.toFixed(0)}%</td>
                            <td style={{ ...tdStyle('center'), color: hybridMax > 100 ? T.risk : hybridMax > 85 ? T.warn : T.safe }}>{hybridMax.toFixed(0)}%</td>
                            <td style={{ ...tdStyle('center'), color: T.inkLight }}>{wc.capacityHoursPerPeriod}h</td>
                            <td style={tdStyle('center')}>
                              <span style={{
                                padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 600,
                                fontFamily: 'JetBrains Mono', textTransform: 'uppercase',
                                background: worstCase > 100 ? T.riskBg : worstCase > 85 ? T.warnBg : T.safeBg,
                                color: worstCase > 100 ? T.risk : worstCase > 85 ? T.warn : T.safe,
                              }}>
                                {worstCase > 100 ? 'OVERLOADED' : worstCase > 85 ? 'NEAR LIMIT' : 'FEASIBLE'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ─── TAB: Inputs (Calendars + Rates) ─────────────────────────── */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {tab === 'inputs' && (
          <>
            {/* Plant Calendars */}
            <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}` }}>
                <div style={{ fontFamily: 'Sora', fontSize: 14, fontWeight: 600, color: T.ink }}>Production Calendars</div>
                <div style={{ fontSize: 11, color: T.inkMid, marginTop: 2 }}>Working days, shifts, and available hours per plant</div>
              </div>
              {calendars?.calendars ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, padding: 20 }}>
                  {Object.entries(calendars.calendars).map(([plantCode, cal]) => (
                    <div key={plantCode} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: 16 }}>
                      <div style={{ fontFamily: 'Sora', fontSize: 13, fontWeight: 600, color: T.ink, marginBottom: 12 }}>
                        {cal.plantName || plantCode}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {[
                          { label: 'Working Days/Week', value: cal.workingDaysPerWeek },
                          { label: 'Shifts/Day', value: cal.shifts },
                          { label: 'Hours/Shift', value: cal.hoursPerShift },
                          { label: 'Effective Hrs/Week', value: cal.effectiveHoursPerWeek, highlight: true },
                        ].map(item => (
                          <div key={item.label} style={{ background: item.highlight ? T.bgDark : 'transparent', borderRadius: 5, padding: '6px 10px' }}>
                            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 8, color: T.inkLight, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>{item.label}</div>
                            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 16, fontWeight: 600, color: item.highlight ? T.modProduction : T.ink }}>{item.value}</div>
                          </div>
                        ))}
                      </div>
                      {cal.overtimeAvailable && (
                        <div style={{ marginTop: 8, fontSize: 11, color: T.warn, fontFamily: 'JetBrains Mono' }}>
                          ⚡ Overtime available: {cal.overtimeNotes || 'Saturday shifts'}
                        </div>
                      )}
                      {cal.holidays?.length > 0 && (
                        <div style={{ marginTop: 6, fontSize: 10, color: T.inkLight }}>
                          Upcoming holidays: {cal.holidays.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: 30, textAlign: 'center', color: T.inkLight }}>Loading calendars...</div>
              )}
            </div>

            {/* Production Rates */}
            <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}` }}>
                <div style={{ fontFamily: 'Sora', fontSize: 14, fontWeight: 600, color: T.ink }}>Production Rates</div>
                <div style={{ fontSize: 11, color: T.inkMid, marginTop: 2 }}>Units per hour, setup times, and run constraints by product family</div>
              </div>
              {rates?.rates ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                        <th style={thStyle('left')}>Plant</th>
                        <th style={thStyle('left')}>Family</th>
                        <th style={thStyle('right')}>Units/Hour</th>
                        <th style={thStyle('right')}>Setup (hrs)</th>
                        <th style={thStyle('right')}>Changeover (hrs)</th>
                        <th style={thStyle('right')}>Min Run</th>
                        <th style={thStyle('right')}>Max Run</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rates.rates.map((r, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                          <td style={tdStyle()}>{r.plantCode}</td>
                          <td style={{ ...tdStyle(), fontWeight: 500, color: T.ink }}>{r.familyName || r.familyId}</td>
                          <td style={{ ...tdStyle('right'), color: T.modProduction, fontWeight: 500 }}>{r.unitsPerHour}</td>
                          <td style={tdStyle('right')}>{r.setupTimeHrs}</td>
                          <td style={tdStyle('right')}>{r.changeoverTimeHrs}</td>
                          <td style={tdStyle('right')}>{r.minRunSize?.toLocaleString()}</td>
                          <td style={tdStyle('right')}>{r.maxRunSize?.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: 30, textAlign: 'center', color: T.inkLight }}>Loading rates...</div>
              )}
            </div>

            {/* Supply-Demand Match Heuristics */}
            <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden', marginTop: 20 }}>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}` }}>
                <div style={{ fontFamily: 'Sora', fontSize: 14, fontWeight: 600, color: T.ink }}>Supply-Demand Match Heuristics</div>
                <div style={{ fontSize: 11, color: T.inkMid, marginTop: 2 }}>
                  Configurable policies that drive how production plans balance supply against demand
                </div>
              </div>
              {heuristics?.heuristics ? (
                <div style={{ padding: 20 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>

                    {/* Lot Sizing Policy */}
                    <HeuristicCard
                      title="Lot Sizing Policy"
                      description="How production quantities are determined relative to net requirements"
                      current={heuristics.heuristics.lotSizing}
                      options={[
                        { value: 'LFL', label: 'Lot-for-Lot', desc: 'Produce exactly what is needed. Minimizes inventory.' },
                        { value: 'FOQ', label: 'Fixed Order Qty', desc: 'Always produce in fixed batch sizes. Reduces setups.' },
                        { value: 'POQ', label: 'Period Order Qty', desc: 'Cover N periods of demand in each run.' },
                        { value: 'EOQ', label: 'Economic Order Qty', desc: 'Balance setup cost vs carrying cost (Wilson formula).' },
                      ]}
                      onUpdate={(val) => updateHeuristic('lotSizing', val)}
                    />

                    {/* Safety Stock Policy */}
                    <HeuristicCard
                      title="Safety Stock Policy"
                      description="Buffer inventory to protect against demand variability and supply disruption"
                      current={heuristics.heuristics.safetyStock}
                      options={[
                        { value: 'fixed', label: 'Fixed Units', desc: 'Maintain a constant safety stock quantity.' },
                        { value: 'wos', label: 'Weeks of Supply', desc: 'Safety stock = N weeks of average demand.' },
                        { value: 'service', label: 'Service Level %', desc: 'Statistically determined from demand variability.' },
                        { value: 'dynamic', label: 'Dynamic', desc: 'Varies by season — higher in peak, lower in trough.' },
                      ]}
                      onUpdate={(val) => updateHeuristic('safetyStock', val)}
                    />

                    {/* Time Fence Policy */}
                    <HeuristicCard
                      title="Planning Time Fences"
                      description="Frozen/slushy/liquid zones controlling plan stability vs flexibility"
                      current={heuristics.heuristics.timeFence}
                      options={[
                        { value: 'strict', label: 'Strict (2-4-6)', desc: '2wk frozen, 4wk slushy, 6wk+ liquid.' },
                        { value: 'moderate', label: 'Moderate (1-3-5)', desc: '1wk frozen, 3wk slushy, 5wk+ liquid.' },
                        { value: 'flexible', label: 'Flexible (1-2-4)', desc: '1wk frozen, 2wk slushy, 4wk+ liquid.' },
                        { value: 'agile', label: 'Agile (0-1-3)', desc: 'No frozen zone. Maximum responsiveness.' },
                      ]}
                      onUpdate={(val) => updateHeuristic('timeFence', val)}
                    />

                    {/* Capacity Allocation */}
                    <HeuristicCard
                      title="Capacity Allocation Priority"
                      description="When capacity is constrained, which families get produced first"
                      current={heuristics.heuristics.capacityPriority}
                      options={[
                        { value: 'margin', label: 'Highest Margin First', desc: 'Prioritize products with highest contribution margin.' },
                        { value: 'stockout', label: 'Stockout Risk First', desc: 'Prioritize products closest to stockout.' },
                        { value: 'customer', label: 'Customer Priority', desc: 'Top customers (Petco, Chewy) get allocation first.' },
                        { value: 'fifo', label: 'FIFO (Demand Date)', desc: 'Earliest demand date gets priority.' },
                      ]}
                      onUpdate={(val) => updateHeuristic('capacityPriority', val)}
                    />

                    {/* Smoothing */}
                    <HeuristicCard
                      title="Production Smoothing"
                      description="Limits on period-to-period production rate changes"
                      current={heuristics.heuristics.smoothing}
                      options={[
                        { value: 'none', label: 'No Smoothing', desc: 'Production can change freely each period.' },
                        { value: 'light', label: 'Light (±20%)', desc: 'Max 20% change between adjacent periods.' },
                        { value: 'moderate', label: 'Moderate (±10%)', desc: 'Max 10% change. Stable workforce.' },
                        { value: 'heavy', label: 'Heavy (±5%)', desc: 'Near-level production. Minimal disruption.' },
                      ]}
                      onUpdate={(val) => updateHeuristic('smoothing', val)}
                    />

                    {/* Inventory Target */}
                    <HeuristicCard
                      title="Inventory Target Policy"
                      description="Desired weeks of supply to maintain at end of each period"
                      current={heuristics.heuristics.inventoryTarget}
                      options={[
                        { value: 'lean', label: 'Lean (1-2 wks)', desc: 'Minimize inventory. Accept higher stockout risk.' },
                        { value: 'balanced', label: 'Balanced (2-4 wks)', desc: 'Moderate buffer. Standard for most operations.' },
                        { value: 'conservative', label: 'Conservative (4-6 wks)', desc: 'Large buffer. Low stockout risk, high carrying cost.' },
                        { value: 'seasonal', label: 'Seasonal Build', desc: 'Build ahead of peak seasons, draw down after.' },
                      ]}
                      onUpdate={(val) => updateHeuristic('inventoryTarget', val)}
                    />
                  </div>
                </div>
              ) : (
                <div style={{ padding: 30, textAlign: 'center', color: T.inkLight }}>Loading heuristics...</div>
              )}
            </div>
          </>
        )}
      </div>
    </ModuleLayout>
  );
}

// ─── Work Center Capacity Component ──────────────────────────────────────────

function WorkCenterCapacity({ wc, periods }) {
  const maxUtil = Math.max(...(wc.utilization || [0]));
  const hasOverload = wc.overloaded?.some(v => v);

  return (
    <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <span style={{ fontFamily: 'Sora', fontSize: 13, fontWeight: 600, color: T.ink }}>{wc.code}</span>
          <span style={{ marginLeft: 8, fontSize: 10, color: T.inkLight, fontFamily: 'JetBrains Mono' }}>
            {wc.capacityHoursPerPeriod}h capacity/period · {typeof wc.hoursPerUnit === 'number' ? (wc.hoursPerUnit < 0.01 ? wc.hoursPerUnit.toExponential(1) : wc.hoursPerUnit.toFixed(3)) : wc.hoursPerUnit} hrs/unit
          </span>
        </div>
        <span style={{
          padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 600,
          fontFamily: 'JetBrains Mono', textTransform: 'uppercase',
          background: hasOverload ? T.riskBg : maxUtil > 85 ? T.warnBg : T.safeBg,
          color: hasOverload ? T.risk : maxUtil > 85 ? T.warn : T.safe,
        }}>
          Peak: {maxUtil.toFixed(0)}%
        </span>
      </div>

      {/* Bar chart */}
      <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 80 }}>
        {periods.map((p, i) => {
          const util = wc.utilization?.[i] || 0;
          const load = wc.loadHours?.[i] || 0;
          const cap = wc.capacityHoursPerPeriod;
          const barH = Math.min(util, 120) / 120 * 70; // cap visual at 120%
          const isOver = util > 100;
          const isNear = util > 85;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ fontSize: 8, fontFamily: 'JetBrains Mono', color: isOver ? T.risk : isNear ? T.warn : T.inkLight }}>
                {util.toFixed(0)}%
              </div>
              <div style={{ position: 'relative', width: '100%', height: 70 }}>
                {/* Capacity line at 100% */}
                <div style={{ position: 'absolute', bottom: (100 / 120) * 70, left: 0, right: 0, height: 1, background: T.inkGhost, borderStyle: 'dashed' }} />
                {/* Bar */}
                <div style={{
                  position: 'absolute', bottom: 0, left: '15%', right: '15%',
                  height: barH, borderRadius: '3px 3px 0 0',
                  background: isOver ? T.risk : isNear ? T.warn : T.safe,
                  opacity: 0.8, transition: 'height 0.3s',
                }} />
              </div>
              <div style={{ fontSize: 8, fontFamily: 'JetBrains Mono', color: T.inkGhost }}>
                W{i + 1}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Heuristic Card Component ────────────────────────────────────────────────

function HeuristicCard({ title, description, current, options, onUpdate }) {
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: 16 }}>
      <div style={{ fontFamily: 'Sora', fontSize: 13, fontWeight: 600, color: T.ink, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 11, color: T.inkMid, marginBottom: 12, lineHeight: 1.4 }}>{description}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {options.map(opt => {
          const isActive = current === opt.value;
          return (
            <div
              key={opt.value}
              onClick={() => onUpdate(opt.value)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                background: isActive ? T.modProduction + '12' : 'transparent',
                border: `1.5px solid ${isActive ? T.modProduction : 'transparent'}`,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = T.bgDark; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              {/* Radio indicator */}
              <div style={{
                width: 14, height: 14, borderRadius: '50%', marginTop: 1, flexShrink: 0,
                border: `2px solid ${isActive ? T.modProduction : T.inkGhost}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {isActive && <div style={{ width: 7, height: 7, borderRadius: '50%', background: T.modProduction }} />}
              </div>
              <div>
                <div style={{
                  fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: isActive ? 600 : 500,
                  color: isActive ? T.modProduction : T.ink, marginBottom: 1,
                }}>
                  {opt.label}
                </div>
                <div style={{ fontSize: 10, color: T.inkLight, lineHeight: 1.3 }}>{opt.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
