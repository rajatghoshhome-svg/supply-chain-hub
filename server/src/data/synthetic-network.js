// ─────────────────────────────────────────────────────────────────────────────
// Peakline Foods — Synthetic Network Data
// Premium natural snacks & beverages · ~$120M revenue
// 3 plants, 3 DCs, 3 suppliers, 11 finished products
// ─────────────────────────────────────────────────────────────────────────────

export const products = [
  { code: 'GRN-BAR', name: 'Oat & Honey Granola Bar', family: 'bars', uom: 'case/24', unitCost: 18, weight: 12, shelfLifeDays: 270 },
  { code: 'PRO-BAR', name: 'Peanut Butter Protein Bar', family: 'bars', uom: 'case/24', unitCost: 22, weight: 14, shelfLifeDays: 270 },
  { code: 'TRL-MIX', name: 'Classic Trail Mix', family: 'snacks', uom: 'case/12', unitCost: 28, weight: 18, shelfLifeDays: 365 },
  { code: 'VEG-CHP', name: 'Sea Salt Veggie Chips', family: 'snacks', uom: 'case/12', unitCost: 24, weight: 10, shelfLifeDays: 240 },
  { code: 'RCE-CRK', name: 'Brown Rice Crackers', family: 'snacks', uom: 'case/12', unitCost: 20, weight: 8, shelfLifeDays: 300 },
  { code: 'SPK-WAT', name: 'Lemon Sparkling Water', family: 'beverages', uom: 'case/24', unitCost: 12, weight: 30, shelfLifeDays: 540 },
  { code: 'JCE-APL', name: 'Cold-Pressed Apple Juice', family: 'beverages', uom: 'case/12', unitCost: 32, weight: 24, shelfLifeDays: 90 },
  { code: 'KMB-GNG', name: 'Ginger Kombucha', family: 'beverages', uom: 'case/12', unitCost: 36, weight: 24, shelfLifeDays: 120 },
  { code: 'NRG-CIT', name: 'Citrus Energy Drink', family: 'beverages', uom: 'case/24', unitCost: 26, weight: 30, shelfLifeDays: 365 },
  { code: 'CLD-BRW', name: 'Vanilla Cold Brew Coffee', family: 'beverages', uom: 'case/12', unitCost: 38, weight: 20, shelfLifeDays: 60 },
  { code: 'NUT-BTR', name: 'Almond Nut Butter', family: 'snacks', uom: 'case/12', unitCost: 34, weight: 16, shelfLifeDays: 365 },
];

export const productFamilies = {
  bars: ['GRN-BAR', 'PRO-BAR'],
  snacks: ['TRL-MIX', 'VEG-CHP', 'RCE-CRK', 'NUT-BTR'],
  beverages: ['SPK-WAT', 'JCE-APL', 'KMB-GNG', 'NRG-CIT', 'CLD-BRW'],
};

export const plants = [
  { code: 'PLT-PDX', name: 'Portland Plant', city: 'Portland', state: 'OR', lat: 45.52, lon: -122.68, specialization: 'Bars & dry snacks' },
  { code: 'PLT-ATX', name: 'Austin Plant', city: 'Austin', state: 'TX', lat: 30.27, lon: -97.74, specialization: 'Beverages' },
  { code: 'PLT-NSH', name: 'Nashville Plant', city: 'Nashville', state: 'TN', lat: 36.16, lon: -86.78, specialization: 'Specialty & nut butters' },
];

export const distributionCenters = [
  { code: 'DC-ATL', name: 'Atlanta DC', city: 'Atlanta', state: 'GA', lat: 33.75, lon: -84.39 },
  { code: 'DC-CHI', name: 'Chicago DC', city: 'Chicago', state: 'IL', lat: 41.88, lon: -87.63 },
  { code: 'DC-LAS', name: 'Las Vegas DC', city: 'Las Vegas', state: 'NV', lat: 36.17, lon: -115.14 },
];

