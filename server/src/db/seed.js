// ─────────────────────────────────────────────────────────────────────────────
// Supply Chain Hub — Database Seed Script
//
// Loads synthetic data into PostgreSQL via Drizzle ORM.
// Run:  cd server && node src/db/seed.js
//
// Data sources:
//   - synthetic-network.js  (locations, lanes, inventory, work centers)
//   - synthetic-demand.js   (52-week demand history)
//   - synthetic-bom.js      (SKU master, BOMs)
//
// Design: Each section is self-contained so individual sections can be
// adapted or replaced when loading different company datasets via CSV.
// ─────────────────────────────────────────────────────────────────────────────

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';

// Load .env from project root (one level above server/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../../../.env') });
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema.js';

// ── Synthetic data imports ──────────────────────────────────────────────────
import {
  products,
  productFamilies as networkProductFamilies,
  plants,
  distributionCenters,
  suppliers,
  workCenters as workCenterData,
  lanes,
  dcInventory,
  plantInventory,
} from '../data/synthetic-network.js';

import { demandHistory as demandHistoryData } from '../data/synthetic-demand.js';

import {
  skuMaster,
  plantBOMs,
} from '../data/synthetic-bom.js';

// ── Database connection ─────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not set. Add it to .env or export it.');
  process.exit(1);
}

const client = postgres(DATABASE_URL);
const db = drizzle(client, { schema });

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Insert rows in batches to avoid exceeding PG parameter limits */
async function batchInsert(table, rows, batchSize = 500) {
  let total = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await db.insert(table).values(batch).onConflictDoNothing();
    total += batch.length;
  }
  return total;
}

// ── Main seed function ──────────────────────────────────────────────────────

