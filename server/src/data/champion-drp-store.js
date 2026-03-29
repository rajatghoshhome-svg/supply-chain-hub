/**
 * Champion DRP Store — In-memory distribution planning state
 *
 * Singleton initialized on server startup. Generates:
 * - DC inventory positions (on-hand, safety stock, days of supply)
 * - Recommended shipments from DRP engine run
 * - Pending and committed loads
 * - Move-vs-make scenarios for inventory imbalances
 * - Demand splits by product family across DCs
 * - Shipping calendar state
 *
 * Uses seeded PRNG for deterministic demo data.
 */

import { families, skus, products } from './champion-catalog.js';
import { distributionCenters, lanes, shippingCalendars, plantProductSourcing, dcCustomerAllocation } from './champion-network.js';
import { getHistory, getStatForecast, isInitialized as isDemandInitialized } from './champion-store.js';
import { runDRPForLocation, recommendTransitType, moveVsMakeAnalysis } from '../engines/drp-engine.js';
import { suggestCombinations } from '../engines/load-builder.js';

// ── Seeded PRNG (same LCG as champion-demand.js, different seed) ──
let _seed = 5000;
function seededRandom() {
  _seed = (_seed * 1664525 + 1013904223) & 0x7fffffff;
  return _seed / 0x7fffffff;
}

// ── State ──
let _initialized = false;
let _dcInventory = {};        // { DC-ATL: { SKU-CODE: { onHand, safetyStock, inTransit, daysOfSupply } } }
let _demandSplits = {};       // { familyId: { 'DC-ATL': pct, 'DC-DEN': pct, 'DC-TOR': pct } }
let _recommendedShipments = []; // Array of shipment objects
let _pendingLoads = [];       // Array of in-progress load combinations
let _committedLoads = [];     // Array of finalized loads
let _moveVsMakeScenarios = []; // Pre-computed imbalance scenarios
let _shippingCalendars = {};  // Mutable copy of calendar data
let _nextShipmentId = 1;
let _nextLoadId = 1;
let _nextScenarioId = 1;

// ── Weight per unit by product family (lbs) ──
const WEIGHT_PER_CASE = {
  default: 25,     // 25 lb bag
  '4.5lb': 5,
  '13lb': 14,
  '25lb': 26,
  '4lb': 4.5,
  '10lb': 11,
};

function getSkuWeight(sku) {
  if (sku.name.includes('4.5lb') || sku.name.includes('4.5 lb')) return WEIGHT_PER_CASE['4.5lb'];
  if (sku.name.includes('13lb') || sku.name.includes('13 lb')) return WEIGHT_PER_CASE['13lb'];
  if (sku.name.includes('25lb') || sku.name.includes('25 lb')) return WEIGHT_PER_CASE['25lb'];
  if (sku.name.includes('4lb') || sku.name.includes('4 lb')) return WEIGHT_PER_CASE['4lb'];
  if (sku.name.includes('10lb') || sku.name.includes('10 lb')) return WEIGHT_PER_CASE['10lb'];
  return WEIGHT_PER_CASE.default;
}

const CASES_PER_PALLET = 48;

// ── Initialization ──

export function initialize() {
  if (_initialized) return;
  if (!isDemandInitialized()) {
    console.warn('[champion-drp-store] Demand store not initialized, skipping DRP init');
    return;
  }

  _seed = 5000; // Reset seed for determinism
  const t0 = Date.now();

  // 1. Initialize demand splits from dcCustomerAllocation
  _initDemandSplits();

  // 2. Generate DC inventory
  _initDCInventory();

  // 3. Initialize shipping calendars (mutable copy)
  _shippingCalendars = JSON.parse(JSON.stringify(shippingCalendars));

  // 4. Run DRP engine and generate recommended shipments
  _initRecommendedShipments();

  // 5. Generate move-vs-make scenarios
  _initMoveVsMakeScenarios();

  _initialized = true;
  const elapsed = Date.now() - t0;
  console.log(`[champion-drp-store] Ready: ${_recommendedShipments.length} shipments, ${_moveVsMakeScenarios.length} scenarios in ${elapsed}ms`);
}

export function isInitialized() { return _initialized; }

// ── Internal initialization functions ──

