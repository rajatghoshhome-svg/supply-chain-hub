/**
 * Synthetic Distribution Network for Supply Chain Planning
 *
 * Expanded network for a mid-size electric motor manufacturer ($150M revenue):
 *
 *   Suppliers (3)
 *     ├── SUP-STEEL  (steel laminations, shafts)
 *     ├── SUP-COPPER (magnet wire, windings)
 *     └── SUP-ELEC   (PCBs, capacitors, electronics)
 *          │
 *   Plants (3) — each with different product mix & BOMs
 *     ├── PLANT-NORTH (Chicago, IL)    — small/mid motors: MTR-100, MTR-150, MTR-200, MTR-300
 *     ├── PLANT-SOUTH (Houston, TX)    — mid/large motors: MTR-200, MTR-400, MTR-500, MTR-600
 *     └── PLANT-WEST  (Phoenix, AZ)    — large/specialty:  MTR-700, MTR-800, MTR-900, MTR-1000
 *          │
 *   Warehouses / DCs (3)
 *     ├── DC-EAST    (Charlotte, NC)   — serves eastern US
 *     ├── DC-CENTRAL (Dallas, TX)      — serves central US
 *     └── DC-WEST    (Denver, CO)      — serves western US
 *
 * KEY DESIGN DECISIONS:
 *   - MTR-200 is made at BOTH Plant-North and Plant-South with DIFFERENT BOMs
 *     (Plant-North uses ROT-A standard rotor; Plant-South uses ROT-B heavy-duty)
 *     This demonstrates why MRP must run AFTER DRP assigns demand to specific plants.
 *
 *   - Each DC is sourced by multiple plants depending on product
 *     (e.g., DC-East gets MTR-100 from Plant-North, MTR-500 from Plant-South)
 *
 *   - Supplier lead times are realistic: 3-6 weeks for raw materials
 *
 * ASCM CASCADE:
 *   Demand Plan → DRP → S&OP/Prod Plan → MPS (RCCP) → [MRP + Scheduling]
 *                                                         └→ feedback loop
 */

// ─── 10 Finished Good Products ──────────────────────────────────

export const products = [
  { code: 'MTR-100',  name: '1HP Standard Motor',         family: 'small',     unitCost: 85,   weight: 12 },
  { code: 'MTR-150',  name: '1.5HP Compact Motor',        family: 'small',     unitCost: 110,  weight: 14 },
  { code: 'MTR-200',  name: '2HP Premium Motor',          family: 'mid',       unitCost: 165,  weight: 18 },
  { code: 'MTR-300',  name: '3HP Standard Motor',         family: 'mid',       unitCost: 195,  weight: 22 },
  { code: 'MTR-400',  name: '3HP Heavy-Duty Motor',       family: 'mid',       unitCost: 230,  weight: 26 },
  { code: 'MTR-500',  name: '5HP Industrial Motor',       family: 'large',     unitCost: 340,  weight: 35 },
  { code: 'MTR-600',  name: '5HP Explosion-Proof Motor',  family: 'large',     unitCost: 520,  weight: 42 },
  { code: 'MTR-700',  name: '7.5HP Industrial Motor',     family: 'large',     unitCost: 480,  weight: 50 },
  { code: 'MTR-800',  name: '10HP Premium Motor',         family: 'specialty', unitCost: 680,  weight: 65 },
  { code: 'MTR-900',  name: '15HP Industrial Motor',      family: 'specialty', unitCost: 920,  weight: 85 },
  { code: 'MTR-1000', name: '20HP Heavy-Duty Motor',      family: 'specialty', unitCost: 1250, weight: 110 },
];

export const productFamilies = [
  { code: 'small',     name: 'Small Motors (1-1.5HP)',     products: ['MTR-100', 'MTR-150'] },
  { code: 'mid',       name: 'Mid-Range Motors (2-3HP)',   products: ['MTR-200', 'MTR-300', 'MTR-400'] },
  { code: 'large',     name: 'Large Motors (5-7.5HP)',     products: ['MTR-500', 'MTR-600', 'MTR-700'] },
  { code: 'specialty', name: 'Specialty Motors (10-20HP)', products: ['MTR-800', 'MTR-900', 'MTR-1000'] },
];

// ─── Locations ──────────────────────────────────────────────────

