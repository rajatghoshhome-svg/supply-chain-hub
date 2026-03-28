/**
 * Self-Healing Data Layer
 *
 * Validates planning data against configurable rules and takes action:
 *   Auto         — fix automatically (high confidence, low risk)
 *   Flag         — mark for planner review (medium confidence)
 *   Block        — reject the data (low confidence, high risk)
 *   Auto-review  — fix automatically but queue for review
 *
 * Runs on:
 *   - Every CSV import
 *   - Every plan run (pre-engine validation)
 *   - On-demand health check
 *
 * Pure functions — the caller (service layer) handles DB writes.
 */

// ─── Confidence Thresholds ────────────────────────────────────────

const THRESHOLDS = {
  AUTO: 90,        // >= 90% confidence → auto-fix
  AUTO_REVIEW: 70, // >= 70% → auto-fix + queue for review
  FLAG: 40,        // >= 40% → flag for planner
  BLOCK: 0,        // < 40% → block (reject)
};

// ─── Validation Rules ─────────────────────────────────────────────
// Each rule returns: { valid, action, confidence, message, fix? }

const rules = {
  // Lead time must be positive
  leadTimePositive: ({ leadTimeDays }) => {
    if (leadTimeDays == null) return null; // skip if not provided
    if (leadTimeDays < 0) {
      return {
        valid: false,
        action: 'auto',
        confidence: 95,
        field: 'lead_time_days',
        message: `Negative lead time (${leadTimeDays}) corrected to 0`,
        fix: { leadTimeDays: 0 },
      };
    }
    if (leadTimeDays > 365) {
      return {
        valid: false,
        action: 'flag',
        confidence: 60,
        field: 'lead_time_days',
        message: `Lead time ${leadTimeDays} days seems unusually long (> 365)`,
      };
    }
    return null;
  },

  // Safety stock must be non-negative
  safetyStockNonNegative: ({ safetyStock }) => {
    if (safetyStock == null) return null;
    if (safetyStock < 0) {
      return {
        valid: false,
        action: 'auto',
        confidence: 98,
        field: 'safety_stock',
        message: `Negative safety stock (${safetyStock}) corrected to 0`,
        fix: { safetyStock: 0 },
      };
    }
    return null;
  },

  // BOM quantity per must be positive
  bomQtyPerPositive: ({ quantityPer }) => {
    if (quantityPer == null) return null;
    if (quantityPer <= 0) {
      return {
        valid: false,
        action: 'block',
        confidence: 99,
        field: 'quantity_per',
        message: `BOM quantity per unit must be > 0 (got ${quantityPer})`,
      };
    }
    return null;
  },

  // Scrap percentage must be 0-100
  scrapPctRange: ({ scrapPct }) => {
    if (scrapPct == null) return null;
    if (scrapPct < 0 || scrapPct >= 100) {
      if (scrapPct < 0) {
        return {
          valid: false,
          action: 'auto',
          confidence: 95,
          field: 'scrap_pct',
          message: `Negative scrap % (${scrapPct}) corrected to 0`,
          fix: { scrapPct: 0 },
        };
      }
      return {
        valid: false,
        action: 'block',
        confidence: 99,
        field: 'scrap_pct',
        message: `Scrap % must be < 100 (got ${scrapPct})`,
      };
    }
    if (scrapPct > 50) {
      return {
        valid: false,
        action: 'flag',
        confidence: 55,
        field: 'scrap_pct',
        message: `Scrap % of ${scrapPct}% is unusually high — please verify`,
      };
    }
    return null;
  },

  // Demand quantity must be non-negative
  demandNonNegative: ({ demandQty }) => {
    if (demandQty == null) return null;
    if (demandQty < 0) {
      return {
        valid: false,
        action: 'auto',
        confidence: 92,
        field: 'demand_qty',
        message: `Negative demand (${demandQty}) corrected to 0`,
        fix: { demandQty: 0 },
      };
    }
    return null;
  },

  // On-hand inventory reasonableness
  onHandReasonable: ({ onHand, avgDemand }) => {
    if (onHand == null || avgDemand == null || avgDemand === 0) return null;
    const weeksOfSupply = onHand / avgDemand;
    if (weeksOfSupply > 52) {
      return {
        valid: false,
        action: 'flag',
        confidence: 50,
        field: 'on_hand',
        message: `On-hand (${onHand}) represents ${Math.round(weeksOfSupply)} weeks of supply — verify for accuracy`,
      };
    }
    return null;
  },

  // Lot size value must be positive when rule requires it
  lotSizeValueRequired: ({ lotSizeRule, lotSizeValue }) => {
    if (!lotSizeRule) return null;
    const needsValue = ['fixed-order-qty', 'eoq', 'period-order-qty'];
    if (needsValue.includes(lotSizeRule) && (!lotSizeValue || lotSizeValue <= 0)) {
      return {
        valid: false,
        action: 'block',
        confidence: 99,
        field: 'lot_size_value',
        message: `Lot sizing rule "${lotSizeRule}" requires a positive lot size value`,
      };
    }
    return null;
  },

  // SKU code format validation
  skuCodeFormat: ({ code }) => {
    if (!code) return null;
    if (code.length > 50) {
      return {
        valid: false,
        action: 'auto',
        confidence: 90,
        field: 'code',
        message: `SKU code truncated from ${code.length} to 50 characters`,
        fix: { code: code.substring(0, 50) },
      };
    }
    return null;
  },

  // Forecast confidence 0-100
  forecastConfidenceRange: ({ confidence }) => {
    if (confidence == null) return null;
    if (confidence < 0 || confidence > 100) {
      return {
        valid: false,
        action: 'auto',
        confidence: 90,
        field: 'confidence',
        message: `Forecast confidence ${confidence} clamped to 0-100 range`,
        fix: { confidence: Math.max(0, Math.min(100, confidence)) },
      };
    }
    return null;
  },
};

