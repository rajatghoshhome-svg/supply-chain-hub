/**
 * Onboarding Persistence Service
 *
 * Handles inserting validated CSV data from the onboarding flow into the
 * database. Each data type has its own insert function that:
 *   1. Resolves foreign keys (e.g., sku_code -> skus.id)
 *   2. Inserts rows in batches (to avoid PG parameter limits)
 *   3. Uses ON CONFLICT DO NOTHING for idempotency
 *   4. Returns insert counts and any resolution errors
 *
 * Insert order matters due to FK constraints:
 *   locations -> skus -> bom -> inventory -> demand-history -> planning-params
 */

import { db } from '../db/connection.js';
import * as schema from '../db/schema.js';

// ─── Helpers ──────────────────────────────────────────────────────

async function batchInsert(table, rows, batchSize = 500) {
  let total = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await db.insert(table).values(batch).onConflictDoNothing();
    total += batch.length;
  }
  return total;
}

async function buildLookup(table, codeField = 'code') {
  const all = await db.select().from(table);
  return Object.fromEntries(all.map(r => [r[codeField], r.id]));
}

// ─── Insert Functions Per Data Type ──────────────────────────────

/**
 * Insert locations (plants, DCs, suppliers)
 */
async function insertLocations(rows) {
  const locationRows = rows.map(r => ({
    code: (r.location_code || '').toString().trim(),
    name: (r.name || '').toString().trim(),
    type: (r.type || 'dc').toString().trim().toLowerCase(),
    city: (r.city || '').toString().trim() || null,
    state: (r.region || r.state || '').toString().trim() || null,
    lat: r.latitude ? String(r.latitude) : null,
    lng: r.longitude ? String(r.longitude) : null,
    status: 'stable',
    statusLabel: null,
    color: null,
  }));

  const inserted = await batchInsert(schema.locations, locationRows);
  return { table: 'locations', inserted, total: rows.length };
}

/**
 * Insert SKUs (finished goods, subassemblies, raw materials)
 */
async function insertSkus(rows) {
  const skuRows = rows.map(r => ({
    code: (r.sku_code || '').toString().trim(),
    name: (r.name || '').toString().trim(),
    productFamily: (r.category || r.product_family || '').toString().trim() || null,
    uom: (r.uom || 'units').toString().trim(),
    abcClass: (r.abc_class || '').toString().trim().toUpperCase() || null,
    shelfLifeDays: r.shelf_life_days ? Number(r.shelf_life_days) : null,
  }));

  const inserted = await batchInsert(schema.skus, skuRows);
  return { table: 'skus', inserted, total: rows.length };
}

/**
 * Insert BOM headers + lines from flat parent-child rows
 */
async function insertBom(rows) {
  // Build SKU lookup for FK resolution
  const skuByCode = await buildLookup(schema.skus);
  const errors = [];

  // Group by parent to create headers
  const parentMap = new Map(); // parentCode -> [{ child, qty_per, scrap_pct, lead_time_offset }]
  for (const r of rows) {
    const parent = (r.parent_code || '').toString().trim();
    const child = (r.child_code || '').toString().trim();
    if (!parent || !child) continue;

    if (!skuByCode[parent]) {
      errors.push(`BOM parent SKU "${parent}" not found in skus table`);
      continue;
    }
    if (!skuByCode[child]) {
      errors.push(`BOM child SKU "${child}" not found in skus table`);
      continue;
    }

    if (!parentMap.has(parent)) parentMap.set(parent, []);
    parentMap.get(parent).push({
      childCode: child,
      qtyPer: r.qty_per != null ? Number(r.qty_per) : 1,
      scrapPct: r.scrap_pct != null ? Number(r.scrap_pct) : 0,
      leadTimeOffset: r.lead_time_offset != null ? Number(r.lead_time_offset) : 0,
    });
  }

  // Insert BOM headers
  const parentCodes = [...parentMap.keys()];
  if (parentCodes.length === 0) {
    return { table: 'bom_headers + bom_lines', inserted: 0, total: rows.length, errors };
  }

  const headerRows = parentCodes.map(code => ({
    parentSkuId: skuByCode[code],
    version: 1,
    effectiveDate: new Date().toISOString().split('T')[0],
    status: 'active',
  }));

  const insertedHeaders = await db.insert(schema.bomHeaders)
    .values(headerRows)
    .onConflictDoNothing()
    .returning();

  // Build header lookup
  const bomHeaderByParent = {};
  for (let i = 0; i < parentCodes.length; i++) {
    if (insertedHeaders[i]) {
      bomHeaderByParent[parentCodes[i]] = insertedHeaders[i].id;
    }
  }

  // Insert BOM lines
  const lineRows = [];
  for (const [parentCode, children] of parentMap.entries()) {
    const bomId = bomHeaderByParent[parentCode];
    if (!bomId) continue;
    for (const child of children) {
      lineRows.push({
        bomId,
        childSkuId: skuByCode[child.childCode],
        quantityPer: String(child.qtyPer),
        scrapPct: String(child.scrapPct),
        leadTimeOffsetDays: child.leadTimeOffset,
      });
    }
  }

  const linesInserted = await batchInsert(schema.bomLines, lineRows);

  return {
    table: 'bom_headers + bom_lines',
    inserted: insertedHeaders.length + linesInserted,
    headers: insertedHeaders.length,
    lines: linesInserted,
    total: rows.length,
    errors,
  };
}