function _initDemandSplits() {
  _demandSplits = {};
  const dcCodes = distributionCenters.map(dc => dc.code);

  for (const fam of families) {
    const splits = {};
    // Derive from dcCustomerAllocation: average across customers
    for (const dcCode of dcCodes) {
      const custAlloc = dcCustomerAllocation[dcCode] || {};
      const avgPct = Object.values(custAlloc).reduce((s, v) => s + v, 0) / Object.keys(custAlloc).length;
      splits[dcCode] = Math.round(avgPct * 100) / 100;
    }
    // Normalize to sum to 1.0
    const total = Object.values(splits).reduce((s, v) => s + v, 0);
    if (total > 0) {
      for (const dc of dcCodes) splits[dc] = Math.round((splits[dc] / total) * 100) / 100;
    }
    _demandSplits[fam.id] = splits;
  }
}

function _initDCInventory() {
  _dcInventory = {};
  const dcCodes = distributionCenters.map(dc => dc.code);

  for (const dcCode of dcCodes) {
    _dcInventory[dcCode] = {};

    for (const sku of skus) {
      // Get average weekly demand for this SKU (across all customers)
      const forecast = getStatForecast('sku', sku.id, null);
      const avgWeeklyDemand = forecast.length > 0
        ? forecast.reduce((s, v) => s + v, 0) / forecast.length
        : 50;

      // DC gets a share of demand based on its allocation
      const dcShare = _getDCShare(dcCode, sku);
      const dcWeeklyDemand = avgWeeklyDemand * dcShare;

      // Safety stock = 2 weeks of demand
      const safetyStock = Math.round(dcWeeklyDemand * 2);

      // On-hand varies: some SKUs are low (creates DRP shipments), some are high (creates move-vs-make)
      const r = seededRandom();
      let stockMultiplier;
      if (r < 0.3) stockMultiplier = 0.5 + seededRandom() * 1.0;       // 0.5-1.5 weeks (shortage)
      else if (r < 0.6) stockMultiplier = 1.5 + seededRandom() * 1.5;  // 1.5-3 weeks (normal)
      else stockMultiplier = 3.0 + seededRandom() * 4.0;                // 3-7 weeks (excess)
      const onHand = Math.round(dcWeeklyDemand * stockMultiplier);

      // Days of supply
      const dailyDemand = dcWeeklyDemand / 7;
      const daysOfSupply = dailyDemand > 0 ? Math.round(onHand / dailyDemand) : 999;

      _dcInventory[dcCode][sku.id] = {
        onHand,
        safetyStock,
        inTransit: Math.round(dcWeeklyDemand * 0.5 * seededRandom()),
        daysOfSupply,
        avgWeeklyDemand: Math.round(dcWeeklyDemand),
      };
    }
  }
}

function _getDCShare(dcCode, sku) {
  // Find the family for this SKU
  const product = products.find(p => p.id === sku.parentId);
  if (!product) return 0.33;
  const familyId = product.parentId;
  const splits = _demandSplits[familyId];
  if (!splits) return 0.33;
  return splits[dcCode] || 0.33;
}