export const suppliers = [
  { code: 'SUP-PKG', name: 'Pacific Packaging', city: 'Fresno', state: 'CA', materials: 'Packaging film, cartons, labels' },
  { code: 'SUP-ING', name: 'Heartland Ingredients', city: 'Des Moines', state: 'IA', materials: 'Oats, nuts, cocoa, sugar, flour' },
  { code: 'SUP-BTL', name: 'SouthGlass Bottles', city: 'Birmingham', state: 'AL', materials: 'Glass bottles, aluminum cans, caps' },
];

// Which plants produce which products
export const plantProductSourcing = {
  'PLT-PDX': ['GRN-BAR', 'PRO-BAR', 'TRL-MIX', 'VEG-CHP', 'RCE-CRK'],
  'PLT-ATX': ['SPK-WAT', 'JCE-APL', 'KMB-GNG', 'NRG-CIT', 'CLD-BRW'],
  'PLT-NSH': ['NUT-BTR', 'TRL-MIX', 'PRO-BAR'],  // dual-sourced items
};

// Work centers by plant
export const workCenters = [
  // PLT-PDX (Portland — Bars & Snacks)
  { code: 'WC-P-MIXING', name: 'Dry Mixing Line', plant: 'PLT-PDX', capacityHrsPerPeriod: 160 },
  { code: 'WC-P-BAKING', name: 'Baking/Forming Ovens', plant: 'PLT-PDX', capacityHrsPerPeriod: 140 },
  { code: 'WC-P-PACKING', name: 'Packaging & Case Packing', plant: 'PLT-PDX', capacityHrsPerPeriod: 180 },
  { code: 'WC-P-QC', name: 'Quality Control & Testing', plant: 'PLT-PDX', capacityHrsPerPeriod: 80 },
  // PLT-ATX (Austin — Beverages)
  { code: 'WC-A-BLENDING', name: 'Liquid Blending', plant: 'PLT-ATX', capacityHrsPerPeriod: 180 },
  { code: 'WC-A-FILLING', name: 'Bottle/Can Filling Line', plant: 'PLT-ATX', capacityHrsPerPeriod: 160 },
  { code: 'WC-A-PASTEUR', name: 'Pasteurization', plant: 'PLT-ATX', capacityHrsPerPeriod: 120 },
  { code: 'WC-A-PACKING', name: 'Case Packing', plant: 'PLT-ATX', capacityHrsPerPeriod: 180 },
  // PLT-NSH (Nashville — Specialty)
  { code: 'WC-N-ROASTING', name: 'Nut Roasting', plant: 'PLT-NSH', capacityHrsPerPeriod: 100 },
  { code: 'WC-N-GRINDING', name: 'Grinding & Milling', plant: 'PLT-NSH', capacityHrsPerPeriod: 120 },
  { code: 'WC-N-BLENDING', name: 'Blending & Mixing', plant: 'PLT-NSH', capacityHrsPerPeriod: 140 },
  { code: 'WC-N-PACKING', name: 'Packaging', plant: 'PLT-NSH', capacityHrsPerPeriod: 160 },
];

