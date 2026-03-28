/**
 * Onboarding / Implementation Wizard Routes
 *
 * Guided multi-step flow: "I have spreadsheets" -> "my supply chain is running"
 *
 * POST /api/onboarding/upload       — Upload CSV (multipart or JSON) for a data type
 * POST /api/onboarding/map-columns  — AI-powered column mapping (heuristic)
 * POST /api/onboarding/validate     — Full validation on mapped data
 * GET  /api/onboarding/status       — Current onboarding progress
 * POST /api/onboarding/complete     — Insert all data into DB, trigger cascade
 * GET  /api/onboarding/templates    — Download CSV templates per data type
 * GET  /api/onboarding/templates/:type/csv — Download a single template as CSV file
 *
 * Reuses the existing csv-sanitizer and data-health services.
 */

import { Router } from 'express';
import multer from 'multer';
import { sanitizeCSVText, sanitizeCSV, parseAndValidate } from '../services/csv-sanitizer.js';
import { validateBatch, runHealthChecks } from '../services/data-health.js';
import { triggerFullCascade } from '../services/cascade-handlers.js';
import { insertAllOnboardingData } from '../services/onboarding-persistence.js';
import { ValidationError } from '../middleware/error-handler.js';

export const onboardingRouter = Router();

// ─── Multer config for multipart file uploads ────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    // Accept CSV and plain text files
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

// ─── In-Memory Onboarding State ──────────────────────────────────

const DATA_TYPES = [
  'skus', 'locations', 'bom', 'demand-history', 'inventory',
  'planning-params', 'distribution-network', 'work-centers',
];

const REQUIRED_TYPES = ['skus', 'locations', 'bom', 'demand-history'];
const RECOMMENDED_TYPES = ['inventory'];
const OPTIONAL_TYPES = ['planning-params', 'distribution-network', 'work-centers'];

const onboardingState = {
  started: false,
  completed: false,
  uploads: {},
  // uploads[dataType] = {
  //   rowCount, status, preview, validation, healthChecks,
  //   columnMapping, uploadedAt, mappedRows (staged for DB insert)
  // }
};

// ─── Import Schemas (all 8 data types) ──────────────────────────

