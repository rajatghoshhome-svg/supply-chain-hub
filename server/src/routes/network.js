/**
 * Network Routes — Supply Chain Network Topology
 *
 * Exposes the full distribution network for visualization:
 * locations, lanes, products, sourcing rules, and suppliers.
 */

import { Router } from 'express';
import {
  networkLocations,
  networkLanes,
  products,
  productSourcing,
  suppliers,
} from '../data/synthetic-network.js';

export const networkRouter = Router();

/**
 * GET /api/network/topology
 * Returns the full network topology for map visualization.
 */
networkRouter.get('/topology', (_req, res) => {
  // Build a location lookup for merging lat/lng into suppliers
  const locationByCode = Object.fromEntries(
    networkLocations.map(loc => [loc.code, loc])
  );

  // Merge lat/lng from networkLocations into suppliers
  const suppliersWithGeo = Object.fromEntries(
    Object.entries(suppliers).map(([code, sup]) => {
      const loc = locationByCode[code];
      return [code, {
        ...sup,
        code,
        lat: loc?.lat ?? null,
        lng: loc?.lng ?? null,
        city: loc?.city ?? null,
        state: loc?.state ?? null,
      }];
    })
  );

  res.json({
    locations: networkLocations,
    lanes: networkLanes,
    products,
    productSourcing,
    suppliers: suppliersWithGeo,
  });
});
