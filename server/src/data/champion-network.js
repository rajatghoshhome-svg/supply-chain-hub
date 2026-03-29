// ─────────────────────────────────────────────────────────────────────────────
// Champion Pet Foods — Network: Plants, DCs, Customers, Lanes
//
// 2 Plants:  DogStar Kitchens (Auburn KY), NorthStar Kitchen (Acheson AB)
// 3 DCs:     Atlanta DC, Denver DC, Toronto DC
// 5 Customers: Petco, Chewy, PetSmart, Independent Pet Stores, Amazon
// ─────────────────────────────────────────────────────────────────────────────

export const plants = [
  {
    code: 'PLT-DOGSTAR',
    name: 'DogStar Kitchens',
    city: 'Auburn',
    state: 'KY',
    country: 'US',
    lat: 38.90,
    lon: -85.00,
    specialization: 'Dry kibble, freeze-dried, treats',
    capacityTonsPerWeek: 450,
    notes: 'Primary US plant. Produces all ORIJEN and ACANA dry, FD, and treat products for US market.',
  },
  {
    code: 'PLT-NORTHSTAR',
    name: 'NorthStar Kitchen',
    city: 'Acheson',
    state: 'AB',
    country: 'CA',
    lat: 53.54,
    lon: -113.77,
    specialization: 'Dry kibble, wet canned',
    capacityTonsPerWeek: 320,
    notes: 'Canadian plant. Produces all wet dog food, plus overflow dry for Canadian market.',
  },
];

export const distributionCenters = [
  {
    code: 'DC-ATL',
    name: 'Atlanta DC',
    city: 'Atlanta',
    state: 'GA',
    country: 'US',
    lat: 33.75,
    lon: -84.39,
    capacityPallets: 18000,
    primaryRegion: 'Southeast + East Coast',
  },
  {
    code: 'DC-DEN',
    name: 'Denver DC',
    city: 'Denver',
    state: 'CO',
    country: 'US',
    lat: 39.74,
    lon: -104.99,
    capacityPallets: 14000,
    primaryRegion: 'Mountain + West Coast',
  },
  {
    code: 'DC-TOR',
    name: 'Toronto DC',
    city: 'Mississauga',
    state: 'ON',
    country: 'CA',
    lat: 43.59,
    lon: -79.64,
    capacityPallets: 10000,
    primaryRegion: 'Canada',
  },
];

export const customers = [
  { id: 'PETCO',   name: 'Petco',                  channel: 'specialty-retail', color: '#003DA5', mixPct: 0.30 },
  { id: 'CHEWY',   name: 'Chewy',                  channel: 'ecommerce',       color: '#E55525', mixPct: 0.25 },
  { id: 'PETSMT',  name: 'PetSmart',               channel: 'specialty-retail', color: '#E2001A', mixPct: 0.20 },
  { id: 'INDIE',   name: 'Independent Pet Stores',  channel: 'independent',     color: '#6B7280', mixPct: 0.15 },
  { id: 'AMAZON',  name: 'Amazon',                  channel: 'ecommerce',       color: '#FF9900', mixPct: 0.10 },
];

