/**
 * Onboarding / Implementation Wizard Routes
 *
 * Guided multi-step flow: "I have spreadsheets" → "my supply chain is running"
 *
 * POST /api/onboarding/upload       — Upload CSV for a specific data type
 * POST /api/onboarding/map-columns  — AI-powered column mapping (heuristic)
 * POST /api/onboarding/validate     — Full validation on mapped data
 * GET  /api/onboarding/status       — Current onboarding progress
 * POST /api/onboarding/complete     — Mark complete, trigger initial cascade
 *
 * Reuses the existing csv-sanitizer and data-health services.
 */

import { Router } from 'express';
import { sanitizeCSVText, sanitizeCSV, parseAndValidate } from '../services/csv-sanitizer.js';
import { validateBatch, runHealthChecks } from '../services/data-health.js';
import { triggerFullCascade } from '../services/cascade-handlers.js';
import { ValidationError } from '../middleware/error-handler.js';

export const onboardingRouter = Router();

// ─── In-Memory Onboarding State ──────────────────────────────────

const DATA_TYPES = ['skus', 'locations', 'bom', 'demand-history', 'inventory', 'planning-params'];

const REQUIRED_TYPES = ['skus', 'locations', 'bom', 'demand-history'];
const RECOMMENDED_TYPES = ['inventory'];
const OPTIONAL_TYPES = ['planning-params'];

const onboardingState = {
  started: false,
  completed: false,
  uploads: {},
  // uploads[dataType] = { rowCount, status, preview, validation, healthChecks, columnMapping, uploadedAt }
};

// ─── Import Schemas (extended from import.js for onboarding types) ───

const ONBOARDING_SCHEMAS = {
  skus: {
    label: 'SKUs / Items',
    columns: [
      { name: 'sku_code', type: 'string', required: true },
      { name: 'name', type: 'string', required: true },
      { name: 'category', type: 'string', required: false },
      { name: 'unit_cost', type: 'number', required: false },
      { name: 'uom', type: 'string', required: false },
      { name: 'level', type: 'number', required: false },
    ],
  },
  locations: {
    label: 'Locations / Sites',
    columns: [
      { name: 'location_code', type: 'string', required: true },
      { name: 'name', type: 'string', required: true },
      { name: 'type', type: 'string', required: false },
      { name: 'region', type: 'string', required: false },
      { name: 'capacity', type: 'number', required: false },
    ],
  },
  bom: {
    label: 'Bills of Material',
    columns: [
      { name: 'parent_code', type: 'string', required: true },
      { name: 'child_code', type: 'string', required: true },
      { name: 'qty_per', type: 'number', required: true },
      { name: 'scrap_pct', type: 'number', required: false },
      { name: 'lead_time_offset', type: 'number', required: false },
      { name: 'uom', type: 'string', required: false },
    ],
  },
  'demand-history': {
    label: 'Demand History',
    columns: [
      { name: 'sku_code', type: 'string', required: true },
      { name: 'period', type: 'date', required: true },
      { name: 'quantity', type: 'number', required: true },
      { name: 'location_code', type: 'string', required: false },
      { name: 'customer', type: 'string', required: false },
    ],
  },
  inventory: {
    label: 'Inventory Positions',
    columns: [
      { name: 'sku_code', type: 'string', required: true },
      { name: 'location_code', type: 'string', required: true },
      { name: 'on_hand', type: 'number', required: true },
      { name: 'in_transit', type: 'number', required: false },
      { name: 'allocated', type: 'number', required: false },
      { name: 'unit_cost', type: 'number', required: false },
    ],
  },
  'planning-params': {
    label: 'Planning Parameters',
    columns: [
      { name: 'sku_code', type: 'string', required: true },
      { name: 'lead_time_days', type: 'number', required: true },
      { name: 'safety_stock', type: 'number', required: false },
      { name: 'lot_size_rule', type: 'string', required: false },
      { name: 'lot_size_value', type: 'number', required: false },
      { name: 'reorder_point', type: 'number', required: false },
    ],
  },
};

// ─── Column Mapping Heuristics ───────────────────────────────────

