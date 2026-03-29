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
      'DC-ATL': { daysOfSupply: 18, onHand: 42500, inTransit: 12400, backorder: 0 },
      'DC-DEN': { daysOfSupply: 12, onHand: 28300, inTransit: 8600, backorder: 1200 },
      'DC-TOR': { daysOfSupply: 15, onHand: 34100, inTransit: 9800, backorder: 0 },
    },
  },

  shipmentData: {
    shipments: [
      { id: 'SHP-4001', laneKey: 'PLT-DOGSTAR→DC-ATL', fromCode: 'PLT-DOGSTAR', toCode: 'DC-ATL', sku: 'Orijen Original Dry Dog 25lb', qty: 1800, uom: 'cases', weight: 45000, priority: 'high' },
      { id: 'SHP-4002', laneKey: 'PLT-DOGSTAR→DC-ATL', fromCode: 'PLT-DOGSTAR', toCode: 'DC-ATL', sku: 'Acana Red Meat Dry Dog 25lb', qty: 1200, uom: 'cases', weight: 30000, priority: 'medium' },
      { id: 'SHP-4003', laneKey: 'PLT-DOGSTAR→DC-ATL', fromCode: 'PLT-DOGSTAR', toCode: 'DC-ATL', sku: 'Orijen Six Fish Dry Dog 25lb', qty: 600, uom: 'cases', weight: 15000, priority: 'normal' },
      { id: 'SHP-4004', laneKey: 'PLT-DOGSTAR→DC-DEN', fromCode: 'PLT-DOGSTAR', toCode: 'DC-DEN', sku: 'Orijen Original Dry Dog 25lb', qty: 1400, uom: 'cases', weight: 35000, priority: 'high' },
      { id: 'SHP-4005', laneKey: 'PLT-DOGSTAR→DC-DEN', fromCode: 'PLT-DOGSTAR', toCode: 'DC-DEN', sku: 'Acana Wet Dog Lamb 12.8oz', qty: 960, uom: 'cases', weight: 9600, priority: 'medium' },
      { id: 'SHP-4006', laneKey: 'PLT-NORTHSTAR→DC-TOR', fromCode: 'PLT-NORTHSTAR', toCode: 'DC-TOR', sku: 'Orijen Dry Cat Tundra 12lb', qty: 2200, uom: 'cases', weight: 26400, priority: 'high' },
      { id: 'SHP-4007', laneKey: 'PLT-NORTHSTAR→DC-TOR', fromCode: 'PLT-NORTHSTAR', toCode: 'DC-TOR', sku: 'Acana Dry Dog Heritage 25lb', qty: 800, uom: 'cases', weight: 20000, priority: 'normal' },
      { id: 'SHP-4008', laneKey: 'PLT-NORTHSTAR→DC-DEN', fromCode: 'PLT-NORTHSTAR', toCode: 'DC-DEN', sku: 'Orijen Freeze-Dried Dog 16oz', qty: 540, uom: 'cases', weight: 5400, priority: 'medium' },
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
    try {
      await fetch(`${API}/demand-split`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyId, allocations }),
      });
      fetchPlan();
    } catch (e) { /* ignore */ }
  };

  const handleUpdateCalendar = async (laneKey, updates) => {
    try {
      await fetch(`${API}/shipping-calendar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ laneKey, ...updates }),
      });
      fetchPlan();
    } catch (e) { /* ignore */ }
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
