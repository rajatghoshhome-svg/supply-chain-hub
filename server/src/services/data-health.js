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

// Export for testing
export { rules, THRESHOLDS };
