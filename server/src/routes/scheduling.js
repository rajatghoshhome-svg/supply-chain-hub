/**
 * Production Scheduling Routes — Operator/Gantt Level
 *
 * ASCM cascade: Demand → DRP → S&OP → MPS (RCCP) → [MRP + Scheduling ⟲]
 *
 * Scheduling receives the MPS output (what to produce, when) and creates
 * a detailed sequence on work centers with:
 *   - Forward scheduling from earliest start
 *   - Sequencing rules (SPT, EDD, CR)
 *   - Changeover time between different products
 *
 * CLOSED LOOP: Scheduling may shift timings → impacts when MRP needs
 * materials → MRP may find shortages → signals back to MPS.
 */

import { Router } from 'express';
import { runScheduler, forwardSchedule, calculateMakespan, minimizeChangeover } from '../engines/sched-engine.js';
import * as schedStore from '../data/champion-scheduling-store.js';
import { runProductionPlan } from '../engines/prod-plan-engine.js';
import { runDRP } from '../engines/drp-engine.js';
import { buildSchedulingContext } from '../services/ai-context/scheduling-context.js';
import {
  networkLanes,
  dcInventory,
  dcDemandForecast,
  plantInventory,
  products,
  productFamilies,
  plantWorkCenters,
  getProductsForPlant,
  getPlants,
  getDCs,
  getBestSourceForDC,
} from '../services/data-provider.js';

export const schedulingRouter = Router();

// In-memory store for persisted resequenced orders (keyed by plant)
const savedSequences = {};


/**
 * GET /api/scheduling/demo
 * Full cascade: DRP → MPS → Scheduling (per plant)
 */
