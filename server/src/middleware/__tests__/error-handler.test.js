import { describe, it, expect, vi } from 'vitest';
import {
  AppError,
  ValidationError,
  NotFoundError,
  EngineError,
  CascadeError,
  errorHandler,
  requestId,
} from '../error-handler.js';

// Mock Express res
function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    setHeader: vi.fn(),
  };
  return res;
}

function mockReq(overrides = {}) {
  return { method: 'GET', path: '/test', requestId: 'req_123', ...overrides };
}

describe('Error Classes', () => {
  it('AppError has correct properties', () => {
    const err = new AppError('Something broke', { status: 503, code: 'SERVICE_UNAVAILABLE', module: 'mrp' });
    expect(err.message).toBe('Something broke');
    expect(err.status).toBe(503);
    expect(err.code).toBe('SERVICE_UNAVAILABLE');
    expect(err.module).toBe('mrp');
    expect(err.isOperational).toBe(true);
  });

  it('ValidationError defaults to 400', () => {
    const err = new ValidationError('Bad input', { field: 'demand_qty' });
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.field).toBe('demand_qty');
  });

  it('NotFoundError defaults to 404', () => {
    const err = new NotFoundError('SKU', 'SKU-999');
    expect(err.status).toBe(404);
    expect(err.message).toContain('SKU-999');
  });

  it('EngineError defaults to 422', () => {
    const err = new EngineError('BOM circular', { engine: 'mrp', module: 'mrp' });
    expect(err.status).toBe(422);
    expect(err.engine).toBe('mrp');
  });

  it('CascadeError tracks step and planRunId', () => {
    const err = new CascadeError('Step failed', { step: 'mrp_run', planRunId: 'run_123' });
    expect(err.step).toBe('mrp_run');
    expect(err.planRunId).toBe('run_123');
  });
});

describe('errorHandler', () => {
  it('returns structured JSON for operational errors', () => {
    const err = new ValidationError('Invalid SKU code', { field: 'code', module: 'mrp' });
    const req = mockReq();
    const res = mockRes();

    errorHandler(err, req, res, () => {});

    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('Invalid SKU code');
    expect(body.error.field).toBe('code');
    expect(body.requestId).toBe('req_123');
    expect(body.timestamp).toBeDefined();
  });

  it('hides details for programmer errors', () => {
    const err = new TypeError('Cannot read property of undefined');
    const req = mockReq();
    const res = mockRes();

    errorHandler(err, req, res, () => {});

    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(body.error.message).toBe('An unexpected error occurred');
    // Should NOT leak the actual error
    expect(body.error.message).not.toContain('Cannot read');
  });

  it('includes requestId in response', () => {
    const err = new AppError('test');
    const req = mockReq({ requestId: 'req_abc_123' });
    const res = mockRes();

    errorHandler(err, req, res, () => {});

    const body = res.json.mock.calls[0][0];
    expect(body.requestId).toBe('req_abc_123');
  });

  it('includes module and engine in EngineError response', () => {
    const err = new EngineError('BOM explosion failed', {
      engine: 'mrp-engine',
      module: 'mrp',
      details: { skuCode: 'SKU-A' },
    });
    const req = mockReq();
    const res = mockRes();

    errorHandler(err, req, res, () => {});

    const body = res.json.mock.calls[0][0];
    expect(body.error.engine).toBe('mrp-engine');
    expect(body.error.module).toBe('mrp');
    expect(body.error.details.skuCode).toBe('SKU-A');
  });
});

describe('requestId middleware', () => {
  it('adds requestId to req and response header', () => {
    const req = {};
    const res = { setHeader: vi.fn() };
    const next = vi.fn();

    requestId(req, res, next);

    expect(req.requestId).toBeDefined();
    expect(req.requestId).toMatch(/^req_/);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', req.requestId);
    expect(next).toHaveBeenCalled();
  });

  it('generates unique IDs', () => {
    const ids = [];
    for (let i = 0; i < 10; i++) {
      const req = {};
      const res = { setHeader: vi.fn() };
      requestId(req, res, () => {});
      ids.push(req.requestId);
    }
    expect(new Set(ids).size).toBe(10);
  });
});