// ── Transportation lanes ──
// Plant → DC lead times in days, enriched with DRP master data
export const lanes = [
  // DogStar → DCs
  { from: 'PLT-DOGSTAR',   to: 'DC-ATL', leadTimeDays: 2, costPerLb: 0.08, mode: 'TL', distanceMiles: 180,  truckCostPerMile: 2.85, railCostPerMile: null,  hasRailAccess: false, maxWeightLbs: 40000, maxPallets: 22, recommendedTransitType: 'truck' },
  { from: 'PLT-DOGSTAR',   to: 'DC-DEN', leadTimeDays: 4, costPerLb: 0.12, mode: 'TL', distanceMiles: 1580, truckCostPerMile: 2.85, railCostPerMile: 1.20, hasRailAccess: true,  maxWeightLbs: 40000, maxPallets: 22, recommendedTransitType: 'rail' },
  { from: 'PLT-DOGSTAR',   to: 'DC-TOR', leadTimeDays: 3, costPerLb: 0.15, mode: 'TL', distanceMiles: 620,  truckCostPerMile: 3.10, railCostPerMile: null,  hasRailAccess: false, maxWeightLbs: 40000, maxPallets: 22, recommendedTransitType: 'truck' },
  // NorthStar → DCs
  { from: 'PLT-NORTHSTAR', to: 'DC-TOR', leadTimeDays: 2, costPerLb: 0.07, mode: 'TL', distanceMiles: 2130, truckCostPerMile: 3.10, railCostPerMile: 1.15, hasRailAccess: true,  maxWeightLbs: 40000, maxPallets: 22, recommendedTransitType: 'rail' },
  { from: 'PLT-NORTHSTAR', to: 'DC-DEN', leadTimeDays: 3, costPerLb: 0.11, mode: 'TL', distanceMiles: 1650, truckCostPerMile: 2.85, railCostPerMile: 1.20, hasRailAccess: true,  maxWeightLbs: 40000, maxPallets: 22, recommendedTransitType: 'rail' },
  { from: 'PLT-NORTHSTAR', to: 'DC-ATL', leadTimeDays: 5, costPerLb: 0.16, mode: 'TL', distanceMiles: 2400, truckCostPerMile: 2.85, railCostPerMile: 1.15, hasRailAccess: true,  maxWeightLbs: 40000, maxPallets: 22, recommendedTransitType: 'rail' },
  // DC-to-DC lanes (Stock Transfer Orders)
  { from: 'DC-ATL', to: 'DC-DEN', leadTimeDays: 3, costPerLb: 0.10, mode: 'STO', distanceMiles: 1400, truckCostPerMile: 2.85, railCostPerMile: null, hasRailAccess: false, maxWeightLbs: 40000, maxPallets: 22, recommendedTransitType: 'STO' },
  { from: 'DC-DEN', to: 'DC-ATL', leadTimeDays: 3, costPerLb: 0.10, mode: 'STO', distanceMiles: 1400, truckCostPerMile: 2.85, railCostPerMile: null, hasRailAccess: false, maxWeightLbs: 40000, maxPallets: 22, recommendedTransitType: 'STO' },
  { from: 'DC-ATL', to: 'DC-TOR', leadTimeDays: 2, costPerLb: 0.09, mode: 'STO', distanceMiles: 900,  truckCostPerMile: 3.10, railCostPerMile: null, hasRailAccess: false, maxWeightLbs: 40000, maxPallets: 22, recommendedTransitType: 'STO' },
  { from: 'DC-TOR', to: 'DC-ATL', leadTimeDays: 2, costPerLb: 0.09, mode: 'STO', distanceMiles: 900,  truckCostPerMile: 3.10, railCostPerMile: null, hasRailAccess: false, maxWeightLbs: 40000, maxPallets: 22, recommendedTransitType: 'STO' },
  { from: 'DC-DEN', to: 'DC-TOR', leadTimeDays: 4, costPerLb: 0.13, mode: 'STO', distanceMiles: 2100, truckCostPerMile: 3.10, railCostPerMile: null, hasRailAccess: false, maxWeightLbs: 40000, maxPallets: 22, recommendedTransitType: 'STO' },
  { from: 'DC-TOR', to: 'DC-DEN', leadTimeDays: 4, costPerLb: 0.13, mode: 'STO', distanceMiles: 2100, truckCostPerMile: 3.10, railCostPerMile: null, hasRailAccess: false, maxWeightLbs: 40000, maxPallets: 22, recommendedTransitType: 'STO' },
];