export const networkLocations = [
  // Plants
  { code: 'PLANT-NORTH', name: 'North Plant',               type: 'plant', city: 'Chicago',   state: 'IL', lat: 41.8781, lng: -87.6298, weeklyCapacity: 250 },
  { code: 'PLANT-SOUTH', name: 'South Plant',               type: 'plant', city: 'Houston',   state: 'TX', lat: 29.7604, lng: -95.3698, weeklyCapacity: 200 },
  { code: 'PLANT-WEST',  name: 'West Plant',                type: 'plant', city: 'Phoenix',   state: 'AZ', lat: 33.4484, lng: -112.074, weeklyCapacity: 120 },
  // Distribution Centers
  { code: 'DC-EAST',     name: 'Eastern Distribution Center', type: 'dc', city: 'Charlotte', state: 'NC', lat: 35.2271, lng: -80.8431 },
  { code: 'DC-CENTRAL',  name: 'Central Distribution Center', type: 'dc', city: 'Dallas',    state: 'TX', lat: 32.7767, lng: -96.7970 },
  { code: 'DC-WEST',     name: 'Western Distribution Center', type: 'dc', city: 'Denver',    state: 'CO', lat: 39.7392, lng: -104.990 },
  // Suppliers
  { code: 'SUP-STEEL',   name: 'Midwest Steel Supply',      type: 'supplier', city: 'Gary',     state: 'IN', lat: 41.5934, lng: -87.3464 },
  { code: 'SUP-COPPER',  name: 'Southwest Copper & Wire',   type: 'supplier', city: 'Tucson',   state: 'AZ', lat: 32.2226, lng: -110.974 },
  { code: 'SUP-ELEC',    name: 'Pacific Electronics',       type: 'supplier', city: 'San Jose', state: 'CA', lat: 37.3382, lng: -121.886 },
];

// ─── Network Lanes (who ships to whom) ──────────────────────────

export const networkLanes = [
  // Supplier → Plant lanes
  { source: 'SUP-STEEL',  dest: 'PLANT-NORTH', leadTimePeriods: 1, transitCostPerUnit: 1.50, laneType: 'inbound' },
  { source: 'SUP-STEEL',  dest: 'PLANT-SOUTH', leadTimePeriods: 2, transitCostPerUnit: 2.00, laneType: 'inbound' },
  { source: 'SUP-STEEL',  dest: 'PLANT-WEST',  leadTimePeriods: 2, transitCostPerUnit: 2.50, laneType: 'inbound' },
  { source: 'SUP-COPPER', dest: 'PLANT-NORTH', leadTimePeriods: 2, transitCostPerUnit: 3.00, laneType: 'inbound' },
  { source: 'SUP-COPPER', dest: 'PLANT-SOUTH', leadTimePeriods: 1, transitCostPerUnit: 2.00, laneType: 'inbound' },
  { source: 'SUP-COPPER', dest: 'PLANT-WEST',  leadTimePeriods: 1, transitCostPerUnit: 1.50, laneType: 'inbound' },
  { source: 'SUP-ELEC',   dest: 'PLANT-NORTH', leadTimePeriods: 3, transitCostPerUnit: 4.00, laneType: 'inbound' },
  { source: 'SUP-ELEC',   dest: 'PLANT-SOUTH', leadTimePeriods: 3, transitCostPerUnit: 3.50, laneType: 'inbound' },
  { source: 'SUP-ELEC',   dest: 'PLANT-WEST',  leadTimePeriods: 2, transitCostPerUnit: 2.50, laneType: 'inbound' },

  // Plant → DC lanes (which plants serve which DCs)
  { source: 'PLANT-NORTH', dest: 'DC-EAST',    leadTimePeriods: 1, transitCostPerUnit: 2.50, laneType: 'outbound' },
  { source: 'PLANT-NORTH', dest: 'DC-CENTRAL', leadTimePeriods: 1, transitCostPerUnit: 2.00, laneType: 'outbound' },
  { source: 'PLANT-NORTH', dest: 'DC-WEST',    leadTimePeriods: 2, transitCostPerUnit: 3.50, laneType: 'outbound' },
  { source: 'PLANT-SOUTH', dest: 'DC-EAST',    leadTimePeriods: 2, transitCostPerUnit: 3.00, laneType: 'outbound' },
  { source: 'PLANT-SOUTH', dest: 'DC-CENTRAL', leadTimePeriods: 1, transitCostPerUnit: 1.50, laneType: 'outbound' },
  { source: 'PLANT-SOUTH', dest: 'DC-WEST',    leadTimePeriods: 2, transitCostPerUnit: 3.00, laneType: 'outbound' },
  { source: 'PLANT-WEST',  dest: 'DC-WEST',    leadTimePeriods: 1, transitCostPerUnit: 2.00, laneType: 'outbound' },
  { source: 'PLANT-WEST',  dest: 'DC-CENTRAL', leadTimePeriods: 2, transitCostPerUnit: 3.50, laneType: 'outbound' },
  { source: 'PLANT-WEST',  dest: 'DC-EAST',    leadTimePeriods: 3, transitCostPerUnit: 5.00, laneType: 'outbound' },
];