const COLUMN_ALIASES = {
  sku_code: ['item number', 'sku', 'part number', 'material', 'item', 'item code', 'sku code', 'part', 'product code', 'product', 'material number', 'item_number', 'sku_code', 'part_number'],
  name: ['description', 'name', 'item name', 'product name', 'sku name', 'material description', 'desc', 'item_name', 'product_name'],
  location_code: ['plant', 'factory', 'manufacturing site', 'location', 'site', 'warehouse', 'dc', 'location code', 'facility', 'loc', 'location_code', 'plant_code', 'site_code'],
  lead_time_days: ['lead time', 'lt', 'lead time days', 'leadtime', 'lead_time', 'lt days', 'lead_time_days', 'lead time (days)'],
  safety_stock: ['safety stock', 'ss', 'min stock', 'safety_stock', 'minimum stock', 'buffer stock', 'buffer'],
  quantity: ['quantity', 'qty', 'amount', 'units', 'demand', 'forecast', 'volume', 'order qty', 'demand qty'],
  period: ['date', 'period', 'week', 'month', 'time', 'period date', 'forecast date', 'demand date', 'year-month'],
  parent_code: ['parent', 'parent sku', 'assembly', 'parent code', 'parent_code', 'parent_sku', 'finished good', 'fg'],
  child_code: ['child', 'component', 'child sku', 'child code', 'child_code', 'child_sku', 'raw material', 'component code', 'material'],
  qty_per: ['qty per', 'usage', 'quantity per', 'qty_per', 'quantity_per', 'usage qty', 'bom qty', 'per assembly'],
  on_hand: ['on hand', 'oh', 'stock', 'available', 'on_hand', 'inventory', 'stock on hand', 'current stock', 'available qty'],
  unit_cost: ['cost', 'unit cost', 'price', 'unit_cost', 'standard cost', 'std cost', 'unit price'],
  category: ['category', 'type', 'group', 'product type', 'item type', 'class', 'product group', 'family'],
  uom: ['uom', 'unit', 'unit of measure', 'measure', 'units'],
  region: ['region', 'area', 'zone', 'territory', 'geography'],
  capacity: ['capacity', 'max capacity', 'production capacity', 'cap'],
  scrap_pct: ['scrap', 'scrap pct', 'scrap %', 'scrap_pct', 'scrap rate', 'waste', 'waste %'],
  lead_time_offset: ['lead time offset', 'offset', 'lead_time_offset', 'lt offset'],
  in_transit: ['in transit', 'in_transit', 'transit', 'on order', 'incoming'],
  allocated: ['allocated', 'reserved', 'committed', 'alloc'],
  customer: ['customer', 'client', 'account', 'customer name', 'cust'],
  lot_size_rule: ['lot size rule', 'lot_size_rule', 'lot sizing', 'lot rule', 'ordering policy'],
  lot_size_value: ['lot size value', 'lot_size_value', 'lot size', 'lot qty', 'order qty'],
  reorder_point: ['reorder point', 'rop', 'reorder_point', 'reorder level', 'min level'],
  type: ['type', 'location type', 'site type', 'facility type'],
  level: ['level', 'bom level', 'tier'],
};

function mapColumns(headers, dataType) {
  const schema = ONBOARDING_SCHEMAS[dataType];
  if (!schema) return { mappings: [], unmapped: [...headers] };

  const expectedFields = schema.columns.map(c => c.name);
  const mappings = [];
  const mappedHeaders = new Set();

  for (const targetField of expectedFields) {
    const aliases = COLUMN_ALIASES[targetField] || [targetField];
    let bestMatch = null;
    let bestConfidence = 0;

    for (const header of headers) {
      if (mappedHeaders.has(header)) continue;
      const headerLower = header.toLowerCase().trim();

      // Exact match
      if (headerLower === targetField.toLowerCase() || headerLower === targetField.replace(/_/g, ' ')) {
        bestMatch = header;
        bestConfidence = 100;
        break;
      }

      // Alias match
      for (const alias of aliases) {
        if (headerLower === alias.toLowerCase()) {
          bestMatch = header;
          bestConfidence = 95;
          break;
        }
      }
      if (bestConfidence >= 95) break;

      // Partial match — alias is contained in header or vice versa
      for (const alias of aliases) {
        const a = alias.toLowerCase();
        if (headerLower.includes(a) || a.includes(headerLower)) {
          const score = 70 + Math.min(20, (Math.min(headerLower.length, a.length) / Math.max(headerLower.length, a.length)) * 20);
          if (score > bestConfidence) {
            bestMatch = header;
            bestConfidence = Math.round(score);
          }
        }
      }
    }

    // Collect alternatives (other possible headers for this field, lower confidence)
    const alternatives = [];
    if (bestMatch) {
      for (const header of headers) {
        if (header === bestMatch || mappedHeaders.has(header)) continue;
        const headerLower = header.toLowerCase().trim();
        const aliases2 = COLUMN_ALIASES[targetField] || [];
        for (const alias of aliases2) {
          if (headerLower.includes(alias.toLowerCase()) || alias.toLowerCase().includes(headerLower)) {
            alternatives.push(header);
            break;
          }
        }
      }
    }

    if (bestMatch && bestConfidence >= 60) {
      mappings.push({
        sourceColumn: bestMatch,
        targetField,
        confidence: bestConfidence,
        alternatives,
      });
      mappedHeaders.add(bestMatch);
    } else {
      mappings.push({
        sourceColumn: null,
        targetField,
        confidence: 0,
        alternatives: [],
      });
    }
  }

  const unmapped = headers.filter(h => !mappedHeaders.has(h));

  return { mappings, unmapped };
}

