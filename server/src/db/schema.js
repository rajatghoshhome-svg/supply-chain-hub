import { pgTable, serial, varchar, decimal, integer, text, boolean, timestamp, date, jsonb, unique } from 'drizzle-orm/pg-core';

// ─── Core Reference Tables ──────────────────────────────────────────

export const locations = pgTable('locations', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 10 }).unique().notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 20 }).notNull().default('dc'), // dc, plant, supplier
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 50 }),
  lat: decimal('lat', { precision: 9, scale: 6 }),
  lng: decimal('lng', { precision: 9, scale: 6 }),
  status: varchar('status', { length: 20 }).default('stable'),
  statusLabel: varchar('status_label', { length: 50 }),
  color: varchar('color', { length: 7 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const skus = pgTable('skus', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 50 }).unique().notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  productFamily: varchar('product_family', { length: 100 }),
  uom: varchar('uom', { length: 20 }).default('units'),
  shelfLifeDays: integer('shelf_life_days'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 50 }).unique().notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  color: varchar('color', { length: 7 }),
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── Inventory ──────────────────────────────────────────────────────

export const inventoryRecords = pgTable('inventory_records', {
  id: serial('id').primaryKey(),
  skuId: integer('sku_id').references(() => skus.id),
  locationId: integer('location_id').references(() => locations.id),
  onHand: decimal('on_hand', { precision: 12, scale: 2 }).default('0'),
  allocated: decimal('allocated', { precision: 12, scale: 2 }).default('0'),
  inTransit: decimal('in_transit', { precision: 12, scale: 2 }).default('0'),
  safetyStock: decimal('safety_stock', { precision: 12, scale: 2 }).default('0'),
  reorderPoint: decimal('reorder_point', { precision: 12, scale: 2 }).default('0'),
  snapshotDate: date('snapshot_date'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const distributionNetwork = pgTable('distribution_network', {
  id: serial('id').primaryKey(),
  sourceId: integer('source_id').references(() => locations.id),
  destId: integer('dest_id').references(() => locations.id),
  leadTimeDays: integer('lead_time_days'),
  transitCostPerUnit: decimal('transit_cost_per_unit', { precision: 8, scale: 2 }),
  distanceMiles: integer('distance_miles'),
});

// ─── Demand Planning ────────────────────────────────────────────────

export const demandHistory = pgTable('demand_history', {
  id: serial('id').primaryKey(),
  skuId: integer('sku_id').references(() => skus.id),
  locationId: integer('location_id').references(() => locations.id),
  periodStart: date('period_start').notNull(),
  periodType: varchar('period_type', { length: 10 }).default('weekly'),
  actualQty: decimal('actual_qty', { precision: 12, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  unique('demand_history_unique').on(table.skuId, table.locationId, table.periodStart, table.periodType),
]);

export const demandForecasts = pgTable('demand_forecasts', {
  id: serial('id').primaryKey(),
  skuId: integer('sku_id').references(() => skus.id),
  locationId: integer('location_id').references(() => locations.id),
  periodStart: date('period_start').notNull(),
  periodType: varchar('period_type', { length: 10 }).default('weekly'),
  forecastQty: decimal('forecast_qty', { precision: 12, scale: 2 }),
  method: varchar('method', { length: 30 }),
  confidence: decimal('confidence', { precision: 5, scale: 2 }),
  version: integer('version').default(1),
  createdBy: varchar('created_by', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const forecastAccuracy = pgTable('forecast_accuracy', {
  id: serial('id').primaryKey(),
  skuId: integer('sku_id').references(() => skus.id),
  locationId: integer('location_id').references(() => locations.id),
  periodStart: date('period_start'),
  mape: decimal('mape', { precision: 8, scale: 4 }),
  bias: decimal('bias', { precision: 8, scale: 4 }),
  forecastQty: decimal('forecast_qty', { precision: 12, scale: 2 }),
  actualQty: decimal('actual_qty', { precision: 12, scale: 2 }),
});

// ─── DRP ────────────────────────────────────────────────────────────

export const drpRecords = pgTable('drp_records', {
  id: serial('id').primaryKey(),
  skuId: integer('sku_id').references(() => skus.id),
  locationId: integer('location_id').references(() => locations.id),
  periodStart: date('period_start'),
  grossReq: decimal('gross_req', { precision: 12, scale: 2 }),
  scheduledReceipts: decimal('scheduled_receipts', { precision: 12, scale: 2 }),
  projectedOh: decimal('projected_oh', { precision: 12, scale: 2 }),
  netReq: decimal('net_req', { precision: 12, scale: 2 }),
  plannedShipment: decimal('planned_shipment', { precision: 12, scale: 2 }),
  sourceLocationId: integer('source_location_id').references(() => locations.id),
});

export const plannedTransfers = pgTable('planned_transfers', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 30 }).unique(),
  sourceId: integer('source_id').references(() => locations.id),
  destId: integer('dest_id').references(() => locations.id),
  status: varchar('status', { length: 20 }).default('proposed'),
  urgency: varchar('urgency', { length: 10 }),
  rebalanceScore: integer('rebalance_score'),
  transferCost: decimal('transfer_cost', { precision: 10, scale: 2 }),
  riskAvoided: decimal('risk_avoided', { precision: 10, scale: 2 }),
  windowHours: integer('window_hours'),
  mode: varchar('mode', { length: 20 }),
  loadPct: decimal('load_pct', { precision: 5, scale: 2 }),
  reason: text('reason'),
  approvedBy: varchar('approved_by', { length: 100 }),
  decidedAt: timestamp('decided_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const transferLines = pgTable('transfer_lines', {
  id: serial('id').primaryKey(),
  transferId: integer('transfer_id').references(() => plannedTransfers.id),
  skuId: integer('sku_id').references(() => skus.id),
  quantity: decimal('quantity', { precision: 12, scale: 2 }),
});

// ─── Production Planning ────────────────────────────────────────────

export const productFamilies = pgTable('product_families', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
});

export const productFamilyMembers = pgTable('product_family_members', {
  id: serial('id').primaryKey(),
  familyId: integer('family_id').references(() => productFamilies.id),
  skuId: integer('sku_id').references(() => skus.id),
});

export const workCenters = pgTable('work_centers', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 50 }).unique().notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  locationId: integer('location_id').references(() => locations.id),
  capacityPerDay: decimal('capacity_per_day', { precision: 12, scale: 2 }),
  capacityUom: varchar('capacity_uom', { length: 20 }),
});

export const productionPlans = pgTable('production_plans', {
  id: serial('id').primaryKey(),
  familyId: integer('family_id').references(() => productFamilies.id),
  workCenterId: integer('work_center_id').references(() => workCenters.id),
  periodStart: date('period_start'),
  periodEnd: date('period_end'),
  strategy: varchar('strategy', { length: 20 }),
  plannedQty: decimal('planned_qty', { precision: 12, scale: 2 }),
  capacityUsedPct: decimal('capacity_used_pct', { precision: 5, scale: 2 }),
  version: integer('version').default(1),
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── Production Scheduling ──────────────────────────────────────────

export const productionOrders = pgTable('production_orders', {
  id: serial('id').primaryKey(),
  skuId: integer('sku_id').references(() => skus.id),
  workCenterId: integer('work_center_id').references(() => workCenters.id),
  plannedStart: timestamp('planned_start'),
  plannedEnd: timestamp('planned_end'),
  quantity: decimal('quantity', { precision: 12, scale: 2 }),
  status: varchar('status', { length: 20 }).default('planned'),
  sequenceNum: integer('sequence_num'),
  changeoverMins: integer('changeover_mins'),
  priority: integer('priority'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const schedulingConstraints = pgTable('scheduling_constraints', {
  id: serial('id').primaryKey(),
  workCenterId: integer('work_center_id').references(() => workCenters.id),
  constraintType: varchar('constraint_type', { length: 30 }),
  parameters: jsonb('parameters'),
});

// ─── MRP ────────────────────────────────────────────────────────────

export const bomHeaders = pgTable('bom_headers', {
  id: serial('id').primaryKey(),
  parentSkuId: integer('parent_sku_id').references(() => skus.id),
  version: integer('version').default(1),
  effectiveDate: date('effective_date'),
  status: varchar('status', { length: 20 }).default('active'),
});

export const bomLines = pgTable('bom_lines', {
  id: serial('id').primaryKey(),
  bomId: integer('bom_id').references(() => bomHeaders.id),
  childSkuId: integer('child_sku_id').references(() => skus.id),
  quantityPer: decimal('quantity_per', { precision: 10, scale: 4 }),
  scrapPct: decimal('scrap_pct', { precision: 5, scale: 2 }).default('0'),
  leadTimeOffsetDays: integer('lead_time_offset_days').default(0),
});

export const mrpRecords = pgTable('mrp_records', {
  id: serial('id').primaryKey(),
  skuId: integer('sku_id').references(() => skus.id),
  locationId: integer('location_id').references(() => locations.id),
  periodStart: date('period_start'),
  grossReq: decimal('gross_req', { precision: 12, scale: 2 }),
  scheduledReceipts: decimal('scheduled_receipts', { precision: 12, scale: 2 }),
  projectedOh: decimal('projected_oh', { precision: 12, scale: 2 }),
  netReq: decimal('net_req', { precision: 12, scale: 2 }),
  plannedOrderRelease: decimal('planned_order_release', { precision: 12, scale: 2 }),
  plannedOrderReceipt: decimal('planned_order_receipt', { precision: 12, scale: 2 }),
});

export const mrpExceptions = pgTable('mrp_exceptions', {
  id: serial('id').primaryKey(),
  skuId: integer('sku_id').references(() => skus.id),
  locationId: integer('location_id').references(() => locations.id),
  exceptionType: varchar('exception_type', { length: 30 }),
  message: text('message'),
  severity: varchar('severity', { length: 10 }),
  resolved: boolean('resolved').default(false),
  resolvedAt: timestamp('resolved_at'),
});

// ─── Shared / Cross-Module ──────────────────────────────────────────

export const aiConversations = pgTable('ai_conversations', {
  id: serial('id').primaryKey(),
  module: varchar('module', { length: 30 }),
  contextSnapshot: jsonb('context_snapshot'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const aiMessages = pgTable('ai_messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').references(() => aiConversations.id),
  role: varchar('role', { length: 10 }),
  content: text('content'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const decisionLog = pgTable('decision_log', {
  id: serial('id').primaryKey(),
  module: varchar('module', { length: 30 }),
  entityType: varchar('entity_type', { length: 30 }),
  entityId: integer('entity_id'),
  action: varchar('action', { length: 20 }),
  rationale: text('rationale'),
  decidedBy: varchar('decided_by', { length: 100 }),
  decidedAt: timestamp('decided_at').defaultNow(),
  financialImpact: jsonb('financial_impact'),
});