// ─── Product Sourcing Rules ─────────────────────────────────────
// Which plant makes which product. MTR-200 is dual-sourced (key test case).

export const productSourcing = {
  'MTR-100':  [{ plantCode: 'PLANT-NORTH', priority: 1 }],
  'MTR-150':  [{ plantCode: 'PLANT-NORTH', priority: 1 }],
  'MTR-200':  [{ plantCode: 'PLANT-NORTH', priority: 1 }, { plantCode: 'PLANT-SOUTH', priority: 2 }],  // DUAL SOURCE
  'MTR-300':  [{ plantCode: 'PLANT-NORTH', priority: 1 }],
  'MTR-400':  [{ plantCode: 'PLANT-SOUTH', priority: 1 }],
  'MTR-500':  [{ plantCode: 'PLANT-SOUTH', priority: 1 }],
  'MTR-600':  [{ plantCode: 'PLANT-SOUTH', priority: 1 }],
  'MTR-700':  [{ plantCode: 'PLANT-WEST',  priority: 1 }],
  'MTR-800':  [{ plantCode: 'PLANT-WEST',  priority: 1 }],
  'MTR-900':  [{ plantCode: 'PLANT-WEST',  priority: 1 }],
  'MTR-1000': [{ plantCode: 'PLANT-WEST',  priority: 1 }],
};

// ─── Plant Work Centers ─────────────────────────────────────────

export const plantWorkCenters = {
  'PLANT-NORTH': [
    { code: 'WC-N-WINDING',  name: 'Winding Line',        capacityHoursPerWeek: 80, hoursPerUnit: { small: 0.5, mid: 0.8 } },
    { code: 'WC-N-ASSEMBLY', name: 'Assembly Line',        capacityHoursPerWeek: 80, hoursPerUnit: { small: 0.6, mid: 1.0 } },
    { code: 'WC-N-TESTING',  name: 'Test & QC',           capacityHoursPerWeek: 40, hoursPerUnit: { small: 0.3, mid: 0.4 } },
    { code: 'WC-N-PAINT',    name: 'Paint & Finish',      capacityHoursPerWeek: 40, hoursPerUnit: { small: 0.2, mid: 0.3 } },
  ],
  'PLANT-SOUTH': [
    { code: 'WC-S-WINDING',  name: 'Winding Line',        capacityHoursPerWeek: 60, hoursPerUnit: { mid: 0.9, large: 1.5 } },
    { code: 'WC-S-ASSEMBLY', name: 'Assembly Line',        capacityHoursPerWeek: 80, hoursPerUnit: { mid: 1.0, large: 1.8 } },
    { code: 'WC-S-TESTING',  name: 'Test & QC',           capacityHoursPerWeek: 40, hoursPerUnit: { mid: 0.4, large: 0.6 } },
    { code: 'WC-S-HAZLOC',   name: 'Hazardous Location',  capacityHoursPerWeek: 20, hoursPerUnit: { large: 2.5 } },  // MTR-600 only
  ],
  'PLANT-WEST': [
    { code: 'WC-W-WINDING',  name: 'Winding Line',        capacityHoursPerWeek: 40, hoursPerUnit: { large: 1.8, specialty: 2.5 } },
    { code: 'WC-W-ASSEMBLY', name: 'Assembly Line',        capacityHoursPerWeek: 60, hoursPerUnit: { large: 2.0, specialty: 3.0 } },
    { code: 'WC-W-TESTING',  name: 'Test & QC',           capacityHoursPerWeek: 40, hoursPerUnit: { large: 0.8, specialty: 1.2 } },
    { code: 'WC-W-BALANCE',  name: 'Dynamic Balancing',   capacityHoursPerWeek: 20, hoursPerUnit: { specialty: 1.5 } },
  ],
};