const ONBOARDING_SCHEMAS = {
  skus: {
    label: 'SKUs / Items',
    description: 'Master list of finished goods, subassemblies, and raw materials',
    columns: [
      { name: 'sku_code', type: 'string', required: true },
      { name: 'name', type: 'string', required: true },
      { name: 'category', type: 'string', required: false },
      { name: 'unit_cost', type: 'number', required: false },
      { name: 'uom', type: 'string', required: false },
      { name: 'level', type: 'number', required: false },
    ],
    sampleRow: { sku_code: 'FG-001', name: 'Protein Bar 12-Pack', category: 'bars', unit_cost: '24.99', uom: 'cases', level: '0' },
  },
  locations: {
    label: 'Locations / Sites',
    description: 'Plants, distribution centers, and suppliers',
    columns: [
      { name: 'location_code', type: 'string', required: true },
      { name: 'name', type: 'string', required: true },
      { name: 'type', type: 'string', required: false },
      { name: 'region', type: 'string', required: false },
      { name: 'capacity', type: 'number', required: false },
    ],
    sampleRow: { location_code: 'PLT-CHI', name: 'Chicago Plant', type: 'plant', region: 'Midwest', capacity: '5000' },
  },
  bom: {
    label: 'Bills of Material',
    description: 'Parent-child relationships defining product structure',
    columns: [
      { name: 'parent_code', type: 'string', required: true },
      { name: 'child_code', type: 'string', required: true },
      { name: 'qty_per', type: 'number', required: true },
      { name: 'scrap_pct', type: 'number', required: false },
      { name: 'lead_time_offset', type: 'number', required: false },
      { name: 'uom', type: 'string', required: false },
    ],
    sampleRow: { parent_code: 'FG-001', child_code: 'SUB-010', qty_per: '2', scrap_pct: '1.5', lead_time_offset: '0', uom: 'units' },
  },
  'demand-history': {
    label: 'Demand History',
    description: 'Historical demand by SKU and period for forecasting',
    columns: [
      { name: 'sku_code', type: 'string', required: true },
      { name: 'period', type: 'date', required: true },
      { name: 'quantity', type: 'number', required: true },
      { name: 'location_code', type: 'string', required: false },
      { name: 'customer', type: 'string', required: false },
    ],
    sampleRow: { sku_code: 'FG-001', period: '2026-01-06', quantity: '450', location_code: 'DC-EAST', customer: '' },
  },
  inventory: {
    label: 'Inventory Positions',
    description: 'Current on-hand quantities by SKU and location',
    columns: [
      { name: 'sku_code', type: 'string', required: true },
      { name: 'location_code', type: 'string', required: true },
      { name: 'on_hand', type: 'number', required: true },
      { name: 'in_transit', type: 'number', required: false },
      { name: 'allocated', type: 'number', required: false },
      { name: 'unit_cost', type: 'number', required: false },
    ],
    sampleRow: { sku_code: 'FG-001', location_code: 'DC-EAST', on_hand: '1200', in_transit: '300', allocated: '100', unit_cost: '24.99' },
  },
  'planning-params': {
    label: 'Planning Parameters',
    description: 'Lead times, safety stock, lot sizing rules per SKU',
    columns: [
      { name: 'sku_code', type: 'string', required: true },
      { name: 'lead_time_days', type: 'number', required: true },
      { name: 'safety_stock', type: 'number', required: false },
      { name: 'lot_size_rule', type: 'string', required: false },
      { name: 'lot_size_value', type: 'number', required: false },
      { name: 'reorder_point', type: 'number', required: false },
      { name: 'location_code', type: 'string', required: false },
    ],
    sampleRow: { sku_code: 'FG-001', lead_time_days: '14', safety_stock: '200', lot_size_rule: 'fixed-order-qty', lot_size_value: '500', reorder_point: '400', location_code: 'DC-EAST' },
  },
  'distribution-network': {
    label: 'Distribution Network',
    description: 'Transportation lanes between locations (source to destination)',
    columns: [
      { name: 'source_code', type: 'string', required: true },
      { name: 'dest_code', type: 'string', required: true },
      { name: 'lead_time_days', type: 'number', required: true },
      { name: 'cost_per_unit', type: 'number', required: false },
      { name: 'distance_miles', type: 'number', required: false },
    ],
    sampleRow: { source_code: 'PLT-CHI', dest_code: 'DC-EAST', lead_time_days: '3', cost_per_unit: '0.12', distance_miles: '790' },
  },
  'work-centers': {
    label: 'Work Centers',
    description: 'Production work centers with capacity at each plant',
    columns: [
      { name: 'work_center_code', type: 'string', required: true },
      { name: 'name', type: 'string', required: true },
      { name: 'location_code', type: 'string', required: false },
      { name: 'capacity_per_day', type: 'number', required: false },
      { name: 'capacity_uom', type: 'string', required: false },
    ],
    sampleRow: { work_center_code: 'WC-MIX-01', name: 'Mixing Line 1', location_code: 'PLT-CHI', capacity_per_day: '40', capacity_uom: 'hrs/day' },
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
  source_code: ['source', 'from', 'origin', 'source code', 'source_code', 'ship from', 'from location', 'from_code'],
  dest_code: ['destination', 'to', 'dest', 'dest code', 'dest_code', 'ship to', 'to location', 'to_code'],
  cost_per_unit: ['cost per unit', 'transit cost', 'freight cost', 'shipping cost', 'cost_per_unit', 'transport cost'],
  distance_miles: ['distance', 'miles', 'distance miles', 'distance_miles', 'km'],
  work_center_code: ['work center', 'wc', 'work center code', 'work_center_code', 'wc code', 'wc_code', 'machine', 'line'],
  capacity_per_day: ['capacity per day', 'daily capacity', 'capacity_per_day', 'hrs per day', 'hours per day'],
  capacity_uom: ['capacity uom', 'capacity_uom', 'cap uom', 'capacity unit'],
};

function mapColumns(headers, dataType) {
  const schemaObj = ONBOARDING_SCHEMAS[dataType];
  if (!schemaObj) return { mappings: [], unmapped: [...headers] };

  const expectedFields = schemaObj.columns.map(c => c.name);
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

      // Partial match
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

    // Collect alternatives
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

    case 'bom': {
      data.boms = rows.map(r => ({
        parent: r.parent_code || r.parent || '',
        child: r.child_code || r.child || '',
        quantityPer: r.qty_per != null ? Number(r.qty_per) : null,
        scrapPct: r.scrap_pct != null ? Number(r.scrap_pct) : null,
      }));
      const skuSet = new Set();
      for (const r of rows) {
        const parent = (r.parent_code || r.parent || '').toString().trim();
        if (parent) skuSet.add(parent);
      }
      data.skus = Array.from(skuSet).map(code => ({ code }));
      break;
    }

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
    case 'distribution-network':
    case 'work-centers':
      // No specific health checks for these, structural validation is sufficient
      break;
  }

  return data;
}