/**
 * Insert demand history
 */
async function insertDemandHistory(rows) {
  const skuByCode = await buildLookup(schema.skus);
  const locByCode = await buildLookup(schema.locations);
  const errors = [];

  const demandRows = [];
  for (const r of rows) {
    const skuCode = (r.sku_code || '').toString().trim();
    const locCode = (r.location_code || '').toString().trim();
    const skuId = skuByCode[skuCode];

    if (!skuId) {
      errors.push(`Demand history SKU "${skuCode}" not found in skus table`);
      continue;
    }

    // Location is optional for demand
    const locationId = locCode ? locByCode[locCode] || null : null;

    demandRows.push({
      skuId,
      locationId,
      periodStart: r.period || new Date().toISOString().split('T')[0],
      periodType: 'weekly',
      actualQty: r.quantity != null ? String(Number(r.quantity)) : '0',
    });
  }

  const inserted = await batchInsert(schema.demandHistory, demandRows);
  return { table: 'demand_history', inserted, total: rows.length, errors };
}

/**
 * Insert inventory records
 */
async function insertInventory(rows) {
  const skuByCode = await buildLookup(schema.skus);
  const locByCode = await buildLookup(schema.locations);
  const errors = [];
  const today = new Date().toISOString().split('T')[0];

  const invRows = [];
  for (const r of rows) {
    const skuCode = (r.sku_code || '').toString().trim();
    const locCode = (r.location_code || '').toString().trim();
    const skuId = skuByCode[skuCode];
    const locationId = locByCode[locCode];

    if (!skuId) {
      errors.push(`Inventory SKU "${skuCode}" not found in skus table`);
      continue;
    }
    if (!locationId) {
      errors.push(`Inventory location "${locCode}" not found in locations table`);
      continue;
    }

    invRows.push({
      skuId,
      locationId,
      onHand: r.on_hand != null ? String(Number(r.on_hand)) : '0',
      allocated: r.allocated != null ? String(Number(r.allocated)) : '0',
      inTransit: r.in_transit != null ? String(Number(r.in_transit)) : '0',
      safetyStock: '0',
      reorderPoint: '0',
      snapshotDate: today,
    });
  }

  const inserted = await batchInsert(schema.inventoryRecords, invRows);
  return { table: 'inventory_records', inserted, total: rows.length, errors };
}

/**
 * Insert planning parameters
 */
async function insertPlanningParams(rows) {
  const skuByCode = await buildLookup(schema.skus);
  const locByCode = await buildLookup(schema.locations);
  const errors = [];

  const paramRows = [];
  for (const r of rows) {
    const skuCode = (r.sku_code || '').toString().trim();
    const locCode = (r.location_code || '').toString().trim();
    const skuId = skuByCode[skuCode];

    if (!skuId) {
      errors.push(`Planning params SKU "${skuCode}" not found in skus table`);
      continue;
    }

    // Location is optional (null means global default for that SKU)
    const locationId = locCode ? locByCode[locCode] || null : null;

    paramRows.push({
      skuId,
      locationId,
      leadTimeDays: r.lead_time_days != null ? Number(r.lead_time_days) : null,
      safetyStock: r.safety_stock != null ? String(Number(r.safety_stock)) : '0',
      lotSizeRule: (r.lot_size_rule || 'lot-for-lot').toString().trim(),
      lotSizeValue: r.lot_size_value != null ? String(Number(r.lot_size_value)) : null,
      moq: null,
      reorderPoint: r.reorder_point != null ? String(Number(r.reorder_point)) : '0',
    });
  }

  const inserted = await batchInsert(schema.planningParameters, paramRows);
  return { table: 'planning_parameters', inserted, total: rows.length, errors };
}