// ─── DC Inventory Positions ─────────────────────────────────────

export const dcInventory = {
  'DC-EAST': {
    'MTR-100':  { onHand: 20, safetyStock: 8,  scheduledReceipts: [0, 0, 0, 0, 0, 0, 0, 0] },
    'MTR-150':  { onHand: 10, safetyStock: 4,  scheduledReceipts: [0, 0, 0, 0, 0, 0, 0, 0] },
    'MTR-200':  { onHand: 12, safetyStock: 5,  scheduledReceipts: [0, 0, 0, 0, 0, 0, 0, 0] },
    'MTR-300':  { onHand: 8,  safetyStock: 3,  scheduledReceipts: [0, 0, 0, 0, 0, 0, 0, 0] },
    'MTR-400':  { onHand: 5,  safetyStock: 2,  scheduledReceipts: [0, 0, 0, 0, 0, 0, 0, 0] },
    'MTR-500':  { onHand: 4,  safetyStock: 2,  scheduledReceipts: [0, 0, 0, 0, 0, 0, 0, 0] },
    'MTR-600':  { onHand: 2,  safetyStock: 1,  scheduledReceipts: [0, 0, 0, 0, 0, 0, 0, 0] },
    'MTR-700':  { onHand: 3,  safetyStock: 1,  scheduledReceipts: [0, 0, 0, 0, 0, 0, 0, 0] },
    'MTR-800':  { onHand: 2,  safetyStock: 1,  scheduledReceipts: [0, 0, 0, 0, 0, 0, 0, 0] },
    'MTR-900':  { onHand: 1,  safetyStock: 1,  scheduledReceipts: [0, 0, 0, 0, 0, 0, 0, 0] },
    'MTR-1000': { onHand: 1,  safetyStock: 0,  scheduledReceipts: [0, 0, 0, 0, 0, 0, 0, 0] },
  },
  'DC-CENTRAL': {
    'MTR-100':  { onHand: 15, safetyStock: 6,  scheduledReceipts: [0, 0, 0, 0, 0, 0, 0, 0] },
    'MTR-150':  { onHand: 8,  safetyStock: 3,  scheduledReceipts: [0, 0, 0, 0, 0, 0, 0, 0] },
    'MTR-200':  { onHand: 10, safetyStock: 4,  scheduledReceipts: [0, 0, 0, 0, 0, 0, 0, 0] },
    'MTR-300':  { onHand: 6,  safetyStock: 2,  scheduledReceipts: [0, 0, 0, 0, 0, 0, 0, 0] },
    'MTR-400':  { onHand: 6,  safetyStock: 3,  scheduledReceipts: [0, 0, 0, 0, 0, 0, 0, 0] },
    'MTR-500':  { onHand: 3,  safetyStock: 2,  scheduledReceipts: [0, 0, 0, 0, 0, 0, 0, 0] },
    'MTR-600':  { onHand: 1,  safetyStock: 1,  scheduledReceipts: [0, 0, 0, 0, 0, 0, 0, 0] },
    'MTR-700':  { onHand: 2,  safetyStock: 1,  scheduledReceipts: [0, 0, 0, 0, 0, 0, 0, 0] },
    'MTR-800':  { onHand: 1,  safetyStock: 1,  scheduledReceipts: [0, 0, 0, 0, 0, 0, 0, 0] },
    'MTR-900':  { onHand: 1,  safetyStock: 0,  scheduledReceipts: [0, 0, 0, 0, 0, 0, 0, 0] },
    'MTR-1000': { onHand: 0,  safetyStock: 0,  scheduledReceipts: [0, 0, 0, 0, 0, 0, 0, 0] },
  },
  'DC-WEST': {
    'MTR-100':  { onHand: 12, safetyStock: 5,  scheduledReceipts: [0, 0, 0, 0, 0, 0, 0, 0] },
    'MTR-150':  { onHand: 6,  safetyStock: 3,  scheduledReceipts: [0, 0, 0, 0, 0, 0, 0, 0] },
    'MTR-200':  { onHand: 8,  safetyStock: 3,  scheduledReceipts: [0, 0, 0, 0, 0, 0, 0, 0] },
    'MTR-300':  { onHand: 5,  safetyStock: 2,  scheduledReceipts: [0, 0, 0, 0, 0, 0, 0, 0] },
    'MTR-400':  { onHand: 3,  safetyStock: 2,  scheduledReceipts: [0, 0, 0, 0, 0, 0, 0, 0] },
    'MTR-500':  { onHand: 3,  safetyStock: 1,  scheduledReceipts: [0, 0, 0, 0, 0, 0, 0, 0] },
    'MTR-600':  { onHand: 1,  safetyStock: 1,  scheduledReceipts: [0, 0, 0, 0, 0, 0, 0, 0] },
    'MTR-700':  { onHand: 4,  safetyStock: 2,  scheduledReceipts: [0, 0, 0, 0, 0, 0, 0, 0] },
    'MTR-800':  { onHand: 2,  safetyStock: 1,  scheduledReceipts: [0, 0, 0, 0, 0, 0, 0, 0] },
    'MTR-900':  { onHand: 1,  safetyStock: 1,  scheduledReceipts: [0, 0, 0, 0, 0, 0, 0, 0] },
    'MTR-1000': { onHand: 1,  safetyStock: 0,  scheduledReceipts: [0, 0, 0, 0, 0, 0, 0, 0] },
  },
};