// ─── Helper: extract CSV text from request ───────────────────────

function extractCSVFromRequest(req) {
  // Case 1: Multipart file upload (multer)
  if (req.file) {
    return req.file.buffer.toString('utf-8');
  }

  // Case 2: JSON body with "csv" field
  if (req.body?.csv && typeof req.body.csv === 'string') {
    return req.body.csv;
  }

  // Case 3: Raw text body
  if (typeof req.body === 'string') {
    return req.body;
  }

  return null;
}

// ─── Helper: parse and map CSV ───────────────────────────────────

function parseAndMapCSV(csvText, dataType) {
  // Step 1: Sanitize
  const sanitizedText = sanitizeCSVText(csvText);

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

  // Column mapping
  const columnMapping = mapColumns(headers, dataType);

  // Apply column mappings to build normalized rows
  const mappedRows = rows.map(row => {
    const mapped = {};
    for (const m of columnMapping.mappings) {
      if (m.sourceColumn && m.confidence >= 60) {
        mapped[m.targetField] = row[m.sourceColumn] || '';
      }
    }
    return mapped;
  });

  // Schema validation
  const schemaObj = ONBOARDING_SCHEMAS[dataType];
  const validationErrors = [];
  const validationWarnings = [];

  for (let r = 0; r < mappedRows.length; r++) {
    for (const col of schemaObj.columns) {
      const val = (mappedRows[r][col.name] || '').toString().trim();

      if (col.required && val === '') {
        const mapping = columnMapping.mappings.find(m => m.targetField === col.name);
        if (mapping && mapping.sourceColumn) {
          validationErrors.push({
            row: r + 1,
            column: col.name,
            message: `Required field "${col.name}" is empty at row ${r + 1}`,
          });
        } else {
          if (r === 0) {
            validationWarnings.push({
              row: 0,
              column: col.name,
              message: `Required column "${col.name}" has no mapping -- check your column headers`,
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

  // Health checks
  let healthChecks = { autoFixed: [], flagged: [], blocked: [] };
  if (mappedRows.length > 0) {
    const healthData = buildHealthData(dataType, mappedRows);
    healthChecks = runHealthChecks(healthData);
  }

  // Determine status
  const hasBlockers = validationErrors.length > 0 || healthChecks.blocked.length > 0;
  const hasUnmappedRequired = schemaObj.columns
    .filter(c => c.required)
    .some(c => {
      const m = columnMapping.mappings.find(mm => mm.targetField === c.name);
      return !m || !m.sourceColumn || m.confidence < 60;
    });

  const status = hasBlockers || hasUnmappedRequired ? 'errors' : 'ready';

  return {
    status,
    rows,       // original rows with user's headers
    mappedRows, // normalized rows with target field names
    headers,
    columnMapping,
    validationErrors,
    validationWarnings,
    healthChecks,
    sanitizationIssues: sanitized.issues || [],
  };
}

// ─── POST /api/onboarding/upload ─────────────────────────────────
// Accepts multipart/form-data (file field: "file") OR JSON body { csv, dataType }

onboardingRouter.post('/upload', upload.single('file'), (req, res, next) => {
  try {
    const dataType = req.body?.dataType || req.query?.dataType;

    if (!dataType || !DATA_TYPES.includes(dataType)) {
      throw new ValidationError(`dataType must be one of: ${DATA_TYPES.join(', ')}`);
    }

    const csv = extractCSVFromRequest(req);
    if (!csv) {
      throw new ValidationError(
        'CSV data is required. Send as multipart file upload (field: "file") or JSON body { csv: "...", dataType: "..." }'
      );
    }

    // Size check
    const byteSize = Buffer.byteLength(csv, 'utf-8');
    if (byteSize > 50 * 1024 * 1024) {
      throw new ValidationError('CSV exceeds maximum size of 50MB');
    }

    const result = parseAndMapCSV(csv, dataType);

    // Preview: first 5 rows with original headers
    const preview = result.rows.slice(0, 5);
    const schemaObj = ONBOARDING_SCHEMAS[dataType];

    // Save to onboarding state (including mappedRows for later DB insert)
    onboardingState.started = true;
    onboardingState.uploads[dataType] = {
      rowCount: result.rows.length,
      status: result.status,
      preview,
      validation: { errors: result.validationErrors, warnings: result.validationWarnings },
      healthChecks: result.healthChecks,
      columnMapping: result.columnMapping,
      mappedRows: result.mappedRows,  // <-- staged data for DB insert
      uploadedAt: new Date().toISOString(),
    };

    res.json({
      status: result.status,
      rowCount: result.rows.length,
      preview,
      validation: {
        errors: result.validationErrors,
        warnings: result.validationWarnings,
      },
      healthChecks: {
        autoFixed: result.healthChecks.autoFixed,
        flagged: result.healthChecks.flagged,
        blocked: result.healthChecks.blocked,
      },
      columnMapping: {
        detected: result.headers,
        expected: schemaObj.columns.map(c => c.name),
        suggestions: result.columnMapping.mappings,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/onboarding/map-columns ────────────────────────────

onboardingRouter.post('/map-columns', (req, res, next) => {
  try {
    const { headers, dataType } = req.body;

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
    const schemaObj = ONBOARDING_SCHEMAS[dataType];
    const errors = [];
    const warnings = [];

    for (let r = 0; r < mappedRows.length; r++) {
      for (const col of schemaObj.columns) {
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

    // Update state with re-validated data
    if (onboardingState.uploads[dataType]) {
      onboardingState.uploads[dataType].status = valid ? 'ready' : 'errors';
      onboardingState.uploads[dataType].validation = { errors, warnings };
      onboardingState.uploads[dataType].healthChecks = healthChecks;
      onboardingState.uploads[dataType].mappedRows = mappedRows;
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
    const uploadEntry = onboardingState.uploads[dt];
    const requirement = REQUIRED_TYPES.includes(dt) ? 'required'
      : RECOMMENDED_TYPES.includes(dt) ? 'recommended' : 'optional';

    return {
      dataType: dt,
      label: ONBOARDING_SCHEMAS[dt].label,
      requirement,
      status: uploadEntry ? uploadEntry.status : 'not-started',
      rowCount: uploadEntry ? uploadEntry.rowCount : 0,
      uploadedAt: uploadEntry ? uploadEntry.uploadedAt : null,
      errorCount: uploadEntry ? uploadEntry.validation.errors.length : 0,
      warningCount: uploadEntry ? uploadEntry.validation.warnings.length : 0,
      autoFixedCount: uploadEntry ? uploadEntry.healthChecks.autoFixed.length : 0,
    };
  });

  const allRequiredReady = REQUIRED_TYPES.every(dt => {
    const uploadEntry = onboardingState.uploads[dt];
    return uploadEntry && uploadEntry.status === 'ready';
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
// Inserts all staged data into the database, then triggers cascade.

onboardingRouter.post('/complete', async (req, res, next) => {
  try {
    // Check all required types are uploaded and valid
    for (const dt of REQUIRED_TYPES) {
      const uploadEntry = onboardingState.uploads[dt];
      if (!uploadEntry || uploadEntry.status !== 'ready') {
        throw new ValidationError(
          `Required data type "${dt}" is not yet uploaded and validated. Current status: ${uploadEntry?.status || 'not-started'}`
        );
      }
    }

    // Gather all staged data
    const stagedData = {};
    for (const [dataType, uploadEntry] of Object.entries(onboardingState.uploads)) {
      if (uploadEntry.status === 'ready' && uploadEntry.mappedRows && uploadEntry.mappedRows.length > 0) {
        stagedData[dataType] = uploadEntry.mappedRows;
      }
    }

    if (Object.keys(stagedData).length === 0) {
      throw new ValidationError('No validated data available to insert. Upload CSV files first.');
    }

    // Insert all data into the database in FK-safe order
    const insertResults = await insertAllOnboardingData(stagedData);

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
      status: 'complete',
      insertResults: insertResults.results,
      insertErrors: insertResults.errors,
      planRunId,
      message: cascadeError
        ? `Onboarding complete. Data inserted successfully. Initial cascade encountered an issue: ${cascadeError}. You can retry from the dashboard.`
        : 'Onboarding complete! Data inserted and initial planning cascade is running.',
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/onboarding/templates ───────────────────────────────
// Returns template CSVs for each data type (column headers + sample row)

onboardingRouter.get('/templates', (req, res) => {
  const templates = {};
  for (const [key, schemaObj] of Object.entries(ONBOARDING_SCHEMAS)) {
    const headerRow = schemaObj.columns.map(c => c.name).join(',');
    const sampleValues = schemaObj.sampleRow
      ? schemaObj.columns.map(col => schemaObj.sampleRow[col.name] || '')
      : schemaObj.columns.map(col => {
          switch (col.type) {
            case 'number': return '100';
            case 'date': return '2026-01-01';
            default: return 'SAMPLE';
          }
        });
    templates[key] = {
      label: schemaObj.label,
      description: schemaObj.description || '',
      columns: schemaObj.columns,
      csv: headerRow + '\n' + sampleValues.join(','),
    };
  }
  res.json({ templates });
});

// ─── GET /api/onboarding/templates/:type/csv ─────────────────────
// Downloads a single template as a CSV file

onboardingRouter.get('/templates/:type/csv', (req, res, next) => {
  try {
    const schemaObj = ONBOARDING_SCHEMAS[req.params.type];
    if (!schemaObj) {
      throw new ValidationError(`Unknown data type: ${req.params.type}. Available: ${DATA_TYPES.join(', ')}`);
    }

    const headerRow = schemaObj.columns.map(c => c.name).join(',');
    const sampleValues = schemaObj.sampleRow
      ? schemaObj.columns.map(col => schemaObj.sampleRow[col.name] || '')
      : schemaObj.columns.map(col => {
          switch (col.type) {
            case 'number': return '100';
            case 'date': return '2026-01-01';
            default: return 'SAMPLE';
          }
        });
    const csv = headerRow + '\n' + sampleValues.join(',') + '\n';

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.type}-template.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/onboarding/reset ──────────────────────────────────
// Reset onboarding state (for re-onboarding or testing)

onboardingRouter.post('/reset', (req, res) => {
  onboardingState.started = false;
  onboardingState.completed = false;
  onboardingState.uploads = {};
  res.json({ status: 'reset', message: 'Onboarding state cleared.' });
});
