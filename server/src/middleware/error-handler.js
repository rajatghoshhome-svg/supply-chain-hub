/**
 * Structured Error Handler
 *
 * Replaces generic catch-all with:
 *   - Error classification (operational vs programmer)
 *   - Structured JSON responses with request context
 *   - Module-specific error codes
 *   - Request ID tracking
 */

// ─── Error Classes ────────────────────────────────────────────────

export class AppError extends Error {
  constructor(message, { status = 500, code = 'INTERNAL_ERROR', module = null, details = null } = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.module = module;
    this.details = details;
    this.isOperational = true;
  }
}

export class ValidationError extends AppError {
  constructor(message, { field = null, details = null, module = null } = {}) {
    super(message, { status: 400, code: 'VALIDATION_ERROR', module, details });
    this.name = 'ValidationError';
    this.field = field;
  }
}

export class NotFoundError extends AppError {
  constructor(resource, id) {
    super(`${resource} not found: ${id}`, { status: 404, code: 'NOT_FOUND' });
    this.name = 'NotFoundError';
    this.resource = resource;
  }
}

export class EngineError extends AppError {
  constructor(message, { engine, module = null, details = null } = {}) {
    super(message, { status: 422, code: 'ENGINE_ERROR', module, details });
    this.name = 'EngineError';
    this.engine = engine;
  }
}

export class CascadeError extends AppError {
  constructor(message, { step, planRunId, details = null } = {}) {
    super(message, { status: 500, code: 'CASCADE_ERROR', module: 'cascade', details });
    this.name = 'CascadeError';
    this.step = step;
    this.planRunId = planRunId;
  }
}

// ─── Request ID Middleware ────────────────────────────────────────

let requestCounter = 0;

export function requestId(req, res, next) {
  requestCounter++;
  req.requestId = `req_${Date.now()}_${requestCounter}`;
  res.setHeader('X-Request-Id', req.requestId);
  next();
}

// ─── Error Handler ────────────────────────────────────────────────

export function errorHandler(err, req, res, _next) {
  // Determine if this is an operational error we understand
  const isOperational = err.isOperational === true;

  // Build structured error response
  const status = err.status || 500;
  const response = {
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: isOperational ? err.message : 'An unexpected error occurred',
      ...(err.module && { module: err.module }),
      ...(err.field && { field: err.field }),
      ...(err.details && { details: err.details }),
      ...(err.engine && { engine: err.engine }),
      ...(err.step && { step: err.step }),
    },
    requestId: req.requestId || null,
    timestamp: new Date().toISOString(),
  };

  // Log with context
  const logEntry = {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    status,
    error: err.message,
    ...(err.code && { code: err.code }),
    ...(err.module && { module: err.module }),
    ...(!isOperational && { stack: err.stack }),
  };

  if (isOperational && status < 500) {
    console.warn('[WARN]', JSON.stringify(logEntry));
  } else {
    console.error('[ERROR]', JSON.stringify(logEntry));
  }

  // Don't leak internals for programmer errors
  if (!isOperational) {
    response.error.message = 'An unexpected error occurred';
  }

  res.status(status).json(response);
}
