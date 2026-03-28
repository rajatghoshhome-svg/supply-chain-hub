/**
 * Synthetic BOM & SKU Data — Multi-Plant
 *
 * 10 finished goods, ~25 subassemblies/components, ~15 raw materials.
 * 3 plants with DIFFERENT BOMs for the same product (critical for MRP).
 *
 * KEY DESIGN DECISION:
 *   MTR-200 is manufactured at both PLANT-NORTH and PLANT-SOUTH.
 *   Plant-North uses ROT-A (standard rotor) → lighter, cheaper.
 *   Plant-South uses ROT-B (heavy-duty rotor) → heavier, more reliable.
 *   This is why MRP must run AFTER DRP assigns demand to specific plants.
 *
 * Structure (per plant):
 *   Level 0: Finished Goods (10 motor variants)
 *   Level 1: Subassemblies (stators, rotors, housings, control boards)
 *   Level 2: Raw Materials & Purchased Components
 *
 * ASCM compliance: BOM is always plant-specific. The same FG code can
 * have different component structures at different manufacturing sites.
 */

// ─── SKU Master Data ──────────────────────────────────────────────
// All items across all plants (shared catalogue)

export const skuMaster = [
  // Level 0: Finished Goods (10 products)
  { code: 'MTR-100',  name: '1HP Standard Motor',         level: 0, leadTimePeriods: 1, safetyStock: 5,  onHand: 0, lotSizing: { method: 'lot-for-lot' } },
  { code: 'MTR-150',  name: '1.5HP Compact Motor',        level: 0, leadTimePeriods: 1, safetyStock: 4,  onHand: 0, lotSizing: { method: 'lot-for-lot' } },
  { code: 'MTR-200',  name: '2HP Premium Motor',          level: 0, leadTimePeriods: 1, safetyStock: 3,  onHand: 0, lotSizing: { method: 'lot-for-lot' } },
  { code: 'MTR-300',  name: '3HP Standard Motor',         level: 0, leadTimePeriods: 1, safetyStock: 3,  onHand: 0, lotSizing: { method: 'lot-for-lot' } },
  { code: 'MTR-400',  name: '3HP Heavy-Duty Motor',       level: 0, leadTimePeriods: 2, safetyStock: 2,  onHand: 0, lotSizing: { method: 'lot-for-lot' } },
  { code: 'MTR-500',  name: '5HP Industrial Motor',       level: 0, leadTimePeriods: 2, safetyStock: 2,  onHand: 0, lotSizing: { method: 'lot-for-lot' } },
  { code: 'MTR-600',  name: '5HP Explosion-Proof Motor',  level: 0, leadTimePeriods: 3, safetyStock: 1,  onHand: 0, lotSizing: { method: 'lot-for-lot' } },
  { code: 'MTR-700',  name: '7.5HP Industrial Motor',     level: 0, leadTimePeriods: 2, safetyStock: 2,  onHand: 0, lotSizing: { method: 'lot-for-lot' } },
  { code: 'MTR-800',  name: '10HP Premium Motor',         level: 0, leadTimePeriods: 2, safetyStock: 1,  onHand: 0, lotSizing: { method: 'fixed-order-qty', fixedQty: 5 } },
  { code: 'MTR-900',  name: '15HP Industrial Motor',      level: 0, leadTimePeriods: 3, safetyStock: 1,  onHand: 0, lotSizing: { method: 'lot-for-lot' } },
  { code: 'MTR-1000', name: '20HP Heavy-Duty Motor',      level: 0, leadTimePeriods: 3, safetyStock: 0,  onHand: 0, lotSizing: { method: 'lot-for-lot' } },

  // Level 1: Subassemblies
  { code: 'STAT-A',     name: 'Stator Assembly 1HP',         level: 1, leadTimePeriods: 1, safetyStock: 3,  onHand: 15, lotSizing: { method: 'lot-for-lot' } },
  { code: 'STAT-A15',   name: 'Stator Assembly 1.5HP',       level: 1, leadTimePeriods: 1, safetyStock: 2,  onHand: 10, lotSizing: { method: 'lot-for-lot' } },
  { code: 'STAT-B',     name: 'Stator Assembly 2-3HP',       level: 1, leadTimePeriods: 1, safetyStock: 3,  onHand: 12, lotSizing: { method: 'lot-for-lot' } },
  { code: 'STAT-C',     name: 'Stator Assembly 5HP',         level: 1, leadTimePeriods: 2, safetyStock: 2,  onHand: 8,  lotSizing: { method: 'lot-for-lot' } },
  { code: 'STAT-D',     name: 'Stator Assembly 7.5-10HP',    level: 1, leadTimePeriods: 2, safetyStock: 2,  onHand: 6,  lotSizing: { method: 'lot-for-lot' } },
  { code: 'STAT-E',     name: 'Stator Assembly 15-20HP',     level: 1, leadTimePeriods: 2, safetyStock: 1,  onHand: 4,  lotSizing: { method: 'lot-for-lot' } },
  { code: 'ROT-A',      name: 'Rotor Standard',              level: 1, leadTimePeriods: 1, safetyStock: 3,  onHand: 20, lotSizing: { method: 'lot-for-lot' } },
  { code: 'ROT-B',      name: 'Rotor Heavy-Duty',            level: 1, leadTimePeriods: 2, safetyStock: 2,  onHand: 10, lotSizing: { method: 'lot-for-lot' } },
  { code: 'ROT-C',      name: 'Rotor Large',                 level: 1, leadTimePeriods: 2, safetyStock: 2,  onHand: 6,  lotSizing: { method: 'lot-for-lot' } },
  { code: 'HOUS-SM',    name: 'Housing Small (1-1.5HP)',      level: 1, leadTimePeriods: 1, safetyStock: 5,  onHand: 30, lotSizing: { method: 'fixed-order-qty', fixedQty: 20 } },
  { code: 'HOUS-MD',    name: 'Housing Medium (2-5HP)',       level: 1, leadTimePeriods: 1, safetyStock: 5,  onHand: 25, lotSizing: { method: 'fixed-order-qty', fixedQty: 20 } },
  { code: 'HOUS-LG',    name: 'Housing Large (7.5-20HP)',     level: 1, leadTimePeriods: 2, safetyStock: 3,  onHand: 12, lotSizing: { method: 'fixed-order-qty', fixedQty: 10 } },
  { code: 'HOUS-EXP',   name: 'Housing Explosion-Proof',      level: 1, leadTimePeriods: 3, safetyStock: 2,  onHand: 5,  lotSizing: { method: 'lot-for-lot' } },

  // Level 2: Raw Materials & Purchased Components
  { code: 'LAM-STEEL',    name: 'Steel Laminations (kg)',     level: 2, leadTimePeriods: 3, safetyStock: 50,  onHand: 300, lotSizing: { method: 'fixed-order-qty', fixedQty: 200 } },
  { code: 'CU-WIRE',      name: 'Copper Magnet Wire (kg)',    level: 2, leadTimePeriods: 4, safetyStock: 30,  onHand: 200, lotSizing: { method: 'eoq', annualDemand: 8000, orderingCost: 75, holdingCost: 3 } },
  { code: 'CU-WIRE-HV',   name: 'HV Copper Wire (kg)',       level: 2, leadTimePeriods: 4, safetyStock: 15,  onHand: 60,  lotSizing: { method: 'fixed-order-qty', fixedQty: 50 } },
  { code: 'BEAR-6205',    name: 'Bearing 6205-2RS',           level: 2, leadTimePeriods: 2, safetyStock: 20,  onHand: 100, lotSizing: { method: 'fixed-order-qty', fixedQty: 50 } },
  { code: 'BEAR-6208',    name: 'Bearing 6208-2RS',           level: 2, leadTimePeriods: 2, safetyStock: 15,  onHand: 60,  lotSizing: { method: 'fixed-order-qty', fixedQty: 50 } },
  { code: 'BEAR-6310',    name: 'Bearing 6310-2RS (large)',   level: 2, leadTimePeriods: 3, safetyStock: 10,  onHand: 30,  lotSizing: { method: 'fixed-order-qty', fixedQty: 25 } },
  { code: 'SHAFT-25',     name: 'Shaft 25mm (bar)',           level: 2, leadTimePeriods: 2, safetyStock: 10,  onHand: 50,  lotSizing: { method: 'lot-for-lot' } },
  { code: 'SHAFT-40',     name: 'Shaft 40mm (bar)',           level: 2, leadTimePeriods: 3, safetyStock: 8,   onHand: 25,  lotSizing: { method: 'lot-for-lot' } },
  { code: 'SHAFT-50',     name: 'Shaft 50mm (bar)',           level: 2, leadTimePeriods: 3, safetyStock: 5,   onHand: 15,  lotSizing: { method: 'lot-for-lot' } },
  { code: 'CAP-BANK',     name: 'Capacitor Bank',             level: 2, leadTimePeriods: 5, safetyStock: 5,   onHand: 20,  lotSizing: { method: 'period-order-qty', periodsPerOrder: 4 } },
  { code: 'CAP-BANK-HV',  name: 'HV Capacitor Bank',         level: 2, leadTimePeriods: 6, safetyStock: 3,   onHand: 10,  lotSizing: { method: 'lot-for-lot' } },
  { code: 'CTRL-PCB',     name: 'Control PCB Standard',       level: 2, leadTimePeriods: 5, safetyStock: 5,   onHand: 20,  lotSizing: { method: 'lot-for-lot' } },
  { code: 'CTRL-PCB-ADV', name: 'Control PCB Advanced',       level: 2, leadTimePeriods: 5, safetyStock: 3,   onHand: 10,  lotSizing: { method: 'lot-for-lot' } },
  { code: 'VFD-MODULE',   name: 'VFD Drive Module',           level: 2, leadTimePeriods: 6, safetyStock: 2,   onHand: 6,   lotSizing: { method: 'lot-for-lot' } },
  { code: 'FAN-80',       name: 'Cooling Fan 80mm',           level: 2, leadTimePeriods: 2, safetyStock: 15,  onHand: 60,  lotSizing: { method: 'fixed-order-qty', fixedQty: 25 } },
  { code: 'FAN-120',      name: 'Cooling Fan 120mm',          level: 2, leadTimePeriods: 2, safetyStock: 10,  onHand: 30,  lotSizing: { method: 'fixed-order-qty', fixedQty: 25 } },
  { code: 'TERM-BLK',     name: 'Terminal Block 3-pole',      level: 2, leadTimePeriods: 1, safetyStock: 25,  onHand: 120, lotSizing: { method: 'lot-for-lot' } },
  { code: 'SEAL-LIP',     name: 'Lip Seal Set',               level: 2, leadTimePeriods: 1, safetyStock: 20,  onHand: 80,  lotSizing: { method: 'lot-for-lot' } },
  { code: 'SEAL-EXP',     name: 'Explosion-Proof Seal Kit',   level: 2, leadTimePeriods: 3, safetyStock: 5,   onHand: 15,  lotSizing: { method: 'lot-for-lot' } },
  { code: 'PAINT-EP',     name: 'Epoxy Paint (liters)',       level: 2, leadTimePeriods: 2, safetyStock: 10,  onHand: 40,  lotSizing: { method: 'fixed-order-qty', fixedQty: 20 } },
];

