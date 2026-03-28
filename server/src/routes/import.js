/**
 * CSV Import Route
 *
 * POST /api/import/csv — Upload and validate CSV data
 * GET  /api/import/templates — Return available import schemas/templates
 *
 * Pipeline:
 *   1. Size check (50MB limit)
 *   2. CSV parsing + sanitization (formula stripping, injection prevention)
 *   3. Schema-based validation (type-aware per import type)
 *   4. Self-healing validation (data health rules)
 *   5. Return structured results with row/column error locations
 *
 * The route does NOT write to the database directly. It returns
 * validated/sanitized data + health results for the frontend to
 * confirm before the service layer persists.
 */

import { Router } from 'express';
import { sanitizeCSV, sanitizeCSVText, parseAndValidate } from '../services/csv-sanitizer.js';
import { validateBatch, runHealthChecks } from '../services/data-health.js';
import { ValidationError } from '../middleware/error-handler.js';

export const importRouter = Router();

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// ─── Import Schemas (per type) ───────────────────────────────────

const IMPORT_SCHEMAS = {
  demand: {
    label: 'Demand Forecast',
    description: 'Import demand/forecast data by SKU and period',
    columns: [
      { name: 'sku', type: 'string', required: true },
      { name: 'period', type: 'date', required: true },
      { name: 'quantity', type: 'number', required: true },
      { name: 'customer', type: 'string', required: false },
      { name: 'location', type: 'string', required: false },
      { name: 'confidence', type: 'number', required: false },
    ],
  },
  inventory: {
    label: 'Inventory Snapshot',
    description: 'Import current inventory levels by SKU and location',
    columns: [
      { name: 'sku', type: 'string', required: true },
      { name: 'location', type: 'string', required: true },
      { name: 'on_hand', type: 'number', required: true },
      { name: 'in_transit', type: 'number', required: false },
      { name: 'allocated', type: 'number', required: false },
      { name: 'lot_number', type: 'string', required: false },
      { name: 'expiry_date', type: 'date', required: false },
    ],
  },
  bom: {
    label: 'Bill of Materials',
    description: 'Import BOM structures (parent-child relationships)',
    columns: [
      { name: 'parent', type: 'string', required: true },
      { name: 'child', type: 'string', required: true },
      { name: 'quantity_per', type: 'number', required: true },
      { name: 'scrap_pct', type: 'number', required: false },
      { name: 'lead_time_offset', type: 'number', required: false },
      { name: 'uom', type: 'string', required: false },
    ],
  },
  'planning-params': {
    label: 'Planning Parameters',
    description: 'Import planning parameters (lead times, lot sizing, safety stock)',
    columns: [
      { name: 'sku', type: 'string', required: true },
      { name: 'lead_time_weeks', type: 'number', required: true },
      { name: 'safety_stock', type: 'number', required: false },
      { name: 'lot_size_rule', type: 'string', required: false },
      { name: 'lot_size_value', type: 'number', required: false },
      { name: 'reorder_point', type: 'number', required: false },
      { name: 'planner_code', type: 'string', required: false },
    ],
  },
};

// ─── POST /api/import/csv ─────────────────────────────────────────