// Network lanes with lead times and per-lb costs
export const lanes = [
  // Supplier → Plant
  { from: 'SUP-PKG', to: 'PLT-PDX', leadTimeDays: 1, costPerLb: 0.02 },
  { from: 'SUP-PKG', to: 'PLT-ATX', leadTimeDays: 3, costPerLb: 0.04 },
  { from: 'SUP-PKG', to: 'PLT-NSH', leadTimeDays: 3, costPerLb: 0.04 },
  { from: 'SUP-ING', to: 'PLT-PDX', leadTimeDays: 3, costPerLb: 0.03 },
  { from: 'SUP-ING', to: 'PLT-ATX', leadTimeDays: 2, costPerLb: 0.02 },
  { from: 'SUP-ING', to: 'PLT-NSH', leadTimeDays: 2, costPerLb: 0.02 },
  { from: 'SUP-BTL', to: 'PLT-ATX', leadTimeDays: 2, costPerLb: 0.05 },
  { from: 'SUP-BTL', to: 'PLT-NSH', leadTimeDays: 1, costPerLb: 0.03 },
  // Plant → DC
  { from: 'PLT-PDX', to: 'DC-LAS', leadTimeDays: 2, costPerLb: 0.06 },
  { from: 'PLT-PDX', to: 'DC-CHI', leadTimeDays: 3, costPerLb: 0.08 },
  { from: 'PLT-PDX', to: 'DC-ATL', leadTimeDays: 4, costPerLb: 0.10 },
  { from: 'PLT-ATX', to: 'DC-ATL', leadTimeDays: 2, costPerLb: 0.05 },
  { from: 'PLT-ATX', to: 'DC-CHI', leadTimeDays: 2, costPerLb: 0.06 },
  { from: 'PLT-ATX', to: 'DC-LAS', leadTimeDays: 3, costPerLb: 0.08 },
  { from: 'PLT-NSH', to: 'DC-ATL', leadTimeDays: 1, costPerLb: 0.03 },
  { from: 'PLT-NSH', to: 'DC-CHI', leadTimeDays: 1, costPerLb: 0.04 },
  { from: 'PLT-NSH', to: 'DC-LAS', leadTimeDays: 3, costPerLb: 0.08 },
];

// DC inventory: on-hand and safety stock per SKU per DC
export const dcInventory = {
  'DC-ATL': {
    'GRN-BAR': { onHand: 180, safetyStock: 200 },
    'PRO-BAR': { onHand: 120, safetyStock: 180 },
    'TRL-MIX': { onHand: 95, safetyStock: 150 },
    'VEG-CHP': { onHand: 140, safetyStock: 120 },
    'RCE-CRK': { onHand: 85, safetyStock: 100 },
    'SPK-WAT': { onHand: 220, safetyStock: 300 },
    'JCE-APL': { onHand: 65, safetyStock: 100 },
    'KMB-GNG': { onHand: 70, safetyStock: 80 },
    'NRG-CIT': { onHand: 160, safetyStock: 200 },
    'CLD-BRW': { onHand: 45, safetyStock: 60 },
    'NUT-BTR': { onHand: 110, safetyStock: 120 },
  },
  'DC-CHI': {
    'GRN-BAR': { onHand: 820, safetyStock: 200 },
    'PRO-BAR': { onHand: 680, safetyStock: 180 },
    'TRL-MIX': { onHand: 540, safetyStock: 150 },
    'VEG-CHP': { onHand: 480, safetyStock: 120 },
    'RCE-CRK': { onHand: 390, safetyStock: 100 },
    'SPK-WAT': { onHand: 1240, safetyStock: 300 },
    'JCE-APL': { onHand: 310, safetyStock: 100 },
    'KMB-GNG': { onHand: 260, safetyStock: 80 },
    'NRG-CIT': { onHand: 720, safetyStock: 200 },
    'CLD-BRW': { onHand: 190, safetyStock: 60 },
    'NUT-BTR': { onHand: 420, safetyStock: 120 },
  },
  'DC-LAS': {
    'GRN-BAR': { onHand: 340, safetyStock: 200 },
    'PRO-BAR': { onHand: 280, safetyStock: 180 },
    'TRL-MIX': { onHand: 220, safetyStock: 150 },
    'VEG-CHP': { onHand: 260, safetyStock: 120 },
    'RCE-CRK': { onHand: 170, safetyStock: 100 },
    'SPK-WAT': { onHand: 580, safetyStock: 300 },
    'JCE-APL': { onHand: 140, safetyStock: 100 },
    'KMB-GNG': { onHand: 120, safetyStock: 80 },
    'NRG-CIT': { onHand: 380, safetyStock: 200 },
    'CLD-BRW': { onHand: 80, safetyStock: 60 },
    'NUT-BTR': { onHand: 200, safetyStock: 120 },
  },
};