// ─── Plant-Specific BOMs ────────────────────────────────────────
// CRITICAL: BOM varies by plant. MTR-200 at PLANT-NORTH ≠ MTR-200 at PLANT-SOUTH.

export const plantBOMs = {
  // ═══════════════════════════════════════════════════════════════
  // PLANT-NORTH: Small/Mid motors (MTR-100, MTR-150, MTR-200, MTR-300)
  // ═══════════════════════════════════════════════════════════════
  'PLANT-NORTH': {
    'MTR-100': [
      { childCode: 'STAT-A',    qtyPer: 1,   scrapPct: 0 },
      { childCode: 'ROT-A',     qtyPer: 1,   scrapPct: 0 },
      { childCode: 'HOUS-SM',   qtyPer: 1,   scrapPct: 0 },
      { childCode: 'SHAFT-25',  qtyPer: 1,   scrapPct: 0 },
      { childCode: 'BEAR-6205', qtyPer: 2,   scrapPct: 0 },
      { childCode: 'FAN-80',    qtyPer: 1,   scrapPct: 0 },
      { childCode: 'TERM-BLK',  qtyPer: 1,   scrapPct: 0 },
      { childCode: 'SEAL-LIP',  qtyPer: 2,   scrapPct: 0 },
      { childCode: 'PAINT-EP',  qtyPer: 0.3, scrapPct: 5 },
    ],
    'MTR-150': [
      { childCode: 'STAT-A15',  qtyPer: 1,   scrapPct: 0 },
      { childCode: 'ROT-A',     qtyPer: 1,   scrapPct: 0 },
      { childCode: 'HOUS-SM',   qtyPer: 1,   scrapPct: 0 },
      { childCode: 'SHAFT-25',  qtyPer: 1,   scrapPct: 0 },
      { childCode: 'BEAR-6205', qtyPer: 2,   scrapPct: 0 },
      { childCode: 'FAN-80',    qtyPer: 1,   scrapPct: 0 },
      { childCode: 'TERM-BLK',  qtyPer: 1,   scrapPct: 0 },
      { childCode: 'SEAL-LIP',  qtyPer: 2,   scrapPct: 0 },
      { childCode: 'PAINT-EP',  qtyPer: 0.35, scrapPct: 5 },
    ],
    // MTR-200 at PLANT-NORTH: uses standard rotor (ROT-A) — LIGHTER, CHEAPER
    'MTR-200': [
      { childCode: 'STAT-B',    qtyPer: 1,   scrapPct: 0 },
      { childCode: 'ROT-A',     qtyPer: 1,   scrapPct: 0 },    // ← Standard rotor
      { childCode: 'HOUS-MD',   qtyPer: 1,   scrapPct: 0 },
      { childCode: 'SHAFT-25',  qtyPer: 1,   scrapPct: 0 },
      { childCode: 'BEAR-6205', qtyPer: 2,   scrapPct: 0 },
      { childCode: 'FAN-80',    qtyPer: 1,   scrapPct: 0 },
      { childCode: 'CTRL-PCB',  qtyPer: 1,   scrapPct: 0 },
      { childCode: 'TERM-BLK',  qtyPer: 1,   scrapPct: 0 },
      { childCode: 'SEAL-LIP',  qtyPer: 2,   scrapPct: 0 },
      { childCode: 'PAINT-EP',  qtyPer: 0.4, scrapPct: 5 },
    ],
    'MTR-300': [
      { childCode: 'STAT-B',    qtyPer: 1,   scrapPct: 0 },
      { childCode: 'ROT-B',     qtyPer: 1,   scrapPct: 0 },
      { childCode: 'HOUS-MD',   qtyPer: 1,   scrapPct: 0 },
      { childCode: 'SHAFT-40',  qtyPer: 1,   scrapPct: 0 },
      { childCode: 'BEAR-6208', qtyPer: 2,   scrapPct: 0 },
      { childCode: 'FAN-80',    qtyPer: 1,   scrapPct: 0 },
      { childCode: 'CTRL-PCB',  qtyPer: 1,   scrapPct: 0 },
      { childCode: 'TERM-BLK',  qtyPer: 1,   scrapPct: 0 },
      { childCode: 'SEAL-LIP',  qtyPer: 2,   scrapPct: 0 },
      { childCode: 'PAINT-EP',  qtyPer: 0.5, scrapPct: 5 },
    ],
    // Subassembly BOMs at Plant-North
    'STAT-A':   [{ childCode: 'LAM-STEEL', qtyPer: 2.5, scrapPct: 8 }, { childCode: 'CU-WIRE', qtyPer: 1.2, scrapPct: 3 }],
    'STAT-A15': [{ childCode: 'LAM-STEEL', qtyPer: 3.0, scrapPct: 8 }, { childCode: 'CU-WIRE', qtyPer: 1.5, scrapPct: 3 }],
    'STAT-B':   [{ childCode: 'LAM-STEEL', qtyPer: 4.0, scrapPct: 8 }, { childCode: 'CU-WIRE', qtyPer: 2.0, scrapPct: 3 }],
    'ROT-A':    [{ childCode: 'LAM-STEEL', qtyPer: 1.8, scrapPct: 8 }, { childCode: 'CU-WIRE', qtyPer: 0.8, scrapPct: 3 }],
    'ROT-B':    [{ childCode: 'LAM-STEEL', qtyPer: 3.2, scrapPct: 8 }, { childCode: 'CU-WIRE', qtyPer: 1.5, scrapPct: 3 }],
  },

  // ═══════════════════════════════════════════════════════════════
  // PLANT-SOUTH: Mid/Large motors (MTR-200, MTR-400, MTR-500, MTR-600)
  // ═══════════════════════════════════════════════════════════════
  'PLANT-SOUTH': {
    // MTR-200 at PLANT-SOUTH: uses heavy-duty rotor (ROT-B) — HEAVIER, MORE RELIABLE
    'MTR-200': [
      { childCode: 'STAT-B',    qtyPer: 1,   scrapPct: 0 },
      { childCode: 'ROT-B',     qtyPer: 1,   scrapPct: 0 },    // ← Heavy-duty rotor (DIFFERENT!)
      { childCode: 'HOUS-MD',   qtyPer: 1,   scrapPct: 0 },
      { childCode: 'SHAFT-40',  qtyPer: 1,   scrapPct: 0 },    // ← 40mm shaft (DIFFERENT!)
      { childCode: 'BEAR-6208', qtyPer: 2,   scrapPct: 0 },    // ← Larger bearings (DIFFERENT!)
      { childCode: 'FAN-80',    qtyPer: 1,   scrapPct: 0 },
      { childCode: 'CTRL-PCB',  qtyPer: 1,   scrapPct: 0 },
      { childCode: 'TERM-BLK',  qtyPer: 1,   scrapPct: 0 },
      { childCode: 'SEAL-LIP',  qtyPer: 2,   scrapPct: 0 },
      { childCode: 'PAINT-EP',  qtyPer: 0.45, scrapPct: 5 },
    ],
    'MTR-400': [
      { childCode: 'STAT-B',    qtyPer: 1,   scrapPct: 0 },
      { childCode: 'ROT-B',     qtyPer: 1,   scrapPct: 0 },
      { childCode: 'HOUS-MD',   qtyPer: 1,   scrapPct: 2 },
      { childCode: 'SHAFT-40',  qtyPer: 1,   scrapPct: 0 },
      { childCode: 'BEAR-6208', qtyPer: 2,   scrapPct: 0 },
      { childCode: 'FAN-80',    qtyPer: 2,   scrapPct: 0 },
      { childCode: 'CTRL-PCB',  qtyPer: 1,   scrapPct: 0 },
      { childCode: 'CAP-BANK',  qtyPer: 1,   scrapPct: 0 },
      { childCode: 'TERM-BLK',  qtyPer: 1,   scrapPct: 0 },
      { childCode: 'SEAL-LIP',  qtyPer: 3,   scrapPct: 0 },
      { childCode: 'PAINT-EP',  qtyPer: 0.5, scrapPct: 5 },
    ],
    'MTR-500': [
      { childCode: 'STAT-C',    qtyPer: 1,   scrapPct: 0 },
      { childCode: 'ROT-B',     qtyPer: 1,   scrapPct: 0 },
      { childCode: 'HOUS-MD',   qtyPer: 1,   scrapPct: 2 },
      { childCode: 'SHAFT-40',  qtyPer: 1,   scrapPct: 0 },
      { childCode: 'BEAR-6208', qtyPer: 2,   scrapPct: 0 },
      { childCode: 'FAN-80',    qtyPer: 2,   scrapPct: 0 },
      { childCode: 'CTRL-PCB',  qtyPer: 1,   scrapPct: 0 },
      { childCode: 'CAP-BANK',  qtyPer: 1,   scrapPct: 0 },
      { childCode: 'TERM-BLK',  qtyPer: 1,   scrapPct: 0 },
      { childCode: 'SEAL-LIP',  qtyPer: 3,   scrapPct: 0 },
      { childCode: 'PAINT-EP',  qtyPer: 0.6, scrapPct: 5 },
    ],
    'MTR-600': [
      { childCode: 'STAT-C',    qtyPer: 1,   scrapPct: 0 },
      { childCode: 'ROT-B',     qtyPer: 1,   scrapPct: 0 },
      { childCode: 'HOUS-EXP',  qtyPer: 1,   scrapPct: 3 },   // Explosion-proof housing
      { childCode: 'SHAFT-40',  qtyPer: 1,   scrapPct: 0 },
      { childCode: 'BEAR-6208', qtyPer: 2,   scrapPct: 0 },
      { childCode: 'FAN-80',    qtyPer: 2,   scrapPct: 0 },
      { childCode: 'CTRL-PCB-ADV', qtyPer: 1, scrapPct: 0 },   // Advanced PCB
      { childCode: 'CAP-BANK',  qtyPer: 1,   scrapPct: 0 },
      { childCode: 'TERM-BLK',  qtyPer: 1,   scrapPct: 0 },
      { childCode: 'SEAL-EXP',  qtyPer: 1,   scrapPct: 0 },   // Explosion-proof seals
      { childCode: 'PAINT-EP',  qtyPer: 0.8, scrapPct: 5 },
    ],
    // Subassembly BOMs at Plant-South
    'STAT-B': [{ childCode: 'LAM-STEEL', qtyPer: 4.0, scrapPct: 8 }, { childCode: 'CU-WIRE', qtyPer: 2.0, scrapPct: 3 }],
    'STAT-C': [{ childCode: 'LAM-STEEL', qtyPer: 5.5, scrapPct: 8 }, { childCode: 'CU-WIRE', qtyPer: 3.0, scrapPct: 3 }],
    'ROT-B':  [{ childCode: 'LAM-STEEL', qtyPer: 3.2, scrapPct: 8 }, { childCode: 'CU-WIRE', qtyPer: 1.5, scrapPct: 3 }],
  },

  // ═══════════════════════════════════════════════════════════════
  // PLANT-WEST: Large/Specialty motors (MTR-700, MTR-800, MTR-900, MTR-1000)
  // ═══════════════════════════════════════════════════════════════
  'PLANT-WEST': {
    'MTR-700': [
      { childCode: 'STAT-D',      qtyPer: 1,   scrapPct: 0 },
      { childCode: 'ROT-C',       qtyPer: 1,   scrapPct: 0 },
      { childCode: 'HOUS-LG',     qtyPer: 1,   scrapPct: 2 },
      { childCode: 'SHAFT-50',    qtyPer: 1,   scrapPct: 0 },
      { childCode: 'BEAR-6310',   qtyPer: 2,   scrapPct: 0 },
      { childCode: 'FAN-120',     qtyPer: 2,   scrapPct: 0 },
      { childCode: 'CTRL-PCB-ADV', qtyPer: 1,  scrapPct: 0 },
      { childCode: 'CAP-BANK',    qtyPer: 1,   scrapPct: 0 },
      { childCode: 'TERM-BLK',    qtyPer: 1,   scrapPct: 0 },
      { childCode: 'SEAL-LIP',    qtyPer: 3,   scrapPct: 0 },
      { childCode: 'PAINT-EP',    qtyPer: 0.8, scrapPct: 5 },
    ],
    'MTR-800': [
      { childCode: 'STAT-D',      qtyPer: 1,   scrapPct: 0 },
      { childCode: 'ROT-C',       qtyPer: 1,   scrapPct: 0 },
      { childCode: 'HOUS-LG',     qtyPer: 1,   scrapPct: 2 },
      { childCode: 'SHAFT-50',    qtyPer: 1,   scrapPct: 0 },
      { childCode: 'BEAR-6310',   qtyPer: 2,   scrapPct: 0 },
      { childCode: 'FAN-120',     qtyPer: 2,   scrapPct: 0 },
      { childCode: 'CTRL-PCB-ADV', qtyPer: 1,  scrapPct: 0 },
      { childCode: 'CAP-BANK-HV', qtyPer: 1,   scrapPct: 0 },
      { childCode: 'VFD-MODULE',   qtyPer: 1,  scrapPct: 0 },
      { childCode: 'TERM-BLK',    qtyPer: 1,   scrapPct: 0 },
      { childCode: 'SEAL-LIP',    qtyPer: 4,   scrapPct: 0 },
      { childCode: 'PAINT-EP',    qtyPer: 1.0, scrapPct: 5 },
    ],
    'MTR-900': [
      { childCode: 'STAT-E',      qtyPer: 1,   scrapPct: 0 },
      { childCode: 'ROT-C',       qtyPer: 1,   scrapPct: 0 },
      { childCode: 'HOUS-LG',     qtyPer: 1,   scrapPct: 3 },
      { childCode: 'SHAFT-50',    qtyPer: 1,   scrapPct: 0 },
      { childCode: 'BEAR-6310',   qtyPer: 2,   scrapPct: 0 },
      { childCode: 'FAN-120',     qtyPer: 2,   scrapPct: 0 },
      { childCode: 'CTRL-PCB-ADV', qtyPer: 1,  scrapPct: 0 },
      { childCode: 'CAP-BANK-HV', qtyPer: 1,   scrapPct: 0 },
      { childCode: 'VFD-MODULE',   qtyPer: 1,  scrapPct: 0 },
      { childCode: 'TERM-BLK',    qtyPer: 2,   scrapPct: 0 },
      { childCode: 'SEAL-LIP',    qtyPer: 4,   scrapPct: 0 },
      { childCode: 'PAINT-EP',    qtyPer: 1.2, scrapPct: 5 },
    ],
    'MTR-1000': [
      { childCode: 'STAT-E',      qtyPer: 1,   scrapPct: 0 },
      { childCode: 'ROT-C',       qtyPer: 1,   scrapPct: 0 },
      { childCode: 'HOUS-LG',     qtyPer: 1,   scrapPct: 3 },
      { childCode: 'SHAFT-50',    qtyPer: 1,   scrapPct: 0 },
      { childCode: 'BEAR-6310',   qtyPer: 4,   scrapPct: 0 },   // Extra bearings
      { childCode: 'FAN-120',     qtyPer: 3,   scrapPct: 0 },   // Triple fans
      { childCode: 'CTRL-PCB-ADV', qtyPer: 1,  scrapPct: 0 },
      { childCode: 'CAP-BANK-HV', qtyPer: 2,   scrapPct: 0 },  // Dual cap banks
      { childCode: 'VFD-MODULE',   qtyPer: 1,  scrapPct: 0 },
      { childCode: 'TERM-BLK',    qtyPer: 2,   scrapPct: 0 },
      { childCode: 'SEAL-LIP',    qtyPer: 6,   scrapPct: 0 },
      { childCode: 'PAINT-EP',    qtyPer: 1.5, scrapPct: 5 },
    ],
    // Subassembly BOMs at Plant-West
    'STAT-D': [{ childCode: 'LAM-STEEL', qtyPer: 7.0, scrapPct: 8 }, { childCode: 'CU-WIRE-HV', qtyPer: 4.0, scrapPct: 3 }],
    'STAT-E': [{ childCode: 'LAM-STEEL', qtyPer: 10.0, scrapPct: 8 }, { childCode: 'CU-WIRE-HV', qtyPer: 6.0, scrapPct: 3 }],
    'ROT-C':  [{ childCode: 'LAM-STEEL', qtyPer: 5.0, scrapPct: 8 }, { childCode: 'CU-WIRE-HV', qtyPer: 2.5, scrapPct: 3 }],
  },
};