async function seed() {
  const t0 = Date.now();
  const summary = {};

  console.log('');
  console.log('============================================================');
  console.log('  Supply Chain Hub — Database Seed');
  console.log('============================================================');
  console.log(`  Target: ${DATABASE_URL.replace(/\/\/.*@/, '//<credentials>@')}`);
  console.log('');

  // ========================================================================
  // PHASE 1: Clear all tables (FK-dependency order — children first)
  // ========================================================================

  console.log('Phase 1: Clearing existing data...');

  // Delete in reverse dependency order so FK constraints are respected.
  // Tables that reference others must be deleted before the tables they reference.
  const tablesToClear = [
    // Leaf / child tables first
    schema.aiMessages,
    schema.aiConversations,
    schema.decisionLog,
    schema.dataHealthLog,
    schema.agentExceptions,
    schema.mrpExceptions,
    schema.mrpRecords,
    schema.bomLines,
    schema.bomHeaders,
    schema.productionOrders,
    schema.schedulingConstraints,
    schema.productionPlans,
    schema.forecastAccuracy,
    schema.demandForecasts,
    schema.demandHistory,
    schema.drpRecords,
    schema.transferLines,
    schema.plannedTransfers,
    schema.inventoryRecords,
    schema.distributionNetwork,
    schema.planningParameters,
    schema.productFamilyMembers,
    schema.productFamilies,
    schema.workCenters,
    schema.planRuns,
    schema.customers,
    schema.skus,
    schema.locations,
  ];

  for (const table of tablesToClear) {
    await db.delete(table);
  }
  console.log(`  Cleared ${tablesToClear.length} tables.`);
  console.log('');

  // ========================================================================
  // PHASE 2: Seed reference data
  // ========================================================================

  console.log('Phase 2: Seeding reference data...');

  // ── 2a. Locations (plants, DCs, suppliers) ────────────────────────────
  //    Source: synthetic-network.js — plants[], distributionCenters[], suppliers[]

  const locationRows = [
    ...plants.map(p => ({
      code: p.code,
      name: p.name,
      type: 'plant',
      city: p.city,
      state: p.state,
      lat: String(p.lat),
      lng: String(p.lon),
      status: 'stable',
      statusLabel: p.specialization,
      color: '#2E7D32',
    })),
    ...distributionCenters.map(dc => ({
      code: dc.code,
      name: dc.name,
      type: 'dc',
      city: dc.city,
      state: dc.state,
      lat: String(dc.lat),
      lng: String(dc.lon),
      status: 'stable',
      statusLabel: null,
      color: '#999',
    })),
    ...suppliers.map(s => ({
      code: s.code,
      name: s.name,
      type: 'supplier',
      city: s.city,
      state: s.state,
      lat: null,
      lng: null,
      status: 'stable',
      statusLabel: s.materials,
      color: '#999',
    })),
  ];

  await db.insert(schema.locations).values(locationRows);
  summary.locations = locationRows.length;
  console.log(`  locations: ${locationRows.length} rows`);

  // Build location lookup by code -> id
  const allLocations = await db.select().from(schema.locations);
  const locByCode = Object.fromEntries(allLocations.map(l => [l.code, l.id]));

  // ── 2b. SKUs (all 40 items: FG, SUB, RAW) ────────────────────────────
  //    Source: synthetic-bom.js — skuMaster[]

  const familyForCode = {};
  for (const item of skuMaster) {
    // Derive product family from the network products data for FGs
    const prod = products.find(p => p.code === item.code);
    familyForCode[item.code] = prod ? prod.family : null;
  }

  const skuRows = skuMaster.map(item => ({
    code: item.code,
    name: item.name,
    productFamily: familyForCode[item.code] || item.type.toLowerCase(), // FG gets family, SUB/RAW get type
    uom: item.uom,
    abcClass: item.abcClass,
    shelfLifeDays: item.type === 'FG' ? (products.find(p => p.code === item.code)?.shelfLifeDays || null) : null,
  }));

  await db.insert(schema.skus).values(skuRows);
  summary.skus = skuRows.length;
  console.log(`  skus: ${skuRows.length} rows (${skuMaster.filter(s => s.type === 'FG').length} FG, ${skuMaster.filter(s => s.type === 'SUB').length} SUB, ${skuMaster.filter(s => s.type === 'RAW').length} RAW)`);

  // Build SKU lookup by code -> id
  const allSkus = await db.select().from(schema.skus);
  const skuByCode = Object.fromEntries(allSkus.map(s => [s.code, s.id]));

  // ── 2c. Product Families + Members ────────────────────────────────────
  //    Source: synthetic-network.js — productFamilies {}

  const familyNames = Object.keys(networkProductFamilies); // bars, snacks, beverages
  const familyInserted = await db.insert(schema.productFamilies)
    .values(familyNames.map(name => ({
      name,
      description: `${name.charAt(0).toUpperCase() + name.slice(1)} product family`,
    })))
    .returning();
  summary.product_families = familyInserted.length;
  console.log(`  product_families: ${familyInserted.length} rows`);

  const familyByName = Object.fromEntries(familyInserted.map(f => [f.name, f.id]));

  const memberRows = [];
  for (const [familyName, skuCodes] of Object.entries(networkProductFamilies)) {
    for (const code of skuCodes) {
      if (skuByCode[code]) {
        memberRows.push({
          familyId: familyByName[familyName],
          skuId: skuByCode[code],
        });
      }
    }
  }
  await db.insert(schema.productFamilyMembers).values(memberRows);
  summary.product_family_members = memberRows.length;
  console.log(`  product_family_members: ${memberRows.length} rows`);

  // ── 2d. Distribution Network (lanes) ──────────────────────────────────
  //    Source: synthetic-network.js — lanes[]

  const laneRows = lanes.map(l => ({
    sourceId: locByCode[l.from],
    destId: locByCode[l.to],
    leadTimeDays: l.leadTimeDays,
    transitCostPerUnit: String(l.costPerLb),
    distanceMiles: null, // not provided in synthetic data; could be computed
  }));

  await db.insert(schema.distributionNetwork).values(laneRows);
  summary.distribution_network = laneRows.length;
  console.log(`  distribution_network: ${laneRows.length} rows`);

  // ── 2e. Work Centers ──────────────────────────────────────────────────
  //    Source: synthetic-network.js — workCenters[]

  const wcRows = workCenterData.map(wc => ({
    code: wc.code,
    name: wc.name,
    locationId: locByCode[wc.plant],
    capacityPerDay: String(wc.capacityHrsPerPeriod),
    capacityUom: 'hrs/period',
  }));

  await db.insert(schema.workCenters).values(wcRows);
  summary.work_centers = wcRows.length;
  console.log(`  work_centers: ${wcRows.length} rows`);

  // ── 2f. Inventory Records (plants + DCs) ──────────────────────────────
  //    Source: synthetic-network.js — plantInventory{}, dcInventory{}

  const today = new Date().toISOString().split('T')[0];
  const inventoryRows = [];

  // DC inventory (has onHand + safetyStock)
  for (const [dcCode, skuMap] of Object.entries(dcInventory)) {
    for (const [skuCode, inv] of Object.entries(skuMap)) {
      inventoryRows.push({
        skuId: skuByCode[skuCode],
        locationId: locByCode[dcCode],
        onHand: String(inv.onHand),
        allocated: '0',
        inTransit: '0',
        safetyStock: String(inv.safetyStock),
        reorderPoint: String(inv.safetyStock * 2), // 2x safety stock as default ROP
        snapshotDate: today,
      });
    }
  }

  // Plant finished-goods inventory (onHand only)
  for (const [plantCode, skuMap] of Object.entries(plantInventory)) {
    for (const [skuCode, inv] of Object.entries(skuMap)) {
      inventoryRows.push({
        skuId: skuByCode[skuCode],
        locationId: locByCode[plantCode],
        onHand: String(inv.onHand),
        allocated: '0',
        inTransit: '0',
        safetyStock: '0',
        reorderPoint: '0',
        snapshotDate: today,
      });
    }
  }

  await db.insert(schema.inventoryRecords).values(inventoryRows);
  summary.inventory_records = inventoryRows.length;
  console.log(`  inventory_records: ${inventoryRows.length} rows (${Object.keys(dcInventory).length} DCs + ${Object.keys(plantInventory).length} plants)`);

  // ── 2g. Demand History (52 weeks x 11 SKUs x 3 DCs) ──────────────────
  //    Source: synthetic-demand.js — demandHistory[]

  const demandRows = demandHistoryData.map(d => ({
    skuId: skuByCode[d.skuCode],
    locationId: locByCode[d.dcCode],
    periodStart: d.weekStart,
    periodType: d.periodType,
    actualQty: String(d.actualQty),
  }));

  const demandInserted = await batchInsert(schema.demandHistory, demandRows, 500);
  summary.demand_history = demandInserted;
  console.log(`  demand_history: ${demandInserted} rows (52 weeks x ${products.length} SKUs x ${distributionCenters.length} DCs)`);

  // ── 2h. BOM Headers + BOM Lines ───────────────────────────────────────
  //    Source: synthetic-bom.js — plantBOMs{}
  //
  //    Each plant has its own BOM set. We create one bom_header per unique
  //    parent SKU (across all plants, deduplicated), then bom_lines for each
  //    parent-child relationship.

  // Collect unique parent->children relationships across all plants.
  // A parent SKU can appear in multiple plants (dual-sourced), but the BOM
  // structure is the same, so we deduplicate.
  const bomMap = new Map(); // parentCode -> Map<childCode, { qtyPer, scrapPct }>

  for (const [_plantCode, bomEntries] of Object.entries(plantBOMs)) {
    for (const entry of bomEntries) {
      if (!bomMap.has(entry.parent)) {
        bomMap.set(entry.parent, new Map());
      }
      const children = bomMap.get(entry.parent);
      // Use first occurrence (BOMs are identical across plants for same parent)
      if (!children.has(entry.child)) {
        children.set(entry.child, {
          qtyPer: entry.qtyPer,
          scrapPct: entry.scrapPct,
        });
      }
    }
  }

  // Insert BOM headers (one per unique parent SKU)
  const parentCodes = [...bomMap.keys()];
  const bomHeaderRows = parentCodes.map(parentCode => ({
    parentSkuId: skuByCode[parentCode],
    version: 1,
    effectiveDate: '2025-01-01',
    status: 'active',
  }));

  const insertedHeaders = await db.insert(schema.bomHeaders)
    .values(bomHeaderRows)
    .returning();
  summary.bom_headers = insertedHeaders.length;
  console.log(`  bom_headers: ${insertedHeaders.length} rows`);

  // Build bomHeader lookup: parentCode -> bomHeader.id
  const bomHeaderByParent = {};
  for (let i = 0; i < parentCodes.length; i++) {
    bomHeaderByParent[parentCodes[i]] = insertedHeaders[i].id;
  }

  // Insert BOM lines
  const bomLineRows = [];
  for (const [parentCode, children] of bomMap.entries()) {
    const bomId = bomHeaderByParent[parentCode];
    for (const [childCode, detail] of children.entries()) {
      bomLineRows.push({
        bomId,
        childSkuId: skuByCode[childCode],
        quantityPer: String(detail.qtyPer),
        scrapPct: String(detail.scrapPct),
        leadTimeOffsetDays: 0,
      });
    }
  }

  await db.insert(schema.bomLines).values(bomLineRows);
  summary.bom_lines = bomLineRows.length;
  console.log(`  bom_lines: ${bomLineRows.length} rows`);

  // ── 2i. Planning Parameters ───────────────────────────────────────────
  //    Source: synthetic-bom.js — skuMaster[] (leadTime, safetyStock, lotSizing)
  //
  //    We create planning parameters for each FG SKU at each DC location,
  //    and for SUB/RAW items at each plant location where they are used.

  const lotRuleMap = { FOQ: 'fixed-order-qty', L4L: 'lot-for-lot' };
  const planningParamRows = [];

  // FG SKUs: one record per DC
  const fgItems = skuMaster.filter(s => s.type === 'FG');
  const dcCodes = distributionCenters.map(dc => dc.code);

  for (const item of fgItems) {
    for (const dcCode of dcCodes) {
      planningParamRows.push({
        skuId: skuByCode[item.code],
        locationId: locByCode[dcCode],
        leadTimeDays: item.leadTimeDays,
        safetyStock: String(item.safetyStock),
        lotSizeRule: lotRuleMap[item.lotSizeRule] || 'lot-for-lot',
        lotSizeValue: String(item.lotSizeValue),
        moq: null,
        reorderPoint: String(item.safetyStock * 2),
      });
    }
  }

  // SUB + RAW SKUs: one record per plant that uses them (derive from BOMs)
  const plantCodesForMaterial = new Map(); // skuCode -> Set<plantCode>
  for (const [plantCode, bomEntries] of Object.entries(plantBOMs)) {
    for (const entry of bomEntries) {
      // The child materials are what the plant needs
      if (!plantCodesForMaterial.has(entry.child)) {
        plantCodesForMaterial.set(entry.child, new Set());
      }
      plantCodesForMaterial.get(entry.child).add(plantCode);
      // Also include parents that are SUB (subassemblies produced at the plant)
      const parentItem = skuMaster.find(s => s.code === entry.parent);
      if (parentItem && parentItem.type === 'SUB') {
        if (!plantCodesForMaterial.has(entry.parent)) {
          plantCodesForMaterial.set(entry.parent, new Set());
        }
        plantCodesForMaterial.get(entry.parent).add(plantCode);
      }
    }
  }

  const subRawItems = skuMaster.filter(s => s.type === 'SUB' || s.type === 'RAW');
  for (const item of subRawItems) {
    const plantCodes = plantCodesForMaterial.get(item.code) || new Set();
    for (const plantCode of plantCodes) {
      planningParamRows.push({
        skuId: skuByCode[item.code],
        locationId: locByCode[plantCode],
        leadTimeDays: item.leadTimeDays,
        safetyStock: String(item.safetyStock),
        lotSizeRule: lotRuleMap[item.lotSizeRule] || 'lot-for-lot',
        lotSizeValue: String(item.lotSizeValue),
        moq: null,
        reorderPoint: String(item.safetyStock * 2),
      });
    }
  }

  await batchInsert(schema.planningParameters, planningParamRows, 500);
  summary.planning_parameters = planningParamRows.length;
  console.log(`  planning_parameters: ${planningParamRows.length} rows (${fgItems.length} FG x ${dcCodes.length} DCs + SUB/RAW at plants)`);

  // ── 2j. Customers (retail channels) ───────────────────────────────────
  //    Static reference data for the demand side

  const customerRows = [
    { code: 'WHOLEFOODS', name: 'Whole Foods', color: '#00674B' },
    { code: 'KROGER', name: 'Kroger', color: '#0071CE' },
    { code: 'COSTCO', name: 'Costco', color: '#E31837' },
    { code: 'TARGET', name: 'Target', color: '#CC0000' },
    { code: 'AMAZON', name: 'Amazon', color: '#FF9900' },
    { code: 'OTHER', name: 'Other', color: '#999' },
  ];

  await db.insert(schema.customers).values(customerRows);
  summary.customers = customerRows.length;
  console.log(`  customers: ${customerRows.length} rows`);

  // ========================================================================
  // PHASE 3: Summary
  // ========================================================================

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const totalRows = Object.values(summary).reduce((a, b) => a + b, 0);

  console.log('');
  console.log('============================================================');
  console.log('  Seed Summary');
  console.log('============================================================');
  for (const [table, count] of Object.entries(summary)) {
    console.log(`  ${table.padEnd(28)} ${String(count).padStart(6)} rows`);
  }
  console.log('  ────────────────────────────────────────');
  console.log(`  ${'TOTAL'.padEnd(28)} ${String(totalRows).padStart(6)} rows`);
  console.log(`  Completed in ${elapsed}s`);
  console.log('============================================================');
  console.log('');

  await client.end();
}

// ── Entry point ─────────────────────────────────────────────────────────────

seed().catch(err => {
  console.error('');
  console.error('Seed FAILED:', err.message);
  if (err.code) console.error('  PG error code:', err.code);
  if (err.detail) console.error('  Detail:', err.detail);
  console.error('');
  process.exit(1);
});