importRouter.post('/csv', (req, res, next) => {
  try {
    // Support both text/csv (raw body) and application/json ({ csv, type })
    let csv;
    let type;
    let delimiter;
    let hasHeader;
    let validationRules;

    const contentType = (req.headers['content-type'] || '').toLowerCase();

    if (contentType.includes('text/csv')) {
      // Raw CSV text in body — type must be in query param
      csv = typeof req.body === 'string' ? req.body : req.body?.toString('utf-8');
      type = req.query.type || null;
      delimiter = req.query.delimiter || ',';
      hasHeader = req.query.hasHeader !== 'false';
    } else {
      // JSON body: { csv, type, delimiter, hasHeader, validationRules }
      csv = req.body?.csv;
      type = req.body?.type || req.body?.targetTable || null;
      delimiter = req.body?.delimiter || ',';
      hasHeader = req.body?.hasHeader !== false;
      validationRules = req.body?.validationRules || null;
    }

    if (!csv || typeof csv !== 'string') {
      throw new ValidationError('CSV data is required as a string in the "csv" field');
    }

    // Size check
    const byteSize = Buffer.byteLength(csv, 'utf-8');
    if (byteSize > MAX_FILE_SIZE) {
      throw new ValidationError(
        `CSV exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB (got ${(byteSize / 1024 / 1024).toFixed(1)}MB)`,
        { field: 'csv' }
      );
    }

    // Step 1: Sanitize raw CSV text (BOM stripping, formula/injection removal)
    const sanitizedText = sanitizeCSVText(csv);

    // Count sanitization stats by comparing
    let formulasStripped = 0;
    let injectionsBlocked = 0;

    // Step 2: Parse + validate against schema (if type provided)
    let rows;
    let validationErrors = [];
    let validationWarnings = [];
    let headers = [];

    const schema = type ? IMPORT_SCHEMAS[type] : null;

    if (schema) {
      const result = parseAndValidate(csv, schema);
      rows = result.rows;
      validationErrors = result.errors;
      validationWarnings = result.warnings;
      if (rows.length > 0) {
        headers = Object.keys(rows[0]);
      }
    } else {
      // No schema — just parse + sanitize
      const sanitized = sanitizeCSV(sanitizedText, { delimiter, hasHeader: hasHeader !== false });
      headers = sanitized.headers;
      rows = sanitized.headers.length > 0
        ? sanitized.rows.map(row => {
            const record = {};
            sanitized.headers.forEach((header, i) => {
              record[header] = row[i] || '';
            });
            return record;
          })
        : sanitized.rows;
    }

    // Count sanitization work from sanitizeCSV pass
    const fullSanitized = sanitizeCSV(csv, { delimiter, hasHeader: hasHeader !== false });
    for (const issue of fullSanitized.issues) {
      if (issue.type === 'formula_stripped') formulasStripped++;
      if (issue.type === 'injection_stripped') injectionsBlocked++;
    }

    // Step 3: Run data health checks if applicable
    let healthCheckResults = { autoFixed: [], flagged: [], blocked: [] };

    if (type && rows.length > 0) {
      const healthData = buildHealthData(type, rows);
      healthCheckResults = runHealthChecks(healthData);
    } else if (!type) {
      // Run generic batch validation
      const batchResults = validateBatch(rows, validationRules || null);
      healthCheckResults = {
        autoFixed: batchResults.autoFixed,
        flagged: batchResults.flagged,
        blocked: batchResults.blocked,
      };
    }

    // Step 4: Return structured results
    res.json({
      status: validationErrors.length > 0 || healthCheckResults.blocked.length > 0 ? 'errors' : 'ok',
      rowsImported: rows.length,
      sanitized: {
        formulasStripped,
        injectionsBlocked,
      },
      validation: {
        errors: validationErrors,
        warnings: validationWarnings,
      },
      healthChecks: {
        autoFixed: healthCheckResults.autoFixed,
        flagged: healthCheckResults.flagged,
        blocked: healthCheckResults.blocked,
      },
      preview: rows.slice(0, 100),
      totalRecords: rows.length,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/import/templates ────────────────────────────────────

importRouter.get('/templates', (req, res) => {
  const templates = Object.entries(IMPORT_SCHEMAS).map(([key, schema]) => ({
    type: key,
    label: schema.label,
    description: schema.description,
    columns: schema.columns.map(col => ({
      name: col.name,
      type: col.type,
      required: col.required,
    })),
    sampleCSV: generateSampleCSV(schema),
  }));

  res.json({ templates });
});

// ─── Helpers ──────────────────────────────────────────────────────

/**
 * Build the data structure that runHealthChecks expects from parsed rows.
 */
function buildHealthData(type, rows) {
  const data = { skus: [], boms: [], inventory: [], planningParams: [], demand: [] };

  switch (type) {
    case 'demand':
      data.demand = rows.map(r => ({
        sku: r.sku,
        period: r.period,
        quantity: r.quantity != null ? Number(r.quantity) : null,
        customer: r.customer,
        location: r.location,
      }));
      break;

    case 'inventory':
      data.inventory = rows.map(r => ({
        sku: r.sku,
        location: r.location,
        onHand: r.on_hand != null ? Number(r.on_hand) : null,
        inTransit: r.in_transit != null ? Number(r.in_transit) : null,
      }));
      break;

    case 'bom':
      // For BOM validation, we need a SKU list. Extract unique parents + children as the SKU universe.
      const skuSet = new Set();
      for (const r of rows) {
        if (r.parent) skuSet.add(r.parent.toString().trim());
        // Note: children are what we validate, so we do NOT add them to skuSet
        // unless they also appear as parents. The check is whether child exists in skus.
      }
      // Only parents are known SKUs for BOM child validation
      data.skus = Array.from(skuSet).map(code => ({ code }));
      data.boms = rows.map(r => ({
        parent: r.parent,
        child: r.child,
        quantityPer: r.quantity_per != null ? Number(r.quantity_per) : null,
        scrapPct: r.scrap_pct != null ? Number(r.scrap_pct) : null,
      }));
      break;

    case 'planning-params':
      data.planningParams = rows.map(r => ({
        sku: r.sku,
        lead_time_weeks: r.lead_time_weeks != null ? Number(r.lead_time_weeks) : null,
        safety_stock: r.safety_stock != null ? Number(r.safety_stock) : null,
        lot_size_rule: r.lot_size_rule || null,
        lot_size_value: r.lot_size_value != null ? Number(r.lot_size_value) : null,
      }));
      // Also register SKUs from planning params for cross-checks
      data.skus = rows.map(r => ({ code: r.sku }));
      break;
  }

  return data;
}

/**
 * Generate a sample CSV string for a schema (for template downloads).
 */
function generateSampleCSV(schema) {
  const headerRow = schema.columns.map(c => c.name).join(',');
  const sampleValues = schema.columns.map(col => {
    switch (col.type) {
      case 'number': return '100';
      case 'date': return '2026-01-01';
      default: return 'SAMPLE';
    }
  });
  return headerRow + '\n' + sampleValues.join(',');
}
