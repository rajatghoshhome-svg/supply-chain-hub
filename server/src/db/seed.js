import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client, { schema });

async function seed() {
  console.log('Seeding database — Peakline Foods...');

  // ── Locations (plants, DCs, suppliers) ──
  const locationData = [
    // Plants
    { code: 'PLT-PDX', name: 'Portland Plant', type: 'plant', city: 'Portland', state: 'OR', lat: '45.520000', lng: '-122.680000', status: 'stable', statusLabel: 'Bars & Dry Snacks', color: '#2E7D32' },
    { code: 'PLT-ATX', name: 'Austin Plant', type: 'plant', city: 'Austin', state: 'TX', lat: '30.270000', lng: '-97.740000', status: 'stable', statusLabel: 'Beverages', color: '#2E7D32' },
    { code: 'PLT-NSH', name: 'Nashville Plant', type: 'plant', city: 'Nashville', state: 'TN', lat: '36.160000', lng: '-86.780000', status: 'stable', statusLabel: 'Specialty & Nut Butters', color: '#2E7D32' },
    // Distribution Centers
    { code: 'DC-ATL', name: 'Atlanta DC', type: 'dc', city: 'Atlanta', state: 'GA', lat: '33.750000', lng: '-84.390000', status: 'crisis', statusLabel: 'Critical — 3.1 days', color: '#B03A2E' },
    { code: 'DC-CHI', name: 'Chicago DC', type: 'dc', city: 'Chicago', state: 'IL', lat: '41.880000', lng: '-87.630000', status: 'stable', statusLabel: 'Stable — 19 days', color: '#999' },
    { code: 'DC-LAS', name: 'Las Vegas DC', type: 'dc', city: 'Las Vegas', state: 'NV', lat: '36.170000', lng: '-115.140000', status: 'review', statusLabel: 'Review — 8.4 days', color: '#D4A017' },
    // Suppliers
    { code: 'SUP-PKG', name: 'Pacific Packaging', type: 'supplier', city: 'Fresno', state: 'CA', lat: '36.740000', lng: '-119.770000', status: 'stable', statusLabel: 'Packaging film, cartons, labels', color: '#999' },
    { code: 'SUP-ING', name: 'Heartland Ingredients', type: 'supplier', city: 'Des Moines', state: 'IA', lat: '41.590000', lng: '-93.620000', status: 'stable', statusLabel: 'Oats, nuts, cocoa, sugar, flour', color: '#999' },
    { code: 'SUP-BTL', name: 'SouthGlass Bottles', type: 'supplier', city: 'Birmingham', state: 'AL', lat: '33.520000', lng: '-86.810000', status: 'stable', statusLabel: 'Glass bottles, aluminum cans, caps', color: '#999' },
  ];
  const insertedLocations = await db.insert(schema.locations).values(locationData).onConflictDoNothing().returning();
  console.log(`  Locations: ${insertedLocations.length} inserted`);

  // Build location ID lookup
  const allLocations = await db.select().from(schema.locations);
  const locByCode = Object.fromEntries(allLocations.map(l => [l.code, l.id]));

  // ── SKUs (11 finished goods) ──
  const skuData = [
    { code: 'GRN-BAR', name: 'Oat & Honey Granola Bar', productFamily: 'bars', uom: 'case/24', shelfLifeDays: 270 },
    { code: 'PRO-BAR', name: 'Peanut Butter Protein Bar', productFamily: 'bars', uom: 'case/24', shelfLifeDays: 270 },
    { code: 'TRL-MIX', name: 'Classic Trail Mix', productFamily: 'snacks', uom: 'case/12', shelfLifeDays: 365 },
    { code: 'VEG-CHP', name: 'Sea Salt Veggie Chips', productFamily: 'snacks', uom: 'case/12', shelfLifeDays: 240 },
    { code: 'RCE-CRK', name: 'Brown Rice Crackers', productFamily: 'snacks', uom: 'case/12', shelfLifeDays: 300 },
    { code: 'SPK-WAT', name: 'Lemon Sparkling Water', productFamily: 'beverages', uom: 'case/24', shelfLifeDays: 540 },
    { code: 'JCE-APL', name: 'Cold-Pressed Apple Juice', productFamily: 'beverages', uom: 'case/12', shelfLifeDays: 90 },
    { code: 'KMB-GNG', name: 'Ginger Kombucha', productFamily: 'beverages', uom: 'case/12', shelfLifeDays: 120 },
    { code: 'NRG-CIT', name: 'Citrus Energy Drink', productFamily: 'beverages', uom: 'case/24', shelfLifeDays: 365 },
    { code: 'CLD-BRW', name: 'Vanilla Cold Brew Coffee', productFamily: 'beverages', uom: 'case/12', shelfLifeDays: 60 },
    { code: 'NUT-BTR', name: 'Almond Nut Butter', productFamily: 'snacks', uom: 'case/12', shelfLifeDays: 365 },
  ];
  const insertedSkus = await db.insert(schema.skus).values(skuData).onConflictDoNothing().returning();
  console.log(`  SKUs: ${insertedSkus.length} inserted`);

  const allSkus = await db.select().from(schema.skus);
  const skuByCode = Object.fromEntries(allSkus.map(s => [s.code, s.id]));

  // ── Customers (retail channels) ──
  const customerData = [
    { code: 'WHOLEFOODS', name: 'Whole Foods', color: '#00674B' },
    { code: 'KROGER', name: 'Kroger', color: '#0071CE' },
    { code: 'COSTCO', name: 'Costco', color: '#E31837' },
    { code: 'TARGET', name: 'Target', color: '#CC0000' },
    { code: 'AMAZON', name: 'Amazon', color: '#FF9900' },
    { code: 'OTHER', name: 'Other', color: '#999' },
  ];
  const insertedCustomers = await db.insert(schema.customers).values(customerData).onConflictDoNothing().returning();
  console.log(`  Customers: ${insertedCustomers.length} inserted`);

  // ── Inventory Records (per SKU per DC) ──
  const today = new Date().toISOString().split('T')[0];
  const inventoryData = [
    // DC-ATL — crisis, low inventory
    { skuId: skuByCode['GRN-BAR'], locationId: locByCode['DC-ATL'], onHand: '180', safetyStock: '200', reorderPoint: '400', snapshotDate: today },
    { skuId: skuByCode['PRO-BAR'], locationId: locByCode['DC-ATL'], onHand: '120', safetyStock: '180', reorderPoint: '350', snapshotDate: today },
    { skuId: skuByCode['TRL-MIX'], locationId: locByCode['DC-ATL'], onHand: '95', safetyStock: '150', reorderPoint: '300', snapshotDate: today },
    { skuId: skuByCode['VEG-CHP'], locationId: locByCode['DC-ATL'], onHand: '140', safetyStock: '120', reorderPoint: '250', snapshotDate: today },
    { skuId: skuByCode['RCE-CRK'], locationId: locByCode['DC-ATL'], onHand: '85', safetyStock: '100', reorderPoint: '200', snapshotDate: today },
    { skuId: skuByCode['SPK-WAT'], locationId: locByCode['DC-ATL'], onHand: '220', safetyStock: '300', reorderPoint: '600', snapshotDate: today },
    { skuId: skuByCode['JCE-APL'], locationId: locByCode['DC-ATL'], onHand: '65', safetyStock: '100', reorderPoint: '200', snapshotDate: today },
    { skuId: skuByCode['KMB-GNG'], locationId: locByCode['DC-ATL'], onHand: '70', safetyStock: '80', reorderPoint: '160', snapshotDate: today },
    { skuId: skuByCode['NRG-CIT'], locationId: locByCode['DC-ATL'], onHand: '160', safetyStock: '200', reorderPoint: '400', snapshotDate: today },
    { skuId: skuByCode['CLD-BRW'], locationId: locByCode['DC-ATL'], onHand: '45', safetyStock: '60', reorderPoint: '120', snapshotDate: today },
    { skuId: skuByCode['NUT-BTR'], locationId: locByCode['DC-ATL'], onHand: '110', safetyStock: '120', reorderPoint: '240', snapshotDate: today },
    // DC-CHI — stable, healthy inventory
    { skuId: skuByCode['GRN-BAR'], locationId: locByCode['DC-CHI'], onHand: '820', safetyStock: '200', reorderPoint: '400', snapshotDate: today },
    { skuId: skuByCode['PRO-BAR'], locationId: locByCode['DC-CHI'], onHand: '680', safetyStock: '180', reorderPoint: '350', snapshotDate: today },
    { skuId: skuByCode['TRL-MIX'], locationId: locByCode['DC-CHI'], onHand: '540', safetyStock: '150', reorderPoint: '300', snapshotDate: today },
    { skuId: skuByCode['VEG-CHP'], locationId: locByCode['DC-CHI'], onHand: '480', safetyStock: '120', reorderPoint: '250', snapshotDate: today },
    { skuId: skuByCode['RCE-CRK'], locationId: locByCode['DC-CHI'], onHand: '390', safetyStock: '100', reorderPoint: '200', snapshotDate: today },
    { skuId: skuByCode['SPK-WAT'], locationId: locByCode['DC-CHI'], onHand: '1240', safetyStock: '300', reorderPoint: '600', snapshotDate: today },
    { skuId: skuByCode['JCE-APL'], locationId: locByCode['DC-CHI'], onHand: '310', safetyStock: '100', reorderPoint: '200', snapshotDate: today },
    { skuId: skuByCode['KMB-GNG'], locationId: locByCode['DC-CHI'], onHand: '260', safetyStock: '80', reorderPoint: '160', snapshotDate: today },
    { skuId: skuByCode['NRG-CIT'], locationId: locByCode['DC-CHI'], onHand: '720', safetyStock: '200', reorderPoint: '400', snapshotDate: today },
    { skuId: skuByCode['CLD-BRW'], locationId: locByCode['DC-CHI'], onHand: '190', safetyStock: '60', reorderPoint: '120', snapshotDate: today },
    { skuId: skuByCode['NUT-BTR'], locationId: locByCode['DC-CHI'], onHand: '420', safetyStock: '120', reorderPoint: '240', snapshotDate: today },
    // DC-LAS — review, moderate inventory
    { skuId: skuByCode['GRN-BAR'], locationId: locByCode['DC-LAS'], onHand: '340', safetyStock: '200', reorderPoint: '400', snapshotDate: today },
    { skuId: skuByCode['PRO-BAR'], locationId: locByCode['DC-LAS'], onHand: '280', safetyStock: '180', reorderPoint: '350', snapshotDate: today },
    { skuId: skuByCode['TRL-MIX'], locationId: locByCode['DC-LAS'], onHand: '220', safetyStock: '150', reorderPoint: '300', snapshotDate: today },
    { skuId: skuByCode['VEG-CHP'], locationId: locByCode['DC-LAS'], onHand: '260', safetyStock: '120', reorderPoint: '250', snapshotDate: today },
    { skuId: skuByCode['RCE-CRK'], locationId: locByCode['DC-LAS'], onHand: '170', safetyStock: '100', reorderPoint: '200', snapshotDate: today },
    { skuId: skuByCode['SPK-WAT'], locationId: locByCode['DC-LAS'], onHand: '580', safetyStock: '300', reorderPoint: '600', snapshotDate: today },
    { skuId: skuByCode['JCE-APL'], locationId: locByCode['DC-LAS'], onHand: '140', safetyStock: '100', reorderPoint: '200', snapshotDate: today },
    { skuId: skuByCode['KMB-GNG'], locationId: locByCode['DC-LAS'], onHand: '120', safetyStock: '80', reorderPoint: '160', snapshotDate: today },
    { skuId: skuByCode['NRG-CIT'], locationId: locByCode['DC-LAS'], onHand: '380', safetyStock: '200', reorderPoint: '400', snapshotDate: today },
    { skuId: skuByCode['CLD-BRW'], locationId: locByCode['DC-LAS'], onHand: '80', safetyStock: '60', reorderPoint: '120', snapshotDate: today },
    { skuId: skuByCode['NUT-BTR'], locationId: locByCode['DC-LAS'], onHand: '200', safetyStock: '120', reorderPoint: '240', snapshotDate: today },
  ];
  await db.insert(schema.inventoryRecords).values(inventoryData).returning();
  console.log(`  Inventory records: ${inventoryData.length} inserted`);

  // ── Distribution Network (lanes) ──
  const networkData = [
    // Supplier → Plant
    { sourceId: locByCode['SUP-PKG'], destId: locByCode['PLT-PDX'], leadTimeDays: 1, transitCostPerUnit: '0.02', distanceMiles: 640 },
    { sourceId: locByCode['SUP-PKG'], destId: locByCode['PLT-ATX'], leadTimeDays: 3, transitCostPerUnit: '0.04', distanceMiles: 1480 },
    { sourceId: locByCode['SUP-PKG'], destId: locByCode['PLT-NSH'], leadTimeDays: 3, transitCostPerUnit: '0.04', distanceMiles: 2100 },
    { sourceId: locByCode['SUP-ING'], destId: locByCode['PLT-PDX'], leadTimeDays: 3, transitCostPerUnit: '0.03', distanceMiles: 1730 },
    { sourceId: locByCode['SUP-ING'], destId: locByCode['PLT-ATX'], leadTimeDays: 2, transitCostPerUnit: '0.02', distanceMiles: 940 },
    { sourceId: locByCode['SUP-ING'], destId: locByCode['PLT-NSH'], leadTimeDays: 2, transitCostPerUnit: '0.02', distanceMiles: 670 },
    { sourceId: locByCode['SUP-BTL'], destId: locByCode['PLT-ATX'], leadTimeDays: 2, transitCostPerUnit: '0.05', distanceMiles: 680 },
    { sourceId: locByCode['SUP-BTL'], destId: locByCode['PLT-NSH'], leadTimeDays: 1, transitCostPerUnit: '0.03', distanceMiles: 190 },
    // Plant → DC
    { sourceId: locByCode['PLT-PDX'], destId: locByCode['DC-LAS'], leadTimeDays: 2, transitCostPerUnit: '0.06', distanceMiles: 970 },
    { sourceId: locByCode['PLT-PDX'], destId: locByCode['DC-CHI'], leadTimeDays: 3, transitCostPerUnit: '0.08', distanceMiles: 2100 },
    { sourceId: locByCode['PLT-PDX'], destId: locByCode['DC-ATL'], leadTimeDays: 4, transitCostPerUnit: '0.10', distanceMiles: 2630 },
    { sourceId: locByCode['PLT-ATX'], destId: locByCode['DC-ATL'], leadTimeDays: 2, transitCostPerUnit: '0.05', distanceMiles: 920 },
    { sourceId: locByCode['PLT-ATX'], destId: locByCode['DC-CHI'], leadTimeDays: 2, transitCostPerUnit: '0.06', distanceMiles: 1190 },
    { sourceId: locByCode['PLT-ATX'], destId: locByCode['DC-LAS'], leadTimeDays: 3, transitCostPerUnit: '0.08', distanceMiles: 1220 },
    { sourceId: locByCode['PLT-NSH'], destId: locByCode['DC-ATL'], leadTimeDays: 1, transitCostPerUnit: '0.03', distanceMiles: 250 },
    { sourceId: locByCode['PLT-NSH'], destId: locByCode['DC-CHI'], leadTimeDays: 1, transitCostPerUnit: '0.04', distanceMiles: 470 },
    { sourceId: locByCode['PLT-NSH'], destId: locByCode['DC-LAS'], leadTimeDays: 3, transitCostPerUnit: '0.08', distanceMiles: 1740 },
  ];
  await db.insert(schema.distributionNetwork).values(networkData).returning();
  console.log(`  Network lanes: ${networkData.length} inserted`);

  // ── Planned Transfers ──
  const transferData = [
    { code: 'STO-2026-031', sourceId: locByCode['PLT-NSH'], destId: locByCode['DC-ATL'], status: 'approved', urgency: 'critical', rebalanceScore: 91, transferCost: '1860', riskAvoided: '52400', mode: 'FTL', approvedBy: 'sarah.chen', decidedAt: new Date('2026-03-27') },
    { code: 'STO-2026-030', sourceId: locByCode['PLT-ATX'], destId: locByCode['DC-ATL'], status: 'approved', urgency: 'critical', rebalanceScore: 84, transferCost: '2240', riskAvoided: '38600', mode: 'FTL', approvedBy: 'raj.patel', decidedAt: new Date('2026-03-26') },
    { code: 'STO-2026-029', sourceId: locByCode['PLT-PDX'], destId: locByCode['DC-LAS'], status: 'deferred', urgency: 'review', rebalanceScore: 63, transferCost: '980', riskAvoided: '11200', mode: 'LTL', approvedBy: 'sarah.chen', decidedAt: new Date('2026-03-25') },
    { code: 'STO-2026-028', sourceId: locByCode['PLT-ATX'], destId: locByCode['DC-CHI'], status: 'approved', urgency: 'critical', rebalanceScore: 89, transferCost: '3480', riskAvoided: '61200', mode: 'FTL Consolidated', approvedBy: 'mike.johnson', decidedAt: new Date('2026-03-24') },
    { code: 'STO-2026-027', sourceId: locByCode['PLT-PDX'], destId: locByCode['DC-CHI'], status: 'dismissed', urgency: 'routine', rebalanceScore: 41, transferCost: '3120', riskAvoided: '9400', mode: 'FTL', approvedBy: 'raj.patel', decidedAt: new Date('2026-03-23') },
    { code: 'STO-2026-026', sourceId: locByCode['PLT-NSH'], destId: locByCode['DC-ATL'], status: 'approved', urgency: 'critical', rebalanceScore: 88, transferCost: '1640', riskAvoided: '44800', mode: 'FTL', approvedBy: 'sarah.chen', decidedAt: new Date('2026-03-22') },
    { code: 'STO-2026-025', sourceId: locByCode['PLT-ATX'], destId: locByCode['DC-LAS'], status: 'approved', urgency: 'review', rebalanceScore: 56, transferCost: '4200', riskAvoided: '22800', mode: 'FTL', approvedBy: 'mike.johnson', decidedAt: new Date('2026-03-21') },
    { code: 'STO-2026-024', sourceId: locByCode['PLT-PDX'], destId: locByCode['DC-ATL'], status: 'approved', urgency: 'review', rebalanceScore: 74, transferCost: '2180', riskAvoided: '31600', mode: 'LTL', approvedBy: 'raj.patel', decidedAt: new Date('2026-03-20') },
  ];
  await db.insert(schema.plannedTransfers).values(transferData).onConflictDoNothing().returning();
  console.log(`  Transfers: ${transferData.length} inserted`);

  // ── Demand History (12 weeks for all SKU/DC combos) ──
  // Base weekly demand in cases — realistic for $120M CPG company
  const baseWeeklyDemand = {
    'GRN-BAR': { 'DC-ATL': 180, 'DC-CHI': 220, 'DC-LAS': 140 },
    'PRO-BAR': { 'DC-ATL': 160, 'DC-CHI': 200, 'DC-LAS': 120 },
    'TRL-MIX': { 'DC-ATL': 130, 'DC-CHI': 160, 'DC-LAS': 100 },
    'VEG-CHP': { 'DC-ATL': 110, 'DC-CHI': 140, 'DC-LAS': 90 },
    'RCE-CRK': { 'DC-ATL': 80,  'DC-CHI': 100, 'DC-LAS': 65 },
    'SPK-WAT': { 'DC-ATL': 280, 'DC-CHI': 340, 'DC-LAS': 220 },
    'JCE-APL': { 'DC-ATL': 95,  'DC-CHI': 120, 'DC-LAS': 75 },
    'KMB-GNG': { 'DC-ATL': 70,  'DC-CHI': 90,  'DC-LAS': 55 },
    'NRG-CIT': { 'DC-ATL': 190, 'DC-CHI': 240, 'DC-LAS': 150 },
    'CLD-BRW': { 'DC-ATL': 55,  'DC-CHI': 70,  'DC-LAS': 45 },
    'NUT-BTR': { 'DC-ATL': 100, 'DC-CHI': 130, 'DC-LAS': 80 },
  };

  const demandRows = [];
  const startDate = new Date('2026-01-05'); // 12 weeks back from Mar 28
  for (const [skuCode, locDemand] of Object.entries(baseWeeklyDemand)) {
    for (const [locCode, base] of Object.entries(locDemand)) {
      for (let w = 0; w < 12; w++) {
        const weekStart = new Date(startDate);
        weekStart.setDate(weekStart.getDate() + w * 7);
        // Add +/- 15% noise
        const noise = 1 + (Math.random() * 0.3 - 0.15);
        demandRows.push({
          skuId: skuByCode[skuCode],
          locationId: locByCode[locCode],
          periodStart: weekStart.toISOString().split('T')[0],
          periodType: 'weekly',
          actualQty: String(Math.round(base * noise)),
        });
      }
    }
  }
  await db.insert(schema.demandHistory).values(demandRows).onConflictDoNothing().returning();
  console.log(`  Demand history: ${demandRows.length} rows inserted`);

  console.log('Seed complete!');
  await client.end();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
