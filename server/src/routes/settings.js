/**
 * Settings Route
 *
 * GET  /api/settings     — Return current application settings
 * PUT  /api/settings     — Update application settings
 *
 * In-memory settings store for single-user A-lite scope.
 * Persists for the lifetime of the server process.
 */

import { Router } from 'express';

export const settingsRouter = Router();

// ─── Default Settings ────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  ai: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    apiKeyConfigured: false,
    apiKeyMasked: '',
  },
  dataSource: 'demo', // 'demo' | 'imported' | 'live'
  financial: {
    expeditePerUnit: 15,
    stockoutPerUnit: 85,
    reschedulePerUnit: 7.5,
    overtimePerHour: 45,
    cancelPerUnit: 7.5,
    currency: 'USD',
  },
  planning: {
    defaultPlanningHorizon: 8,  // weeks
    defaultSafetyStockWeeks: 2,
    cascadeAutoTrigger: false,
  },
};

let settings = { ...DEFAULT_SETTINGS };

// ─── GET /api/settings ──────────────────────────────────────────

settingsRouter.get('/', (req, res) => {
  res.json({ status: 'ok', settings });
});

// ─── PUT /api/settings ──────────────────────────────────────────

settingsRouter.put('/', (req, res) => {
  try {
    const updates = req.body;
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }

    // Merge updates into settings (shallow merge per section)
    if (updates.ai) {
      // If user provides an API key, mask it for storage display
      if (updates.ai.apiKey) {
        const key = updates.ai.apiKey;
        settings.ai.apiKeyConfigured = true;
        settings.ai.apiKeyMasked = key.slice(0, 7) + '...' + key.slice(-4);
        // Store actual key in process env (not persisted, not returned)
        process.env.ANTHROPIC_API_KEY = key;
        delete updates.ai.apiKey; // don't store raw key in settings
      }
      settings.ai = { ...settings.ai, ...updates.ai };
    }

    if (updates.dataSource) {
      settings.dataSource = updates.dataSource;
    }

    if (updates.financial) {
      settings.financial = { ...settings.financial, ...updates.financial };
    }

    if (updates.planning) {
      settings.planning = { ...settings.planning, ...updates.planning };
    }

    res.json({ status: 'ok', settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