/**
 * Insert distribution network lanes
 */
async function insertDistributionNetwork(rows) {
  const locByCode = await buildLookup(schema.locations);
  const errors = [];

  const laneRows = [];
  for (const r of rows) {
    const sourceCode = (r.source_code || '').toString().trim();
    const destCode = (r.dest_code || '').toString().trim();
    const sourceId = locByCode[sourceCode];
    const destId = locByCode[destCode];

    if (!sourceId) {
      errors.push(`Network source location "${sourceCode}" not found in locations table`);
      continue;
    }
    if (!destId) {
      errors.push(`Network dest location "${destCode}" not found in locations table`);
      continue;
    }

    laneRows.push({
      sourceId,
      destId,
      leadTimeDays: r.lead_time_days != null ? Number(r.lead_time_days) : null,
      transitCostPerUnit: r.cost_per_unit != null ? String(Number(r.cost_per_unit)) : null,
      distanceMiles: r.distance_miles != null ? Number(r.distance_miles) : null,
    });
  }

  const inserted = await batchInsert(schema.distributionNetwork, laneRows);
  return { table: 'distribution_network', inserted, total: rows.length, errors };
}

/**
 * Insert work centers
 */
async function insertWorkCenters(rows) {
  const locByCode = await buildLookup(schema.locations);
  const errors = [];

  const wcRows = [];
  for (const r of rows) {
    const locCode = (r.location_code || '').toString().trim();
    const locationId = locCode ? locByCode[locCode] || null : null;

    if (locCode && !locationId) {
      errors.push(`Work center location "${locCode}" not found in locations table`);
      continue;
    }

    wcRows.push({
      code: (r.work_center_code || '').toString().trim(),
      name: (r.name || '').toString().trim(),
      locationId,
      capacityPerDay: r.capacity_per_day != null ? String(Number(r.capacity_per_day)) : null,
      capacityUom: (r.capacity_uom || 'units').toString().trim(),
    });
  }

  const inserted = await batchInsert(schema.workCenters, wcRows);
  return { table: 'work_centers', inserted, total: rows.length, errors };
}

// ─── Dispatcher ──────────────────────────────────────────────────

const INSERT_HANDLERS = {
  locations: insertLocations,
  skus: insertSkus,
  bom: insertBom,
  'demand-history': insertDemandHistory,
  inventory: insertInventory,
  'planning-params': insertPlanningParams,
  'distribution-network': insertDistributionNetwork,
  'work-centers': insertWorkCenters,
};

/**
 * Insert a single data type's rows into the database.
 * @param {string} dataType
 * @param {Object[]} rows - Mapped/validated rows
 * @returns {Promise<{table, inserted, total, errors?}>}
 */
export async function insertOnboardingData(dataType, rows) {
  const handler = INSERT_HANDLERS[dataType];
  if (!handler) {
    throw new Error(`No insert handler for data type: ${dataType}`);
  }
  return handler(rows);
}

/**
 * Insert all staged onboarding data in FK-safe order.
 * @param {Object} stagedData - { dataType: rows[] }
 * @returns {Promise<{results: Object[], errors: string[]}>}
 */
export async function insertAllOnboardingData(stagedData) {
  // FK-safe insertion order
  const ORDER = [
    'locations',
    'skus',
    'work-centers',
    'distribution-network',
    'bom',
    'inventory',
    'demand-history',
    'planning-params',
  ];

  const results = [];
  const allErrors = [];

  for (const dataType of ORDER) {
    const rows = stagedData[dataType];
    if (!rows || rows.length === 0) continue;

    try {
      const result = await insertOnboardingData(dataType, rows);
      results.push(result);
      if (result.errors && result.errors.length > 0) {
        allErrors.push(...result.errors.map(e => `[${dataType}] ${e}`));
      }
    } catch (err) {
      results.push({
        table: dataType,
        inserted: 0,
        total: rows.length,
        error: err.message,
      });
      allErrors.push(`[${dataType}] Insert failed: ${err.message}`);
    }
  }

  return { results, errors: allErrors };
}
