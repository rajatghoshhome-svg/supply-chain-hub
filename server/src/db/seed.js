import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client, { schema });

async function seed() {
  console.log('Seeding database...');

  // ── Locations (from dcs.js) ──
  const locationData = [
    { code: 'MEM', name: 'Memphis DC', type: 'dc', city: 'Memphis', state: 'TN', lat: '35.150000', lng: '-90.050000', status: 'source', statusLabel: 'Transfer Hub', color: '#2E7D32' },
    { code: 'ATL', name: 'Atlanta DC', type: 'dc', city: 'Atlanta', state: 'GA', lat: '33.750000', lng: '-84.390000', status: 'crisis', statusLabel: 'Critical — 2.7 days', color: '#B03A2E' },
    { code: 'CLT', name: 'Charlotte DC', type: 'dc', city: 'Charlotte', state: 'NC', lat: '35.230000', lng: '-80.840000', status: 'review', statusLabel: 'Review — 9.5 days', color: '#D4A017' },
    { code: 'CHI', name: 'Chicago DC', type: 'dc', city: 'Chicago', state: 'IL', lat: '41.880000', lng: '-87.630000', status: 'stable', statusLabel: 'Stable — 17 days', color: '#999' },
    { code: 'LAX', name: 'Los Angeles DC', type: 'dc', city: 'Los Angeles', state: 'CA', lat: '34.050000', lng: '-118.240000', status: 'overstock', statusLabel: 'Overstock — 80 days', color: '#D4A017' },
    { code: 'DFW', name: 'Dallas DC', type: 'dc', city: 'Dallas', state: 'TX', lat: '32.780000', lng: '-96.800000', status: 'stable', statusLabel: 'Stable — 23 days', color: '#999' },
  ];
  const insertedLocations = await db.insert(schema.locations).values(locationData).onConflictDoNothing().returning();
  console.log(`  Locations: ${insertedLocations.length} inserted`);

  // Build location ID lookup
  const allLocations = await db.select().from(schema.locations);
  const locByCode = Object.fromEntries(allLocations.map(l => [l.code, l.id]));

  // ── SKUs ──
  const skuData = [
    { code: 'DNTX-LG', name: 'Dentastix Large', productFamily: 'Dental Treats', uom: 'units' },
    { code: 'DNTX-SM', name: 'Dentastix Small', productFamily: 'Dental Treats', uom: 'units' },
    { code: 'GRN-MD', name: 'Greenies Medium', productFamily: 'Dental Treats', uom: 'units' },
    { code: 'CSR-SFT', name: 'Cesar Softies', productFamily: 'Soft Treats', uom: 'units' },
  ];
  const insertedSkus = await db.insert(schema.skus).values(skuData).onConflictDoNothing().returning();
  console.log(`  SKUs: ${insertedSkus.length} inserted`);

  const allSkus = await db.select().from(schema.skus);
  const skuByCode = Object.fromEntries(allSkus.map(s => [s.code, s.id]));

  // ── Customers ──
  const customerData = [
    { code: 'WALMART', name: 'Walmart', color: '#0071CE' },
    { code: 'PETSMART', name: 'PetSmart', color: '#E31837' },
    { code: 'CHEWY', name: 'Chewy', color: '#E86C00' },
    { code: 'AMAZON', name: 'Amazon', color: '#D4A017' },
    { code: 'OTHER', name: 'Other', color: '#999' },
  ];
  const insertedCustomers = await db.insert(schema.customers).values(customerData).onConflictDoNothing().returning();
  console.log(`  Customers: ${insertedCustomers.length} inserted`);

  // ── Inventory Records (from DCS available/daysSupply/fillRate) ──
  const today = new Date().toISOString().split('T')[0];
  const inventoryData = [
    { skuId: skuByCode['DNTX-LG'], locationId: locByCode['MEM'], onHand: '16200', safetyStock: '2000', reorderPoint: '5000', snapshotDate: today },
    { skuId: skuByCode['DNTX-LG'], locationId: locByCode['ATL'], onHand: '1520', safetyStock: '2000', reorderPoint: '3000', snapshotDate: today },
    { skuId: skuByCode['GRN-MD'], locationId: locByCode['CLT'], onHand: '1820', safetyStock: '1500', reorderPoint: '2500', snapshotDate: today },
    { skuId: skuByCode['DNTX-LG'], locationId: locByCode['CHI'], onHand: '5900', safetyStock: '2000', reorderPoint: '3500', snapshotDate: today },
    { skuId: skuByCode['CSR-SFT'], locationId: locByCode['LAX'], onHand: '8120', safetyStock: '1500', reorderPoint: '2500', snapshotDate: today },
    { skuId: skuByCode['DNTX-LG'], locationId: locByCode['DFW'], onHand: '6360', safetyStock: '2000', reorderPoint: '3500', snapshotDate: today },
  ];
  await db.insert(schema.inventoryRecords).values(inventoryData).returning();
  console.log(`  Inventory records: ${inventoryData.length} inserted`);

  // ── Distribution Network (lanes between DCs) ──
  const networkData = [
    { sourceId: locByCode['MEM'], destId: locByCode['ATL'], leadTimeDays: 1, transitCostPerUnit: '2.10', distanceMiles: 390 },
    { sourceId: locByCode['MEM'], destId: locByCode['CLT'], leadTimeDays: 2, transitCostPerUnit: '2.50', distanceMiles: 630 },
    { sourceId: locByCode['MEM'], destId: locByCode['CHI'], leadTimeDays: 1, transitCostPerUnit: '2.30', distanceMiles: 530 },
    { sourceId: locByCode['MEM'], destId: locByCode['DFW'], leadTimeDays: 1, transitCostPerUnit: '2.20', distanceMiles: 450 },
    { sourceId: locByCode['CHI'], destId: locByCode['CLT'], leadTimeDays: 2, transitCostPerUnit: '3.10', distanceMiles: 760 },
    { sourceId: locByCode['LAX'], destId: locByCode['CHI'], leadTimeDays: 3, transitCostPerUnit: '4.20', distanceMiles: 2020 },
    { sourceId: locByCode['LAX'], destId: locByCode['DFW'], leadTimeDays: 2, transitCostPerUnit: '3.50', distanceMiles: 1430 },
    { sourceId: locByCode['DFW'], destId: locByCode['ATL'], leadTimeDays: 2, transitCostPerUnit: '2.80', distanceMiles: 780 },
  ];
  await db.insert(schema.distributionNetwork).values(networkData).returning();
  console.log(`  Network lanes: ${networkData.length} inserted`);

  // ── Planned Transfers (from log.js) ──
  const transferData = [
    { code: 'STO-2024-031', sourceId: locByCode['MEM'], destId: locByCode['ATL'], status: 'approved', urgency: 'critical', rebalanceScore: 92, transferCost: '2840', riskAvoided: '74200', mode: 'FTL', approvedBy: 'sarah.chen', decidedAt: new Date('2024-11-03') },
    { code: 'STO-2024-030', sourceId: locByCode['MEM'], destId: locByCode['CLT'], status: 'approved', urgency: 'review', rebalanceScore: 78, transferCost: '1980', riskAvoided: '31200', mode: 'FTL', approvedBy: 'raj.patel', decidedAt: new Date('2024-11-02') },
    { code: 'STO-2024-029', sourceId: locByCode['MEM'], destId: locByCode['ATL'], status: 'deferred', urgency: 'review', rebalanceScore: 61, transferCost: '1240', riskAvoided: '9900', mode: 'LTL', approvedBy: 'sarah.chen', decidedAt: new Date('2024-11-01') },
    { code: 'STO-2024-028', sourceId: locByCode['CHI'], destId: locByCode['CLT'], status: 'approved', urgency: 'critical', rebalanceScore: 88, transferCost: '3120', riskAvoided: '52400', mode: 'FTL Consolidated', approvedBy: 'mike.johnson', decidedAt: new Date('2024-10-31') },
    { code: 'STO-2024-027', sourceId: locByCode['MEM'], destId: locByCode['DFW'], status: 'dismissed', urgency: 'routine', rebalanceScore: 38, transferCost: '2650', riskAvoided: '8200', mode: 'FTL', approvedBy: 'raj.patel', decidedAt: new Date('2024-10-30') },
    { code: 'STO-2024-026', sourceId: locByCode['MEM'], destId: locByCode['ATL'], status: 'approved', urgency: 'critical', rebalanceScore: 89, transferCost: '1820', riskAvoided: '44800', mode: 'FTL', approvedBy: 'sarah.chen', decidedAt: new Date('2024-10-29') },
    { code: 'STO-2024-025', sourceId: locByCode['LAX'], destId: locByCode['CHI'], status: 'approved', urgency: 'review', rebalanceScore: 52, transferCost: '7800', riskAvoided: '18600', mode: 'FTL', approvedBy: 'mike.johnson', decidedAt: new Date('2024-10-28') },
    { code: 'STO-2024-024', sourceId: locByCode['MEM'], destId: locByCode['CLT'], status: 'approved', urgency: 'review', rebalanceScore: 71, transferCost: '1640', riskAvoided: '28400', mode: 'LTL', approvedBy: 'raj.patel', decidedAt: new Date('2024-10-27') },
  ];
  await db.insert(schema.plannedTransfers).values(transferData).onConflictDoNothing().returning();
  console.log(`  Transfers: ${transferData.length} inserted`);

  // ── Synthetic Demand History (12 weeks for all SKU/location combos) ──
  const baseWeeklyDemand = {
    'DNTX-LG': { MEM: 420, ATL: 560, CLT: 190, CHI: 340, LAX: 100, DFW: 275 },
    'DNTX-SM': { MEM: 180, ATL: 240, CLT: 95, CHI: 150, LAX: 60, DFW: 120 },
    'GRN-MD':  { MEM: 210, ATL: 310, CLT: 200, CHI: 180, LAX: 80, DFW: 150 },
    'CSR-SFT': { MEM: 140, ATL: 170, CLT: 80, CHI: 260, LAX: 410, DFW: 190 },
  };

  const demandRows = [];
  const startDate = new Date('2024-08-12'); // 12 weeks back from Nov 3
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
