// ─────────────────────────────────────────────────────────────────────────────
// Peakline Foods — Bill of Materials
// 11 Finished Goods + 9 Subassemblies + 20 Raw Materials = 40 items
// ─────────────────────────────────────────────────────────────────────────────

export const skuMaster = [
  // ── Finished Goods (11) ──────────────────────────────────────────────────
  { code: 'GRN-BAR', name: 'Oat & Honey Granola Bar', type: 'FG', uom: 'case/24', unitCost: 18.00, leadTimeDays: 3, lotSizeRule: 'FOQ', lotSizeValue: 200, safetyStock: 200, weight: 12, abcClass: 'A' },
  { code: 'PRO-BAR', name: 'Peanut Butter Protein Bar', type: 'FG', uom: 'case/24', unitCost: 22.00, leadTimeDays: 3, lotSizeRule: 'FOQ', lotSizeValue: 180, safetyStock: 180, weight: 14, abcClass: 'A' },
  { code: 'TRL-MIX', name: 'Classic Trail Mix', type: 'FG', uom: 'case/12', unitCost: 28.00, leadTimeDays: 2, lotSizeRule: 'FOQ', lotSizeValue: 150, safetyStock: 150, weight: 18, abcClass: 'A' },
  { code: 'VEG-CHP', name: 'Sea Salt Veggie Chips', type: 'FG', uom: 'case/12', unitCost: 24.00, leadTimeDays: 3, lotSizeRule: 'FOQ', lotSizeValue: 120, safetyStock: 120, weight: 10, abcClass: 'B' },
  { code: 'RCE-CRK', name: 'Brown Rice Crackers', type: 'FG', uom: 'case/12', unitCost: 20.00, leadTimeDays: 3, lotSizeRule: 'FOQ', lotSizeValue: 100, safetyStock: 100, weight: 8, abcClass: 'B' },
  { code: 'SPK-WAT', name: 'Lemon Sparkling Water', type: 'FG', uom: 'case/24', unitCost: 12.00, leadTimeDays: 2, lotSizeRule: 'FOQ', lotSizeValue: 500, safetyStock: 300, weight: 30, abcClass: 'A' },
  { code: 'JCE-APL', name: 'Cold-Pressed Apple Juice', type: 'FG', uom: 'case/12', unitCost: 32.00, leadTimeDays: 3, lotSizeRule: 'FOQ', lotSizeValue: 100, safetyStock: 100, weight: 24, abcClass: 'B' },
  { code: 'KMB-GNG', name: 'Ginger Kombucha', type: 'FG', uom: 'case/12', unitCost: 36.00, leadTimeDays: 4, lotSizeRule: 'FOQ', lotSizeValue: 80, safetyStock: 80, weight: 24, abcClass: 'B' },
  { code: 'NRG-CIT', name: 'Citrus Energy Drink', type: 'FG', uom: 'case/24', unitCost: 26.00, leadTimeDays: 2, lotSizeRule: 'FOQ', lotSizeValue: 300, safetyStock: 200, weight: 30, abcClass: 'A' },
  { code: 'CLD-BRW', name: 'Vanilla Cold Brew Coffee', type: 'FG', uom: 'case/12', unitCost: 38.00, leadTimeDays: 3, lotSizeRule: 'FOQ', lotSizeValue: 60, safetyStock: 60, weight: 20, abcClass: 'C' },
  { code: 'NUT-BTR', name: 'Almond Nut Butter', type: 'FG', uom: 'case/12', unitCost: 34.00, leadTimeDays: 3, lotSizeRule: 'FOQ', lotSizeValue: 120, safetyStock: 120, weight: 16, abcClass: 'B' },

  // ── Subassemblies (9) ────────────────────────────────────────────────────
  { code: 'MIX-OAT', name: 'Oat Dry Mix', type: 'SUB', uom: 'batch', unitCost: 6.50, leadTimeDays: 7, lotSizeRule: 'FOQ', lotSizeValue: 50, safetyStock: 20, weight: 0, abcClass: 'B' },
  { code: 'MIX-PRO', name: 'Protein Blend', type: 'SUB', uom: 'batch', unitCost: 9.20, leadTimeDays: 7, lotSizeRule: 'FOQ', lotSizeValue: 40, safetyStock: 15, weight: 0, abcClass: 'B' },
  { code: 'MIX-TRL', name: 'Trail Mix Blend', type: 'SUB', uom: 'batch', unitCost: 11.00, leadTimeDays: 7, lotSizeRule: 'FOQ', lotSizeValue: 40, safetyStock: 15, weight: 0, abcClass: 'B' },
  { code: 'MIX-VEG', name: 'Veggie Chip Dough', type: 'SUB', uom: 'batch', unitCost: 7.80, leadTimeDays: 7, lotSizeRule: 'FOQ', lotSizeValue: 30, safetyStock: 10, weight: 0, abcClass: 'C' },
  { code: 'MIX-RCE', name: 'Rice Cracker Dough', type: 'SUB', uom: 'batch', unitCost: 5.40, leadTimeDays: 7, lotSizeRule: 'FOQ', lotSizeValue: 30, safetyStock: 10, weight: 0, abcClass: 'C' },
  { code: 'SYR-FLV', name: 'Flavor Syrup Base', type: 'SUB', uom: 'batch', unitCost: 4.20, leadTimeDays: 7, lotSizeRule: 'FOQ', lotSizeValue: 60, safetyStock: 20, weight: 0, abcClass: 'B' },
  { code: 'JCE-BAS', name: 'Juice Concentrate', type: 'SUB', uom: 'batch', unitCost: 14.50, leadTimeDays: 14, lotSizeRule: 'FOQ', lotSizeValue: 25, safetyStock: 10, weight: 0, abcClass: 'B' },
  { code: 'KMB-CLT', name: 'Kombucha Culture Starter', type: 'SUB', uom: 'batch', unitCost: 8.80, leadTimeDays: 14, lotSizeRule: 'FOQ', lotSizeValue: 20, safetyStock: 8, weight: 0, abcClass: 'C' },
  { code: 'NUT-RST', name: 'Roasted Almond Paste', type: 'SUB', uom: 'batch', unitCost: 16.00, leadTimeDays: 7, lotSizeRule: 'FOQ', lotSizeValue: 30, safetyStock: 12, weight: 0, abcClass: 'B' },

  // ── Raw Materials (20) ───────────────────────────────────────────────────
  { code: 'OAT-RLD', name: 'Rolled Oats', type: 'RAW', uom: 'lb', unitCost: 0.85, leadTimeDays: 14, lotSizeRule: 'FOQ', lotSizeValue: 5000, safetyStock: 2000, weight: 1, abcClass: 'A' },
  { code: 'PNT-BTR', name: 'Peanut Butter (bulk)', type: 'RAW', uom: 'lb', unitCost: 2.10, leadTimeDays: 14, lotSizeRule: 'FOQ', lotSizeValue: 2000, safetyStock: 800, weight: 1, abcClass: 'A' },
  { code: 'ALM-RAW', name: 'Raw Almonds', type: 'RAW', uom: 'lb', unitCost: 4.50, leadTimeDays: 21, lotSizeRule: 'FOQ', lotSizeValue: 3000, safetyStock: 1200, weight: 1, abcClass: 'A' },
  { code: 'COCO-PWD', name: 'Cocoa Powder', type: 'RAW', uom: 'lb', unitCost: 3.20, leadTimeDays: 14, lotSizeRule: 'FOQ', lotSizeValue: 1000, safetyStock: 400, weight: 1, abcClass: 'B' },
  { code: 'WHY-PRO', name: 'Whey Protein Isolate', type: 'RAW', uom: 'lb', unitCost: 8.50, leadTimeDays: 14, lotSizeRule: 'FOQ', lotSizeValue: 2000, safetyStock: 800, weight: 1, abcClass: 'A' },
  { code: 'RCE-FLR', name: 'Brown Rice Flour', type: 'RAW', uom: 'lb', unitCost: 1.20, leadTimeDays: 14, lotSizeRule: 'FOQ', lotSizeValue: 3000, safetyStock: 1200, weight: 1, abcClass: 'B' },
  { code: 'VEG-PWD', name: 'Vegetable Powder Mix', type: 'RAW', uom: 'lb', unitCost: 5.60, leadTimeDays: 21, lotSizeRule: 'FOQ', lotSizeValue: 1500, safetyStock: 600, weight: 1, abcClass: 'B' },
  { code: 'SGR-ORG', name: 'Organic Cane Sugar', type: 'RAW', uom: 'lb', unitCost: 0.65, leadTimeDays: 7, lotSizeRule: 'L4L', lotSizeValue: 0, safetyStock: 1000, weight: 1, abcClass: 'B' },
  { code: 'HNY-RAW', name: 'Raw Honey', type: 'RAW', uom: 'lb', unitCost: 3.80, leadTimeDays: 14, lotSizeRule: 'FOQ', lotSizeValue: 1000, safetyStock: 400, weight: 1, abcClass: 'B' },
  { code: 'APL-CNC', name: 'Apple Juice Concentrate', type: 'RAW', uom: 'gal', unitCost: 12.00, leadTimeDays: 21, lotSizeRule: 'FOQ', lotSizeValue: 500, safetyStock: 200, weight: 8.3, abcClass: 'A' },
  { code: 'GNG-EXT', name: 'Ginger Extract', type: 'RAW', uom: 'gal', unitCost: 18.00, leadTimeDays: 21, lotSizeRule: 'FOQ', lotSizeValue: 200, safetyStock: 80, weight: 8.5, abcClass: 'B' },
  { code: 'CFE-BNS', name: 'Cold Brew Coffee Beans', type: 'RAW', uom: 'lb', unitCost: 9.50, leadTimeDays: 14, lotSizeRule: 'FOQ', lotSizeValue: 2000, safetyStock: 800, weight: 1, abcClass: 'B' },
  { code: 'CO2-TNK', name: 'CO2 (carbonation)', type: 'RAW', uom: 'tank', unitCost: 45.00, leadTimeDays: 7, lotSizeRule: 'L4L', lotSizeValue: 0, safetyStock: 5, weight: 50, abcClass: 'C' },
  { code: 'CAN-ALU', name: 'Aluminum Cans (24pk)', type: 'RAW', uom: 'case', unitCost: 3.80, leadTimeDays: 7, lotSizeRule: 'FOQ', lotSizeValue: 5000, safetyStock: 2000, weight: 2, abcClass: 'A' },
  { code: 'BTL-GLS', name: 'Glass Bottles (12pk)', type: 'RAW', uom: 'case', unitCost: 5.20, leadTimeDays: 14, lotSizeRule: 'FOQ', lotSizeValue: 3000, safetyStock: 1200, weight: 8, abcClass: 'A' },
  { code: 'LBL-PRN', name: 'Printed Labels (roll)', type: 'RAW', uom: 'roll', unitCost: 0.12, leadTimeDays: 7, lotSizeRule: 'FOQ', lotSizeValue: 10000, safetyStock: 4000, weight: 0.5, abcClass: 'C' },
  { code: 'PKG-FLM', name: 'Packaging Film (bar wrap)', type: 'RAW', uom: 'roll', unitCost: 0.08, leadTimeDays: 7, lotSizeRule: 'FOQ', lotSizeValue: 5000, safetyStock: 2000, weight: 0.3, abcClass: 'C' },
  { code: 'CTN-CSE', name: 'Corrugated Cases', type: 'RAW', uom: 'case', unitCost: 1.20, leadTimeDays: 7, lotSizeRule: 'L4L', lotSizeValue: 0, safetyStock: 1000, weight: 1.5, abcClass: 'C' },
  { code: 'CAP-MTL', name: 'Metal Caps/Lids', type: 'RAW', uom: 'case', unitCost: 2.40, leadTimeDays: 7, lotSizeRule: 'FOQ', lotSizeValue: 5000, safetyStock: 2000, weight: 1, abcClass: 'C' },
  { code: 'FLV-NAT', name: 'Natural Flavoring', type: 'RAW', uom: 'lb', unitCost: 15.00, leadTimeDays: 14, lotSizeRule: 'FOQ', lotSizeValue: 500, safetyStock: 200, weight: 1, abcClass: 'B' },
];

