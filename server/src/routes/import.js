/**
 * CSV Import Route
 *
 * POST /api/import/csv     — Upload and validate CSV data (multipart or JSON)
 * POST /api/import/confirm — Confirm import: write validated data to DB
 * GET  /api/import/templates — Return available import schemas/templates
 *
 * Pipeline:
 *   1. Size check (50MB limit)
 *   2. CSV parsing + sanitization (formula stripping, injection prevention)
 *   3. Schema-based validation (type-aware per import type)
 *   4. Self-healing validation (data health rules)
 *   5. Return structured results with row/column error locations
 *   6. On /confirm, write validated data to the database
 */

import { Router } from 'express';
import multer from 'multer';
import { sanitizeCSV, sanitizeCSVText, parseAndValidate } from '../services/csv-sanitizer.js';
import { validateBatch, runHealthChecks } from '../services/data-health.js';
import { insertOnboardingData } from '../services/onboarding-persistence.js';
import { ValidationError } from '../middleware/error-handler.js';

export const importRouter = Router();

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// ─── Multer config for multipart file uploads ────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'text/csv',
      'text/plain',
      'application/csv',
      'application/vnd.ms-excel',
      'application/octet-stream',
    ];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith('.csv') || file.originalname.endsWith('.txt')) {
      cb(null, true);
    } else {
      cb(new ValidationError(`Unsupported file type: ${file.mimetype}. Please upload a CSV file.`));
    }
  },
});

// ─── In-memory staging for confirmed imports ─────────────────────
// Stores the last validated import for each type so /confirm can persist it.
const importStaging = {};

// ─── Import Schemas (per type) ───────────────────────────────────

const IMPORT_SCHEMAS = {
  demand: {
    label: 'Demand Forecast',
    description: 'Import demand/forecast data by SKU and period',
    dbType: 'demand-history',
    columns: [
      { name: 'sku', type: 'string', required: true },
      { name: 'period', type: 'date', required: true },
      { name: 'quantity', type: 'number', required: true },
      { name: 'customer', type: 'string', required: false },
      { name: 'location', type: 'string', required: false },
      { name: 'confidence', type: 'number', required: false },
    ],
    // Map import field names to onboarding DB field names
    toDbFields: (row) => ({
      sku_code: row.sku,
      period: row.period,
      quantity: row.quantity,
      location_code: row.location || '',
      customer: row.customer || '',
    }),
  },
  inventory: {
    label: 'Inventory Snapshot',
    description: 'Import current inventory levels by SKU and location',
    dbType: 'inventory',
    columns: [
      { name: 'sku', type: 'string', required: true },
      { name: 'location', type: 'string', required: true },
      { name: 'on_hand', type: 'number', required: true },
      { name: 'in_transit', type: 'number', required: false },
      { name: 'allocated', type: 'number', required: false },
      { name: 'lot_number', type: 'string', required: false },
      { name: 'expiry_date', type: 'date', required: false },
    ],
    toDbFields: (row) => ({
      sku_code: row.sku,
      location_code: row.location,
      on_hand: row.on_hand,
      in_transit: row.in_transit || 0,
      allocated: row.allocated || 0,
    }),
  },
  bom: {
    label: 'Bill of Materials',
    description: 'Import BOM structures (parent-child relationships)',
    dbType: 'bom',
    columns: [
      { name: 'parent', type: 'string', required: true },
      { name: 'child', type: 'string', required: true },
      { name: 'quantity_per', type: 'number', required: true },
      { name: 'scrap_pct', type: 'number', required: false },
      { name: 'lead_time_offset', type: 'number', required: false },
      { name: 'uom', type: 'string', required: false },
    ],
    toDbFields: (row) => ({
      parent_code: row.parent,
      child_code: row.child,
      qty_per: row.quantity_per,
      scrap_pct: row.scrap_pct || 0,
      lead_time_offset: row.lead_time_offset || 0,
      uom: row.uom || '',
    }),
  },
  'planning-params': {
    label: 'Planning Parameters',
    description: 'Import planning parameters (lead times, lot sizing, safety stock)',
    dbType: 'planning-params',
    columns: [
      { name: 'sku', type: 'string', required: true },
      { name: 'lead_time_weeks', type: 'number', required: true },
      { name: 'safety_stock', type: 'number', required: false },
      { name: 'lot_size_rule', type: 'string', required: false },
      { name: 'lot_size_value', type: 'number', required: false },
      { name: 'reorder_point', type: 'number', required: false },
      { name: 'planner_code', type: 'string', required: false },
    ],
    toDbFields: (row) => ({
      sku_code: row.sku,
      lead_time_days: row.lead_time_weeks != null ? Number(row.lead_time_weeks) * 7 : null,
      safety_stock: row.safety_stock || 0,
      lot_size_rule: row.lot_size_rule || 'lot-for-lot',
      lot_size_value: row.lot_size_value || null,
      reorder_point: row.reorder_point || 0,
    }),
  },
  locations: {
    label: 'Locations',
    description: 'Import locations (plants, DCs, suppliers)',
    dbType: 'locations',
    columns: [
      { name: 'location_code', type: 'string', required: true },
      { name: 'name', type: 'string', required: true },
      { name: 'type', type: 'string', required: false },
      { name: 'region', type: 'string', required: false },
      { name: 'capacity', type: 'number', required: false },
    ],
    toDbFields: (row) => ({ ...row }),
  },
  skus: {
    label: 'SKUs / Items',
    description: 'Import SKU master list (finished goods, subassemblies, raw materials)',
    dbType: 'skus',
    columns: [
      { name: 'sku_code', type: 'string', required: true },
      { name: 'name', type: 'string', required: true },
      { name: 'category', type: 'string', required: false },
      { name: 'unit_cost', type: 'number', required: false },
      { name: 'uom', type: 'string', required: false },
    ],
    toDbFields: (row) => ({ ...row }),
  },
  'distribution-network': {
    label: 'Distribution Network',
    description: 'Import transportation lanes between locations',
    dbType: 'distribution-network',
    columns: [
      { name: 'source_code', type: 'string', required: true },
      { name: 'dest_code', type: 'string', required: true },
      { name: 'lead_time_days', type: 'number', required: true },
      { name: 'cost_per_unit', type: 'number', required: false },
      { name: 'distance_miles', type: 'number', required: false },
    ],
    toDbFields: (row) => ({ ...row }),
  },
  'work-centers': {
    label: 'Work Centers',
    description: 'Import production work centers with capacity',
    dbType: 'work-centers',
    columns: [
      { name: 'work_center_code', type: 'string', required: true },
      { name: 'name', type: 'string', required: true },
      { name: 'location_code', type: 'string', required: false },
      { name: 'capacity_per_day', type: 'number', required: false },
      { name: 'capacity_uom', type: 'string', required: false },
    ],
    toDbFields: (row) => ({ ...row }),
  },
};

