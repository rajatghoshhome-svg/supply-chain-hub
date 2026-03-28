/**
 * CSV Import Route
 *
 * POST /api/import/csv — Upload and validate CSV data
 *
 * Pipeline:
 *   1. Size check (50MB limit)
 *   2. CSV parsing + sanitization (formula stripping, injection prevention)
 *   3. Self-healing validation (data health rules)
 *   4. Return structured results with row/column error locations
 *
 * The route does NOT write to the database directly. It returns
 * validated/sanitized data + health results for the frontend to
 * confirm before the service layer persists.
 */

import { Router } from 'express';
import { sanitizeCSV } from '../services/csv-sanitizer.js';
import { validateBatch } from '../services/data-health.js';
import { ValidationError } from '../middleware/error-handler.js';

export const importRouter = Router();

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// ─── POST /api/import/csv ─────────────────────────────────────────

importRouter.post('/csv', (req, res, next) => {
  try {
    const { csv, delimiter, hasHeader, targetTable, validationRules } = req.body;

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

    // Step 1: Parse + sanitize
    const sanitized = sanitizeCSV(csv, {
      delimiter: delimiter || ',',
      hasHeader: hasHeader !== false,
    });

    // Step 2: Convert rows to objects (using headers as keys)
    const records = sanitized.headers.length > 0
      ? sanitized.rows.map(row => {
          const record = {};
          sanitized.headers.forEach((header, i) => {
            record[header] = row[i] || '';
          });
          return record;
        })
      : sanitized.rows.map(row => row);

    // Step 3: Run data health validation
    const healthResults = validateBatch(
      records,
      validationRules || null
    );

    // Step 4: Return structured results
    res.json({
      status: 'ok',
      parsing: {
        headers: sanitized.headers,
        rowCount: sanitized.stats.totalRows,
        sanitizedCells: sanitized.stats.sanitizedCells,
        sanitizationIssues: sanitized.issues,
      },
      validation: {
        ...healthResults.summary,
        autoFixed: healthResults.autoFixed,
        flagged: healthResults.flagged,
        blocked: healthResults.blocked,
        autoReview: healthResults.autoReview,
      },
      // Include first 100 rows as preview
      preview: records.slice(0, 100),
      // Full data available if needed (for confirm step)
      totalRecords: records.length,
    });
  } catch (err) {
    next(err);
  }
});