// ─── Run Validation ───────────────────────────────────────────────

/**
 * Validate a record against all applicable rules
 *
 * @param {Object} record - The data record to validate
 * @param {string[]} [ruleNames] - Specific rules to run (default: all)
 * @returns {{ autoFixed: Array, flagged: Array, blocked: Array, autoReview: Array }}
 */
export function validateRecord(record, ruleNames = null) {
  const results = {
    autoFixed: [],
    flagged: [],
    blocked: [],
    autoReview: [],
  };

  const rulesToRun = ruleNames
    ? ruleNames.filter(name => rules[name]).map(name => [name, rules[name]])
    : Object.entries(rules);

  for (const [ruleName, ruleFn] of rulesToRun) {
    const finding = ruleFn(record);
    if (!finding) continue; // rule passed or not applicable

    const entry = {
      rule: ruleName,
      ...finding,
    };

    // Classify by confidence threshold
    if (finding.action === 'block' || finding.confidence < THRESHOLDS.FLAG) {
      results.blocked.push(entry);
    } else if (finding.action === 'flag' || finding.confidence < THRESHOLDS.AUTO_REVIEW) {
      results.flagged.push(entry);
    } else if (finding.action === 'auto-review' || finding.confidence < THRESHOLDS.AUTO) {
      results.autoReview.push(entry);
    } else {
      results.autoFixed.push(entry);
    }
  }

  return results;
}

/**
 * Validate a batch of records (e.g., CSV import rows)
 *
 * @param {Object[]} records - Array of data records
 * @param {string[]} [ruleNames] - Specific rules to run
 * @returns {{ autoFixed, flagged, blocked, autoReview, summary }}
 */
export function validateBatch(records, ruleNames = null) {
  const totals = { autoFixed: [], flagged: [], blocked: [], autoReview: [] };

  for (let i = 0; i < records.length; i++) {
    const result = validateRecord(records[i], ruleNames);
    for (const category of ['autoFixed', 'flagged', 'blocked', 'autoReview']) {
      totals[category].push(
        ...result[category].map(entry => ({ ...entry, rowIndex: i }))
      );
    }
  }

  return {
    ...totals,
    summary: {
      totalRecords: records.length,
      autoFixed: totals.autoFixed.length,
      flagged: totals.flagged.length,
      blocked: totals.blocked.length,
      autoReview: totals.autoReview.length,
      clean: records.length - new Set([
        ...totals.blocked.map(e => e.rowIndex),
        ...totals.flagged.map(e => e.rowIndex),
      ]).size,
    },
  };
}

/**
 * Apply auto-fixes to a record
 *
 * @param {Object} record - The original record
 * @param {Array} autoFixes - Array of { fix: { field: value } } entries
 * @returns {Object} - The record with fixes applied
 */
export function applyFixes(record, autoFixes) {
  const fixed = { ...record };
  for (const entry of autoFixes) {
    if (entry.fix) {
      Object.assign(fixed, entry.fix);
    }
  }
  return fixed;
}

// ─── Dataset-Level Health Checks ─────────────────────────────────
/**
 * Run health checks across the full dataset.
 *
 * @param {Object} data - { skus, boms, inventory, planningParams }
 *   skus: [{ code, name, ... }]
 *   boms: [{ parent, child, quantityPer, ... }]
 *   inventory: [{ sku, onHand, ... }]
 *   planningParams: [{ sku, leadTimeWeeks, safetyStock, lotSizeRule, lotSizeValue, ... }]
 * @returns {{ autoFixed: Array, flagged: Array, blocked: Array }}
 */
