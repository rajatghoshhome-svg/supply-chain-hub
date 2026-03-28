/**
 * Data Provider Service
 *
 * Abstracts all data access away from synthetic data files.
 * Routes import from this module instead of from ../data/synthetic-*.js directly.
 *
 * Strategy:
 *   1. If DATABASE_URL is set, try to read from the DB (Drizzle ORM).
 *   2. If DB is empty or unavailable, fall back to synthetic data.
 *   3. Results are cached with a 60-second TTL to avoid hammering the DB.
 *
 * Exports the EXACT same interface as what synthetic files export,
 * so routes only need to change their import line.
 */

import * as schema from '../db/schema.js';
import { eq, and, asc, desc } from 'drizzle-orm';

// ── Synthetic data (always available as fallback) ────────────────────────────

import {
  products as syntheticProducts,
  productFamilies as syntheticProductFamiliesRaw,
  plants as syntheticPlants,
  distributionCenters as syntheticDCs,
  suppliers as syntheticSuppliersArray,
  plantProductSourcing as syntheticPlantProductSourcing,
  workCenters as syntheticWorkCentersArray,
  lanes as syntheticLanes,
  dcInventory as syntheticDcInventory,
  plantInventory as syntheticPlantInventory,
  dcDemandForecast as syntheticDcDemandForecast,
} from '../data/synthetic-network.js';

import {
  skuMaster as syntheticSkuMaster,
  plantBOMs as syntheticPlantBOMsRaw,
} from '../data/synthetic-bom.js';

import {
  demandHistory as syntheticDemandHistoryRaw,
} from '../data/synthetic-demand.js';

// ─────────────────────────────────────────────────────────────────────────────
// Cache infrastructure
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_TTL = 60_000; // 60 seconds

const _cache = new Map();

function cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.time > CACHE_TTL) {
    _cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function cacheSet(key, value) {
  _cache.set(key, { value, time: Date.now() });
  return value;
}

// ─────────────────────────────────────────────────────────────────────────────
// DB access helpers
// ─────────────────────────────────────────────────────────────────────────────

function hasDatabase() {
  return !!process.env.DATABASE_URL;
}

let _dbModule = null;

async function loadDb() {
  if (_dbModule) return _dbModule.db;
  try {
    _dbModule = await import('../db/connection.js');
    return _dbModule.db;
  } catch {
    return null;
  }
}

/**
 * Try a DB query; return null on failure or if DB is unavailable.
 */
async function tryDbQuery(queryFn) {
  if (!hasDatabase()) return null;
  try {
    const db = await loadDb();
    if (!db) return null;
    const result = await queryFn(db);
    // Treat empty results as "no data" → fall back to synthetic
    if (result === null || result === undefined) return null;
    if (Array.isArray(result) && result.length === 0) return null;
    return result;
  } catch (err) {
    // DB error — log and fall back silently
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[data-provider] DB query failed, falling back to synthetic:', err.message);
    }
    return null;
  }
}

/**
 * Cached DB-or-synthetic pattern.
 * @param {string} key - Cache key
 * @param {Function} dbQueryFn - async (db) => result | null
 * @param {Function} syntheticFn - () => fallback value
 */
async function resolve(key, dbQueryFn, syntheticFn) {
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;

  const dbResult = await tryDbQuery(dbQueryFn);
  if (dbResult !== null) return cacheSet(key, dbResult);

  return cacheSet(key, syntheticFn());
}

/**
 * Synchronous resolve: checks cache, else returns synthetic immediately.
 * Used for exports that must be synchronously available (constants).
 * DB population happens via the async preload() function.
 */
function resolveSync(key, syntheticValue) {
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;
  return syntheticValue;
}

// ─────────────────────────────────────────────────────────────────────────────
// Derived shapes from raw synthetic data
// These match the interfaces routes actually consume.
// ─────────────────────────────────────────────────────────────────────────────

// -- networkLocations: unified array of all locations with { code, name, type, city, state, lat, lng }
function buildNetworkLocations() {
  const locs = [];
  for (const p of syntheticPlants) {
    locs.push({ code: p.code, name: p.name, type: 'plant', city: p.city, state: p.state, lat: p.lat, lng: p.lon, specialization: p.specialization });
  }
  for (const dc of syntheticDCs) {
    locs.push({ code: dc.code, name: dc.name, type: 'dc', city: dc.city, state: dc.state, lat: dc.lat, lng: dc.lon });
  }
  for (const s of syntheticSuppliersArray) {
    locs.push({ code: s.code, name: s.name, type: 'supplier', city: s.city, state: s.state, lat: null, lng: null, materials: s.materials });
  }
  return locs;
}