// Plant finished goods inventory
export const plantInventory = {
  'PLT-PDX': {
    'GRN-BAR': { onHand: 1200 },
    'PRO-BAR': { onHand: 900 },
    'TRL-MIX': { onHand: 650 },
    'VEG-CHP': { onHand: 780 },
    'RCE-CRK': { onHand: 520 },
  },
  'PLT-ATX': {
    'SPK-WAT': { onHand: 2400 },
    'JCE-APL': { onHand: 480 },
    'KMB-GNG': { onHand: 360 },
    'NRG-CIT': { onHand: 1600 },
    'CLD-BRW': { onHand: 280 },
  },
  'PLT-NSH': {
    'NUT-BTR': { onHand: 620 },
    'TRL-MIX': { onHand: 340 },
    'PRO-BAR': { onHand: 440 },
  },
};

// DC demand forecasts: 8 weekly periods with seasonality
// Beverages peak spring/summer; bars/snacks peak fall/winter
// Current period is late March (spring ramp for beverages)
export const dcDemandForecast = {
  'DC-ATL': {
    'GRN-BAR': [175, 170, 165, 160, 155, 150, 148, 145],
    'PRO-BAR': [158, 155, 150, 148, 142, 140, 138, 135],
    'TRL-MIX': [125, 122, 118, 115, 112, 110, 108, 105],
    'VEG-CHP': [108, 110, 112, 115, 118, 120, 122, 125],
    'RCE-CRK': [78, 76, 74, 72, 70, 68, 66, 65],
    'SPK-WAT': [290, 310, 330, 350, 370, 390, 410, 430],
    'JCE-APL': [98, 105, 112, 118, 125, 130, 135, 140],
    'KMB-GNG': [72, 78, 82, 88, 92, 96, 100, 104],
    'NRG-CIT': [195, 210, 225, 240, 255, 268, 280, 290],
    'CLD-BRW': [58, 62, 66, 70, 74, 78, 82, 85],
    'NUT-BTR': [98, 95, 92, 90, 88, 86, 85, 84],
  },
  'DC-CHI': {
    'GRN-BAR': [215, 210, 205, 200, 195, 190, 185, 180],
    'PRO-BAR': [195, 190, 185, 180, 175, 170, 168, 165],
    'TRL-MIX': [155, 150, 148, 145, 140, 138, 135, 132],
    'VEG-CHP': [138, 140, 142, 145, 148, 150, 152, 155],
    'RCE-CRK': [98, 95, 92, 90, 88, 86, 84, 82],
    'SPK-WAT': [350, 375, 400, 425, 450, 475, 495, 520],
    'JCE-APL': [125, 132, 140, 148, 155, 162, 168, 175],
    'KMB-GNG': [92, 98, 105, 112, 118, 124, 128, 132],
    'NRG-CIT': [245, 260, 278, 295, 312, 328, 342, 355],
    'CLD-BRW': [72, 78, 82, 88, 92, 96, 100, 104],
    'NUT-BTR': [128, 125, 120, 118, 115, 112, 110, 108],
  },
  'DC-LAS': {
    'GRN-BAR': [138, 135, 130, 128, 125, 122, 120, 118],
    'PRO-BAR': [118, 115, 112, 110, 108, 105, 102, 100],
    'TRL-MIX': [98, 95, 92, 90, 88, 86, 84, 82],
    'VEG-CHP': [88, 90, 92, 95, 98, 100, 102, 105],
    'RCE-CRK': [64, 62, 60, 58, 56, 55, 54, 52],
    'SPK-WAT': [228, 245, 262, 280, 298, 315, 330, 345],
    'JCE-APL': [78, 82, 88, 92, 98, 102, 108, 112],
    'KMB-GNG': [58, 62, 66, 70, 74, 78, 82, 85],
    'NRG-CIT': [155, 165, 178, 190, 202, 212, 222, 230],
    'CLD-BRW': [48, 52, 55, 58, 62, 65, 68, 70],
    'NUT-BTR': [78, 76, 74, 72, 70, 68, 66, 65],
  },
};
