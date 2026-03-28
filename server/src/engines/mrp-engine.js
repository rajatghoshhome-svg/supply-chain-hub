/**
 * MRP Engine — Deterministic Material Requirements Planning
 *
 * Pure functions. No DB access, no side effects, no LLM calls.
 * Implements ASCM/APICS standard MRP logic:
 *   1. Gross-to-net netting
 *   2. Lead time offsetting
 *   3. Lot sizing (L4L, FOQ, EOQ, POQ)
 *   4. BOM explosion (multi-level, scrap %)
 *   5. Exception generation
 *
 * Data flow:
 *
 *   grossReqs ──▶ netRequirements() ──▶ lotSize() ──▶ lead time offset ──▶ records[]
 *                      │                                                      │
 *                      ▼                                                      ▼
 *               projectedOH[]                                          exceptions[]
 *               netReqs[]
 *
 *   BOM explosion runs separately to generate dependent demand
 *   (parent's plannedOrderRelease * qtyPer = child's grossReqs)
 */

// ─── Gross-to-Net Netting ─────────────────────────────────────────
//
// For each period:
//   projectedOH[t] = projectedOH[t-1] + scheduledReceipts[t] - grossReqs[t]
//   netReq[t] = max(0, safetyStock - projectedOH[t])
//
// Returns raw projectedOH (can be negative) and netReqs.
// Lot sizing is applied separately.

export function netRequirements({ periods, grossReqs, scheduledReceipts, onHand, safetyStock }) {
  const n = periods.length;
  const projectedOH = new Array(n);
  const netReqs = new Array(n);

  let runningOH = onHand;

  for (let t = 0; t < n; t++) {
    runningOH = runningOH + scheduledReceipts[t] - grossReqs[t];
    projectedOH[t] = runningOH;

    if (runningOH < safetyStock) {
      // Incremental net req: amount to bring OH back up to safety stock
      netReqs[t] = safetyStock - runningOH;
      // After netting, assume we'll get this quantity (lot sizing decides actual amount)
      // This keeps subsequent periods' net reqs incremental, not cumulative
      runningOH = safetyStock;
    } else {
      netReqs[t] = 0;
    }
  }

  return { projectedOH, netReqs };
}

// ─── Lot Sizing ───────────────────────────────────────────────────
//
// Takes net requirements and produces planned order quantities.
// Supported methods:
//   lot-for-lot  — order exactly the net req (with MOQ floor)
//   fixed-order-qty — order in fixed multiples
//   eoq — Economic Order Quantity batches
//   period-order-qty — group demand across N periods

export function lotSize({ netReqs, method, fixedQty, annualDemand, orderingCost, holdingCost, periodsPerOrder, moq }) {
  const n = netReqs.length;
  const orders = new Array(n).fill(0);

  switch (method) {
    case 'lot-for-lot': {
      for (let t = 0; t < n; t++) {
        if (netReqs[t] > 0) {
          orders[t] = moq && netReqs[t] < moq ? moq : netReqs[t];
        }
      }
      break;
    }

    case 'fixed-order-qty': {
      let carry = 0;
      for (let t = 0; t < n; t++) {
        const need = netReqs[t] - carry;
        if (need > 0) {
          const batches = Math.ceil(need / fixedQty);
          orders[t] = batches * fixedQty;
          carry = orders[t] - need;
        } else {
          carry = -need; // carry is positive surplus
        }
      }
      break;
    }

    case 'eoq': {
      const eoq = Math.round(Math.sqrt((2 * annualDemand * orderingCost) / holdingCost));
      let carry = 0;
      for (let t = 0; t < n; t++) {
        const need = netReqs[t] - carry;
        if (need > 0) {
          const batches = Math.ceil(need / eoq);
          orders[t] = batches * eoq;
          carry = orders[t] - need;
        } else {
          carry = -need;
        }
      }
      break;
    }

    case 'period-order-qty': {
      let t = 0;
      while (t < n) {
        let groupEnd = Math.min(t + periodsPerOrder, n);
        let total = 0;
        for (let j = t; j < groupEnd; j++) {
          total += netReqs[j];
        }
        if (total > 0) {
          orders[t] = total;
        }
        t = groupEnd;
      }
      break;
    }

    default:
      throw new Error(`Unknown lot sizing method: ${method}`);
  }

  return orders;
}