// -- networkLanes: array with { from, to, leadTimeDays, costPerLb, leadTimePeriods }
function buildNetworkLanes() {
  return syntheticLanes.map(l => ({
    ...l,
    // Convert lead time in days to periods (weeks) — round up
    leadTimePeriods: Math.ceil(l.leadTimeDays / 7) || 1,
  }));
}

// -- suppliers: object keyed by supplier code
function buildSuppliersMap() {
  const map = {};
  for (const s of syntheticSuppliersArray) {
    map[s.code] = { name: s.name, city: s.city, state: s.state, materials: s.materials };
  }
  return map;
}

// -- productFamilies: array of { code, products }
function buildProductFamiliesArray() {
  return Object.entries(syntheticProductFamiliesRaw).map(([code, skuCodes]) => ({
    code,
    products: skuCodes,
  }));
}

// -- productSourcing: { skuCode: [{ plantCode, ... }] } — which plants can make which products
function buildProductSourcing() {
  const sourcing = {};
  for (const [plantCode, skuCodes] of Object.entries(syntheticPlantProductSourcing)) {
    for (const skuCode of skuCodes) {
      if (!sourcing[skuCode]) sourcing[skuCode] = [];
      sourcing[skuCode].push(plantCode);
    }
  }
  return sourcing;
}

// -- plantWorkCenters: { plantCode: [ { code, name, capacityHoursPerWeek, hoursPerUnit: { familyCode: hrs } } ] }
function buildPlantWorkCenters() {
  const map = {};
  for (const wc of syntheticWorkCentersArray) {
    if (!map[wc.plant]) map[wc.plant] = [];
    map[wc.plant].push({
      code: wc.code,
      name: wc.name,
      plant: wc.plant,
      capacityHoursPerWeek: wc.capacityHrsPerPeriod,
      hoursPerUnit: buildHoursPerUnit(wc),
    });
  }
  return map;
}

// Estimate hours per unit per product family from work center specialization
function buildHoursPerUnit(wc) {
  const hpu = {};
  // Simple model: each work center processes ~capacity/expected_volume units per hour
  // We'll assign default rates based on work center type
  const families = Object.keys(syntheticProductFamiliesRaw);
  for (const fam of families) {
    // Base rate: 1 hour per unit, adjusted by work center capacity
    hpu[fam] = 1.0;
  }
  return hpu;
}

// -- plantBOMs: transform from raw { plantCode: [ { parent, child, qtyPer, scrapPct } ] }
//    to { plantCode: { parentCode: [ { childCode, qtyPer, scrapPct } ] } }
function buildPlantBOMs() {
  const result = {};
  for (const [plantCode, entries] of Object.entries(syntheticPlantBOMsRaw)) {
    const bomMap = {};
    for (const entry of entries) {
      if (!bomMap[entry.parent]) bomMap[entry.parent] = [];
      bomMap[entry.parent].push({
        childCode: entry.child,
        qtyPer: entry.qtyPer,
        scrapPct: entry.scrapPct,
      });
    }
    result[plantCode] = bomMap;
  }
  return result;
}

// -- bomTree: flat (non-plant-specific) BOM adjacency map { parentCode: [ { childCode, qtyPer, scrapPct } ] }
function buildBomTree() {
  const tree = {};
  // Merge all plant BOMs; for duplicate parent-child pairs, take the first occurrence
  for (const entries of Object.values(syntheticPlantBOMsRaw)) {
    for (const entry of entries) {
      if (!tree[entry.parent]) tree[entry.parent] = [];
      const existing = tree[entry.parent].find(c => c.childCode === entry.child);
      if (!existing) {
        tree[entry.parent].push({
          childCode: entry.child,
          qtyPer: entry.qtyPer,
          scrapPct: entry.scrapPct,
        });
      }
    }
  }
  return tree;
}