// ── Shipping calendars ──
// Ship days: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
export const shippingCalendars = {
  'PLT-DOGSTAR|DC-ATL':   { shipDays: [1, 3, 5], frequency: '3x/week', transitDays: 2 },
  'PLT-DOGSTAR|DC-DEN':   { shipDays: [2, 4],    frequency: '2x/week', transitDays: 4 },
  'PLT-DOGSTAR|DC-TOR':   { shipDays: [1, 4],    frequency: '2x/week', transitDays: 3 },
  'PLT-NORTHSTAR|DC-TOR': { shipDays: [1, 3, 5], frequency: '3x/week', transitDays: 2 },
  'PLT-NORTHSTAR|DC-DEN': { shipDays: [2, 5],    frequency: '2x/week', transitDays: 3 },
  'PLT-NORTHSTAR|DC-ATL': { shipDays: [3],       frequency: '1x/week', transitDays: 5 },
};

// Day-of-week names for calendar display
export const DAY_NAMES = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ── Plant product sourcing ──
// Which plant makes which product families
export const plantProductSourcing = {
  'PLT-DOGSTAR': {
    primary: ['ORI-DOG-DRY', 'ORI-CAT-DRY', 'ORI-FD', 'ORI-TREAT', 'ACA-DOG-DRY', 'ACA-CAT-DRY'],
    overflow: [],
    notes: 'All US dry, freeze-dried, and treat production',
  },
  'PLT-NORTHSTAR': {
    primary: ['ACA-WET-DOG'],
    overflow: ['ORI-DOG-DRY', 'ACA-DOG-DRY'],
    notes: 'All wet production. Overflow dry for Canadian market.',
  },
};

// ── DC customer allocation ──
// Which DCs serve which customers (by % of volume)
export const dcCustomerAllocation = {
  'DC-ATL': { PETCO: 0.45, CHEWY: 0.30, PETSMT: 0.40, INDIE: 0.35, AMAZON: 0.25 },
  'DC-DEN': { PETCO: 0.40, CHEWY: 0.45, PETSMT: 0.35, INDIE: 0.30, AMAZON: 0.55 },
  'DC-TOR': { PETCO: 0.15, CHEWY: 0.25, PETSMT: 0.25, INDIE: 0.35, AMAZON: 0.20 },
};

// ── Work centers per plant ──
export const workCenters = [
  // DogStar Kitchens — 4 extruders, 1 coating, 1 freeze-dry, 3 packaging = 9 WCs
  { code: 'WC-DS-EXT1', plant: 'PLT-DOGSTAR', name: 'Extruder 1', capacityHrsPerPeriod: 120, type: 'extrusion', stage: 'extrusion' },
  { code: 'WC-DS-EXT2', plant: 'PLT-DOGSTAR', name: 'Extruder 2', capacityHrsPerPeriod: 120, type: 'extrusion', stage: 'extrusion' },
  { code: 'WC-DS-EXT3', plant: 'PLT-DOGSTAR', name: 'Extruder 3', capacityHrsPerPeriod: 100, type: 'extrusion', stage: 'extrusion' },
  { code: 'WC-DS-EXT4', plant: 'PLT-DOGSTAR', name: 'Extruder 4', capacityHrsPerPeriod: 80,  type: 'extrusion', stage: 'extrusion' },
  { code: 'WC-DS-COAT', plant: 'PLT-DOGSTAR', name: 'Coating & Enrobing', capacityHrsPerPeriod: 80, type: 'coating', stage: 'intermediate' },
  { code: 'WC-DS-FD',   plant: 'PLT-DOGSTAR', name: 'Freeze-Dry Chamber', capacityHrsPerPeriod: 60, type: 'freeze-dry', stage: 'intermediate' },
  { code: 'WC-DS-PKG1', plant: 'PLT-DOGSTAR', name: 'Packaging Line 1', capacityHrsPerPeriod: 100, type: 'packaging', stage: 'packaging' },
  { code: 'WC-DS-PKG2', plant: 'PLT-DOGSTAR', name: 'Packaging Line 2', capacityHrsPerPeriod: 80,  type: 'packaging', stage: 'packaging' },
  { code: 'WC-DS-PKG3', plant: 'PLT-DOGSTAR', name: 'Packaging Line 3', capacityHrsPerPeriod: 80,  type: 'packaging', stage: 'packaging' },
  // NorthStar Kitchen — 2 extruders, 1 retort, 2 packaging = 5 WCs
  { code: 'WC-NS-EXT1',   plant: 'PLT-NORTHSTAR', name: 'Extruder 1', capacityHrsPerPeriod: 100, type: 'extrusion', stage: 'extrusion' },
  { code: 'WC-NS-EXT2',   plant: 'PLT-NORTHSTAR', name: 'Extruder 2', capacityHrsPerPeriod: 80,  type: 'extrusion', stage: 'extrusion' },
  { code: 'WC-NS-RETORT', plant: 'PLT-NORTHSTAR', name: 'Retort (Wet Line)', capacityHrsPerPeriod: 80, type: 'retort', stage: 'extrusion' },
  { code: 'WC-NS-PKG1',   plant: 'PLT-NORTHSTAR', name: 'Packaging Line 1', capacityHrsPerPeriod: 80, type: 'packaging', stage: 'packaging' },
  { code: 'WC-NS-PKG2',   plant: 'PLT-NORTHSTAR', name: 'Packaging Line 2', capacityHrsPerPeriod: 60, type: 'packaging', stage: 'packaging' },
];