// ─── Legacy flat BOM (for backward compatibility with existing MRP tests) ───

export const bomTree = {
  ...plantBOMs['PLANT-NORTH'],
  // Add South-specific items that don't exist in North
  'STAT-C':   plantBOMs['PLANT-SOUTH']['STAT-C'],
  'MTR-400':  plantBOMs['PLANT-SOUTH']['MTR-400'],
  'MTR-500':  plantBOMs['PLANT-SOUTH']['MTR-500'],
  'MTR-600':  plantBOMs['PLANT-SOUTH']['MTR-600'],
  // Add West-specific items
  'STAT-D':   plantBOMs['PLANT-WEST']['STAT-D'],
  'STAT-E':   plantBOMs['PLANT-WEST']['STAT-E'],
  'ROT-C':    plantBOMs['PLANT-WEST']['ROT-C'],
  'MTR-700':  plantBOMs['PLANT-WEST']['MTR-700'],
  'MTR-800':  plantBOMs['PLANT-WEST']['MTR-800'],
  'MTR-900':  plantBOMs['PLANT-WEST']['MTR-900'],
  'MTR-1000': plantBOMs['PLANT-WEST']['MTR-1000'],
};

// ─── Demand Forecast (8-week horizon) ─────────────────────────────

export function generateDemandForecast() {
  const base = new Date('2026-04-07');
  const periods = [];
  for (let i = 0; i < 8; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i * 7);
    periods.push(d.toISOString().slice(0, 10));
  }

  return {
    periods,
    finishedGoods: {
      'MTR-100':  [22, 27, 25, 30, 33, 27, 25, 22],
      'MTR-150':  [12, 13, 13, 16, 13, 12, 14, 12],
      'MTR-200':  [14, 16, 18, 16, 14, 16, 18, 15],
      'MTR-300':  [8, 9, 9, 10, 9, 8, 9, 8],
      'MTR-400':  [7, 8, 7, 9, 8, 7, 7, 7],
      'MTR-500':  [5, 6, 5, 7, 6, 5, 6, 5],
      'MTR-600':  [2, 3, 2, 3, 3, 2, 3, 2],
      'MTR-700':  [4, 5, 4, 7, 5, 4, 4, 4],
      'MTR-800':  [3, 3, 2, 4, 3, 2, 3, 2],
      'MTR-900':  [1, 3, 1, 3, 2, 2, 2, 2],
      'MTR-1000': [0, 1, 1, 2, 1, 1, 0, 3],
    },
    scheduledReceipts: {},  // Will be populated per-plant context
  };
}

// ─── Helpers ──────────────────────────────────────────────────────

export function getSkuByCode(code) {
  return skuMaster.find(s => s.code === code);
}

export function getSkusByLevel(level) {
  return skuMaster.filter(s => s.level === level);
}

/**
 * Get BOM for a specific product at a specific plant
 */
export function getBOMForPlant(plantCode, skuCode) {
  return plantBOMs[plantCode]?.[skuCode] || null;
}

/**
 * Get full BOM tree for a plant (all products + subassemblies)
 */
export function getPlantBOMTree(plantCode) {
  return plantBOMs[plantCode] || {};
}
