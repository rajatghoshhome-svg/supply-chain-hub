/**
 * General AI Chat Service
 *
 * Provides module-aware AI chat using Claude API.
 * Each module gets a rich system prompt with ASCM context.
 * Module-specific analyze endpoints (SSE) are on each route;
 * this service handles the general conversational chat.
 */

import { runDRP } from '../engines/drp-engine.js';
import {
  products,
  dcInventory,
  dcDemandForecast,
  plantInventory,
  plantWorkCenters,
  networkLocations,
  networkLanes,
  getBestSourceForDC,
  getDCs,
  getPlants,
  getProductsForPlant,
  productFamilies,
} from '../data/synthetic-network.js';
import { plantBOMs } from '../data/synthetic-bom.js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-5-20250514';

function buildPreamble() {
  return `You are an AI supply chain planning assistant embedded in an ASCM/APICS-compliant Manufacturing Planning and Control (MPC) platform.

You serve small and mid-size manufacturers ($50M-$500M revenue) running electric motor production across 3 plants, 3 DCs, and 11 products.

ASCM MPC CASCADE:
  Demand Plan → DRP → S&OP/Production Plan → MPS (RCCP) → [MRP + Scheduling ⟲]

KEY PRINCIPLES:
- DRP assigns demand to plants; MRP explodes plant-specific BOMs
- MPS does rough-cut capacity planning; Scheduling creates Gantt-level sequences
- Closed loop: Scheduling timing shifts → MRP material needs adjust → signals back to MPS
- MTR-200 is dual-sourced: PLANT-NORTH (ROT-A standard rotor) and PLANT-SOUTH (ROT-B heavy-duty)

Be concise and data-driven. Cite specific SKU codes, plants, periods, and quantities.
Format responses with markdown for readability.
When recommending actions, include specific numbers and rationale.
NEVER fabricate data — only reference what's in the context provided.`;
}

function buildModuleContext(module) {
  const plants = getPlants();
  const dcs = getDCs();

  switch (module) {
    case 'drp': {
      const lines = ['\n## DRP Context'];
      lines.push(`Network: ${plants.length} plants, ${dcs.length} DCs, ${products.length} products`);
      lines.push(`Plants: ${plants.map(p => `${p.code} (${p.city})`).join(', ')}`);
      lines.push(`DCs: ${dcs.map(d => `${d.code} (${d.city})`).join(', ')}`);
      lines.push(`Lanes: ${networkLanes.filter(l => l.type === 'outbound').map(l => `${l.source}→${l.dest} (${l.leadTimePeriods}wk)`).join(', ')}`);
      return lines.join('\n');
    }
    case 'demand': {
      return `\n## Demand Planning Context\n${products.length} products tracked: ${products.map(p => `${p.code} (${p.name})`).join(', ')}\nFamilies: ${productFamilies.map(f => `${f.code} (${f.products.join(', ')})`).join('; ')}`;
    }
    case 'production_plan': {
      const lines = ['\n## Production Planning Context'];
      for (const plant of plants) {
        const wcs = plantWorkCenters[plant.code] || [];
        lines.push(`${plant.code} (${plant.city}): capacity ${plant.weeklyCapacity} units/week, ${wcs.length} work centers`);
        lines.push(`  Products: ${getProductsForPlant(plant.code).join(', ')}`);
      }
      return lines.join('\n');
    }
    case 'scheduling': {
      const lines = ['\n## Scheduling Context'];
      lines.push('Rules available: SPT (shortest processing time), EDD (earliest due date), CR (critical ratio)');
      for (const plant of plants) {
        const wcs = plantWorkCenters[plant.code] || [];
        lines.push(`${plant.code}: ${wcs.map(w => `${w.code} (${w.name}, ${w.capacityHoursPerWeek}h/wk)`).join(', ')}`);
      }
      return lines.join('\n');
    }
    case 'mrp': {
      const lines = ['\n## MRP Context'];
      lines.push('Plant-specific BOMs — same FG may have different component structure per plant');
      for (const plant of plants) {
        const bom = plantBOMs[plant.code] || {};
        const fgs = Object.keys(bom);
        lines.push(`${plant.code}: ${fgs.length} FG BOMs defined (${fgs.join(', ')})`);
      }
      lines.push('\nDual-sourced: MTR-200 uses ROT-A at PLANT-NORTH, ROT-B at PLANT-SOUTH');
      return lines.join('\n');
    }
    default: {
      const lines = ['\n## Network Overview'];
      lines.push(`${plants.length} plants, ${dcs.length} DCs, ${products.length} products, ${productFamilies.length} families`);
      lines.push(`Plants: ${plants.map(p => `${p.code} (${p.city}, cap ${p.weeklyCapacity}/wk)`).join('; ')}`);
      lines.push(`DCs: ${dcs.map(d => `${d.code} (${d.city})`).join('; ')}`);
      lines.push(`Products: ${products.map(p => p.code).join(', ')}`);
      return lines.join('\n');
    }
  }
}

export async function streamChat({ module, messages, res }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const systemPrompt = buildPreamble() + buildModuleContext(module);

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${body}`);
  }

  // Stream SSE back to client
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);
    }
  } finally {
    res.end();
  }
}
