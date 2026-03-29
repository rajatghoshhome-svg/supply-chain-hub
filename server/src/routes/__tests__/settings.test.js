import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { settingsRouter } from '../settings.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/settings', settingsRouter);
  return app;
}

describe('GET /api/settings', () => {
  it('returns default settings', async () => {
    const app = createApp();
    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.settings).toHaveProperty('ai');
    expect(res.body.settings).toHaveProperty('dataSource');
    expect(res.body.settings).toHaveProperty('financial');
    expect(res.body.settings).toHaveProperty('planning');
    expect(res.body.settings.ai.provider).toBe('anthropic');
    expect(res.body.settings.dataSource).toBe('demo');
  });
});

describe('PUT /api/settings', () => {
  it('updates financial settings', async () => {
    const app = createApp();
    const res = await request(app)
      .put('/api/settings')
      .send({ financial: { expeditePerUnit: 25 } });
    expect(res.status).toBe(200);
    expect(res.body.settings.financial.expeditePerUnit).toBe(25);
    // Other financial fields preserved
    expect(res.body.settings.financial.stockoutPerUnit).toBe(85);
  });

  it('updates data source', async () => {
    const app = createApp();
    const res = await request(app)
      .put('/api/settings')
      .send({ dataSource: 'imported' });
    expect(res.status).toBe(200);
    expect(res.body.settings.dataSource).toBe('imported');
  });

  it('masks API key and sets configured flag', async () => {
    const app = createApp();
    const res = await request(app)
      .put('/api/settings')
      .send({ ai: { apiKey: 'sk-ant-api03-abcdefghijklmnop' } });
    expect(res.status).toBe(200);
    expect(res.body.settings.ai.apiKeyConfigured).toBe(true);
    expect(res.body.settings.ai.apiKeyMasked).toMatch(/^sk-ant-/);
    expect(res.body.settings.ai.apiKeyMasked).toContain('...');
    // Raw key should NOT be in the returned settings
    expect(res.body.settings.ai.apiKey).toBeUndefined();
  });

  it('rejects non-object body with 400', async () => {
    const app = createApp();
    const res = await request(app)
      .put('/api/settings')
      .send('not json')
      .set('Content-Type', 'text/plain');
    // Express may parse this differently, but the route checks for object
    expect(res.status).toBe(400);
  });

  it('updates planning settings', async () => {
    const app = createApp();
    const res = await request(app)
      .put('/api/settings')
      .send({ planning: { defaultPlanningHorizon: 12 } });
    expect(res.status).toBe(200);
    expect(res.body.settings.planning.defaultPlanningHorizon).toBe(12);
    // Other planning fields preserved
    expect(res.body.settings.planning.defaultSafetyStockWeeks).toBe(2);
  });
});