// ── Unified network locations (for map/dashboard views) ──
export function getNetworkLocations() {
  const locs = [];
  for (const p of plants) {
    locs.push({
      code: p.code, name: p.name, type: 'plant',
      city: p.city, state: p.state, country: p.country,
      lat: p.lat, lng: p.lon,
      specialization: p.specialization,
    });
  }
  for (const dc of distributionCenters) {
    locs.push({
      code: dc.code, name: dc.name, type: 'dc',
      city: dc.city, state: dc.state, country: dc.country,
      lat: dc.lat, lng: dc.lon,
      primaryRegion: dc.primaryRegion,
    });
  }
  for (const c of customers) {
    locs.push({
      code: c.id, name: c.name, type: 'customer',
      channel: c.channel, color: c.color,
    });
  }
  return locs;
}

// ── Production routes by format ──
// Defines the stage sequence for each product format
export const productionRoutes = {
  'dry':          ['extrusion', 'coating', 'packaging'],
  'wet':          ['retort', 'packaging'],
  'freeze-dried': ['extrusion', 'freeze-dry', 'packaging'],
  'treat':        ['extrusion', 'packaging'],
};

// ── Default changeover matrix rules ──
// Hours needed to switch between product families on a work center
export const defaultChangeoverRules = {
  sameFamily: 0,                // Same product family → no changeover
  sameBrandDiffFamily: 0.5,     // Same brand (ORIJEN→ORIJEN or ACANA→ACANA) different family
  diffBrandSameFormat: 1.0,     // Different brand, same format (e.g. ORI dry → ACA dry)
  diffFormat: 2.0,              // Different format entirely (e.g. dry → wet)
};

// ── Brand color mapping for Gantt chart ──
export const brandColors = {
  'ORIJEN': '#C8102E',
  'ACANA': '#00563F',
};

// Helper: get brand from familyId
export function getBrandFromFamily(familyId) {
  return familyId.startsWith('ORI') ? 'ORIJEN' : 'ACANA';
}

// Helper: get format from familyId
export function getFormatFromFamily(familyId) {
  const map = {
    'ORI-DOG-DRY': 'dry', 'ORI-CAT-DRY': 'dry', 'ACA-DOG-DRY': 'dry', 'ACA-CAT-DRY': 'dry',
    'ORI-FD': 'freeze-dried', 'ORI-TREAT': 'treat',
    'ACA-WET-DOG': 'wet', 'ACA-WET-CAT': 'wet', 'ACA-SINGLES': 'dry',
  };
  return map[familyId] || 'dry';
}