function _initRecommendedShipments() {
  _recommendedShipments = [];
  const FORECAST_WEEKS = 8; // Plan shipments for next 8 weeks
  const dcCodes = distributionCenters.map(dc => dc.code);
  const plantLanes = lanes.filter(l => l.mode !== 'STO');

  // Build period labels
  const periods = [];
  const baseDate = new Date('2026-04-06');
  for (let i = 0; i < FORECAST_WEEKS; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i * 7);
    periods.push(d.toISOString().split('T')[0]);
  }

  // For each SKU, run DRP across DCs
  for (const sku of skus) {
    const weight = getSkuWeight(sku);

    for (const dcCode of dcCodes) {
      // Find source plant lane for this DC
      const sourceLane = _findSourceLane(sku, dcCode);
      if (!sourceLane) continue;

      const inv = _dcInventory[dcCode]?.[sku.id];
      if (!inv) continue;

      // Build gross requirements from forecast split to this DC
      const forecast = getStatForecast('sku', sku.id, null);
      const dcShare = _getDCShare(dcCode, sku);
      const grossReqs = forecast.slice(0, FORECAST_WEEKS).map(v => Math.round(v * dcShare));

      const transitLT = Math.ceil(sourceLane.leadTimeDays / 7) || 1;

      const result = runDRPForLocation({
        skuCode: sku.id,
        locationCode: dcCode,
        periods,
        grossReqs,
        scheduledReceipts: new Array(FORECAST_WEEKS).fill(0),
        onHand: inv.onHand,
        safetyStock: inv.safetyStock,
        transitLeadTime: transitLT,
        sourceCode: sourceLane.from,
      });

      // Convert planned shipments to shipment cards
      for (const rec of result.records) {
        if (rec.plannedShipment > 0) {
          const pallets = Math.ceil(rec.plannedShipment / CASES_PER_PALLET);
          const transitRec = recommendTransitType(sourceLane, pallets);

          _recommendedShipments.push({
            id: `SHP-${String(_nextShipmentId++).padStart(4, '0')}`,
            skuCode: sku.id,
            skuName: sku.name,
            fromCode: sourceLane.from,
            toCode: dcCode,
            laneKey: `${sourceLane.from}|${dcCode}`,
            qty: rec.plannedShipment,
            weightLbs: Math.round(rec.plannedShipment * weight),
            pallets,
            period: rec.period,
            transitType: transitRec.recommended,
            status: 'recommended', // recommended | combined | committed
          });
        }
      }
    }
  }
}

function _findSourceLane(sku, dcCode) {
  // Determine which plant makes this SKU based on brand + family
  // DogStar makes: all ORIJEN dry/cat/FD/treats + ACANA dry/cat
  // NorthStar makes: ACANA wet dog + overflow
  const isAcanaWet = sku.id.startsWith('ACA-WET') || sku.id.startsWith('ACA-BC') ||
    sku.id.startsWith('ACA-PC') || sku.id.startsWith('ACA-DC') ||
    sku.id.startsWith('ACA-LC') || sku.id.startsWith('ACA-BFC');

  // Check if this is a wet product by looking at family
  const product = products.find(p => p.id === sku.parentId);
  let isWet = isAcanaWet;
  if (product) {
    // Walk up: product -> line -> family
    const fam = families.find(f => {
      // Find family by checking if product's line belongs to it
      const lines = f.children || [];
      return lines && lines.length > 0;
    });
    // Simple: check if the SKU name contains wet-related terms
    if (sku.name && (sku.name.includes('Chunks') || sku.name.includes('Pate'))) isWet = true;
  }

  const plantCode = isWet ? 'PLT-NORTHSTAR' : 'PLT-DOGSTAR';
  return lanes.find(l => l.from === plantCode && l.to === dcCode && l.mode !== 'STO');
}

function _initMoveVsMakeScenarios() {
  _moveVsMakeScenarios = [];
  const dcCodes = distributionCenters.map(dc => dc.code);

  // Find SKUs with big inventory imbalances between DCs
  for (const sku of skus) {
    const dcData = dcCodes.map(dc => ({
      dcCode: dc,
      ...(_dcInventory[dc]?.[sku.id] || { onHand: 0, safetyStock: 100, daysOfSupply: 0, avgWeeklyDemand: 50 }),
    }));

    // Find the DC with highest and lowest days of supply
    const sorted = [...dcData].sort((a, b) => b.daysOfSupply - a.daysOfSupply);
    const excess = sorted[0];
    const shortage = sorted[sorted.length - 1];

    // Only create a scenario if there's a meaningful imbalance
    if (excess.daysOfSupply > 28 && shortage.daysOfSupply < 14 && shortage.avgWeeklyDemand > 5) {
      const qty = Math.min(
        Math.round(shortage.avgWeeklyDemand * 2), // 2 weeks of demand
        Math.round(excess.onHand * 0.3), // Max 30% of excess stock
      );

      if (qty < 10) continue;

      const moveLane = lanes.find(l => l.from === excess.dcCode && l.to === shortage.dcCode && l.mode === 'STO');
      const plantLane = _findSourceLane(sku, shortage.dcCode);

      if (!moveLane || !plantLane) continue;

      const analysis = moveVsMakeAnalysis({
        skuName: sku.name,
        qty,
        unitWeight: getSkuWeight(sku),
        unitCost: sku.unitCost || 50,
        moveLane,
        plantLane,
      });

      _moveVsMakeScenarios.push({
        id: `MVM-${String(_nextScenarioId++).padStart(3, '0')}`,
        skuCode: sku.id,
        skuName: sku.name,
        fromDC: excess.dcCode,
        toDC: shortage.dcCode,
        fromDCName: distributionCenters.find(d => d.code === excess.dcCode)?.name || excess.dcCode,
        toDCName: distributionCenters.find(d => d.code === shortage.dcCode)?.name || shortage.dcCode,
        qty,
        fromDaysOfSupply: excess.daysOfSupply,
        toDaysOfSupply: shortage.daysOfSupply,
        severity: shortage.daysOfSupply < 7 ? 'critical' : 'warning',
        analysis,
        status: 'open', // open | executed
        executedDecision: null,
      });

      // Limit to 8 scenarios for demo
      if (_moveVsMakeScenarios.length >= 8) break;
    }
  }

  // Sort by severity then by shortage days of supply
  _moveVsMakeScenarios.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
    return a.toDaysOfSupply - b.toDaysOfSupply;
  });
}

