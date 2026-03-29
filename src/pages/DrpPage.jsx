import { useState, useEffect, useCallback } from 'react';
import { T } from '../styles/tokens';
import ModuleLayout from '../components/shared/ModuleLayout';
import PageHeader from '../components/shared/PageHeader';
import DistributionPlannerTab from '../components/drp/DistributionPlannerTab';
import LoadManagerTab from '../components/drp/LoadManagerTab';
import MoveVsMakeTab from '../components/drp/MoveVsMakeTab';

const TABS = [
  { id: 'planner', label: 'Distribution Planner' },
  { id: 'loads', label: 'Load Manager' },
  { id: 'moveVsMake', label: 'Move vs Make' },
];

const API = '/api/drp';

/* ─── Static fallback data (used when API is unavailable, e.g. on Vercel) ─── */
const FALLBACK = {
  plan: {
    summary: {
      totalShipments: 14,
      totalWeight: 186400,
      totalCost: 72350,
      activeLanes: 6,
      recommendedShipments: 8,
      pendingLoads: 0,
      committedLoads: 0,
      moveVsMakeScenarios: 2,
    },
    lanes: [
      { laneKey: 'PLT-DOGSTAR→DC-ATL', from: 'PLT-DOGSTAR', to: 'DC-ATL', mode: 'plant', distanceMiles: 460, leadTimeDays: 2, recommendedTransitType: 'truck', shipmentCount: 3 },
      { laneKey: 'PLT-DOGSTAR→DC-DEN', from: 'PLT-DOGSTAR', to: 'DC-DEN', mode: 'plant', distanceMiles: 1180, leadTimeDays: 3, recommendedTransitType: 'truck', shipmentCount: 2 },
      { laneKey: 'PLT-NORTHSTAR→DC-TOR', from: 'PLT-NORTHSTAR', to: 'DC-TOR', mode: 'plant', distanceMiles: 2100, leadTimeDays: 4, recommendedTransitType: 'rail', shipmentCount: 3 },
      { laneKey: 'PLT-NORTHSTAR→DC-DEN', from: 'PLT-NORTHSTAR', to: 'DC-DEN', mode: 'plant', distanceMiles: 1640, leadTimeDays: 3, recommendedTransitType: 'truck', shipmentCount: 2 },
      { laneKey: 'PLT-NORTHSTAR→DC-ATL', from: 'PLT-NORTHSTAR', to: 'DC-ATL', mode: 'plant', distanceMiles: 2480, leadTimeDays: 5, recommendedTransitType: 'intermodal', shipmentCount: 2 },
      { laneKey: 'DC-ATL↔DC-DEN', from: 'DC-ATL', to: 'DC-DEN', mode: 'STO', distanceMiles: 1390, leadTimeDays: 3 },
      { laneKey: 'DC-TOR↔DC-ATL', from: 'DC-TOR', to: 'DC-ATL', mode: 'STO', distanceMiles: 880, leadTimeDays: 2 },
    ],
    demandSplits: {
      'orijen-dry-dog':   { 'DC-ATL': 0.45, 'DC-DEN': 0.30, 'DC-TOR': 0.25 },
      'orijen-dry-cat':   { 'DC-ATL': 0.40, 'DC-DEN': 0.25, 'DC-TOR': 0.35 },
      'acana-wet-dog':    { 'DC-ATL': 0.50, 'DC-DEN': 0.30, 'DC-TOR': 0.20 },
      'acana-dry-dog':    { 'DC-ATL': 0.35, 'DC-DEN': 0.35, 'DC-TOR': 0.30 },
      'orijen-freeze-dry': { 'DC-ATL': 0.40, 'DC-DEN': 0.35, 'DC-TOR': 0.25 },
    },
    calendars: {
      'PLT-DOGSTAR→DC-ATL':   { shipDays: [1, 3, 5], frequency: '3x/wk' },
      'PLT-DOGSTAR→DC-DEN':   { shipDays: [2, 4], frequency: '2x/wk' },
      'PLT-NORTHSTAR→DC-TOR': { shipDays: [1, 3, 5], frequency: '3x/wk' },
      'PLT-NORTHSTAR→DC-DEN': { shipDays: [2, 5], frequency: '2x/wk' },
      'PLT-NORTHSTAR→DC-ATL': { shipDays: [1, 4], frequency: '2x/wk' },
    },
    dcInventory: {
      'DC-ATL': {
        'orijen-dry-dog': { onHand: 14200, safetyStock: 8000, daysOfSupply: 22 },
        'acana-dry-dog':  { onHand: 9800, safetyStock: 6000, daysOfSupply: 18 },
        'orijen-dry-cat': { onHand: 11500, safetyStock: 7000, daysOfSupply: 20 },
        'acana-wet-dog':  { onHand: 7000, safetyStock: 5000, daysOfSupply: 14 },
      },
      'DC-DEN': {
        'orijen-dry-dog': { onHand: 9800, safetyStock: 7000, daysOfSupply: 14 },
        'acana-dry-dog':  { onHand: 5200, safetyStock: 5500, daysOfSupply: 9 },
        'orijen-freeze-dry': { onHand: 4300, safetyStock: 3000, daysOfSupply: 12 },
        'acana-wet-dog':  { onHand: 9000, safetyStock: 6000, daysOfSupply: 16 },
      },
      'DC-TOR': {
        'orijen-dry-cat': { onHand: 12400, safetyStock: 6000, daysOfSupply: 24 },
        'acana-dry-dog':  { onHand: 8700, safetyStock: 5000, daysOfSupply: 18 },
        'orijen-dry-dog': { onHand: 6900, safetyStock: 7500, daysOfSupply: 10 },
        'orijen-freeze-dry': { onHand: 6100, safetyStock: 4000, daysOfSupply: 15 },
      },
    },
  },

  shipmentData: {
    shipments: [
      { id: 'SHP-4001', laneKey: 'PLT-DOGSTAR→DC-ATL', fromCode: 'PLT-DOGSTAR', toCode: 'DC-ATL', skuName: 'Orijen Original Dry Dog 25lb', qty: 1800, uom: 'cases', weightLbs: 45000, pallets: 24, priority: 'high' },
      { id: 'SHP-4002', laneKey: 'PLT-DOGSTAR→DC-ATL', fromCode: 'PLT-DOGSTAR', toCode: 'DC-ATL', skuName: 'Acana Red Meat Dry Dog 25lb', qty: 1200, uom: 'cases', weightLbs: 30000, pallets: 16, priority: 'medium' },
      { id: 'SHP-4003', laneKey: 'PLT-DOGSTAR→DC-ATL', fromCode: 'PLT-DOGSTAR', toCode: 'DC-ATL', skuName: 'Orijen Six Fish Dry Dog 25lb', qty: 600, uom: 'cases', weightLbs: 15000, pallets: 8, priority: 'normal' },
      { id: 'SHP-4004', laneKey: 'PLT-DOGSTAR→DC-DEN', fromCode: 'PLT-DOGSTAR', toCode: 'DC-DEN', skuName: 'Orijen Original Dry Dog 25lb', qty: 1400, uom: 'cases', weightLbs: 35000, pallets: 18, priority: 'high' },
      { id: 'SHP-4005', laneKey: 'PLT-DOGSTAR→DC-DEN', fromCode: 'PLT-DOGSTAR', toCode: 'DC-DEN', skuName: 'Acana Wet Dog Lamb 12.8oz', qty: 960, uom: 'cases', weightLbs: 9600, pallets: 6, priority: 'medium' },
      { id: 'SHP-4006', laneKey: 'PLT-NORTHSTAR→DC-TOR', fromCode: 'PLT-NORTHSTAR', toCode: 'DC-TOR', skuName: 'Orijen Dry Cat Tundra 12lb', qty: 2200, uom: 'cases', weightLbs: 26400, pallets: 14, priority: 'high' },
      { id: 'SHP-4007', laneKey: 'PLT-NORTHSTAR→DC-TOR', fromCode: 'PLT-NORTHSTAR', toCode: 'DC-TOR', skuName: 'Acana Dry Dog Heritage 25lb', qty: 800, uom: 'cases', weightLbs: 20000, pallets: 10, priority: 'normal' },
      { id: 'SHP-4008', laneKey: 'PLT-NORTHSTAR→DC-DEN', fromCode: 'PLT-NORTHSTAR', toCode: 'DC-DEN', skuName: 'Orijen Freeze-Dried Dog 16oz', qty: 540, uom: 'cases', weightLbs: 5400, pallets: 4, priority: 'medium' },
    ],
    pendingLoads: [],
    committedLoads: [],
  },

  scenarios: [
    {
      id: 'MVM-301', status: 'open',
      skuName: 'Orijen Original Dry Dog 25lb',
      fromDC: 'DC-ATL', fromDCName: 'Atlanta', toDC: 'DC-DEN', toDCName: 'Denver',
      fromDaysOfSupply: 28, toDaysOfSupply: 5, qty: 2400, severity: 'critical',
      analysis: {
        recommendation: 'move', savingsPercent: 34, savingsAmount: 8150,
        moveOption: {
          cost: 15800, leadTimeDays: 3,
          steps: [
            { label: 'STO transfer DC-ATL → DC-DEN', cost: 12200, days: 3 },
            { label: 'Handling & restocking', cost: 3600, days: 0 },
          ],
          riskFactors: ['Truck capacity limited mid-week'],
        },
        makeOption: {
          cost: 23950, leadTimeDays: 10,
          steps: [
            { label: 'Schedule run at DogStar Kitchens', cost: 0, days: 4 },
            { label: 'Production (2,400 cases)', cost: 16800, days: 3 },
            { label: 'Ship PLT-DOGSTAR → DC-DEN', cost: 7150, days: 3 },
          ],
          riskFactors: ['Line changeover required', 'Raw material lead time risk'],
        },
      },
    },
    {
      id: 'MVM-302', status: 'open',
      skuName: 'Acana Wet Dog Lamb 12.8oz',
      fromDC: 'DC-TOR', fromDCName: 'Toronto', toDC: 'DC-ATL', toDCName: 'Atlanta',
      fromDaysOfSupply: 22, toDaysOfSupply: 8, qty: 1600, severity: 'warning',
      analysis: {
        recommendation: 'move', savingsPercent: 18, savingsAmount: 3200,
        moveOption: {
          cost: 14600, leadTimeDays: 2,
          steps: [
            { label: 'STO transfer DC-TOR → DC-ATL', cost: 11400, days: 2 },
            { label: 'Handling & restocking', cost: 3200, days: 0 },
          ],
          riskFactors: ['Cross-border customs clearance'],
        },
        makeOption: {
          cost: 17800, leadTimeDays: 12,
          steps: [
            { label: 'Schedule run at NorthStar Kitchen', cost: 0, days: 5 },
            { label: 'Production (1,600 cases)', cost: 10400, days: 3 },
            { label: 'Ship PLT-NORTHSTAR → DC-ATL', cost: 7400, days: 4 },
          ],
          riskFactors: ['Wet line at capacity until next week'],
        },
      },
    },
    {
      id: 'MVM-303', status: 'executed',
      skuName: 'Orijen Freeze-Dried Dog 16oz',
      fromDC: 'DC-DEN', fromDCName: 'Denver', toDC: 'DC-TOR', toDCName: 'Toronto',
      fromDaysOfSupply: 31, toDaysOfSupply: 9, qty: 800, severity: 'warning',
      analysis: {
        recommendation: 'make', savingsPercent: 12, savingsAmount: 1450,
        moveOption: {
          cost: 13500, leadTimeDays: 5,
          steps: [
            { label: 'STO transfer DC-DEN → DC-TOR', cost: 10800, days: 4 },
            { label: 'Cross-border brokerage', cost: 1500, days: 1 },
            { label: 'Handling & restocking', cost: 1200, days: 0 },
          ],
          riskFactors: ['Cross-border transit variability', 'Limited reefer availability'],
        },
        makeOption: {
          cost: 12050, leadTimeDays: 8,
          steps: [
            { label: 'Schedule run at NorthStar Kitchen', cost: 0, days: 3 },
            { label: 'Freeze-dry production (800 cases)', cost: 7250, days: 3 },
            { label: 'Ship PLT-NORTHSTAR → DC-TOR', cost: 4800, days: 2 },
          ],
          riskFactors: [],
        },
      },
    },
  ],
};

