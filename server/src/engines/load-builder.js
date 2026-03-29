/**
 * Load Builder Engine — Pure functions for building truckloads
 *
 * Combines individual SKU shipments on the same lane into consolidated loads.
 * FTL (Full Truckload): 40,000 lbs / 22 pallets
 * LTL (Less Than Truckload): < 10,000 lbs
 * Partial: between LTL and FTL
 *
 * All functions are pure — no side effects.
 */

/**
 * Suggest how to combine shipments into loads using greedy bin-packing.
 *
 * @param {Object[]} shipments - Array of { id, weightLbs, pallets, period, ... }
 * @param {Object} limits - { maxWeightLbs: 40000, maxPallets: 22 }
 * @returns {Object[]} Array of suggested load groupings
 */
export function suggestCombinations(shipments, { maxWeightLbs = 40000, maxPallets = 22 } = {}) {
  if (!shipments || shipments.length === 0) return [];

  // Sort by period (pack shipments shipping around the same time together)
  const sorted = [...shipments].sort((a, b) => (a.period || 0) - (b.period || 0));

  const loads = [];
  const used = new Set();

  for (const shipment of sorted) {
    if (used.has(shipment.id)) continue;

    // Start a new load with this shipment
    const load = {
      shipmentIds: [shipment.id],
      totalWeightLbs: shipment.weightLbs,
      totalPallets: shipment.pallets,
      period: shipment.period,
    };
    used.add(shipment.id);

    // Try to pack more shipments from the same period window
    for (const candidate of sorted) {
      if (used.has(candidate.id)) continue;
      // Allow combining shipments within 1 period of each other
      if (Math.abs((candidate.period || 0) - (shipment.period || 0)) > 1) continue;

      const newWeight = load.totalWeightLbs + candidate.weightLbs;
      const newPallets = load.totalPallets + candidate.pallets;

      if (newWeight <= maxWeightLbs && newPallets <= maxPallets) {
        load.shipmentIds.push(candidate.id);
        load.totalWeightLbs = newWeight;
        load.totalPallets = newPallets;
        used.add(candidate.id);
      }
    }

    loads.push({
      ...load,
      ...calculateUtilization(load, { maxWeightLbs, maxPallets }),
    });
  }

  return loads;
}

/**
 * Calculate weight and pallet utilization for a load.
 *
 * @param {Object} load - { totalWeightLbs, totalPallets }
 * @param {Object} limits - { maxWeightLbs, maxPallets }
 * @returns {{ weightPct, palletPct, classification }}
 */
export function calculateUtilization(load, { maxWeightLbs = 40000, maxPallets = 22 } = {}) {
  const weightPct = Math.round((load.totalWeightLbs / maxWeightLbs) * 100);
  const palletPct = Math.round((load.totalPallets / maxPallets) * 100);
  const maxPct = Math.max(weightPct, palletPct);

  let classification;
  if (maxPct >= 85) classification = 'FTL';
  else if (maxPct < 25) classification = 'LTL';
  else classification = 'Partial';

  return { weightPct, palletPct, classification };
}

/**
 * Validate that a set of shipments can form a valid load.
 *
 * @param {Object[]} shipments - Array of shipment objects
 * @param {Object} laneConfig - { maxWeightLbs, maxPallets, from, to }
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateLoad(shipments, laneConfig = {}) {
  const errors = [];
  const { maxWeightLbs = 40000, maxPallets = 22 } = laneConfig;

  if (!shipments || shipments.length === 0) {
    errors.push('No shipments provided');
    return { valid: false, errors };
  }

  // Check all shipments are on the same lane
  const lanes = new Set(shipments.map(s => `${s.fromCode}|${s.toCode}`));
  if (lanes.size > 1) {
    errors.push('All shipments must be on the same lane');
  }

  // Check weight limit
  const totalWeight = shipments.reduce((sum, s) => sum + (s.weightLbs || 0), 0);
  if (totalWeight > maxWeightLbs) {
    errors.push(`Total weight ${totalWeight.toLocaleString()} lbs exceeds limit of ${maxWeightLbs.toLocaleString()} lbs`);
  }

  // Check pallet limit
  const totalPallets = shipments.reduce((sum, s) => sum + (s.pallets || 0), 0);
  if (totalPallets > maxPallets) {
    errors.push(`Total pallets ${totalPallets} exceeds limit of ${maxPallets}`);
  }

  return { valid: errors.length === 0, errors };
}