// ─── BOM Explosion ────────────────────────────────────────────────
//
// Walks the BOM tree recursively and produces a flat list of
// { skuCode, requiredQty, level } for all components.
//
// Handles:
//   - Multi-level BOMs (recursive)
//   - Scrap % (qty / (1 - scrapPct/100))
//   - Shared components (aggregated across branches)
//   - Circular reference detection (throws)
//
// bomTree format:
//   { 'PARENT-CODE': [{ childCode, qtyPer, scrapPct }, ...], ... }

export function explodeBOM({ parentCode, parentQty, bomTree }) {
  const aggregated = new Map(); // skuCode → { requiredQty, level }

  function walk(code, qty, level, visited) {
    const children = bomTree[code];
    if (!children || children.length === 0) return;

    for (const child of children) {
      if (visited.has(child.childCode)) {
        throw new Error(`Circular BOM reference detected: ${child.childCode} already in path [${[...visited].join(' → ')} → ${child.childCode}]`);
      }

      // Apply scrap factor: need more to account for loss
      const scrapFactor = child.scrapPct > 0 ? 1 / (1 - child.scrapPct / 100) : 1;
      const childQty = qty * child.qtyPer * scrapFactor;

      // Aggregate shared components
      if (aggregated.has(child.childCode)) {
        const existing = aggregated.get(child.childCode);
        existing.requiredQty += childQty;
        existing.level = Math.max(existing.level, level + 1);
      } else {
        aggregated.set(child.childCode, {
          skuCode: child.childCode,
          requiredQty: childQty,
          level: level + 1,
        });
      }

      // Recurse into child's BOM
      const nextVisited = new Set(visited);
      nextVisited.add(child.childCode);
      walk(child.childCode, childQty, level + 1, nextVisited);
    }
  }

  walk(parentCode, parentQty, 0, new Set([parentCode]));

  return [...aggregated.values()];
}

// ─── Exception Generation ─────────────────────────────────────────
//
// Compares scheduled receipts against planned order receipts to
// generate ASCM standard action messages:
//   expedite       — need it sooner than any existing order covers
//   reschedule-in  — existing order arrives too late, move it earlier
//   reschedule-out — existing order arrives too early, move it later
//   cancel         — existing order is not needed at all

export function generateExceptions({ skuCode, periods, netReqs, scheduledReceipts, plannedOrderReceipts }) {
  const exceptions = [];
  const n = periods.length;

  // Find periods with scheduled receipts and check alignment
  for (let t = 0; t < n; t++) {
    if (scheduledReceipts[t] > 0) {
      // There's an existing order arriving in period t.
      // Is there demand that needs it?
      const totalNetReq = netReqs.reduce((s, v) => s + v, 0);
      const totalPlanned = plannedOrderReceipts.reduce((s, v) => s + v, 0);

      if (totalNetReq === 0 && totalPlanned === 0) {
        // No demand at all — cancel this order
        exceptions.push({
          type: 'cancel',
          skuCode,
          period: periods[t],
          qty: scheduledReceipts[t],
          message: `Cancel order of ${scheduledReceipts[t]} in ${periods[t]} — no demand`,
          severity: 'warning',
        });
        continue;
      }

      // Find the first period with a planned receipt (where we actually need material)
      const firstNeedPeriod = plannedOrderReceipts.findIndex(r => r > 0);

      if (firstNeedPeriod === -1) {
        // Planned receipts are zero but there's net req... unusual, cancel
        exceptions.push({
          type: 'cancel',
          skuCode,
          period: periods[t],
          qty: scheduledReceipts[t],
          message: `Cancel order of ${scheduledReceipts[t]} in ${periods[t]} — covered by other means`,
          severity: 'info',
        });
      } else if (t > firstNeedPeriod) {
        // Scheduled receipt arrives AFTER we need it → reschedule-in
        exceptions.push({
          type: 'reschedule-in',
          skuCode,
          fromPeriod: periods[t],
          toPeriod: periods[firstNeedPeriod],
          qty: scheduledReceipts[t],
          message: `Reschedule-in: move ${scheduledReceipts[t]} from ${periods[t]} to ${periods[firstNeedPeriod]}`,
          severity: 'critical',
        });
      } else if (t < firstNeedPeriod) {
        // Scheduled receipt arrives BEFORE we need it → reschedule-out
        exceptions.push({
          type: 'reschedule-out',
          skuCode,
          fromPeriod: periods[t],
          toPeriod: periods[firstNeedPeriod],
          qty: scheduledReceipts[t],
          message: `Reschedule-out: move ${scheduledReceipts[t]} from ${periods[t]} to ${periods[firstNeedPeriod]}`,
          severity: 'info',
        });
      }
      // If t === firstNeedPeriod, it's aligned — no exception
    }
  }

  return exceptions;
}