// -- skuMaster: enhanced with BOM levels, inventory, lot sizing, lead time in periods
function buildEnhancedSkuMaster() {
  const bomTree = buildBomTree();
  // Determine BOM levels: items never appearing as children are level 0
  const allChildren = new Set();
  for (const children of Object.values(bomTree)) {
    for (const c of children) allChildren.add(c.childCode);
  }
  const allParents = new Set(Object.keys(bomTree));

  return syntheticSkuMaster.map(item => {
    let level;
    if (item.type === 'FG') level = 0;
    else if (item.type === 'SUB') level = 1;
    else level = 2; // RAW

    return {
      ...item,
      level,
      onHand: getDefaultOnHand(item.code, item.type),
      leadTimePeriods: Math.ceil(item.leadTimeDays / 7) || 1,
      lotSizing: {
        method: item.lotSizeRule === 'FOQ' ? 'fixed-order-qty' : 'lot-for-lot',
        fixedQty: item.lotSizeRule === 'FOQ' ? item.lotSizeValue : undefined,
      },
    };
  });
}

// Default on-hand from plant inventory or zero
function getDefaultOnHand(skuCode, type) {
  if (type === 'FG') {
    // Sum across all plants
    let total = 0;
    for (const plantInv of Object.values(syntheticPlantInventory)) {
      if (plantInv[skuCode]) total += plantInv[skuCode].onHand;
    }
    return total || 0;
  }
  // Subassemblies and raw materials: use safety stock as proxy for on-hand
  const skuInfo = syntheticSkuMaster.find(s => s.code === skuCode);
  return skuInfo ? skuInfo.safetyStock * 2 : 0; // Assume 2x safety stock on hand
}

// -- demandHistory: transform from flat array to { skuCode: { name, weekly: [...], periods: [...] } }
function buildDemandHistoryMap() {
  const map = {};

  // Get product name lookup
  const nameMap = {};
  for (const p of syntheticProducts) {
    nameMap[p.code] = p.name;
  }

  // Group by SKU, aggregate across DCs per week
  const weeklyBySku = {};
  for (const record of syntheticDemandHistoryRaw) {
    if (!weeklyBySku[record.skuCode]) {
      weeklyBySku[record.skuCode] = {};
    }
    const week = record.weekStart;
    if (!weeklyBySku[record.skuCode][week]) {
      weeklyBySku[record.skuCode][week] = 0;
    }
    weeklyBySku[record.skuCode][week] += record.actualQty;
  }

  for (const [skuCode, weekData] of Object.entries(weeklyBySku)) {
    const sortedWeeks = Object.keys(weekData).sort();
    map[skuCode] = {
      name: nameMap[skuCode] || skuCode,
      weekly: sortedWeeks.map(w => weekData[w]),
      periods: sortedWeeks,
    };
  }

  return map;
}

// -- generateDemandForecast: builds demand forecast structure for MRP
function buildDemandForecast() {
  // Generate 8-period forecast from dcDemandForecast, aggregated to company level
  const periods = [];
  const base = new Date('2026-04-07');
  for (let i = 0; i < 8; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i * 7);
    periods.push(d.toISOString().slice(0, 10));
  }

  // Aggregate demand across DCs for finished goods
  const finishedGoods = {};
  for (const product of syntheticProducts) {
    const sku = product.code;
    const totalDemand = new Array(8).fill(0);
    for (const dc of Object.keys(syntheticDcDemandForecast)) {
      const dcDemand = syntheticDcDemandForecast[dc]?.[sku];
      if (dcDemand) {
        for (let i = 0; i < Math.min(dcDemand.length, 8); i++) {
          totalDemand[i] += dcDemand[i];
        }
      }
    }
    finishedGoods[sku] = totalDemand;
  }

  return { periods, finishedGoods, scheduledReceipts: {} };
}

// ─────────────────────────────────────────────────────────────────────────────
// Build all derived constants once at module load time
// ─────────────────────────────────────────────────────────────────────────────

const _syntheticNetworkLocations = buildNetworkLocations();
const _syntheticNetworkLanes = buildNetworkLanes();
const _syntheticSuppliersMap = buildSuppliersMap();
const _syntheticProductFamilies = buildProductFamiliesArray();
const _syntheticProductSourcing = buildProductSourcing();
const _syntheticPlantWorkCenters = buildPlantWorkCenters();
const _syntheticPlantBOMs = buildPlantBOMs();
const _syntheticBomTree = buildBomTree();
const _syntheticEnhancedSkuMaster = buildEnhancedSkuMaster();
const _syntheticDemandHistoryMap = buildDemandHistoryMap();