// ─── Build health check data structure ───────────────────────────

function buildHealthData(dataType, rows) {
  const data = { skus: [], boms: [], inventory: [], planningParams: [], demand: [] };

  switch (dataType) {
    case 'skus':
      data.skus = rows.map(r => ({
        code: r.sku_code || r.code || '',
        name: r.name || '',
      }));
      break;

    case 'bom':
      data.boms = rows.map(r => ({
        parent: r.parent_code || r.parent || '',
        child: r.child_code || r.child || '',
        quantityPer: r.qty_per != null ? Number(r.qty_per) : null,
        scrapPct: r.scrap_pct != null ? Number(r.scrap_pct) : null,
      }));
      // For BOM validation, register parents as the known SKU universe
      const skuSet = new Set();
      for (const r of rows) {
        const parent = (r.parent_code || r.parent || '').toString().trim();
        if (parent) skuSet.add(parent);
      }
      data.skus = Array.from(skuSet).map(code => ({ code }));
      break;

    case 'demand-history':
      data.demand = rows.map(r => ({
        sku: r.sku_code || r.sku || '',
        period: r.period || '',
        quantity: r.quantity != null ? Number(r.quantity) : null,
      }));
      break;

    case 'inventory':
      data.inventory = rows.map(r => ({
        sku: r.sku_code || r.sku || '',
        location: r.location_code || r.location || '',
        onHand: r.on_hand != null ? Number(r.on_hand) : null,
        inTransit: r.in_transit != null ? Number(r.in_transit) : null,
      }));
      break;

    case 'planning-params':
      data.planningParams = rows.map(r => ({
        sku: r.sku_code || r.sku || '',
        lead_time_weeks: r.lead_time_days != null ? Math.ceil(Number(r.lead_time_days) / 7) : null,
        safety_stock: r.safety_stock != null ? Number(r.safety_stock) : null,
        lot_size_rule: r.lot_size_rule || null,
        lot_size_value: r.lot_size_value != null ? Number(r.lot_size_value) : null,
      }));
      data.skus = rows.map(r => ({ code: r.sku_code || r.sku || '' }));
      break;

    case 'locations':
      // No specific health checks for locations, but we can still validate
      break;
  }

  return data;
}

// ─── POST /api/onboarding/upload ─────────────────────────────────