// ── Public API ──

export function getDistributionSummary() {
  const totalShipments = _recommendedShipments.filter(s => s.status === 'recommended').length;
  const totalCommitted = _committedLoads.length;
  const totalPending = _pendingLoads.length;
  const openScenarios = _moveVsMakeScenarios.filter(s => s.status === 'open').length;

  const plantLanes = lanes.filter(l => l.mode !== 'STO');
  const totalWeight = _recommendedShipments
    .filter(s => s.status === 'recommended')
    .reduce((sum, s) => sum + s.weightLbs, 0);

  return {
    recommendedShipments: totalShipments,
    committedLoads: totalCommitted,
    pendingLoads: totalPending,
    moveVsMakeScenarios: openScenarios,
    totalWeight,
    lanes: plantLanes.length,
    dcs: distributionCenters.length,
  };
}

export function getDCInventory(dcCode = null) {
  if (dcCode) return _dcInventory[dcCode] || {};
  return _dcInventory;
}

export function getDemandSplits() {
  return _demandSplits;
}

export function updateDemandSplit(familyId, allocations) {
  if (!_demandSplits[familyId]) return { error: 'Family not found' };
  // Validate sum to ~1.0
  const total = Object.values(allocations).reduce((s, v) => s + v, 0);
  if (Math.abs(total - 1.0) > 0.02) return { error: `Allocations must sum to 100% (got ${Math.round(total * 100)}%)` };
  _demandSplits[familyId] = { ...allocations };
  return { success: true, splits: _demandSplits[familyId] };
}

export function getLanes() {
  return lanes.map(lane => {
    const laneKey = `${lane.from}|${lane.to}`;
    const calendar = _shippingCalendars[laneKey] || null;
    const shipmentCount = _recommendedShipments.filter(
      s => s.laneKey === laneKey && s.status === 'recommended'
    ).length;
    return { ...lane, laneKey, calendar, shipmentCount };
  });
}

export function getRecommendedShipments(laneKey = null) {
  let shipments = _recommendedShipments.filter(s => s.status === 'recommended');
  if (laneKey) shipments = shipments.filter(s => s.laneKey === laneKey);
  return shipments;
}

