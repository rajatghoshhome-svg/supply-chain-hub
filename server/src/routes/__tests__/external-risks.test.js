import { describe, it, expect, vi, beforeAll } from 'vitest';
import express from 'express';
import { externalRisksRouter } from '../external-risks.js';

// Build a minimal express app wrapping the router
let app;
let server;
let baseUrl;

beforeAll(async () => {
  app = express();
  app.use('/api/external-risks', externalRisksRouter);

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });

  return () => {
    server.close();
  };
});

describe('GET /api/external-risks/geopolitical', () => {
  it('returns an array of geopolitical risks', async () => {
    const res = await fetch(`${baseUrl}/api/external-risks/geopolitical`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    // Each risk should have expected structure
    const risk = data[0];
    expect(risk).toHaveProperty('id');
    expect(risk).toHaveProperty('source', 'intelligence');
    expect(risk).toHaveProperty('type');
    expect(risk).toHaveProperty('severity');
    expect(risk).toHaveProperty('headline');
    expect(risk).toHaveProperty('suggestedMultiplier');
  });

  it('returns exactly 4 geopolitical risks', async () => {
    const res = await fetch(`${baseUrl}/api/external-risks/geopolitical`);
    const data = await res.json();
    expect(data).toHaveLength(4);
  });
});

describe('GET /api/external-risks/weather', () => {
  it('returns structured weather data (fallback when NWS unreachable)', async () => {
    // Mock global fetch to simulate NWS API being unreachable
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn((url, opts) => {
      // If the route handler calls NWS API, reject it
      if (typeof url === 'string' && url.includes('api.weather.gov')) {
        return Promise.reject(new Error('Network error'));
      }
      // For our own test request, use the real fetch
      return originalFetch(url, opts);
    });

    try {
      const res = await originalFetch(`${baseUrl}/api/external-risks/weather`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);

      // Should have weather risk structure
      const risk = data[0];
      expect(risk).toHaveProperty('source', 'nws');
      expect(risk).toHaveProperty('type', 'weather');
      expect(risk).toHaveProperty('severity');
      expect(risk).toHaveProperty('headline');
      expect(risk).toHaveProperty('suggestedMultiplier');
      expect(risk).toHaveProperty('location');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('GET /api/external-risks/all', () => {
  it('combines weather and geopolitical sources', async () => {
    // Mock NWS to return quickly with fallback
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn((url, opts) => {
      if (typeof url === 'string' && url.includes('api.weather.gov')) {
        return Promise.reject(new Error('Network error'));
      }
      return originalFetch(url, opts);
    });

    try {
      const res = await originalFetch(`${baseUrl}/api/external-risks/all`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);

      // Should include both weather and geopolitical entries
      const sources = new Set(data.map(r => r.source));
      expect(sources.has('nws')).toBe(true);
      expect(sources.has('intelligence')).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('sorts critical risks before warning risks', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn((url, opts) => {
      if (typeof url === 'string' && url.includes('api.weather.gov')) {
        return Promise.reject(new Error('Network error'));
      }
      return originalFetch(url, opts);
    });

    try {
      const res = await originalFetch(`${baseUrl}/api/external-risks/all`);
      const data = await res.json();

      // Find first warning index and last critical index
      const firstWarning = data.findIndex(r => r.severity === 'warning');
      const lastCritical = data.map(r => r.severity).lastIndexOf('critical');

      if (firstWarning !== -1 && lastCritical !== -1) {
        expect(lastCritical).toBeLessThan(firstWarning);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
