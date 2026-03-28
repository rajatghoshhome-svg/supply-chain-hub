/**
 * CSV Import Sanitizer
 *
 * Server-side CSV parsing with security hardening:
 *   1. Formula prefix stripping (=, +, -, @, \t, \r)
 *   2. Prompt injection sanitization (<system>, <human>, [INST] patterns)
 *   3. Field length limits
 *   4. Encoding normalization
 *   5. Row/column error tracking
 *
 * Pure functions — no DB, no side effects. Returns structured results
 * that the import route/service can act on.
 */

// ─── Formula Prefix Patterns ──────────────────────────────────────
// These characters at the start of a cell can trigger formula execution
// in spreadsheet applications (Excel, Google Sheets, LibreOffice)

const FORMULA_PREFIXES = /^[=+\-@\t\r]/;

// ─── Prompt Injection Patterns ────────────────────────────────────
// Patterns that could manipulate LLM behavior if CSV data is fed to AI

const INJECTION_PATTERNS = [
  /<system>/gi,
  /<\/system>/gi,
  /<human>/gi,
  /<\/human>/gi,
  /<assistant>/gi,
  /<\/assistant>/gi,
  /\[INST\]/gi,
  /\[\/INST\]/gi,
  /<<SYS>>/gi,
  /<<\/SYS>>/gi,
  /<\|im_start\|>/gi,
  /<\|im_end\|>/gi,
  /\bsystem:\s*you are\b/gi,
  /\bignore previous instructions\b/gi,
  /\bignore all previous\b/gi,
  /\bforget your instructions\b/gi,
  /\byou are now\b/gi,
  /\bact as\b/gi,
];

const MAX_FIELD_LENGTH = 10000;
const MAX_ROW_COUNT = 100000;

// ─── Sanitize a Single Cell Value ─────────────────────────────────

export function sanitizeCell(value, row, col) {
  if (value == null) return { value: '', issues: [] };

  let cleaned = String(value).trim();
  const issues = [];

  // Strip formula prefixes
  if (FORMULA_PREFIXES.test(cleaned)) {
    const original = cleaned;
    // Strip all leading formula characters
    cleaned = cleaned.replace(/^[=+\-@\t\r]+/, '');
    issues.push({
      type: 'formula_stripped',
      row,
      col,
      original: original.substring(0, 50),
      message: `Formula prefix stripped from cell (${row},${col})`,
    });
  }

  // Check for prompt injection
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(cleaned)) {
      const match = cleaned.match(pattern);
      cleaned = cleaned.replace(pattern, '');
      issues.push({
        type: 'injection_stripped',
        row,
        col,
        pattern: match?.[0],
        message: `Prompt injection pattern removed from cell (${row},${col})`,
      });
    }
    // Reset regex lastIndex for global patterns
    pattern.lastIndex = 0;
  }

  // Enforce field length limit
  if (cleaned.length > MAX_FIELD_LENGTH) {
    cleaned = cleaned.substring(0, MAX_FIELD_LENGTH);
    issues.push({
      type: 'truncated',
      row,
      col,
      message: `Field truncated to ${MAX_FIELD_LENGTH} chars at (${row},${col})`,
    });
  }

  return { value: cleaned, issues };
}

// ─── Parse CSV String ─────────────────────────────────────────────
// Lightweight CSV parser that handles quoted fields and escaped quotes.
// For production, consider csv-parse package. This handles the common cases.