export function runHealthChecks(data) {
  const autoFixed = [];
  const flagged = [];
  const blocked = [];

  const skus = data.skus || [];
  const boms = data.boms || [];
  const inventory = data.inventory || [];
  const planningParams = data.planningParams || [];

  // Build SKU code set for reference checks
  const skuCodes = new Set(skus.map(s => (s.code || s.sku || '').toString().trim()));

  // ── Rule 1: Lead time check (0 or >12 weeks) ──
  for (let i = 0; i < planningParams.length; i++) {
    const p = planningParams[i];
    const lt = Number(p.leadTimeWeeks ?? p.lead_time_weeks ?? p.leadTimeDays ?? null);
    const field = p.leadTimeWeeks != null ? 'leadTimeWeeks' : (p.lead_time_weeks != null ? 'lead_time_weeks' : 'leadTimeDays');
    if (lt != null && !isNaN(lt)) {
      if (lt === 0) {
        const oldValue = 0;
        const newValue = 1;
        p[field] = newValue;
        autoFixed.push({
          table: 'planningParams',
          row: i,
          field,
          oldValue,
          newValue,
          rule: 'leadTimeZero',
          message: `Lead time was 0, auto-corrected to 1`,
        });
      } else if (lt > 12) {
        flagged.push({
          table: 'planningParams',
          row: i,
          field,
          value: lt,
          rule: 'leadTimeExcessive',
          message: `Lead time of ${lt} weeks exceeds 12-week threshold — verify`,
        });
      }
    }
  }

  // ── Rule 2: Safety stock check (negative) ──
  for (let i = 0; i < planningParams.length; i++) {
    const p = planningParams[i];
    const ss = Number(p.safetyStock ?? p.safety_stock ?? null);
    const field = p.safetyStock != null ? 'safetyStock' : 'safety_stock';
    if (ss != null && !isNaN(ss) && ss < 0) {
      const oldValue = ss;
      p[field] = 0;
      autoFixed.push({
        table: 'planningParams',
        row: i,
        field,
        oldValue,
        newValue: 0,
        rule: 'safetyStockNegative',
        message: `Negative safety stock (${oldValue}) auto-corrected to 0`,
      });
    }
  }

  // ── Rule 3: BOM validation (child references non-existent SKU) ──
  for (let i = 0; i < boms.length; i++) {
    const b = boms[i];
    const child = (b.child || b.child_sku || b.component || '').toString().trim();
    if (child && skuCodes.size > 0 && !skuCodes.has(child)) {
      blocked.push({
        table: 'boms',
        row: i,
        field: 'child',
        value: child,
        rule: 'bomChildMissing',
        message: `BOM child "${child}" references a non-existent SKU`,
      });
    }
  }

  // ── Rule 4: Demand check (negative demand) ──
  // Demand can be in inventory records or a separate demand array
  const demandRecords = data.demand || [];
  for (let i = 0; i < demandRecords.length; i++) {
    const d = demandRecords[i];
    const qty = Number(d.quantity ?? d.qty ?? d.demandQty ?? d.demand_qty ?? null);
    const field = d.quantity != null ? 'quantity' : (d.qty != null ? 'qty' : (d.demandQty != null ? 'demandQty' : 'demand_qty'));
    if (qty != null && !isNaN(qty) && qty < 0) {
      const oldValue = qty;
      d[field] = 0;
      autoFixed.push({
        table: 'demand',
        row: i,
        field,
        oldValue,
        newValue: 0,
        rule: 'demandNegative',
        message: `Negative demand (${oldValue}) auto-corrected to 0`,
      });
    }
  }

  // ── Rule 5: Lot size check (FOQ quantity is 0) ──
  for (let i = 0; i < planningParams.length; i++) {
    const p = planningParams[i];
    const rule = (p.lotSizeRule || p.lot_size_rule || '').toString().toLowerCase();
    const val = Number(p.lotSizeValue ?? p.lot_size_value ?? null);
    const ruleField = p.lotSizeRule != null ? 'lotSizeRule' : 'lot_size_rule';
    const valField = p.lotSizeValue != null ? 'lotSizeValue' : 'lot_size_value';

    if ((rule === 'fixed-order-qty' || rule === 'foq') && (val === 0 || isNaN(val))) {
      const oldRule = p[ruleField];
      p[ruleField] = 'lot-for-lot';
      p[valField] = null;
      autoFixed.push({
        table: 'planningParams',
        row: i,
        field: ruleField,
        oldValue: oldRule,
        newValue: 'lot-for-lot',
        rule: 'lotSizeFOQZero',
        message: `FOQ with quantity 0 auto-switched to lot-for-lot`,
      });
    }
  }

  // ── Rule 6: Duplicate SKU codes ──
  const seenSkus = new Map();
  for (let i = 0; i < skus.length; i++) {
    const code = (skus[i].code || skus[i].sku || '').toString().trim();
    if (!code) continue;
    if (seenSkus.has(code)) {
      flagged.push({
        table: 'skus',
        row: i,
        field: 'code',
        value: code,
        rule: 'duplicateSKU',
        message: `Duplicate SKU code "${code}" (first seen at row ${seenSkus.get(code)})`,
      });
    } else {
      seenSkus.set(code, i);
    }
  }

  return { autoFixed, flagged, blocked };
}

// Export for testing
export { rules, THRESHOLDS };