onboardingRouter.post('/upload', (req, res, next) => {
  try {
    const { csv, dataType } = req.body;

    if (!csv || typeof csv !== 'string') {
      throw new ValidationError('CSV data is required as a string in the "csv" field');
    }

    if (!dataType || !DATA_TYPES.includes(dataType)) {
      throw new ValidationError(`dataType must be one of: ${DATA_TYPES.join(', ')}`);
    }

    // Size check
    const byteSize = Buffer.byteLength(csv, 'utf-8');
    if (byteSize > 50 * 1024 * 1024) {
      throw new ValidationError('CSV exceeds maximum size of 50MB');
    }

    // Step 1: Sanitize
    const sanitizedText = sanitizeCSVText(csv);

    // Step 2: Parse
    const sanitized = sanitizeCSV(sanitizedText, { delimiter: ',', hasHeader: true });
    const headers = sanitized.headers;
    const rawRows = sanitized.rows;

    if (rawRows.length === 0) {
      throw new ValidationError('CSV contains no data rows');
    }

    // Build row objects from headers
    const rows = rawRows.map(row => {
      const record = {};
      headers.forEach((header, i) => {
        record[header] = row[i] || '';
      });
      return record;
    });

    // Step 3: Column mapping
    const columnMapping = mapColumns(headers, dataType);

    // Step 4: Apply column mappings to build normalized rows
    const mappedRows = rows.map(row => {
      const mapped = {};
      for (const m of columnMapping.mappings) {
        if (m.sourceColumn && m.confidence >= 60) {
          mapped[m.targetField] = row[m.sourceColumn] || '';
        }
      }
      return mapped;
    });

    // Step 5: Run schema validation on mapped data
    const schema = ONBOARDING_SCHEMAS[dataType];
    const validationErrors = [];
    const validationWarnings = [];

    for (let r = 0; r < mappedRows.length; r++) {
      for (const col of schema.columns) {
        const val = (mappedRows[r][col.name] || '').toString().trim();

        if (col.required && val === '') {
          // Check if we even have a mapping for this column
          const mapping = columnMapping.mappings.find(m => m.targetField === col.name);
          if (mapping && mapping.sourceColumn) {
            validationErrors.push({
              row: r + 1,
              column: col.name,
              message: `Required field "${col.name}" is empty at row ${r + 1}`,
            });
          } else {
            // Missing column entirely — add as warning not per-row error
            if (r === 0) {
              validationWarnings.push({
                row: 0,
                column: col.name,
                message: `Required column "${col.name}" has no mapping — check your column headers`,
              });
            }
          }
          continue;
        }

        if (val === '') continue;

        if (col.type === 'number' && isNaN(Number(val))) {
          validationErrors.push({
            row: r + 1,
            column: col.name,
            message: `Expected number for "${col.name}" at row ${r + 1}, got "${val}"`,
          });
        } else if (col.type === 'number') {
          mappedRows[r][col.name] = Number(val);
        }

        if (col.type === 'date') {
          const d = new Date(val);
          if (isNaN(d.getTime())) {
            validationErrors.push({
              row: r + 1,
              column: col.name,
              message: `Invalid date for "${col.name}" at row ${r + 1}, got "${val}"`,
            });
          }
        }
      }
    }

    // Step 6: Run health checks
    let healthChecks = { autoFixed: [], flagged: [], blocked: [] };
    if (mappedRows.length > 0) {
      const healthData = buildHealthData(dataType, mappedRows);
      healthChecks = runHealthChecks(healthData);
    }

    // Step 7: Determine status
    const hasBlockers = validationErrors.length > 0 || healthChecks.blocked.length > 0;
    const hasUnmappedRequired = schema.columns
      .filter(c => c.required)
      .some(c => {
        const m = columnMapping.mappings.find(mm => mm.targetField === c.name);
        return !m || !m.sourceColumn || m.confidence < 60;
      });

    const status = hasBlockers || hasUnmappedRequired ? 'errors' : 'ready';

    // Preview: first 5 rows with original headers
    const preview = rows.slice(0, 5);

    // Save to onboarding state
    onboardingState.started = true;
    onboardingState.uploads[dataType] = {
      rowCount: rows.length,
      status,
      preview,
      validation: { errors: validationErrors, warnings: validationWarnings },
      healthChecks,
      columnMapping,
      uploadedAt: new Date().toISOString(),
    };

    res.json({
      status,
      rowCount: rows.length,
      preview,
      validation: {
        errors: validationErrors,
        warnings: validationWarnings,
      },
      healthChecks: {
        autoFixed: healthChecks.autoFixed,
        flagged: healthChecks.flagged,
        blocked: healthChecks.blocked,
      },
      columnMapping: {
        detected: headers,
        expected: schema.columns.map(c => c.name),
        suggestions: columnMapping.mappings,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/onboarding/map-columns ────────────────────────────

onboardingRouter.post('/map-columns', (req, res, next) => {
  try {
    const { headers, dataType, sampleRows } = req.body;

    if (!headers || !Array.isArray(headers)) {
      throw new ValidationError('headers must be an array of strings');
    }

    if (!dataType || !DATA_TYPES.includes(dataType)) {
      throw new ValidationError(`dataType must be one of: ${DATA_TYPES.join(', ')}`);
    }

    const result = mapColumns(headers, dataType);

    res.json({
      mappings: result.mappings,
      unmapped: result.unmapped,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/onboarding/validate ───────────────────────────────

onboardingRouter.post('/validate', (req, res, next) => {
  try {
    const { dataType, rows, mappings } = req.body;

    if (!dataType || !DATA_TYPES.includes(dataType)) {
      throw new ValidationError(`dataType must be one of: ${DATA_TYPES.join(', ')}`);
    }

    if (!rows || !Array.isArray(rows)) {
      throw new ValidationError('rows must be an array');
    }

    // Apply column mappings if provided
    const mappedRows = mappings
      ? rows.map(row => {
          const mapped = {};
          for (const m of mappings) {
            if (m.sourceColumn && m.targetField) {
              mapped[m.targetField] = row[m.sourceColumn] || '';
            }
          }
          return mapped;
        })
      : rows;

    // Schema validation
    const schema = ONBOARDING_SCHEMAS[dataType];
    const errors = [];
    const warnings = [];

    for (let r = 0; r < mappedRows.length; r++) {
      for (const col of schema.columns) {
        const val = (mappedRows[r][col.name] || '').toString().trim();
        if (col.required && val === '') {
          errors.push({ row: r + 1, column: col.name, message: `Required "${col.name}" is empty at row ${r + 1}` });
        }
        if (val && col.type === 'number' && isNaN(Number(val))) {
          errors.push({ row: r + 1, column: col.name, message: `Expected number for "${col.name}" at row ${r + 1}` });
        }
      }
    }

    // Health checks
    let healthChecks = { autoFixed: [], flagged: [], blocked: [] };
    if (mappedRows.length > 0) {
      const healthData = buildHealthData(dataType, mappedRows);
      healthChecks = runHealthChecks(healthData);
    }

    const valid = errors.length === 0 && healthChecks.blocked.length === 0;

    // Update state
    if (onboardingState.uploads[dataType]) {
      onboardingState.uploads[dataType].status = valid ? 'ready' : 'errors';
      onboardingState.uploads[dataType].validation = { errors, warnings };
      onboardingState.uploads[dataType].healthChecks = healthChecks;
    }

    res.json({
      valid,
      errors,
      warnings,
      autoFixed: healthChecks.autoFixed,
      summary: {
        totalRows: mappedRows.length,
        errorCount: errors.length,
        warningCount: warnings.length,
        autoFixedCount: healthChecks.autoFixed.length,
        flaggedCount: healthChecks.flagged.length,
        blockedCount: healthChecks.blocked.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/onboarding/status ──────────────────────────────────

onboardingRouter.get('/status', (req, res) => {
  const types = DATA_TYPES.map(dt => {
    const upload = onboardingState.uploads[dt];
    const requirement = REQUIRED_TYPES.includes(dt) ? 'required'
      : RECOMMENDED_TYPES.includes(dt) ? 'recommended' : 'optional';

    return {
      dataType: dt,
      label: ONBOARDING_SCHEMAS[dt].label,
      requirement,
      status: upload ? upload.status : 'not-started',
      rowCount: upload ? upload.rowCount : 0,
      uploadedAt: upload ? upload.uploadedAt : null,
      errorCount: upload ? upload.validation.errors.length : 0,
      warningCount: upload ? upload.validation.warnings.length : 0,
      autoFixedCount: upload ? upload.healthChecks.autoFixed.length : 0,
    };
  });

  const allRequiredReady = REQUIRED_TYPES.every(dt => {
    const upload = onboardingState.uploads[dt];
    return upload && upload.status === 'ready';
  });

  res.json({
    started: onboardingState.started,
    completed: onboardingState.completed,
    canComplete: allRequiredReady,
    types,
    progress: {
      uploaded: Object.keys(onboardingState.uploads).length,
      total: DATA_TYPES.length,
      requiredDone: REQUIRED_TYPES.filter(dt => onboardingState.uploads[dt]?.status === 'ready').length,
      requiredTotal: REQUIRED_TYPES.length,
    },
  });
});

// ─── POST /api/onboarding/complete ───────────────────────────────

onboardingRouter.post('/complete', async (req, res, next) => {
  try {
    // Check all required types are uploaded and valid
    for (const dt of REQUIRED_TYPES) {
      const upload = onboardingState.uploads[dt];
      if (!upload || upload.status !== 'ready') {
        throw new ValidationError(
          `Required data type "${dt}" is not yet uploaded and validated. Current status: ${upload?.status || 'not-started'}`
        );
      }
    }

    // Mark as complete
    onboardingState.completed = true;

    // Trigger initial cascade run
    let planRunId = null;
    let cascadeError = null;
    try {
      const result = await triggerFullCascade({});
      planRunId = result.planRunId;
    } catch (err) {
      cascadeError = err.message;
    }

    res.json({
      planRunId,
      message: cascadeError
        ? `Onboarding complete. Initial cascade encountered an issue: ${cascadeError}. You can retry from the dashboard.`
        : 'Onboarding complete! Your initial planning cascade is running.',
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/onboarding/templates ───────────────────────────────
// Returns template CSVs for each data type (column headers + sample row)

onboardingRouter.get('/templates', (req, res) => {
  const templates = {};
  for (const [key, schema] of Object.entries(ONBOARDING_SCHEMAS)) {
    const headerRow = schema.columns.map(c => c.name).join(',');
    const sampleValues = schema.columns.map(col => {
      switch (col.type) {
        case 'number': return '100';
        case 'date': return '2026-01-01';
        default: return 'SAMPLE';
      }
    });
    templates[key] = {
      label: schema.label,
      columns: schema.columns,
      csv: headerRow + '\n' + sampleValues.join(','),
    };
  }
  res.json({ templates });
});