export function parseCSV(csvString, { delimiter = ',' } = {}) {
  const rows = [];
  const len = csvString.length;
  let i = 0;
  let row = [];
  let field = '';
  let inQuotes = false;

  while (i < len) {
    const ch = csvString[i];

    if (inQuotes) {
      if (ch === '"') {
        // Peek next char
        if (i + 1 < len && csvString[i + 1] === '"') {
          // Escaped quote
          field += '"';
          i += 2;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === delimiter) {
        row.push(field);
        field = '';
        i++;
      } else if (ch === '\n' || (ch === '\r' && i + 1 < len && csvString[i + 1] === '\n')) {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        i += ch === '\r' ? 2 : 1;
      } else if (ch === '\r') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }

  // Last field/row
  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

// ─── Strip BOM + Sanitize Raw CSV Text ───────────────────────────
// Returns sanitized CSV text as a string (for callers that just need
// the cleaned text without parsing into rows/objects).

export function sanitizeCSVText(csvText) {
  if (typeof csvText !== 'string') return '';

  // Strip BOM markers (UTF-8, UTF-16 LE, UTF-16 BE)
  let text = csvText.replace(/^\uFEFF/, '').replace(/^\uFFFE/, '').replace(/^\uFEFF/, '');

  // Process line-by-line, cell-by-cell
  const lines = text.split(/\r?\n/);
  const sanitizedLines = [];

  for (const line of lines) {
    // Simple cell split respecting quotes
    const cells = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && i + 1 < line.length && line[i + 1] === '"') {
          current += '""';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
          current += ch;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
          current += ch;
        } else if (ch === ',') {
          cells.push(current);
          current = '';
        } else {
          current += ch;
        }
      }
    }
    cells.push(current);

    const sanitizedCells = cells.map(cell => {
      let val = cell;
      // Detect if cell is quoted
      const isQuoted = val.startsWith('"') && val.endsWith('"');
      let inner = isQuoted ? val.slice(1, -1).replace(/""/g, '"') : val;

      // Strip formula prefixes
      inner = inner.replace(/^[=+\-@\t\r]+/, '');

      // Strip prompt injection patterns
      for (const pattern of INJECTION_PATTERNS) {
        inner = inner.replace(pattern, '');
        pattern.lastIndex = 0;
      }

      // Re-quote if it was quoted or contains commas/newlines
      if (isQuoted || inner.includes(',') || inner.includes('"')) {
        return '"' + inner.replace(/"/g, '""') + '"';
      }
      return inner;
    });

    sanitizedLines.push(sanitizedCells.join(','));
  }

  return sanitizedLines.join('\n');
}

// ─── Parse and Validate Against Schema ───────────────────────────
// Sanitizes, parses, then validates each row against a column schema.

export function parseAndValidate(csvText, schema) {
  // Sanitize first
  const sanitizedText = sanitizeCSVText(csvText);

  // Parse into structured form
  const parsed = sanitizeCSV(sanitizedText, { delimiter: ',', hasHeader: true });

  const errors = [];
  const warnings = [];
  const rows = [];

  // Build column lookup from schema
  const columnDefs = schema && schema.columns ? schema.columns : [];
  const headerLower = parsed.headers.map(h => h.toLowerCase().trim());

  // Map schema columns to header indices
  const colMap = columnDefs.map(col => {
    const idx = headerLower.indexOf(col.name.toLowerCase().trim());
    return { ...col, idx };
  });

  // Check for missing required columns
  for (const col of colMap) {
    if (col.idx === -1 && col.required) {
      errors.push({
        row: 0,
        column: col.name,
        message: `Required column "${col.name}" not found in CSV headers`,
      });
    }
  }

  // Validate each data row
  for (let r = 0; r < parsed.rows.length; r++) {
    const rawRow = parsed.rows[r];
    const rowObj = {};

    // Build row object from headers
    for (let c = 0; c < parsed.headers.length; c++) {
      rowObj[parsed.headers[c]] = rawRow[c] || '';
    }

    // Validate against schema columns
    for (const col of colMap) {
      if (col.idx === -1) continue;
      const val = (rawRow[col.idx] || '').trim();

      // Required check
      if (col.required && val === '') {
        errors.push({
          row: r + 1,
          column: col.name,
          message: `Required field "${col.name}" is empty at row ${r + 1}`,
        });
        continue;
      }

      if (val === '') continue; // optional and empty is fine

      // Type validation
      if (col.type === 'number') {
        const num = Number(val);
        if (isNaN(num)) {
          errors.push({
            row: r + 1,
            column: col.name,
            message: `Expected number for "${col.name}" at row ${r + 1}, got "${val}"`,
          });
        } else {
          rowObj[col.name] = num;
        }
      } else if (col.type === 'date') {
        const d = new Date(val);
        if (isNaN(d.getTime())) {
          errors.push({
            row: r + 1,
            column: col.name,
            message: `Invalid date for "${col.name}" at row ${r + 1}, got "${val}"`,
          });
        }
      }
      // 'string' type always passes
    }

    rows.push(rowObj);
  }

  return { rows, errors, warnings };
}

// ─── Sanitize Full CSV ────────────────────────────────────────────

export function sanitizeCSV(csvString, { delimiter = ',', hasHeader = true } = {}) {
  const allIssues = [];
  const rows = parseCSV(csvString, { delimiter });

  if (rows.length === 0) {
    return { headers: [], rows: [], issues: [], stats: { totalRows: 0, sanitizedCells: 0, blockedRows: 0 } };
  }

  // Row count limit
  if (rows.length > MAX_ROW_COUNT) {
    return {
      headers: [],
      rows: [],
      issues: [{ type: 'row_limit_exceeded', message: `CSV exceeds maximum row count of ${MAX_ROW_COUNT}` }],
      stats: { totalRows: rows.length, sanitizedCells: 0, blockedRows: rows.length },
    };
  }

  // Extract headers
  let headers = [];
  let dataStartIdx = 0;

  if (hasHeader && rows.length > 0) {
    headers = rows[0].map((h, col) => {
      const { value, issues } = sanitizeCell(h, 0, col);
      allIssues.push(...issues);
      return value;
    });
    dataStartIdx = 1;
  }

  // Sanitize data rows
  const sanitizedRows = [];
  let sanitizedCellCount = 0;

  for (let r = dataStartIdx; r < rows.length; r++) {
    const sanitizedRow = [];
    for (let c = 0; c < rows[r].length; c++) {
      const { value, issues } = sanitizeCell(rows[r][c], r, c);
      sanitizedRow.push(value);
      if (issues.length > 0) {
        sanitizedCellCount++;
        allIssues.push(...issues);
      }
    }
    sanitizedRows.push(sanitizedRow);
  }

  return {
    headers,
    rows: sanitizedRows,
    issues: allIssues,
    stats: {
      totalRows: sanitizedRows.length,
      sanitizedCells: sanitizedCellCount,
      blockedRows: 0,
    },
  };
}