// ─────────────────────────────────────────────────────────────────────────────
// DB query functions — map Drizzle schema to synthetic shapes
// ─────────────────────────────────────────────────────────────────────────────

async function dbQueryProducts(db) {
  const rows = await db.select().from(schema.skus);
  if (!rows.length) return null;
  return rows.map(r => ({
    code: r.code,
    name: r.name,
    family: r.productFamily,
    uom: r.uom,
    abcClass: r.abcClass,
    shelfLifeDays: r.shelfLifeDays,
  }));
}

async function dbQueryNetworkLocations(db) {
  const rows = await db.select().from(schema.locations);
  if (!rows.length) return null;
  return rows.map(r => ({
    code: r.code,
    name: r.name,
    type: r.type,
    city: r.city,
    state: r.state,
    lat: r.lat ? parseFloat(r.lat) : null,
    lng: r.lng ? parseFloat(r.lng) : null,
    status: r.status,
    statusLabel: r.statusLabel,
    color: r.color,
  }));
}

async function dbQueryNetworkLanes(db) {
  const rows = await db.select().from(schema.distributionNetwork);
  if (!rows.length) return null;

  // Need to resolve source/dest codes from location IDs
  const locRows = await db.select().from(schema.locations);
  const locById = Object.fromEntries(locRows.map(l => [l.id, l.code]));

  return rows.map(r => ({
    from: locById[r.sourceId] || `loc-${r.sourceId}`,
    to: locById[r.destId] || `loc-${r.destId}`,
    leadTimeDays: r.leadTimeDays,
    costPerLb: r.transitCostPerUnit ? parseFloat(r.transitCostPerUnit) : 0,
    leadTimePeriods: Math.ceil((r.leadTimeDays || 7) / 7) || 1,
  }));
}

async function dbQueryDcInventory(db) {
  const rows = await db.select().from(schema.inventoryRecords);
  if (!rows.length) return null;

  const locRows = await db.select().from(schema.locations).where(eq(schema.locations.type, 'dc'));
  const locById = Object.fromEntries(locRows.map(l => [l.id, l.code]));

  const skuRows = await db.select().from(schema.skus);
  const skuById = Object.fromEntries(skuRows.map(s => [s.id, s.code]));

  const result = {};
  for (const r of rows) {
    const dcCode = locById[r.locationId];
    const skuCode = skuById[r.skuId];
    if (!dcCode || !skuCode) continue;

    if (!result[dcCode]) result[dcCode] = {};
    result[dcCode][skuCode] = {
      onHand: parseFloat(r.onHand) || 0,
      safetyStock: parseFloat(r.safetyStock) || 0,
    };
  }

  return Object.keys(result).length > 0 ? result : null;
}

async function dbQueryPlantInventory(db) {
  const rows = await db.select().from(schema.inventoryRecords);
  if (!rows.length) return null;

  const locRows = await db.select().from(schema.locations).where(eq(schema.locations.type, 'plant'));
  const locById = Object.fromEntries(locRows.map(l => [l.id, l.code]));

  const skuRows = await db.select().from(schema.skus);
  const skuById = Object.fromEntries(skuRows.map(s => [s.id, s.code]));

  const result = {};
  for (const r of rows) {
    const plantCode = locById[r.locationId];
    const skuCode = skuById[r.skuId];
    if (!plantCode || !skuCode) continue;

    if (!result[plantCode]) result[plantCode] = {};
    result[plantCode][skuCode] = {
      onHand: parseFloat(r.onHand) || 0,
      safetyStock: parseFloat(r.safetyStock) || 0,
    };
  }

  return Object.keys(result).length > 0 ? result : null;
}

