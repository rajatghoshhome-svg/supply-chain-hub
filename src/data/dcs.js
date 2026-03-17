import { T } from '../styles/tokens';

export const CC = {
  Walmart: T.walmart,
  Chewy: T.chewy,
  PetSmart: T.petsmart,
  Amazon: T.amazon,
  Other: T.other,
};

export const DCS = [
  {
    id: 'MEM', city: 'Memphis', state: 'TN', lat: 35.15, lng: -90.05,
    status: 'source', statusLabel: 'Transfer Hub', color: T.accent,
    available: 16200, daysSupply: 38.5, fillRate: 98.2,
    customers: [
      { name: 'Walmart',  pct: 42, units: 6800, atRisk: false },
      { name: 'PetSmart', pct: 28, units: 4530, atRisk: false },
      { name: 'Amazon',   pct: 18, units: 2910, atRisk: false },
      { name: 'Chewy',    pct: 8,  units: 1290, atRisk: false },
      { name: 'Other',    pct: 4,  units: 650,  atRisk: false },
    ],
  },
  {
    id: 'ATL', city: 'Atlanta', state: 'GA', lat: 33.75, lng: -84.39,
    status: 'crisis', statusLabel: 'Critical — 2.7 days', color: T.risk,
    available: 1520, daysSupply: 2.7, fillRate: 71.4,
    customers: [
      { name: 'Walmart',  pct: 45, units: 685, atRisk: true  },
      { name: 'PetSmart', pct: 30, units: 456, atRisk: true  },
      { name: 'Chewy',    pct: 15, units: 228, atRisk: true  },
      { name: 'Amazon',   pct: 7,  units: 107, atRisk: false },
      { name: 'Other',    pct: 3,  units: 44,  atRisk: false },
    ],
  },
  {
    id: 'CLT', city: 'Charlotte', state: 'NC', lat: 35.23, lng: -80.84,
    status: 'review', statusLabel: 'Review — 9.5 days', color: T.warn,
    available: 1820, daysSupply: 9.5, fillRate: 88.6,
    customers: [
      { name: 'Walmart',  pct: 38, units: 692, atRisk: true  },
      { name: 'PetSmart', pct: 32, units: 582, atRisk: false },
      { name: 'Amazon',   pct: 18, units: 328, atRisk: false },
      { name: 'Chewy',    pct: 8,  units: 146, atRisk: false },
      { name: 'Other',    pct: 4,  units: 72,  atRisk: false },
    ],
  },
  {
    id: 'CHI', city: 'Chicago', state: 'IL', lat: 41.88, lng: -87.63,
    status: 'stable', statusLabel: 'Stable — 17 days', color: T.inkLight,
    available: 5900, daysSupply: 17.4, fillRate: 97.8,
    customers: [
      { name: 'Walmart',  pct: 35, units: 2065, atRisk: false },
      { name: 'Chewy',    pct: 28, units: 1650, atRisk: false },
      { name: 'Amazon',   pct: 22, units: 1298, atRisk: false },
      { name: 'PetSmart', pct: 12, units: 708,  atRisk: false },
      { name: 'Other',    pct: 3,  units: 179,  atRisk: false },
    ],
  },
  {
    id: 'LAX', city: 'Los Angeles', state: 'CA', lat: 34.05, lng: -118.24,
    status: 'overstock', statusLabel: 'Overstock — 80 days', color: T.warn,
    available: 8120, daysSupply: 79.8, fillRate: 96.1,
    customers: [
      { name: 'Amazon',   pct: 40, units: 3248, atRisk: false },
      { name: 'Chewy',    pct: 30, units: 2436, atRisk: false },
      { name: 'Walmart',  pct: 18, units: 1462, atRisk: false },
      { name: 'PetSmart', pct: 8,  units: 650,  atRisk: false },
      { name: 'Other',    pct: 4,  units: 324,  atRisk: false },
    ],
  },
  {
    id: 'DFW', city: 'Dallas', state: 'TX', lat: 32.78, lng: -96.80,
    status: 'stable', statusLabel: 'Stable — 23 days', color: T.inkLight,
    available: 6360, daysSupply: 23.2, fillRate: 98.9,
    customers: [
      { name: 'Walmart',  pct: 44, units: 2798, atRisk: false },
      { name: 'Amazon',   pct: 25, units: 1590, atRisk: false },
      { name: 'Chewy',    pct: 18, units: 1145, atRisk: false },
      { name: 'PetSmart', pct: 10, units: 636,  atRisk: false },
      { name: 'Other',    pct: 3,  units: 191,  atRisk: false },
    ],
  },
];