export default function DrpPage() {
  const [activeTab, setActiveTab] = useState('planner');
  const [plan, setPlan] = useState(null);
  const [shipmentData, setShipmentData] = useState(null);
  const [scenarios, setScenarios] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchPlan = useCallback(() => {
    fetch(`${API}/distribution-plan`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setPlan)
      .catch(() => setPlan(FALLBACK.plan));
  }, []);

  const fetchShipments = useCallback(() => {
    fetch(`${API}/recommended-shipments`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setShipmentData)
      .catch(() => setShipmentData(FALLBACK.shipmentData));
  }, []);

  const fetchScenarios = useCallback(() => {
    fetch(`${API}/move-vs-make/scenarios`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => setScenarios(data.scenarios || []))
      .catch(() => setScenarios(FALLBACK.scenarios));
  }, []);

  // Fetch data for the active tab
  useEffect(() => {
    setLoading(true);
    if (activeTab === 'planner') {
      fetchPlan();
    } else if (activeTab === 'loads') {
      fetchShipments();
    } else if (activeTab === 'moveVsMake') {
      fetchScenarios();
    }
    setLoading(false);
  }, [activeTab, fetchPlan, fetchShipments, fetchScenarios]);

  const handleUpdateSplit = async (familyId, allocations) => {
    // Optimistic update
    setPlan(prev => {
      if (!prev?.demandSplits) return prev;
      return { ...prev, demandSplits: { ...prev.demandSplits, [familyId]: allocations } };
    });
    try {
      await fetch(`${API}/demand-split`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyId, allocations }),
      });
    } catch { /* API unavailable, local state already updated */ }
  };

  const handleUpdateCalendar = async (laneKey, updates) => {
    // Optimistic update
    setPlan(prev => {
      if (!prev?.calendars) return prev;
      const cal = prev.calendars[laneKey] || {};
      return { ...prev, calendars: { ...prev.calendars, [laneKey]: { ...cal, ...updates } } };
    });
    try {
      await fetch(`${API}/shipping-calendar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ laneKey, ...updates }),
      });
    } catch { /* API unavailable, local state already updated */ }
  };

  return (
    <ModuleLayout moduleContext="drp" tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}>
      <PageHeader
        title="Distribution Planning"
        subtitle="Champion Pet Foods — DRP"
      />

      {activeTab === 'planner' && (
        <DistributionPlannerTab
          plan={plan}
          onUpdateSplit={handleUpdateSplit}
          onUpdateCalendar={handleUpdateCalendar}
        />
      )}

      {activeTab === 'loads' && (
        <LoadManagerTab
          shipmentData={shipmentData}
          onRefresh={fetchShipments}
        />
      )}

      {activeTab === 'moveVsMake' && (
        <MoveVsMakeTab
          scenarios={scenarios}
          onRefresh={fetchScenarios}
        />
      )}
    </ModuleLayout>
  );
}