async function dbQuerySkuMaster(db) {
  const rows = await db.select().from(schema.skus);
  if (!rows.length) return null;

  // Also fetch planning parameters for lot sizing, lead times, safety stock
  const params = await db.select().from(schema.planningParameters);
  const paramBySku = {};
  for (const p of params) {
    if (!paramBySku[p.skuId]) paramBySku[p.skuId] = p;
  }

  // Fetch BOM structure for levels
  const bomHeaders = await db.select().from(schema.bomHeaders);
  const bomLines = await db.select().from(schema.bomLines);
  const parentIds = new Set(bomHeaders.map(h => h.parentSkuId));
  const childIds = new Set(bomLines.map(l => l.childSkuId));

  return rows.map(r => {
    const pp = paramBySku[r.id];
    let level = 2; // default raw
    if (parentIds.has(r.id) && !childIds.has(r.id)) level = 0;
    else if (parentIds.has(r.id) && childIds.has(r.id)) level = 1;

    return {
      code: r.code,
      name: r.name,
      type: level === 0 ? 'FG' : level === 1 ? 'SUB' : 'RAW',
      uom: r.uom,
      unitCost: 0, // Would need a cost table
      leadTimeDays: pp?.leadTimeDays || 7,
      leadTimePeriods: Math.ceil((pp?.leadTimeDays || 7) / 7) || 1,
      lotSizeRule: pp?.lotSizeRule || 'lot-for-lot',
      lotSizeValue: pp?.lotSizeValue ? parseFloat(pp.lotSizeValue) : 0,
      safetyStock: pp?.safetyStock ? parseFloat(pp.safetyStock) : 0,
      weight: 0,
      abcClass: r.abcClass || 'C',
      level,
      onHand: 0, // Would need inventory join
      lotSizing: {
        method: pp?.lotSizeRule || 'lot-for-lot',
        fixedQty: pp?.lotSizeRule === 'fixed-order-qty' && pp?.lotSizeValue
          ? parseFloat(pp.lotSizeValue) : undefined,
      },
    };
  });
}

async function dbQueryPlantBOMs(db) {
  const bomHeaders = await db.select().from(schema.bomHeaders);
  if (!bomHeaders.length) return null;

  const bomLines = await db.select().from(schema.bomLines);
  const skuRows = await db.select().from(schema.skus);
  const skuById = Object.fromEntries(skuRows.map(s => [s.id, s.code]));

  // We need to associate BOMs with plants via work centers or a mapping table
  // For now, build a flat BOM tree (not plant-specific from DB)
  // Plant-specific BOMs would require a bom_headers.location_id column
  const tree = {};
  for (const header of bomHeaders) {
    const parentCode = skuById[header.parentSkuId];
    if (!parentCode) continue;

    const lines = bomLines.filter(l => l.bomId === header.id);
    if (!tree[parentCode]) tree[parentCode] = [];
    for (const line of lines) {
      const childCode = skuById[line.childSkuId];
      if (!childCode) continue;
      tree[parentCode].push({
        childCode,
        qtyPer: parseFloat(line.quantityPer) || 1,
        scrapPct: parseFloat(line.scrapPct) || 0,
      });
    }
  }

  return Object.keys(tree).length > 0 ? tree : null;
}

async function dbQueryDemandHistory(db) {
  const rows = await db.select().from(schema.demandHistory).orderBy(asc(schema.demandHistory.periodStart));
  if (!rows.length) return null;

  const skuRows = await db.select().from(schema.skus);
  const skuById = Object.fromEntries(skuRows.map(s => [s.id, { code: s.code, name: s.name }]));

  // Group by SKU, aggregate across locations per period
  const weeklyBySku = {};
  for (const r of rows) {
    const skuInfo = skuById[r.skuId];
    if (!skuInfo) continue;
    const { code } = skuInfo;
    if (!weeklyBySku[code]) weeklyBySku[code] = {};
    const period = r.periodStart;
    if (!weeklyBySku[code][period]) weeklyBySku[code][period] = 0;
    weeklyBySku[code][period] += parseFloat(r.actualQty) || 0;
  }

  const result = {};
  for (const [skuCode, weekData] of Object.entries(weeklyBySku)) {
    const sortedWeeks = Object.keys(weekData).sort();
    const skuInfo = Object.values(skuById).find(s => s.code === skuCode);
    result[skuCode] = {
      name: skuInfo?.name || skuCode,
      weekly: sortedWeeks.map(w => Math.round(weekData[w])),
      periods: sortedWeeks,
    };
  }

  return Object.keys(result).length > 0 ? result : null;
}

