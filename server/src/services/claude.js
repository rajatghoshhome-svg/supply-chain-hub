import { db } from '../db/connection.js';
import { locations, skus, inventoryRecords, demandForecasts, plannedTransfers } from '../db/schema.js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-5-20250514';

function buildPreamble() {
  return `You are an AI supply chain planning assistant integrated into the Supply Chain Hub platform.
You help planners make better decisions across demand planning, production planning, distribution requirements planning (DRP), production scheduling, and material planning (MRP).
Be concise and data-driven. When recommending actions, include specific numbers and rationale.
Format responses with markdown for readability.`;
}

async function buildModuleContext(module) {
  switch (module) {
    case 'drp': {
      const locs = await db.select().from(locations);
      const transfers = await db.select().from(plannedTransfers);
      return `\n## DRP Context\nLocations: ${locs.map(l => `${l.code} (${l.city}, ${l.state}) — status: ${l.status}`).join('; ')}\nPending transfers: ${transfers.length} active\n${transfers.map(t => `${t.code}: score ${t.rebalanceScore}, cost $${t.transferCost}, risk avoided $${t.riskAvoided}`).join('\n')}`;
    }
    case 'demand': {
      const allSkus = await db.select().from(skus);
      return `\n## Demand Planning Context\nSKUs tracked: ${allSkus.map(s => `${s.code} (${s.name})`).join(', ')}`;
    }
    case 'production_plan':
      return '\n## Production Planning Context\nNo production plans configured yet.';
    case 'scheduling':
      return '\n## Scheduling Context\nNo production orders scheduled yet.';
    case 'mrp':
      return '\n## MRP Context\nNo BOMs configured yet.';
    default: {
      const locs = await db.select().from(locations);
      const allSkus = await db.select().from(skus);
      return `\n## Network Overview\n${locs.length} locations, ${allSkus.length} SKUs tracked.`;
    }
  }
}

export async function streamChat({ module, messages, res }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const systemPrompt = buildPreamble() + await buildModuleContext(module);

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