// ─── POST /api/import/csv ─────────────────────────────────────────

importRouter.post('/csv', upload.single('file'), (req, res, next) => {
  try {
    let csv;
    let type;
    let delimiter;
    let hasHeader;
    let validationRules;

    // Case 1: Multipart file upload
    if (req.file) {
      csv = req.file.buffer.toString('utf-8');
      type = req.body?.type || req.query?.type || null;
      delimiter = req.body?.delimiter || req.query?.delimiter || ',';
      hasHeader = (req.body?.hasHeader ?? req.query?.hasHeader) !== 'false';
    } else {
      const contentType = (req.headers['content-type'] || '').toLowerCase();

      if (contentType.includes('text/csv')) {
        csv = typeof req.body === 'string' ? req.body : req.body?.toString('utf-8');
        type = req.query.type || null;
        delimiter = req.query.delimiter || ',';
        hasHeader = req.query.hasHeader !== 'false';
      } else {
        csv = req.body?.csv;
        type = req.body?.type || req.body?.targetTable || null;
        delimiter = req.body?.delimiter || ',';
        hasHeader = req.body?.hasHeader !== false;
        validationRules = req.body?.validationRules || null;
      }
    }

    if (!csv || typeof csv !== 'string') {
      throw new ValidationError(
        'CSV data is required. Send as multipart file upload (field: "file"), raw text/csv body, or JSON { csv: "..." }'
      );
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

    // Count sanitization stats
    let formulasStripped = 0;
    let injectionsBlocked = 0;

    // Step 2: Parse + validate against schema (if type provided)
    let rows;
    let validationErrors = [];
    let validationWarnings = [];
    let headers = [];

    const importSchema = type ? IMPORT_SCHEMAS[type] : null;

    if (importSchema) {
      const result = parseAndValidate(csv, importSchema);
      rows = result.rows;
      validationErrors = result.errors;
      validationWarnings = result.warnings;
      if (rows.length > 0) {
        headers = Object.keys(rows[0]);
      }
    } else {
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

    // Count sanitization work
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
      const batchResults = validateBatch(rows, validationRules || null);
      healthCheckResults = {
        autoFixed: batchResults.autoFixed,
        flagged: batchResults.flagged,
        blocked: batchResults.blocked,
      };
    }

    // Stage data for /confirm endpoint
    const importStatus = validationErrors.length > 0 || healthCheckResults.blocked.length > 0 ? 'errors' : 'ok';
    if (type && importStatus === 'ok') {
      importStaging[type] = {
        rows,
        type,
        stagedAt: new Date().toISOString(),
      };
    }

    // Step 4: Return structured results
    res.json({
      status: importStatus,
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
      canConfirm: importStatus === 'ok' && !!type,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/import/confirm ────────────────────────────────────
// Writes previously validated CSV data to the database.

importRouter.post('/confirm', async (req, res, next) => {
  try {
    const { type } = req.body;

    if (!type) {
      throw new ValidationError('type is required (e.g., "demand", "inventory", "bom")');
    }

    const staged = importStaging[type];
    if (!staged) {
      throw new ValidationError(
        `No validated data staged for type "${type}". Upload and validate via POST /api/import/csv first.`
      );
    }

    const importSchema = IMPORT_SCHEMAS[type];
    if (!importSchema) {
      throw new ValidationError(`Unknown import type: ${type}`);
    }

    // Map rows to DB field names
    const dbRows = importSchema.toDbFields
      ? staged.rows.map(importSchema.toDbFields)
      : staged.rows;

    // Insert into the database
    const result = await insertOnboardingData(importSchema.dbType, dbRows);

    // Clear staging
    delete importStaging[type];

    res.json({
      status: 'inserted',
      ...result,
      message: `Successfully imported ${result.inserted} rows into ${result.table}.`,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/import/templates ────────────────────────────────────

importRouter.get('/templates', (req, res) => {
  const templates = Object.entries(IMPORT_SCHEMAS).map(([key, importSchema]) => ({
    type: key,
    label: importSchema.label,
    description: importSchema.description,
    columns: importSchema.columns.map(col => ({
      name: col.name,
      type: col.type,
      required: col.required,
    })),
    sampleCSV: generateSampleCSV(importSchema),
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

    case 'bom': {
      const skuSet = new Set();
      for (const r of rows) {
        if (r.parent) skuSet.add(r.parent.toString().trim());
      }
      data.skus = Array.from(skuSet).map(code => ({ code }));
      data.boms = rows.map(r => ({
        parent: r.parent,
        child: r.child,
        quantityPer: r.quantity_per != null ? Number(r.quantity_per) : null,
        scrapPct: r.scrap_pct != null ? Number(r.scrap_pct) : null,
      }));
      break;
    }

    case 'planning-params':
      data.planningParams = rows.map(r => ({
        sku: r.sku,
        lead_time_weeks: r.lead_time_weeks != null ? Number(r.lead_time_weeks) : null,
        safety_stock: r.safety_stock != null ? Number(r.safety_stock) : null,
        lot_size_rule: r.lot_size_rule || null,
        lot_size_value: r.lot_size_value != null ? Number(r.lot_size_value) : null,
      }));
      data.skus = rows.map(r => ({ code: r.sku }));
      break;

    case 'skus':
      data.skus = rows.map(r => ({
        code: r.sku_code || '',
        name: r.name || '',
      }));
      break;

    case 'locations':
    case 'distribution-network':
    case 'work-centers':
      // Structural validation only (no specific health check rules)
      break;
  }

  return data;
}

/**
 * Generate a sample CSV string for a schema (for template downloads).
 */
function generateSampleCSV(importSchema) {
  const headerRow = importSchema.columns.map(c => c.name).join(',');
  const sampleValues = importSchema.columns.map(col => {
    switch (col.type) {
      case 'number': return '100';
      case 'date': return '2026-01-01';
      default: return 'SAMPLE';
    }
  });
  return headerRow + '\n' + sampleValues.join(',');
}