async function dbQueryDemandHistoryFlat(db) {
  const rows = await db.select().from(schema.demandHistory).orderBy(asc(schema.demandHistory.periodStart));
  if (!rows.length) return null;

  const skuRows = await db.select().from(schema.skus);
  const skuById = Object.fromEntries(skuRows.map(s => [s.id, s.code]));

  const locRows = await db.select().from(schema.locations);
  const locById = Object.fromEntries(locRows.map(l => [l.id, l.code]));

  return rows.map(r => ({
    skuCode: skuById[r.skuId] || `sku-${r.skuId}`,
    dcCode: locById[r.locationId] || `loc-${r.locationId}`,
    weekStart: r.periodStart,
    periodType: r.periodType || 'weekly',
    actualQty: parseFloat(r.actualQty) || 0,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Preload: async function to populate cache from DB at startup
// ─────────────────────────────────────────────────────────────────────────────

let _preloaded = false;

export async function preload() {
  if (_preloaded || !hasDatabase()) return;
  _preloaded = true;

  try {
    await Promise.all([
      resolve('products', dbQueryProducts, () => syntheticProducts),
      resolve('networkLocations', dbQueryNetworkLocations, () => _syntheticNetworkLocations),
      resolve('networkLanes', dbQueryNetworkLanes, () => _syntheticNetworkLanes),
      resolve('dcInventory', dbQueryDcInventory, () => syntheticDcInventory),
      resolve('plantInventory', dbQueryPlantInventory, () => syntheticPlantInventory),
      resolve('skuMaster', dbQuerySkuMaster, () => _syntheticEnhancedSkuMaster),
      resolve('demandHistoryMap', dbQueryDemandHistory, () => _syntheticDemandHistoryMap),
      resolve('demandHistoryFlat', dbQueryDemandHistoryFlat, () => syntheticDemandHistoryRaw),
    ]);
  } catch (err) {
    console.warn('[data-provider] Preload failed, using synthetic data:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exported constants — synchronous, use cache or synthetic fallback
// ─────────────────────────────────────────────────────────────────────────────

// -- From synthetic-network.js --

export const products = resolveSync('products', syntheticProducts);

// productFamilies: array of { code, products: [...skuCodes] }
export const productFamilies = _syntheticProductFamilies;

export const plantProductSourcing = syntheticPlantProductSourcing;

export const dcInventory = resolveSync('dcInventory', syntheticDcInventory);

export const dcDemandForecast = syntheticDcDemandForecast;

export const plantInventory = resolveSync('plantInventory', syntheticPlantInventory);

export const networkLocations = _syntheticNetworkLocations;

export const networkLanes = _syntheticNetworkLanes;

// suppliers as a map: { 'SUP-PKG': { name, city, state, materials }, ... }
export const suppliers = _syntheticSuppliersMap;

export const plantWorkCenters = _syntheticPlantWorkCenters;

export const productSourcing = _syntheticProductSourcing;

// -- Raw re-exports from synthetic-network.js (for any consumer that uses the raw shapes) --
export const plants = syntheticPlants;
export const distributionCenters = syntheticDCs;
export const workCenters = syntheticWorkCentersArray;
export const lanes = syntheticLanes;

// -- From synthetic-bom.js --

export const skuMaster = resolveSync('skuMaster', _syntheticEnhancedSkuMaster);

export const plantBOMs = _syntheticPlantBOMs;

export const bomTree = _syntheticBomTree;

// -- From synthetic-demand.js --

// demandHistory as a map: { skuCode: { name, weekly: [...], periods: [...] } }
export const demandHistory = _syntheticDemandHistoryMap;

// demandHistory as a flat array (original format from synthetic-demand.js)
export const demandHistoryFlat = syntheticDemandHistoryRaw;

// ─────────────────────────────────────────────────────────────────────────────
// Exported functions — helper/accessor functions the routes call
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all plant location objects.
 * @returns {Array} Plant objects with { code, name, type, city, state, lat, lng, ... }
 */
export function getPlants() {
  const locs = resolveSync('networkLocations', _syntheticNetworkLocations);
  return locs.filter(l => l.type === 'plant');
}

/**
 * Get all DC location objects.
 * @returns {Array} DC objects with { code, name, type, city, state, lat, lng }
 */
export function getDCs() {
  const locs = resolveSync('networkLocations', _syntheticNetworkLocations);
  return locs.filter(l => l.type === 'dc');
}

/**
 * Get product codes assigned to a plant.
 * @param {string} plantCode
 * @returns {string[]} Array of SKU codes
 */
export function getProductsForPlant(plantCode) {
  return syntheticPlantProductSourcing[plantCode] || [];
}

/**
 * Find the best source plant for a given DC + SKU combination.
 * Returns the lane with lowest lead time from a plant that makes this product.
 *
 * @param {string} dcCode
 * @param {string} skuCode
 * @returns {{ source: string, leadTimePeriods: number, leadTimeDays: number, costPerLb: number } | null}
 */
export function getBestSourceForDC(dcCode, skuCode) {
  const lanesData = resolveSync('networkLanes', _syntheticNetworkLanes);
  const sourcing = _syntheticProductSourcing;

  // Which plants make this product?
  const plantCodes = sourcing[skuCode] || [];
  if (plantCodes.length === 0) return null;

  // Find lanes from those plants to this DC
  const candidates = lanesData
    .filter(l => plantCodes.includes(l.from) && l.to === dcCode)
    .sort((a, b) => a.leadTimeDays - b.leadTimeDays);

  if (candidates.length === 0) return null;

  const best = candidates[0];
  return {
    source: best.from,
    leadTimePeriods: best.leadTimePeriods || Math.ceil(best.leadTimeDays / 7) || 1,
    leadTimeDays: best.leadTimeDays,
    costPerLb: best.costPerLb,
  };
}

/**
 * Look up a SKU from the enhanced skuMaster by code.
 * @param {string} code
 * @returns {Object|undefined} Enhanced SKU object with level, lotSizing, onHand, etc.
 */
export function getSkuByCode(code) {
  const master = resolveSync('skuMaster', _syntheticEnhancedSkuMaster);
  return master.find(s => s.code === code);
}

/**
 * Get demand data for a specific SKU with period information.
 * Used by GET /api/demand/history/:skuCode
 *
 * @param {string} skuCode
 * @returns {{ skuCode, skuName, demand: number[], periods: string[] } | null}
 */
export function getDemandWithPeriods(skuCode) {
  const histMap = resolveSync('demandHistoryMap', _syntheticDemandHistoryMap);
  const entry = histMap[skuCode];
  if (!entry) return null;

  return {
    skuCode,
    skuName: entry.name,
    demand: entry.weekly,
    periods: entry.periods,
  };
}

/**
 * Generate a demand forecast structure for MRP consumption.
 * Returns { periods: string[], finishedGoods: { skuCode: number[] }, scheduledReceipts: {} }
 */
export function generateDemandForecast() {
  return buildDemandForecast();
}

// ─────────────────────────────────────────────────────────────────────────────
// Async accessor functions — for routes that can await
// These try DB first, then fall back to synthetic.
// ─────────────────────────────────────────────────────────────────────────────

export async function getProducts() {
  return resolve('products', dbQueryProducts, () => syntheticProducts);
}

export async function getNetworkLocations() {
  return resolve('networkLocations', dbQueryNetworkLocations, () => _syntheticNetworkLocations);
}

export async function getNetworkLanes() {
  return resolve('networkLanes', dbQueryNetworkLanes, () => _syntheticNetworkLanes);
}

export async function getDcInventory() {
  return resolve('dcInventory', dbQueryDcInventory, () => syntheticDcInventory);
}

export async function getPlantInventory() {
  return resolve('plantInventory', dbQueryPlantInventory, () => syntheticPlantInventory);
}

export async function getSkuMaster() {
  return resolve('skuMaster', dbQuerySkuMaster, () => _syntheticEnhancedSkuMaster);
}

export async function getDemandHistoryMap() {
  return resolve('demandHistoryMap', dbQueryDemandHistory, () => _syntheticDemandHistoryMap);
}

export async function getPlantBOMs() {
  const dbBom = await tryDbQuery(dbQueryPlantBOMs);
  if (dbBom) {
    // DB returns flat tree; wrap as single-plant if no plant separation
    // For full plant-specific BOMs from DB, we'd need location association
    return dbBom;
  }
  return _syntheticPlantBOMs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache management
// ─────────────────────────────────────────────────────────────────────────────

/** Clear all cached data (useful after writes or for testing). */
export function clearCache() {
  _cache.clear();
}

/** Get cache stats for diagnostics. */
export function getCacheStats() {
  const now = Date.now();
  let active = 0;
  let expired = 0;
  for (const [, entry] of _cache) {
    if (now - entry.time <= CACHE_TTL) active++;
    else expired++;
  }
  return { active, expired, total: _cache.size, ttlMs: CACHE_TTL, hasDatabase: hasDatabase() };
}