export function combineShipments(shipmentIds) {
  const shipments = shipmentIds
    .map(id => _recommendedShipments.find(s => s.id === id && s.status === 'recommended'))
    .filter(Boolean);

  if (shipments.length === 0) return { error: 'No valid shipments found' };

  // Check all same lane
  const laneKeys = new Set(shipments.map(s => s.laneKey));
  if (laneKeys.size > 1) return { error: 'All shipments must be on the same lane' };

  const laneKey = shipments[0].laneKey;
  const lane = lanes.find(l => `${l.from}|${l.to}` === laneKey);

  const totalWeight = shipments.reduce((sum, s) => sum + s.weightLbs, 0);
  const totalPallets = shipments.reduce((sum, s) => sum + s.pallets, 0);
  const maxWeight = lane?.maxWeightLbs || 40000;
  const maxPallets = lane?.maxPallets || 22;

  if (totalWeight > maxWeight) {
    return { error: `Total weight ${totalWeight.toLocaleString()} lbs exceeds ${maxWeight.toLocaleString()} lb limit` };
  }
  if (totalPallets > maxPallets) {
    return { error: `Total pallets ${totalPallets} exceeds ${maxPallets} pallet limit` };
  }

  // Mark shipments as combined
  for (const s of shipments) s.status = 'combined';

  const weightPct = Math.round((totalWeight / maxWeight) * 100);
  const palletPct = Math.round((totalPallets / maxPallets) * 100);
  const maxPct = Math.max(weightPct, palletPct);

  const load = {
    id: `LOAD-${String(_nextLoadId++).padStart(4, '0')}`,
    laneKey,
    fromCode: shipments[0].fromCode,
    toCode: shipments[0].toCode,
    transitType: shipments[0].transitType,
    shipmentIds: shipments.map(s => s.id),
    shipments: shipments.map(s => ({ id: s.id, skuName: s.skuName, qty: s.qty, weightLbs: s.weightLbs, pallets: s.pallets })),
    totalWeight,
    totalPallets,
    totalQty: shipments.reduce((sum, s) => sum + s.qty, 0),
    weightPct,
    palletPct,
    classification: maxPct >= 85 ? 'FTL' : maxPct < 25 ? 'LTL' : 'Partial',
    status: 'pending',
  };

  _pendingLoads.push(load);
  return { success: true, load };
}

export function getPendingLoads() {
  return _pendingLoads;
}

export function uncommitLoad(loadId) {
  const idx = _pendingLoads.findIndex(l => l.id === loadId);
  if (idx === -1) return { error: 'Load not found' };

  const load = _pendingLoads[idx];
  // Release shipments back to recommended
  for (const sid of load.shipmentIds) {
    const s = _recommendedShipments.find(sh => sh.id === sid);
    if (s) s.status = 'recommended';
  }
  _pendingLoads.splice(idx, 1);
  return { success: true };
}

export function commitLoad(loadId) {
  const idx = _pendingLoads.findIndex(l => l.id === loadId);
  if (idx === -1) return { error: 'Pending load not found' };

  const load = _pendingLoads[idx];
  load.status = 'committed';
  load.committedAt = new Date().toISOString();

  // Mark shipments as committed
  for (const sid of load.shipmentIds) {
    const s = _recommendedShipments.find(sh => sh.id === sid);
    if (s) s.status = 'committed';
  }

  _committedLoads.push(load);
  _pendingLoads.splice(idx, 1);
  return { success: true, load };
}

export function getCommittedLoads() {
  return _committedLoads;
}

export function getShippingCalendars() {
  return _shippingCalendars;
}

export function updateShippingCalendar(laneKey, updates) {
  if (!_shippingCalendars[laneKey]) {
    _shippingCalendars[laneKey] = { shipDays: [], frequency: '' };
  }
  Object.assign(_shippingCalendars[laneKey], updates);
  return { success: true, calendar: _shippingCalendars[laneKey] };
}

export function getMoveVsMakeScenarios() {
  return _moveVsMakeScenarios;
}

export function getMoveVsMakeDetail(scenarioId) {
  return _moveVsMakeScenarios.find(s => s.id === scenarioId) || null;
}

export function executeMoveVsMake(scenarioId, decision) {
  const scenario = _moveVsMakeScenarios.find(s => s.id === scenarioId);
  if (!scenario) return { error: 'Scenario not found' };
  if (scenario.status !== 'open') return { error: 'Scenario already executed' };

  scenario.status = 'executed';
  scenario.executedDecision = decision;
  scenario.executedAt = new Date().toISOString();

  // Update inventory based on decision
  if (decision === 'move') {
    // Decrease source DC, increase dest DC
    const fromInv = _dcInventory[scenario.fromDC]?.[scenario.skuCode];
    const toInv = _dcInventory[scenario.toDC]?.[scenario.skuCode];
    if (fromInv) fromInv.onHand = Math.max(0, fromInv.onHand - scenario.qty);
    if (toInv) toInv.inTransit += scenario.qty;
  }

  return { success: true, scenario };
}