// ─── DC Demand Forecasts (weekly, 8 periods) ────────────────────
// Regional demand allocated to DCs — this is DRP input

export const dcDemandForecast = {
  'DC-EAST': {
    // 40% of total demand (largest market)
    'MTR-100':  [10, 12, 11, 13, 14, 12, 11, 10],
    'MTR-150':  [5, 6, 5, 7, 6, 5, 6, 5],
    'MTR-200':  [6, 7, 8, 7, 6, 7, 8, 7],
    'MTR-300':  [3, 4, 3, 4, 4, 3, 3, 3],
    'MTR-400':  [2, 3, 2, 3, 3, 2, 2, 2],
    'MTR-500':  [2, 2, 2, 3, 2, 2, 2, 2],
    'MTR-600':  [1, 1, 1, 1, 1, 1, 1, 1],
    'MTR-700':  [1, 2, 1, 2, 2, 1, 1, 1],
    'MTR-800':  [1, 1, 1, 1, 1, 1, 1, 1],
    'MTR-900':  [0, 1, 0, 1, 1, 0, 1, 0],
    'MTR-1000': [0, 0, 1, 0, 1, 0, 0, 1],
  },
  'DC-CENTRAL': {
    // 35% of total demand
    'MTR-100':  [7, 9, 8, 10, 11, 9, 8, 7],
    'MTR-150':  [4, 4, 5, 5, 4, 4, 5, 4],
    'MTR-200':  [5, 5, 6, 5, 5, 5, 6, 5],
    'MTR-300':  [3, 3, 3, 4, 3, 3, 3, 3],
    'MTR-400':  [3, 3, 3, 4, 3, 3, 3, 3],
    'MTR-500':  [2, 2, 2, 2, 2, 2, 2, 2],
    'MTR-600':  [1, 1, 1, 1, 1, 1, 1, 1],
    'MTR-700':  [1, 1, 1, 2, 1, 1, 1, 1],
    'MTR-800':  [1, 1, 0, 1, 1, 0, 1, 0],
    'MTR-900':  [0, 1, 0, 1, 0, 1, 0, 1],
    'MTR-1000': [0, 0, 0, 1, 0, 0, 0, 1],
  },
  'DC-WEST': {
    // 25% of total demand
    'MTR-100':  [5, 6, 6, 7, 8, 6, 6, 5],
    'MTR-150':  [3, 3, 3, 4, 3, 3, 3, 3],
    'MTR-200':  [3, 4, 4, 4, 3, 4, 4, 3],
    'MTR-300':  [2, 2, 3, 2, 2, 2, 3, 2],
    'MTR-400':  [2, 2, 2, 2, 2, 2, 2, 2],
    'MTR-500':  [1, 2, 1, 2, 2, 1, 2, 1],
    'MTR-600':  [0, 1, 0, 1, 1, 0, 1, 0],
    'MTR-700':  [2, 2, 2, 3, 2, 2, 2, 2],
    'MTR-800':  [1, 1, 1, 2, 1, 1, 1, 1],
    'MTR-900':  [1, 1, 1, 1, 1, 1, 1, 1],
    'MTR-1000': [0, 1, 0, 1, 0, 1, 0, 1],
  },
};

// ─── Plant Finished-Goods Inventory ─────────────────────────────