// ── Plant-specific BOMs ────────────────────────────────────────────────────
// Each entry: { parent, child, qtyPer, scrapPct }
// qtyPer = amount of child per 1 unit (case) of parent

export const plantBOMs = {
  // ═══════════════════════════════════════════════════════════════════════════
  // PLT-PDX — Portland Plant (Bars & Dry Snacks)
  // ═══════════════════════════════════════════════════════════════════════════
  'PLT-PDX': [
    // ── GRN-BAR (Oat & Honey Granola Bar) — 3-level BOM ──
    // Level 0→1: FG → Subassembly + packaging
    { parent: 'GRN-BAR', child: 'MIX-OAT', qtyPer: 1.0, scrapPct: 2.0 },
    { parent: 'GRN-BAR', child: 'PKG-FLM', qtyPer: 24, scrapPct: 3.0 },
    { parent: 'GRN-BAR', child: 'CTN-CSE', qtyPer: 1, scrapPct: 1.0 },
    { parent: 'GRN-BAR', child: 'LBL-PRN', qtyPer: 24, scrapPct: 2.0 },
    // Level 1→2: Subassembly → Raw materials
    { parent: 'MIX-OAT', child: 'OAT-RLD', qtyPer: 8.0, scrapPct: 1.5 },
    { parent: 'MIX-OAT', child: 'HNY-RAW', qtyPer: 2.0, scrapPct: 1.0 },
    { parent: 'MIX-OAT', child: 'SGR-ORG', qtyPer: 1.5, scrapPct: 0.5 },

    // ── PRO-BAR (Peanut Butter Protein Bar) — 3-level BOM ──
    { parent: 'PRO-BAR', child: 'MIX-PRO', qtyPer: 1.0, scrapPct: 2.0 },
    { parent: 'PRO-BAR', child: 'PKG-FLM', qtyPer: 24, scrapPct: 3.0 },
    { parent: 'PRO-BAR', child: 'CTN-CSE', qtyPer: 1, scrapPct: 1.0 },
    { parent: 'PRO-BAR', child: 'LBL-PRN', qtyPer: 24, scrapPct: 2.0 },
    { parent: 'MIX-PRO', child: 'PNT-BTR', qtyPer: 4.0, scrapPct: 1.0 },
    { parent: 'MIX-PRO', child: 'WHY-PRO', qtyPer: 3.0, scrapPct: 1.0 },
    { parent: 'MIX-PRO', child: 'OAT-RLD', qtyPer: 4.0, scrapPct: 1.5 },
    { parent: 'MIX-PRO', child: 'COCO-PWD', qtyPer: 1.0, scrapPct: 0.5 },

    // ── TRL-MIX (Classic Trail Mix) — 3-level BOM ──
    { parent: 'TRL-MIX', child: 'MIX-TRL', qtyPer: 1.0, scrapPct: 1.5 },
    { parent: 'TRL-MIX', child: 'PKG-FLM', qtyPer: 12, scrapPct: 3.0 },
    { parent: 'TRL-MIX', child: 'CTN-CSE', qtyPer: 1, scrapPct: 1.0 },
    { parent: 'TRL-MIX', child: 'LBL-PRN', qtyPer: 12, scrapPct: 2.0 },
    { parent: 'MIX-TRL', child: 'ALM-RAW', qtyPer: 5.0, scrapPct: 2.0 },
    { parent: 'MIX-TRL', child: 'PNT-BTR', qtyPer: 2.0, scrapPct: 1.0 },
    { parent: 'MIX-TRL', child: 'OAT-RLD', qtyPer: 3.0, scrapPct: 1.0 },
    { parent: 'MIX-TRL', child: 'COCO-PWD', qtyPer: 1.5, scrapPct: 0.5 },
    { parent: 'MIX-TRL', child: 'SGR-ORG', qtyPer: 1.0, scrapPct: 0.5 },

    // ── VEG-CHP (Sea Salt Veggie Chips) — 3-level BOM ──
    { parent: 'VEG-CHP', child: 'MIX-VEG', qtyPer: 1.0, scrapPct: 3.0 },
    { parent: 'VEG-CHP', child: 'PKG-FLM', qtyPer: 12, scrapPct: 3.0 },
    { parent: 'VEG-CHP', child: 'CTN-CSE', qtyPer: 1, scrapPct: 1.0 },
    { parent: 'VEG-CHP', child: 'LBL-PRN', qtyPer: 12, scrapPct: 2.0 },
    { parent: 'MIX-VEG', child: 'VEG-PWD', qtyPer: 6.0, scrapPct: 2.0 },
    { parent: 'MIX-VEG', child: 'RCE-FLR', qtyPer: 3.0, scrapPct: 1.0 },
    { parent: 'MIX-VEG', child: 'SGR-ORG', qtyPer: 0.5, scrapPct: 0.5 },

    // ── RCE-CRK (Brown Rice Crackers) — 3-level BOM ──
    { parent: 'RCE-CRK', child: 'MIX-RCE', qtyPer: 1.0, scrapPct: 2.5 },
    { parent: 'RCE-CRK', child: 'PKG-FLM', qtyPer: 12, scrapPct: 3.0 },
    { parent: 'RCE-CRK', child: 'CTN-CSE', qtyPer: 1, scrapPct: 1.0 },
    { parent: 'RCE-CRK', child: 'LBL-PRN', qtyPer: 12, scrapPct: 2.0 },
    { parent: 'MIX-RCE', child: 'RCE-FLR', qtyPer: 7.0, scrapPct: 1.5 },
    { parent: 'MIX-RCE', child: 'SGR-ORG', qtyPer: 0.3, scrapPct: 0.5 },
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // PLT-ATX — Austin Plant (Beverages)
  // ═══════════════════════════════════════════════════════════════════════════
  'PLT-ATX': [
    // ── SPK-WAT (Lemon Sparkling Water) — 2-level BOM ──
    { parent: 'SPK-WAT', child: 'SYR-FLV', qtyPer: 0.5, scrapPct: 1.0 },
    { parent: 'SPK-WAT', child: 'CO2-TNK', qtyPer: 0.04, scrapPct: 5.0 },
    { parent: 'SPK-WAT', child: 'CAN-ALU', qtyPer: 1.0, scrapPct: 2.0 },
    { parent: 'SPK-WAT', child: 'LBL-PRN', qtyPer: 24, scrapPct: 2.0 },
    { parent: 'SPK-WAT', child: 'CTN-CSE', qtyPer: 1, scrapPct: 1.0 },
    { parent: 'SYR-FLV', child: 'SGR-ORG', qtyPer: 3.0, scrapPct: 0.5 },
    { parent: 'SYR-FLV', child: 'FLV-NAT', qtyPer: 0.5, scrapPct: 1.0 },

    // ── JCE-APL (Cold-Pressed Apple Juice) — 2-level BOM ──
    { parent: 'JCE-APL', child: 'JCE-BAS', qtyPer: 1.0, scrapPct: 2.0 },
    { parent: 'JCE-APL', child: 'BTL-GLS', qtyPer: 1.0, scrapPct: 3.0 },
    { parent: 'JCE-APL', child: 'CAP-MTL', qtyPer: 1.0, scrapPct: 2.0 },
    { parent: 'JCE-APL', child: 'LBL-PRN', qtyPer: 12, scrapPct: 2.0 },
    { parent: 'JCE-APL', child: 'CTN-CSE', qtyPer: 1, scrapPct: 1.0 },
    { parent: 'JCE-BAS', child: 'APL-CNC', qtyPer: 3.0, scrapPct: 2.0 },
    { parent: 'JCE-BAS', child: 'FLV-NAT', qtyPer: 0.2, scrapPct: 1.0 },

    // ── KMB-GNG (Ginger Kombucha) — 2-level BOM ──
    { parent: 'KMB-GNG', child: 'KMB-CLT', qtyPer: 1.0, scrapPct: 5.0 },
    { parent: 'KMB-GNG', child: 'BTL-GLS', qtyPer: 1.0, scrapPct: 3.0 },
    { parent: 'KMB-GNG', child: 'CAP-MTL', qtyPer: 1.0, scrapPct: 2.0 },
    { parent: 'KMB-GNG', child: 'LBL-PRN', qtyPer: 12, scrapPct: 2.0 },
    { parent: 'KMB-GNG', child: 'CTN-CSE', qtyPer: 1, scrapPct: 1.0 },
    { parent: 'KMB-CLT', child: 'GNG-EXT', qtyPer: 1.5, scrapPct: 3.0 },
    { parent: 'KMB-CLT', child: 'SGR-ORG', qtyPer: 4.0, scrapPct: 0.5 },

    // ── NRG-CIT (Citrus Energy Drink) — 2-level BOM ──
    { parent: 'NRG-CIT', child: 'SYR-FLV', qtyPer: 0.8, scrapPct: 1.0 },
    { parent: 'NRG-CIT', child: 'CO2-TNK', qtyPer: 0.03, scrapPct: 5.0 },
    { parent: 'NRG-CIT', child: 'CAN-ALU', qtyPer: 1.0, scrapPct: 2.0 },
    { parent: 'NRG-CIT', child: 'LBL-PRN', qtyPer: 24, scrapPct: 2.0 },
    { parent: 'NRG-CIT', child: 'CTN-CSE', qtyPer: 1, scrapPct: 1.0 },

    // ── CLD-BRW (Vanilla Cold Brew Coffee) — 2-level BOM ──
    { parent: 'CLD-BRW', child: 'CFE-BNS', qtyPer: 6.0, scrapPct: 2.0 },
    { parent: 'CLD-BRW', child: 'FLV-NAT', qtyPer: 0.3, scrapPct: 1.0 },
    { parent: 'CLD-BRW', child: 'SGR-ORG', qtyPer: 1.0, scrapPct: 0.5 },
    { parent: 'CLD-BRW', child: 'BTL-GLS', qtyPer: 1.0, scrapPct: 3.0 },
    { parent: 'CLD-BRW', child: 'CAP-MTL', qtyPer: 1.0, scrapPct: 2.0 },
    { parent: 'CLD-BRW', child: 'LBL-PRN', qtyPer: 12, scrapPct: 2.0 },
    { parent: 'CLD-BRW', child: 'CTN-CSE', qtyPer: 1, scrapPct: 1.0 },
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // PLT-NSH — Nashville Plant (Specialty & Nut Butters)
  // ═══════════════════════════════════════════════════════════════════════════
  'PLT-NSH': [
    // ── NUT-BTR (Almond Nut Butter) — 3-level BOM ──
    { parent: 'NUT-BTR', child: 'NUT-RST', qtyPer: 1.0, scrapPct: 2.0 },
    { parent: 'NUT-BTR', child: 'BTL-GLS', qtyPer: 1.0, scrapPct: 3.0 },
    { parent: 'NUT-BTR', child: 'CAP-MTL', qtyPer: 1.0, scrapPct: 2.0 },
    { parent: 'NUT-BTR', child: 'LBL-PRN', qtyPer: 12, scrapPct: 2.0 },
    { parent: 'NUT-BTR', child: 'CTN-CSE', qtyPer: 1, scrapPct: 1.0 },
    { parent: 'NUT-RST', child: 'ALM-RAW', qtyPer: 10.0, scrapPct: 3.0 },
    { parent: 'NUT-RST', child: 'SGR-ORG', qtyPer: 0.5, scrapPct: 0.5 },

    // ── TRL-MIX (Classic Trail Mix — dual sourced) — 3-level BOM ──
    { parent: 'TRL-MIX', child: 'MIX-TRL', qtyPer: 1.0, scrapPct: 1.5 },
    { parent: 'TRL-MIX', child: 'PKG-FLM', qtyPer: 12, scrapPct: 3.0 },
    { parent: 'TRL-MIX', child: 'CTN-CSE', qtyPer: 1, scrapPct: 1.0 },
    { parent: 'TRL-MIX', child: 'LBL-PRN', qtyPer: 12, scrapPct: 2.0 },
    { parent: 'MIX-TRL', child: 'ALM-RAW', qtyPer: 5.0, scrapPct: 2.0 },
    { parent: 'MIX-TRL', child: 'PNT-BTR', qtyPer: 2.0, scrapPct: 1.0 },
    { parent: 'MIX-TRL', child: 'OAT-RLD', qtyPer: 3.0, scrapPct: 1.0 },
    { parent: 'MIX-TRL', child: 'COCO-PWD', qtyPer: 1.5, scrapPct: 0.5 },
    { parent: 'MIX-TRL', child: 'SGR-ORG', qtyPer: 1.0, scrapPct: 0.5 },

    // ── PRO-BAR (Peanut Butter Protein Bar — dual sourced) — 3-level BOM ──
    { parent: 'PRO-BAR', child: 'MIX-PRO', qtyPer: 1.0, scrapPct: 2.0 },
    { parent: 'PRO-BAR', child: 'PKG-FLM', qtyPer: 24, scrapPct: 3.0 },
    { parent: 'PRO-BAR', child: 'CTN-CSE', qtyPer: 1, scrapPct: 1.0 },
    { parent: 'PRO-BAR', child: 'LBL-PRN', qtyPer: 24, scrapPct: 2.0 },
    { parent: 'MIX-PRO', child: 'PNT-BTR', qtyPer: 4.0, scrapPct: 1.0 },
    { parent: 'MIX-PRO', child: 'WHY-PRO', qtyPer: 3.0, scrapPct: 1.0 },
    { parent: 'MIX-PRO', child: 'OAT-RLD', qtyPer: 4.0, scrapPct: 1.5 },
    { parent: 'MIX-PRO', child: 'COCO-PWD', qtyPer: 1.0, scrapPct: 0.5 },
  ],
};