// ─── Full MRP Run ─────────────────────────────────────────────────
//
// Orchestrates the full MRP calculation for a single SKU:
//   1. Net requirements
//   2. Lot sizing
//   3. Lead time offsetting
//   4. Exception generation
//
// Returns { records: [...], exceptions: [...] }

export function runMRP({ sku, periods, grossReqs, scheduledReceipts, onHand, safetyStock, leadTimePeriods, lotSizing }) {
  const n = periods.length;

  // Step 1: Gross-to-net netting
  const { projectedOH: rawProjectedOH, netReqs } = netRequirements({
    periods,
    grossReqs,
    scheduledReceipts,
    onHand,
    safetyStock,
  });

  // Step 2: Lot sizing on net requirements
  const plannedOrderReceipts = lotSize({
    netReqs,
    ...lotSizing,
  });

  // Recalculate projected OH with planned receipts
  const projectedOH = new Array(n);
  let runningOH = onHand;
  for (let t = 0; t < n; t++) {
    runningOH = runningOH + scheduledReceipts[t] + plannedOrderReceipts[t] - grossReqs[t];
    projectedOH[t] = runningOH;
  }

  // Step 3: Lead time offsetting
  // Planned order release = planned order receipt shifted earlier by lead time
  const plannedOrderReleases = new Array(n).fill(0);
  const exceptions = [];

  for (let t = 0; t < n; t++) {
    if (plannedOrderReceipts[t] > 0) {
      const releaseIdx = t - leadTimePeriods;
      if (releaseIdx >= 0) {
        plannedOrderReleases[releaseIdx] = plannedOrderReceipts[t];
      } else {
        // Need to release before the planning horizon — expedite exception
        plannedOrderReleases[0] = (plannedOrderReleases[0] || 0) + plannedOrderReceipts[t];
        exceptions.push({
          type: 'expedite',
          skuCode: sku.code,
          period: periods[t],
          qty: plannedOrderReceipts[t],
          message: `Expedite: need ${plannedOrderReceipts[t]} by ${periods[t]} but lead time requires release ${-releaseIdx} periods before horizon`,
          severity: 'critical',
        });
      }
    }
  }

  // Step 4: Generate alignment exceptions (scheduled vs planned)
  const alignmentExceptions = generateExceptions({
    skuCode: sku.code,
    periods,
    netReqs,
    scheduledReceipts,
    plannedOrderReceipts,
  });

  // Build records
  const records = periods.map((period, t) => ({
    period,
    grossReq: grossReqs[t],
    scheduledReceipts: scheduledReceipts[t],
    projectedOH: projectedOH[t],
    netReq: netReqs[t],
    plannedOrderReceipt: plannedOrderReceipts[t],
    plannedOrderRelease: plannedOrderReleases[t],
  }));

  return {
    records,
    exceptions: [...exceptions, ...alignmentExceptions],
  };
}