export const plantInventory = {
  'PLANT-NORTH': {
    'MTR-100':  { onHand: 25, safetyStock: 10 },
    'MTR-150':  { onHand: 15, safetyStock: 5 },
    'MTR-200':  { onHand: 10, safetyStock: 5 },   // North makes MTR-200 too
    'MTR-300':  { onHand: 8,  safetyStock: 3 },
  },
  'PLANT-SOUTH': {
    'MTR-200':  { onHand: 8,  safetyStock: 4 },   // South also makes MTR-200 (different BOM!)
    'MTR-400':  { onHand: 6,  safetyStock: 3 },
    'MTR-500':  { onHand: 5,  safetyStock: 2 },
    'MTR-600':  { onHand: 3,  safetyStock: 1 },
  },
  'PLANT-WEST': {
    'MTR-700':  { onHand: 5,  safetyStock: 2 },
    'MTR-800':  { onHand: 3,  safetyStock: 1 },
    'MTR-900':  { onHand: 2,  safetyStock: 1 },
    'MTR-1000': { onHand: 1,  safetyStock: 1 },
  },
};

// ─── Supplier Capabilities ──────────────────────────────────────

export const suppliers = {
  'SUP-STEEL': {
    name: 'Midwest Steel Supply',
    materials: ['LAM-STEEL', 'SHAFT-25', 'SHAFT-40', 'SHAFT-50'],
    leadTimePeriods: 3,
    moq: 100,       // minimum order qty (kg for steel)
    reliability: 0.95,
  },
  'SUP-COPPER': {
    name: 'Southwest Copper & Wire',
    materials: ['CU-WIRE', 'CU-WIRE-HV'],
    leadTimePeriods: 4,
    moq: 50,
    reliability: 0.92,
  },
  'SUP-ELEC': {
    name: 'Pacific Electronics',
    materials: ['CTRL-PCB', 'CTRL-PCB-ADV', 'CAP-BANK', 'CAP-BANK-HV', 'VFD-MODULE'],
    leadTimePeriods: 5,
    moq: 10,
    reliability: 0.88,
  },
};

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Get the primary source plant for a product
 */
export function getPrimaryPlant(skuCode) {
  const sources = productSourcing[skuCode];
  if (!sources) return null;
  return sources.sort((a, b) => a.priority - b.priority)[0].plantCode;
}

/**
 * Get all plants that can make a product
 */
export function getPlantsForProduct(skuCode) {
  return (productSourcing[skuCode] || []).map(s => s.plantCode);
}

/**
 * Get all products a plant can make
 */
export function getProductsForPlant(plantCode) {
  return Object.entries(productSourcing)
    .filter(([_, sources]) => sources.some(s => s.plantCode === plantCode))
    .map(([skuCode]) => skuCode);
}

/**
 * Get outbound lanes from a plant to DCs
 */
export function getOutboundLanes(plantCode) {
  return networkLanes.filter(l => l.source === plantCode && l.laneType === 'outbound');
}

/**
 * Get inbound lanes to a plant from suppliers
 */
export function getInboundLanes(plantCode) {
  return networkLanes.filter(l => l.dest === plantCode && l.laneType === 'inbound');
}

/**
 * Get the best source plant for a DC+product combination
 * (shortest transit time among plants that make this product)
 */
export function getBestSourceForDC(dcCode, skuCode) {
  const plants = getPlantsForProduct(skuCode);
  const lanes = plants
    .map(p => networkLanes.find(l => l.source === p && l.dest === dcCode && l.laneType === 'outbound'))
    .filter(Boolean);
  if (lanes.length === 0) return null;
  lanes.sort((a, b) => a.leadTimePeriods - b.leadTimePeriods);
  return lanes[0];
}

/**
 * Get all DCs
 */
export function getDCs() {
  return networkLocations.filter(l => l.type === 'dc');
}

/**
 * Get all plants
 */
export function getPlants() {
  return networkLocations.filter(l => l.type === 'plant');
}

/**
 * Legacy compatibility: get DCs sourced by a plant
 */
export function getDCsForPlant(plantCode) {
  return networkLanes
    .filter(l => l.source === plantCode && l.laneType === 'outbound')
    .map(l => ({ dcCode: l.dest, leadTimePeriods: l.leadTimePeriods, transitCost: l.transitCostPerUnit }));
}

/**
 * Legacy compatibility: get source for a DC (primary lane)
 */
export function getSourceForDC(dcCode) {
  const lane = networkLanes.find(l => l.dest === dcCode && l.laneType === 'outbound');
  return lane || null;
}