schedulingRouter.get('/demo', (req, res) => {
  try {
    const periods = makePeriods(8);
    const selectedPlant = req.query.plant || 'PLANT-NORTH';
    const rule = req.query.rule || 'EDD';
    const dcCodes = getDCs().map(d => d.code);

    // Step 1: Run DRP for products made at this plant
    const plantProducts = getProductsForPlant(selectedPlant);
    const plantGrossReqs = {};

    for (const skuCode of plantProducts) {
      const locations = [];
      for (const dc of dcCodes) {
        const inv = dcInventory[dc]?.[skuCode];
        const demand = dcDemandForecast[dc]?.[skuCode];
        if (!inv || !demand) continue;
        const lane = getBestSourceForDC(dc, skuCode);
        if (!lane || lane.source !== selectedPlant) continue;

        locations.push({
          code: dc,
          onHand: inv.onHand,
          safetyStock: inv.safetyStock,
          scheduledReceipts: inv.scheduledReceipts || periods.map(() => 0),
          grossReqs: demand,
          transitLeadTime: lane.leadTimePeriods,
          sourceCode: lane.source,
        });
      }

      if (locations.length === 0) continue;
      const drpResult = runDRP({ skuCode, periods, locations });
      plantGrossReqs[skuCode] = drpResult.plantRequirements?.grossReqs || new Array(8).fill(0);
    }

    // Step 2: Create production orders from MPS (chase strategy = produce what's needed)
    const allOrders = [];
    let orderIdx = 1;

    // Build work center lookup for this plant
    const plantWCs = plantWorkCenters[selectedPlant] || [];
    const mixingWCs = plantWCs.filter(wc => /mix|blend|roast|grind/i.test(wc.name));
    const processingWCs = plantWCs.filter(wc => /bak|form|pasteur|fill/i.test(wc.name));
    const packingWCs = plantWCs.filter(wc => /pack|case|wrap|label/i.test(wc.name));
    const qcWCs = plantWCs.filter(wc => /quality|qc|test|inspect/i.test(wc.name));

    for (const skuCode of plantProducts) {
      const grossReqs = plantGrossReqs[skuCode] || new Array(8).fill(0);
      const inv = plantInventory[selectedPlant]?.[skuCode] || { onHand: 0 };
      const prod = products.find(p => p.code === skuCode);
      const family = productFamilies.find(f => f.products.includes(skuCode));

      const plan = runProductionPlan({
        periods,
        grossReqs,
        beginningInventory: inv.onHand,
        costPerUnit: prod?.unitCost || 100,
      });

      const production = plan.strategies.chase.production;

      // Assign primary work center based on product type
      // Each product type maps to the WC that is its bottleneck operation
      // Goal: distribute across work centers so Gantt shows multiple rows
      let assignedWC;
      if (/MIX/i.test(skuCode)) {
        assignedWC = mixingWCs[0] || plantWCs[0];
      } else if (/NUT/i.test(skuCode)) {
        assignedWC = mixingWCs[1] || mixingWCs[0] || plantWCs[0];
      } else if (/BAR/i.test(skuCode)) {
        assignedWC = processingWCs[0] || plantWCs[1] || plantWCs[0];
      } else if (/CHP/i.test(skuCode)) {
        assignedWC = packingWCs[0] || plantWCs[2] || plantWCs[0];
      } else if (/CRK/i.test(skuCode)) {
        assignedWC = qcWCs[0] || packingWCs[0] || plantWCs[3] || plantWCs[0];
      } else if (/WAT|NRG/i.test(skuCode)) {
        // Sparkling/energy drinks bottleneck at filling
        assignedWC = processingWCs[0] || plantWCs[1] || plantWCs[0];
      } else if (/JCE|CLD/i.test(skuCode)) {
        // Juices and cold brew bottleneck at blending
        assignedWC = mixingWCs[0] || plantWCs[0];
      } else if (/KMB/i.test(skuCode)) {
        // Kombucha bottleneck at pasteurization (a processing WC)
        assignedWC = processingWCs[1] || processingWCs[0] || plantWCs[2] || plantWCs[0];
      } else {
        assignedWC = plantWCs[0];
      }
      const hrsPerUnit = assignedWC?.hoursPerUnit?.[family?.code] || 1.0;

      for (let i = 0; i < periods.length; i++) {
        if (production[i] > 0) {
          const duePeriodIdx = Math.min(i + 2, periods.length - 1);
          allOrders.push({
            id: `PO-${String(orderIdx++).padStart(3, '0')}`,
            skuCode,
            skuName: prod?.name,
            qty: production[i],
            processingTime: Math.round(production[i] * hrsPerUnit * 10) / 10,
            dueDate: periods[duePeriodIdx],
            workCenter: assignedWC?.code || 'WC-ASSEMBLY',
            workCenterName: assignedWC?.name || 'Assembly',
            priority: 'normal',
          });
        }
      }
    }

    // Step 3: Schedule
    let result = runScheduler({
      orders: allOrders,
      rule,
      capacityHoursPerDay: 8,
      changeoverTime: 1,
      compareRules: true,
      currentDate: '2026-04-07',
    });

    // Apply saved resequence if one exists for this plant
    if (savedSequences[selectedPlant] && rule === 'EDD') {
      const savedIds = savedSequences[selectedPlant];
      const reordered = [];
      for (const id of savedIds) {
        const order = result.schedule.find(o => o.id === id);
        if (order) reordered.push(order);
      }
      // Add any new orders not in the saved sequence
      for (const order of result.schedule) {
        if (!savedIds.includes(order.id)) reordered.push(order);
      }
      if (reordered.length > 0) {
        const rescheduled = forwardSchedule({
          orders: reordered,
          capacityHoursPerDay: 8,
          changeoverTime: 1,
        });
        result = {
          ...result,
          schedule: rescheduled,
          makespan: calculateMakespan(rescheduled),
          lateOrders: rescheduled.filter(o => o.late).length,
          rule: 'MANUAL',
        };
      }
    }

    // Include work center details in response
    const workCenterList = plantWCs.map(wc => ({
      code: wc.code,
      name: wc.name,
      capacityHoursPerWeek: wc.capacityHoursPerWeek,
    }));

    res.json({
      periods,
      plant: selectedPlant,
      plantProducts,
      workCenters: workCenterList,
      ...result,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-5-20250514';

/**
 * POST /api/scheduling/demo/analyze — Schedule + AI stream
 */
schedulingRouter.post('/demo/analyze', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  try {
    const { question, plant: reqPlant, rule: reqRule } = req.body || {};
    const selectedPlant = reqPlant || 'PLANT-NORTH';
    const rule = reqRule || 'EDD';
    const periods = makePeriods(8);
    const dcCodes = getDCs().map(d => d.code);

    // Run same DRP → MPS → Schedule cascade as /demo
    const plantProducts = getProductsForPlant(selectedPlant);
    const plantGrossReqs = {};

    for (const skuCode of plantProducts) {
      const locations = [];
      for (const dc of dcCodes) {
        const inv = dcInventory[dc]?.[skuCode];
        const demand = dcDemandForecast[dc]?.[skuCode];
        if (!inv || !demand) continue;
        const lane = getBestSourceForDC(dc, skuCode);
        if (!lane || lane.source !== selectedPlant) continue;
        locations.push({
          code: dc, onHand: inv.onHand, safetyStock: inv.safetyStock,
          scheduledReceipts: inv.scheduledReceipts || periods.map(() => 0),
          grossReqs: demand, transitLeadTime: lane.leadTimePeriods, sourceCode: lane.source,
        });
      }
      if (locations.length === 0) continue;
      const drpResult = runDRP({ skuCode, periods, locations });
      plantGrossReqs[skuCode] = drpResult.plantRequirements?.grossReqs || new Array(8).fill(0);
    }

    const allOrders = [];
    let orderIdx = 1;
    const analyzeWCs = plantWorkCenters[selectedPlant] || [];
    const analyzeMixWCs = analyzeWCs.filter(wc => /mix|blend|roast|grind/i.test(wc.name));
    const analyzeProcWCs = analyzeWCs.filter(wc => /bak|form|pasteur|fill/i.test(wc.name));
    const analyzePackWCs = analyzeWCs.filter(wc => /pack|case|wrap|label/i.test(wc.name));
    const analyzeQCWCs = analyzeWCs.filter(wc => /quality|qc|test|inspect/i.test(wc.name));
    for (const skuCode of plantProducts) {
      const grossReqs = plantGrossReqs[skuCode] || new Array(8).fill(0);
      const inv = plantInventory[selectedPlant]?.[skuCode] || { onHand: 0 };
      const prod = products.find(p => p.code === skuCode);
      const family = productFamilies.find(f => f.products.includes(skuCode));
      const plan = runProductionPlan({ periods, grossReqs, beginningInventory: inv.onHand, costPerUnit: prod?.unitCost || 100 });
      const production = plan.strategies.chase.production;
      let aWC;
      if (/MIX/i.test(skuCode)) aWC = analyzeMixWCs[0] || analyzeWCs[0];
      else if (/NUT/i.test(skuCode)) aWC = analyzeMixWCs[1] || analyzeMixWCs[0] || analyzeWCs[0];
      else if (/BAR/i.test(skuCode)) aWC = analyzeProcWCs[0] || analyzeWCs[1] || analyzeWCs[0];
      else if (/CHP/i.test(skuCode)) aWC = analyzePackWCs[0] || analyzeWCs[2] || analyzeWCs[0];
      else if (/CRK/i.test(skuCode)) aWC = analyzeQCWCs[0] || analyzePackWCs[0] || analyzeWCs[3] || analyzeWCs[0];
      else if (/WAT|NRG/i.test(skuCode)) aWC = analyzeProcWCs[0] || analyzeWCs[1] || analyzeWCs[0];
      else if (/JCE|CLD/i.test(skuCode)) aWC = analyzeMixWCs[0] || analyzeWCs[0];
      else if (/KMB/i.test(skuCode)) aWC = analyzeProcWCs[1] || analyzeProcWCs[0] || analyzeWCs[2] || analyzeWCs[0];
      else aWC = analyzeWCs[0];
      const hrsPerUnit = aWC?.hoursPerUnit?.[family?.code] || 1.0;
      for (let i = 0; i < periods.length; i++) {
        if (production[i] > 0) {
          const duePeriodIdx = Math.min(i + 2, periods.length - 1);
          allOrders.push({
            id: `PO-${String(orderIdx++).padStart(3, '0')}`, skuCode, skuName: prod?.name,
            qty: production[i], processingTime: Math.round(production[i] * hrsPerUnit * 10) / 10,
            dueDate: periods[duePeriodIdx], workCenter: aWC?.code || 'WC-ASSEMBLY',
            workCenterName: aWC?.name || 'Assembly', priority: 'normal',
          });
        }
      }
    }

    const result = runScheduler({
      orders: allOrders, rule, capacityHoursPerDay: 8,
      changeoverTime: 1, compareRules: true, currentDate: '2026-04-07',
    });

    const { systemPrompt, userMessage } = buildSchedulingContext({
      scheduleResult: result, plant: selectedPlant, rule, periods, plannerQuestion: question,
    });

    // SSE stream
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    res.write(`event: schedule-results\ndata: ${JSON.stringify({
      plant: selectedPlant, rule, totalOrders: result.totalOrders,
      makespan: result.makespan, lateOrders: result.lateOrders,
    })}\n\n`);

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL, max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        stream: true,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      res.write(`event: error\ndata: ${JSON.stringify({ error: `API error ${response.status}: ${body}` })}\n\n`);
      res.end();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
});

/**
 * POST /api/scheduling/run
 */
schedulingRouter.post('/run', (req, res) => {
  try {
    const { orders, rule, capacityHoursPerDay, changeoverTime, compareRules } = req.body;
    if (!orders) return res.status(400).json({ error: 'Required: orders' });
    res.json(runScheduler({
      orders,
      rule: rule || 'EDD',
      capacityHoursPerDay: capacityHoursPerDay || 8,
      changeoverTime: changeoverTime || 0,
      compareRules: compareRules || false,
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/scheduling/resequence — Manually reorder production orders ─
schedulingRouter.put('/resequence', (req, res) => {
  try {
    const { plant, orderIds, orders: incomingOrders } = req.body;
    if (!plant || !orderIds || !Array.isArray(orderIds)) {
      return res.status(400).json({ error: 'plant and orderIds array are required' });
    }

    // The frontend sends the full order list; resequence uses orderIds to define new order
    // If orders aren't provided, run the demo schedule to get them
    let sourceOrders = incomingOrders;
    if (!sourceOrders) {
      const periods = makePeriods(8);
      const dcCodes = getDCs().map(d => d.code);
      const plantProducts = getProductsForPlant(plant);
      const plantGrossReqs = {};

      for (const skuCode of plantProducts) {
        const locations = [];
        for (const dc of dcCodes) {
          const inv = dcInventory[dc]?.[skuCode];
          const demand = dcDemandForecast[dc]?.[skuCode];
          if (!inv || !demand) continue;
          const lane = getBestSourceForDC(dc, skuCode);
          if (!lane || lane.source !== plant) continue;
          locations.push({
            code: dc, onHand: inv.onHand, safetyStock: inv.safetyStock,
            scheduledReceipts: inv.scheduledReceipts || periods.map(() => 0),
            grossReqs: demand, transitLeadTime: lane.leadTimePeriods, sourceCode: lane.source,
          });
        }
        if (locations.length === 0) continue;
        const drpResult = runDRP({ skuCode, periods, locations });
        plantGrossReqs[skuCode] = drpResult.plantRequirements?.grossReqs || new Array(8).fill(0);
      }

      const allOrders = [];
      let orderIdx = 1;
      for (const skuCode of plantProducts) {
        const grossReqs = plantGrossReqs[skuCode] || new Array(8).fill(0);
        const inv = plantInventory[plant]?.[skuCode] || { onHand: 0 };
        const prod = products.find(p => p.code === skuCode);
        const family = productFamilies.find(f => f.products.includes(skuCode));
        const plan = runProductionPlan({ periods, grossReqs, beginningInventory: inv.onHand, costPerUnit: prod?.unitCost || 100 });
        const production = plan.strategies.chase.production;
        const rWCs = plantWorkCenters[plant] || [];
        const rMixWCs = rWCs.filter(wc => /mix|blend|roast|grind/i.test(wc.name));
        const rProcWCs = rWCs.filter(wc => /bak|form|pasteur|fill/i.test(wc.name));
        const rPackWCs = rWCs.filter(wc => /pack|case|wrap|label/i.test(wc.name));
        const rQCWCs = rWCs.filter(wc => /quality|qc|test|inspect/i.test(wc.name));
        let rWC;
        if (/MIX/i.test(skuCode)) rWC = rMixWCs[0] || rWCs[0];
        else if (/NUT/i.test(skuCode)) rWC = rMixWCs[1] || rMixWCs[0] || rWCs[0];
        else if (/BAR/i.test(skuCode)) rWC = rProcWCs[0] || rWCs[1] || rWCs[0];
        else if (/CHP/i.test(skuCode)) rWC = rPackWCs[0] || rWCs[2] || rWCs[0];
        else if (/CRK/i.test(skuCode)) rWC = rQCWCs[0] || rPackWCs[0] || rWCs[3] || rWCs[0];
        else if (/WAT|NRG/i.test(skuCode)) rWC = rProcWCs[0] || rWCs[1] || rWCs[0];
        else if (/JCE|CLD/i.test(skuCode)) rWC = rMixWCs[0] || rWCs[0];
        else if (/KMB/i.test(skuCode)) rWC = rProcWCs[1] || rProcWCs[0] || rWCs[2] || rWCs[0];
        else rWC = rWCs[0];
        const hrsPerUnit = rWC?.hoursPerUnit?.[family?.code] || 1.0;
        for (let i = 0; i < periods.length; i++) {
          if (production[i] > 0) {
            const duePeriodIdx = Math.min(i + 2, periods.length - 1);
            allOrders.push({
              id: `PO-${String(orderIdx++).padStart(3, '0')}`, skuCode, skuName: prod?.name,
              qty: production[i], processingTime: Math.round(production[i] * hrsPerUnit * 10) / 10,
              dueDate: periods[duePeriodIdx], workCenter: rWC?.code || 'WC-ASSEMBLY',
              workCenterName: rWC?.name || 'Assembly', priority: 'normal',
            });
          }
        }
      }
      sourceOrders = allOrders;
    }

    // Reorder based on provided orderIds
    const reordered = [];
    for (const id of orderIds) {
      const order = sourceOrders.find(o => o.id === id);
      if (order) reordered.push(order);
    }

    if (reordered.length === 0) {
      return res.status(404).json({ error: 'No matching orders found for the provided orderIds' });
    }

    // Use the engine's forwardSchedule to recalculate timing
    const schedule = forwardSchedule({
      orders: reordered,
      capacityHoursPerDay: 8,
      changeoverTime: 1,
    });

    const makespan = calculateMakespan(schedule);
    const lateOrders = schedule.filter(o => o.late).length;

    // Persist the resequenced order IDs for this plant
    savedSequences[plant] = orderIds;

    res.json({
      status: 'ok',
      plant,
      rule: 'MANUAL',
      totalOrders: schedule.length,
      makespan,
      lateOrders,
      schedule,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Champion Pet Foods — Scheduling Endpoints
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/scheduling/champion/schedule/:plantCode — Full Gantt data */
schedulingRouter.get('/champion/schedule/:plantCode', (req, res) => {
  try {
    const data = schedStore.getSchedule(req.params.plantCode);
    if (!data) return res.status(404).json({ error: 'Plant not found or schedule not generated' });
    // Enrich with changeover matrix (as flat object) and downtime events
    const cmRaw = schedStore.getChangeoverMatrix(req.params.plantCode);
    const changeoverMatrix = {};
    if (cmRaw?.entries) {
      for (const e of cmRaw.entries) {
        changeoverMatrix[`${e.fromFamily}|${e.toFamily}`] = e.hours;
      }
    }
    const downtimeEvents = schedStore.getDowntimeEvents(req.params.plantCode) || [];
    res.json({ ...data, changeoverMatrix, downtimeEvents });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/** POST /api/scheduling/champion/generate/:plantCode — Generate from firmed plan */
schedulingRouter.post('/champion/generate/:plantCode', (req, res) => {
  try {
    schedStore.generateFromFirmedPlan(req.params.plantCode);
    const data = schedStore.getSchedule(req.params.plantCode);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/** POST /api/scheduling/champion/order — Add a new process order */
schedulingRouter.post('/champion/order', (req, res) => {
  try {
    const { plantCode, familyId, qty, workCenter, priority } = req.body;
    if (!plantCode || !familyId || !qty) {
      return res.status(400).json({ error: 'plantCode, familyId, and qty required' });
    }
    const result = schedStore.addProcessOrder(plantCode, { familyId, qty: Number(qty), workCenter, priority });
    if (result.error) return res.status(400).json(result);
    // Enrich response with changeover matrix and downtime
    const cmRaw = schedStore.getChangeoverMatrix(plantCode);
    const changeoverMatrix = {};
    if (cmRaw?.entries) {
      for (const e of cmRaw.entries) changeoverMatrix[`${e.fromFamily}|${e.toFamily}`] = e.hours;
    }
    const downtimeEvents = schedStore.getDowntimeEvents(plantCode) || [];
    res.json({ ...result.schedule, changeoverMatrix, downtimeEvents });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/** PUT /api/scheduling/champion/resequence — Drag-and-drop reorder */
schedulingRouter.put('/champion/resequence', (req, res) => {
  try {
    const { plantCode, workCenter, orderIds } = req.body;
    if (!plantCode || !workCenter || !orderIds) {
      return res.status(400).json({ error: 'plantCode, workCenter, and orderIds required' });
    }
    schedStore.resequenceOrders(plantCode, workCenter, orderIds);
    const data = schedStore.getSchedule(plantCode);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/** POST /api/scheduling/champion/optimize/:plantCode — Changeover minimization */
schedulingRouter.post('/champion/optimize/:plantCode', (req, res) => {
  try {
    const { workCenter } = req.body || {};
    schedStore.optimizeSequence(req.params.plantCode, workCenter);
    const data = schedStore.getSchedule(req.params.plantCode);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/** GET /api/scheduling/champion/execution/:plantCode — Live execution data */
schedulingRouter.get('/champion/execution/:plantCode', (req, res) => {
  try {
    const data = schedStore.getExecutionStatus(req.params.plantCode);
    if (!data) return res.status(404).json({ error: 'No execution data' });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/** GET /api/scheduling/champion/changeover/:plantCode — Changeover matrix */
schedulingRouter.get('/champion/changeover/:plantCode', (req, res) => {
  try {
    const data = schedStore.getChangeoverMatrix(req.params.plantCode);
    if (!data) return res.status(404).json({ error: 'No changeover matrix' });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/** PUT /api/scheduling/champion/changeover — Update matrix entry */
schedulingRouter.put('/champion/changeover', (req, res) => {
  try {
    const { plantCode, fromFam, toFam, hours } = req.body;
    if (!plantCode || !fromFam || !toFam || hours === undefined) {
      return res.status(400).json({ error: 'plantCode, fromFam, toFam, hours required' });
    }
    schedStore.updateChangeoverEntry(plantCode, fromFam, toFam, hours);
    res.json({ status: 'ok' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/** GET /api/scheduling/champion/downtime/:plantCode — Downtime events */
schedulingRouter.get('/champion/downtime/:plantCode', (req, res) => {
  try {
    const data = schedStore.getDowntimeEvents(req.params.plantCode);
    res.json({ events: data || [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/** POST /api/scheduling/champion/downtime — Add downtime event */
schedulingRouter.post('/champion/downtime', (req, res) => {
  try {
    const { plantCode, workCenter, type, startHr, endHr, reason } = req.body;
    if (!plantCode || !workCenter) {
      return res.status(400).json({ error: 'plantCode and workCenter required' });
    }
    schedStore.addDowntimeEvent(plantCode, { workCenter, type: type || 'maintenance', startHr: startHr || 0, endHr: endHr || 8, reason: reason || '' });
    res.json({ status: 'ok', events: schedStore.getDowntimeEvents(plantCode) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/** DELETE /api/scheduling/champion/downtime/:eventId — Remove downtime event */
schedulingRouter.delete('/champion/downtime/:eventId', (req, res) => {
  try {
    // Need plantCode from query param
    const plantCode = req.query.plantCode || 'PLT-DOGSTAR';
    schedStore.removeDowntimeEvent(plantCode, req.params.eventId);
    res.json({ status: 'ok' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/** GET /api/scheduling/champion/config/:plantCode — Sequencing rule config */
schedulingRouter.get('/champion/config/:plantCode', (req, res) => {
  try {
    const rule = schedStore.getSequencingRule(req.params.plantCode);
    res.json({ rule: rule || 'EDD' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/** PUT /api/scheduling/champion/config — Update sequencing rule */
schedulingRouter.put('/champion/config', (req, res) => {
  try {
    const { plantCode, rule } = req.body;
    if (!plantCode || !rule) {
      return res.status(400).json({ error: 'plantCode and rule required' });
    }
    schedStore.setSequencingRule(plantCode, rule);
    res.json({ status: 'ok', rule });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

function makePeriods(count) {
  const periods = [];
  const base = new Date('2026-04-07');
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i * 7);
    periods.push(d.toISOString().slice(0, 10));
  }
  return periods;
}
