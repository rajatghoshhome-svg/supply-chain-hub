/**
 * Champion Scheduling Store — In-memory scheduling state
 *
 * Singleton initialized on server startup. Takes firmed production plan data
 * and generates process orders for a Gantt chart. Tracks:
 * - Process orders per plant (daily batches from firmed weekly plan)
 * - Changeover matrix (family-to-family transition hours)
 * - Downtime events (CIP, maintenance)
 * - Forward-scheduled Gantt data per work center (multi-resource)
 * - Execution state (running/complete/planned with pace tracking)
 *
 * Uses seeded PRNG (LCG, seed 9000) for deterministic demo data.
 */

import {
  workCenters,
  productionRoutes,
  defaultChangeoverRules,
  brandColors,
  getBrandFromFamily,
  getFormatFromFamily,
  plantProductSourcing,
  plants,
} from './champion-network.js';
import {
  getPlantPlan,
  getFirmedPeriods,
  firmPeriod,
} from './champion-production-store.js';
import {
  forwardScheduleMultiResource,
  linkStages,
  minimizeChangeover,
} from '../engines/sched-engine.js';

// ── Seeded PRNG (LCG, seed 9000) ──────────────────────────────────────────────

let _seed = 9000;
function seededRandom() {
  _seed = (_seed * 16807 + 0) % 2147483647;
  return (_seed & 0x7fffffff) / 0x7fffffff;
}

// ── State ─────────────────────────────────────────────────────────────────────

let _initialized = false;
const _processOrders    = new Map();   // plantCode → ProcessOrder[]
const _changeoverMatrix = new Map();   // plantCode → Map<'fromFam|toFam', hours>
const _downtimeEvents   = new Map();   // plantCode → DowntimeEvent[]
const _scheduleResult   = new Map();   // plantCode → Object
const _executionState   = new Map();   // orderId → { status, pacePercent, unitsCompleted }
const _sequencingRule   = new Map();   // plantCode → string

// ── Constants ─────────────────────────────────────────────────────────────────

const HORIZON_START = '2026-04-06';
const HORIZON_END   = '2026-04-27';
const NOW_TIME      = '2026-04-09T14:30:00Z';
// 2026-04-06 Monday 00:00 → 2026-04-09 14:30 = 3 days * 24h + 14.5h = 86.5
// But in scheduling hours (16h/day, 2 shifts): 3 full days = 48h + partial day ~14.5/24*16 ≈ 9.67
// Spec says ~78.5 hours from Monday 0:00 (using calendar hours, not shift hours)
const NOW_HOUR      = 78.5;

const HOURS_PER_DAY = 16; // 2 shifts × 8 hours

const FAMILY_NAMES = {
  'ORI-DOG-DRY': 'Orijen Dog Dry',
  'ORI-CAT-DRY': 'Orijen Cat Dry',
  'ORI-FD': 'Orijen Freeze-Dried',
  'ORI-TREAT': 'Orijen Treats',
  'ACA-DOG-DRY': 'Acana Dog Dry',
  'ACA-CAT-DRY': 'Acana Cat Dry',
  'ACA-WET-DOG': 'Acana Wet Dog',
  'ACA-WET-CAT': 'Acana Wet Cat',
  'ACA-SINGLES': 'Acana Singles',
};

const PERIOD_DUE_DATES = [
  '2026-04-13', // period 0 (end of week 1)
  '2026-04-20', // period 1
  '2026-04-27', // period 2
  '2026-05-04', // period 3
];

// Units per hour by stage type
const STAGE_RATES = {
  extrusion: 120,
  packaging: 150,
  retort: 80,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getFamilyName(familyId) {
  return FAMILY_NAMES[familyId] || familyId;
}

function getPlantName(plantCode) {
  const plant = plants.find(p => p.code === plantCode);
  return plant?.name || plantCode;
}

/**
 * Get work centers of a specific type for a plant.
 */
function getPlantWCsByType(plantCode, type) {
  return workCenters.filter(wc => wc.plant === plantCode && wc.type === type);
}

/**
 * Determine the simplified stage list for a format.
 * - dry:          extrusion + packaging (coating is same line)
 * - wet:          retort + packaging
 * - freeze-dried: extrusion + packaging (simplified from extrusion + freeze-dry + packaging)
 * - treat:        extrusion + packaging
 */
function getSimplifiedStages(format) {
  switch (format) {
    case 'dry':          return ['extrusion', 'packaging'];
    case 'wet':          return ['retort', 'packaging'];
    case 'freeze-dried': return ['extrusion', 'packaging'];
    case 'treat':        return ['extrusion', 'packaging'];
    default:             return ['extrusion', 'packaging'];
  }
}

/**
 * Build stage assignments with work center allocation using round-robin.
 */
function buildStages(format, plantCode, qty, counters) {
  const stageNames = getSimplifiedStages(format);
  const stages = [];

  for (const stageName of stageNames) {
    let wcCode = null;
    const rate = STAGE_RATES[stageName] || 120;
    const processingHrs = Math.round((qty / rate) * 100) / 100;

    if (stageName === 'extrusion') {
      const extruders = getPlantWCsByType(plantCode, 'extrusion');
      if (extruders.length > 0) {
        const idx = counters.extrusion % extruders.length;
        wcCode = extruders[idx].code;
        counters.extrusion++;
      }
    } else if (stageName === 'retort') {
      const retorts = getPlantWCsByType(plantCode, 'retort');
      if (retorts.length > 0) {
        wcCode = retorts[0].code;
      }
    } else if (stageName === 'packaging') {
      const pkgLines = getPlantWCsByType(plantCode, 'packaging');
      if (pkgLines.length > 0) {
        const idx = counters.packaging % pkgLines.length;
        wcCode = pkgLines[idx].code;
        counters.packaging++;
      }
    }

    if (wcCode) {
      stages.push({
        stage: stageName,
        workCenter: wcCode,
        processingHrs,
        startTime: null,
        endTime: null,
      });
    }
  }

  return stages;
}

// ── Initialization ────────────────────────────────────────────────────────────

export function initialize() {
  if (_initialized) return;

  _seed = 9000; // Reset for determinism
  const t0 = Date.now();

  // ── Step 1: Auto-firm periods 0-3 for all families at both plants ──────────

  for (const plant of plants) {
    const sourcing = plantProductSourcing[plant.code];
    if (!sourcing) continue;
    const allFamilyIds = [...(sourcing.primary || []), ...(sourcing.overflow || [])];
    for (const familyId of allFamilyIds) {
      for (let p = 0; p < 4; p++) {
        firmPeriod(plant.code, familyId, p);
      }
    }
  }

  // ── Step 2: Generate process orders from firmed production plan ─────────────

  let totalOrders = 0;

  for (const plant of plants) {
    const plantCode = plant.code;
    const plantPlan = getPlantPlan(plantCode);
    if (!plantPlan) continue;

    const orders = [];
    let orderNum = 1;
    const prefix = plantCode === 'PLT-DOGSTAR' ? 'DS' : 'NS';
    const counters = { extrusion: 0, packaging: 0 };

    for (const fp of plantPlan.familyPlans) {
      const familyId = fp.familyId;
      const format = getFormatFromFamily(familyId);
      const brand = getBrandFromFamily(familyId);
      const brandColor = brandColors[brand];

      // Determine units per hour based on the primary stage
      const primaryRate = format === 'wet' ? STAGE_RATES.retort : STAGE_RATES.extrusion;

      // Get chase strategy production array
      const chaseStrat = fp.plan?.strategies?.chase;
      if (!chaseStrat) continue;
      const production = chaseStrat.production || [];

      // Process firmed periods 0-3
      for (let pIdx = 0; pIdx < 4; pIdx++) {
        const weeklyQty = production[pIdx] || 0;
        if (weeklyQty <= 0) continue;

        // Break weekly qty into ~5 daily process orders (Mon-Fri)
        const baseDailyQty = Math.floor(weeklyQty / 5);
        const remainder = weeklyQty - baseDailyQty * 5;
        const dueDate = PERIOD_DUE_DATES[pIdx];

        // Determine priority
        let priority;
        if (pIdx === 0) priority = 'high';
        else if (pIdx === 1) priority = 'medium';
        else priority = 'normal';

        for (let day = 0; day < 5; day++) {
          // First day gets the remainder
          const dailyQty = day === 0 ? baseDailyQty + remainder : baseDailyQty;
          if (dailyQty <= 0) continue;

          const id = `PO-${prefix}-${String(orderNum).padStart(3, '0')}`;
          const stageAssignments = buildStages(format, plantCode, dailyQty, counters);

          orders.push({
            id,
            orderId: id, // same as id, used by linkStages
            plantCode,
            familyId,
            familyName: getFamilyName(familyId),
            format,
            brandColor,
            qty: dailyQty,
            unitsPerHour: primaryRate,
            stages: stageAssignments,
            dueDate,
            priority,
            status: 'planned',
            sourcePeriodIndex: pIdx,
          });

          orderNum++;
        }
      }
    }

    _processOrders.set(plantCode, orders);
    _sequencingRule.set(plantCode, 'EDD');
    totalOrders += orders.length;
  }

  // ── Step 3: Build changeover matrices ────────────────────────────────────────

  for (const plant of plants) {
    const sourcing = plantProductSourcing[plant.code];
    if (!sourcing) continue;
    const allFamilyIds = [...(sourcing.primary || []), ...(sourcing.overflow || [])];
    const matrix = new Map();

    for (const fromFam of allFamilyIds) {
      const fromBrand = getBrandFromFamily(fromFam);
      const fromFormat = getFormatFromFamily(fromFam);

      for (const toFam of allFamilyIds) {
        const toBrand = getBrandFromFamily(toFam);
        const toFormat = getFormatFromFamily(toFam);

        let hours;
        if (fromFam === toFam) {
          hours = defaultChangeoverRules.sameFamily;
        } else if (fromBrand === toBrand) {
          hours = defaultChangeoverRules.sameBrandDiffFamily;
        } else if (fromFormat === toFormat) {
          hours = defaultChangeoverRules.diffBrandSameFormat;
        } else {
          hours = defaultChangeoverRules.diffFormat;
        }

        matrix.set(`${fromFam}|${toFam}`, hours);
      }
    }

    _changeoverMatrix.set(plant.code, matrix);
  }

  // ── Step 4: Generate downtime events ─────────────────────────────────────────

  _generateDowntimeEvents();

  // ── Step 5: Run multi-resource scheduling ────────────────────────────────────

  _runScheduling();

  // ── Step 6: Simulate execution state ─────────────────────────────────────────

  _simulateExecution();

  // ── Step 7: Build schedule results for frontend ──────────────────────────────

  _buildScheduleResults();

  _initialized = true;
  const elapsed = Date.now() - t0;
  console.log(`[champion-scheduling] Initialized: ${totalOrders} process orders across ${plants.length} plants in ${elapsed}ms`);
}

// ── Downtime Events ──────────────────────────────────────────────────────────

function _generateDowntimeEvents() {
  let eventId = 1;

  for (const plant of plants) {
    const plantCode = plant.code;
    const plantWCs = workCenters.filter(wc => wc.plant === plantCode);
    const events = [];

    // Horizon is 3 weeks (2026-04-06 to 2026-04-27)
    for (let week = 0; week < 3; week++) {
      // Hours use HOURS_PER_DAY = 16 per working day
      // Sunday of week N: day index 6 within each week
      const sundayStartHr = week * 7 * HOURS_PER_DAY + 6 * HOURS_PER_DAY;

      // CIP (Clean-in-Place) every Sunday: 8 hours for each work center
      for (const wc of plantWCs) {
        events.push({
          id: `DT-${String(eventId++).padStart(3, '0')}`,
          workCenter: wc.code,
          type: 'CIP',
          startHr: sundayStartHr,
          endHr: sundayStartHr + 8,
          reason: `Weekly CIP — ${wc.name}`,
        });
      }

      // Maintenance every other Friday afternoon (weeks 0 and 2)
      if (week % 2 === 0) {
        // Friday = day 4, afternoon = start at hour 12 into the day
        const fridayAfternoonHr = week * 7 * HOURS_PER_DAY + 4 * HOURS_PER_DAY + 12;

        // Pick some work centers for maintenance
        const maintenanceWCs = plantWCs.filter(wc =>
          wc.type === 'extrusion' || wc.type === 'retort'
        );
        // Alternate: first extruder on week 0, second on week 2
        const wcIdx = Math.min(Math.floor(week / 2), maintenanceWCs.length - 1);
        if (maintenanceWCs.length > 0) {
          const targetWC = maintenanceWCs[wcIdx % maintenanceWCs.length];
          events.push({
            id: `DT-${String(eventId++).padStart(3, '0')}`,
            workCenter: targetWC.code,
            type: 'maintenance',
            startHr: fridayAfternoonHr,
            endHr: fridayAfternoonHr + 4,
            reason: `Planned maintenance — ${targetWC.name}`,
          });
        }
      }
    }

    _downtimeEvents.set(plantCode, events);
  }
}

// ── Scheduling ───────────────────────────────────────────────────────────────

function _runScheduling() {
  for (const [plantCode] of _processOrders) {
    _runSchedulingForPlant(plantCode);
  }
}

function _runSchedulingForPlant(plantCode) {
  const orders = _processOrders.get(plantCode);
  if (!orders || orders.length === 0) return;

  const changeoverMap = _changeoverMatrix.get(plantCode) || new Map();
  const downtimeEvts = _downtimeEvents.get(plantCode) || [];
  const rule = _sequencingRule.get(plantCode) || 'EDD';

  // ── Group orders by first-stage (extrusion/retort) work center ────────────
  const extrusionWCOrders = new Map();
  const packagingWCOrders = new Map();

  for (const order of orders) {
    if (order.stages.length === 0) continue;

    const firstStage = order.stages[0];
    const firstWC = firstStage.workCenter;
    if (!extrusionWCOrders.has(firstWC)) extrusionWCOrders.set(firstWC, []);
    extrusionWCOrders.get(firstWC).push(order);

    // If there's a second stage (packaging), group for that too
    if (order.stages.length > 1) {
      const secondStage = order.stages[1];
      const secondWC = secondStage.workCenter;
      if (!packagingWCOrders.has(secondWC)) packagingWCOrders.set(secondWC, []);
      packagingWCOrders.get(secondWC).push(order);
    }
  }

  // ── Apply sequencing rule to each work center group ───────────────────────
  function applySequencingRule(wcOrdersMap) {
    for (const [, wcOrders] of wcOrdersMap) {
      if (rule === 'EDD') {
        wcOrders.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
      } else if (rule === 'SPT') {
        wcOrders.sort((a, b) => (a.qty / a.unitsPerHour) - (b.qty / b.unitsPerHour));
      } else if (rule === 'CR') {
        const now = new Date(NOW_TIME);
        wcOrders.sort((a, b) => {
          const aDue = (new Date(a.dueDate) - now) / (1000 * 60 * 60);
          const bDue = (new Date(b.dueDate) - now) / (1000 * 60 * 60);
          const aProc = a.qty / a.unitsPerHour;
          const bProc = b.qty / b.unitsPerHour;
          const crA = aProc > 0 ? aDue / aProc : Infinity;
          const crB = bProc > 0 ? bDue / bProc : Infinity;
          return crA - crB;
        });
      }
      // FIFO: maintain original order
    }
  }

  applySequencingRule(extrusionWCOrders);
  applySequencingRule(packagingWCOrders);

  // ── Forward schedule extrusion stage ──────────────────────────────────────

  const extrusionSchedule = forwardScheduleMultiResource({
    ordersByWorkCenter: extrusionWCOrders,
    changeoverMatrix: changeoverMap,
    downtimeEvents: downtimeEvts,
    startHour: 0,
    hoursPerShift: 8,
    shiftsPerDay: 2,
  });

  // Write extrusion times back to order stages
  for (const [wcCode, scheduledOrders] of extrusionSchedule) {
    for (const order of scheduledOrders) {
      if (order.stages.length > 0 && order.stages[0].workCenter === wcCode) {
        order.stages[0].startTime = order.startTime;
        order.stages[0].endTime = order.endTime;
        order.stages[0].processingHrs = Math.round((order.qty / (STAGE_RATES[order.stages[0].stage] || 120)) * 100) / 100;
      }
    }
  }

  // ── Forward schedule packaging stage ──────────────────────────────────────

  const packagingSchedule = forwardScheduleMultiResource({
    ordersByWorkCenter: packagingWCOrders,
    changeoverMatrix: changeoverMap,
    downtimeEvents: downtimeEvts,
    startHour: 0,
    hoursPerShift: 8,
    shiftsPerDay: 2,
  });

  // Write packaging times back to order stages
  for (const [wcCode, scheduledOrders] of packagingSchedule) {
    for (const order of scheduledOrders) {
      if (order.stages.length > 1 && order.stages[1].workCenter === wcCode) {
        order.stages[1].startTime = order.startTime;
        order.stages[1].endTime = order.endTime;
        order.stages[1].processingHrs = Math.round((order.qty / STAGE_RATES.packaging) * 100) / 100;
      }
    }
  }

  // ── Link stages: packaging cannot start before extrusion completes ────────

  const linkedPackaging = linkStages(extrusionSchedule, packagingSchedule, 2);

  // Write linked packaging times back to order stages
  for (const [wcCode, scheduledOrders] of linkedPackaging) {
    for (const order of scheduledOrders) {
      if (order.stages.length > 1 && order.stages[1].workCenter === wcCode) {
        order.stages[1].startTime = order.startTime;
        order.stages[1].endTime = order.endTime;
      }
    }
  }
}

// ── Execution Simulation ─────────────────────────────────────────────────────

function _simulateExecution() {
  for (const [plantCode] of _processOrders) {
    _simulateExecutionForPlant(plantCode);
  }
}

function _simulateExecutionForPlant(plantCode) {
  const orders = _processOrders.get(plantCode) || [];

  for (const order of orders) {
    const firstStage = order.stages[0];
    if (!firstStage) continue;

    const startTime = firstStage.startTime;
    const endTime = firstStage.endTime;

    let status, pacePercent, unitsCompleted;

    if (startTime == null || endTime == null) {
      status = 'planned';
      pacePercent = 0;
      unitsCompleted = 0;
    } else if (endTime <= NOW_HOUR) {
      // Complete — finished before simulated "now"
      status = 'complete';
      pacePercent = 100;
      unitsCompleted = order.qty;
    } else if (startTime < NOW_HOUR && endTime > NOW_HOUR) {
      // Running — currently in progress
      status = 'running';
      const elapsed = NOW_HOUR - startTime;
      const totalHrs = endTime - startTime;
      pacePercent = Math.round((elapsed / totalHrs) * 100);

      // Simulate small rate variation using PRNG
      const variation = 0.90 + seededRandom() * 0.20; // 90%-110%
      const rateActual = Math.round(order.unitsPerHour * variation * 10) / 10;
      unitsCompleted = Math.round(elapsed * rateActual);
    } else {
      // Planned (not started yet)
      status = 'planned';
      pacePercent = 0;
      unitsCompleted = 0;
    }

    order.status = status;

    _executionState.set(order.id, {
      status,
      pacePercent,
      unitsCompleted,
    });
  }
}

// ── Build Schedule Result (Frontend Format) ──────────────────────────────────

function _buildScheduleResults() {
  for (const plant of plants) {
    _buildScheduleResultForPlant(plant.code);
  }
}

function _buildScheduleResultForPlant(plantCode) {
  const plant = plants.find(p => p.code === plantCode);
  if (!plant) return;

  const orders = _processOrders.get(plantCode) || [];
  const downtimeEvts = _downtimeEvents.get(plantCode) || [];
  const changeoverMap = _changeoverMatrix.get(plantCode) || new Map();

  // Categorize work centers into stage groups
  const plantWCs = workCenters.filter(wc => wc.plant === plantCode);
  const extrusionWCs = plantWCs.filter(wc => wc.type === 'extrusion' || wc.type === 'retort');
  const packagingWCs = plantWCs.filter(wc => wc.type === 'packaging');

  function buildWCData(wcDef, stageFilter) {
    const wcOrders = [];
    let prevFam = null;
    let totalChangeoverHrs = 0;
    let totalProcessingHrs = 0;

    for (const order of orders) {
      for (const stage of order.stages) {
        if (stage.workCenter === wcDef.code && stageFilter(stage.stage)) {
          let changeover = null;
          if (prevFam && prevFam !== order.familyId) {
            const key = `${prevFam}|${order.familyId}`;
            const hrs = changeoverMap.get(key) || 0;
            if (hrs > 0) {
              changeover = {
                fromFamily: prevFam,
                toFamily: order.familyId,
                hours: hrs,
              };
              totalChangeoverHrs += hrs;
            }
          }

          const execState = _executionState.get(order.id);
          wcOrders.push({
            id: order.id,
            familyId: order.familyId,
            familyName: order.familyName,
            brandColor: order.brandColor,
            qty: order.qty,
            startTime: stage.startTime,
            endTime: stage.endTime,
            status: order.status,
            pacePercent: execState?.pacePercent || 0,
            changeover,
          });

          totalProcessingHrs += stage.processingHrs || 0;
          prevFam = order.familyId;
        }
      }
    }

    // Sort orders by start time
    wcOrders.sort((a, b) => (a.startTime || 0) - (b.startTime || 0));

    // Get downtime blocks for this WC
    const downtimeBlocks = downtimeEvts
      .filter(dt => dt.workCenter === wcDef.code)
      .map(dt => ({ startHr: dt.startHr, endHr: dt.endHr, type: dt.type, reason: dt.reason }));

    // Calculate utilization: processing hours / available hours in horizon
    // Horizon is 3 weeks = 21 days, but working days = 15 (5 per week × 3)
    const horizonWorkingHours = 3 * 5 * HOURS_PER_DAY; // 3 weeks × 5 days × 16h
    const downtimeHrs = downtimeBlocks.reduce((s, d) => s + (d.endHr - d.startHr), 0);
    const availableHrs = horizonWorkingHours - downtimeHrs;
    const utilization = availableHrs > 0
      ? Math.round(((totalProcessingHrs + totalChangeoverHrs) / availableHrs) * 10000) / 100
      : 0;

    return {
      code: wcDef.code,
      name: wcDef.name,
      orders: wcOrders,
      downtimeBlocks,
      utilization: Math.min(utilization, 100),
    };
  }

  // Build stage groups
  const stageExtrusion = {
    name: 'Extrusion',
    workCenters: extrusionWCs.map(wc =>
      buildWCData(wc, s => s === 'extrusion' || s === 'retort')
    ),
  };

  const stagePackaging = {
    name: 'Packaging',
    workCenters: packagingWCs.map(wc =>
      buildWCData(wc, s => s === 'packaging')
    ),
  };

  // Compute summary KPIs
  const totalOrderCount = orders.length;
  const runningOrders   = orders.filter(o => o.status === 'running').length;
  const completedOrders = orders.filter(o => o.status === 'complete').length;
  const delayedOrders   = orders.filter(o => o.status === 'delayed').length;

  const allWCData = [
    ...stageExtrusion.workCenters,
    ...stagePackaging.workCenters,
  ];
  const avgUtilization = allWCData.length > 0
    ? Math.round(allWCData.reduce((s, wc) => s + wc.utilization, 0) / allWCData.length * 10) / 10
    : 0;
  const totalChangeoverHours = Math.round(
    allWCData.reduce((s, wc) => {
      let wcChangeoverHrs = 0;
      for (const o of wc.orders) {
        if (o.changeover) wcChangeoverHrs += o.changeover.hours;
      }
      return s + wcChangeoverHrs;
    }, 0) * 100
  ) / 100;

  const stages = [stageExtrusion, stagePackaging];

  _scheduleResult.set(plantCode, {
    plantCode,
    plantName: getPlantName(plantCode),
    horizonStart: HORIZON_START,
    horizonEnd: HORIZON_END,
    nowTime: NOW_TIME,
    hoursPerDay: HOURS_PER_DAY,
    stages,
    summary: {
      totalOrders: totalOrderCount,
      runningOrders,
      completedOrders,
      delayedOrders,
      avgUtilization,
      totalChangeoverHours,
    },
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export function isInitialized() {
  return _initialized;
}

/**
 * Get the full Gantt schedule for a plant.
 */
export function getSchedule(plantCode) {
  return _scheduleResult.get(plantCode) || null;
}

/**
 * Get raw process orders for a plant.
 */
export function getProcessOrders(plantCode) {
  return _processOrders.get(plantCode) || [];
}

/**
 * Re-generate process orders from current firmed plan.
 * Call this after new periods are firmed in production store.
 */
export function generateFromFirmedPlan(plantCode) {
  // Clear existing orders for this plant
  _processOrders.delete(plantCode);
  _scheduleResult.delete(plantCode);

  // Re-read plan from production store
  const plantPlan = getPlantPlan(plantCode);
  if (!plantPlan) return { error: 'Plant not found' };

  const orders = [];
  let orderNum = 1;
  const prefix = plantCode === 'PLT-DOGSTAR' ? 'DS' : 'NS';
  const counters = { extrusion: 0, packaging: 0 };

  for (const fp of plantPlan.familyPlans) {
    const familyId = fp.familyId;
    const format = getFormatFromFamily(familyId);
    const brand = getBrandFromFamily(familyId);
    const brandColor = brandColors[brand];
    const primaryRate = format === 'wet' ? STAGE_RATES.retort : STAGE_RATES.extrusion;

    const chaseStrat = fp.plan?.strategies?.chase;
    if (!chaseStrat) continue;
    const production = chaseStrat.production || [];
    const firmedSet = new Set(fp.firmedPeriods || []);

    for (let pIdx = 0; pIdx < production.length; pIdx++) {
      if (!firmedSet.has(pIdx)) continue;
      const weeklyQty = production[pIdx] || 0;
      if (weeklyQty <= 0) continue;

      const baseDailyQty = Math.floor(weeklyQty / 5);
      const remainder = weeklyQty - baseDailyQty * 5;
      const dueDate = PERIOD_DUE_DATES[pIdx] || PERIOD_DUE_DATES[3];

      let priority;
      if (pIdx === 0) priority = 'high';
      else if (pIdx === 1) priority = 'medium';
      else priority = 'normal';

      for (let day = 0; day < 5; day++) {
        const dailyQty = day === 0 ? baseDailyQty + remainder : baseDailyQty;
        if (dailyQty <= 0) continue;

        const id = `PO-${prefix}-${String(orderNum).padStart(3, '0')}`;
        const stageAssignments = buildStages(format, plantCode, dailyQty, counters);

        orders.push({
          id,
          orderId: id,
          plantCode,
          familyId,
          familyName: getFamilyName(familyId),
          format,
          brandColor,
          qty: dailyQty,
          unitsPerHour: primaryRate,
          stages: stageAssignments,
          dueDate,
          priority,
          status: 'planned',
          sourcePeriodIndex: pIdx,
        });

        orderNum++;
      }
    }
  }

  _processOrders.set(plantCode, orders);

  // Re-run scheduling, execution, and result building for this plant
  _runSchedulingForPlant(plantCode);
  _simulateExecutionForPlant(plantCode);
  _buildScheduleResultForPlant(plantCode);

  return { success: true, orderCount: orders.length };
}

/**
 * Resequence orders on a work center according to newOrderIds.
 * Re-runs forwardScheduleMultiResource for that work center.
 * Re-links stages. Returns updated schedule.
 */
export function resequenceOrders(plantCode, workCenterCode, newOrderIds) {
  const orders = _processOrders.get(plantCode);
  if (!orders) return { error: 'Plant not found' };

  // Find orders assigned to this work center (first stage)
  const wcOrders = orders.filter(o =>
    o.stages.length > 0 && o.stages[0].workCenter === workCenterCode
  );

  // Reorder according to newOrderIds
  const orderMap = new Map(wcOrders.map(o => [o.id, o]));
  const reordered = [];
  for (const id of newOrderIds) {
    const o = orderMap.get(id);
    if (o) reordered.push(o);
  }
  // Append any orders not in the new list
  for (const o of wcOrders) {
    if (!newOrderIds.includes(o.id)) reordered.push(o);
  }

  // Re-schedule this single work center using forwardScheduleMultiResource
  const changeoverMap = _changeoverMatrix.get(plantCode) || new Map();
  const downtimeEvts = _downtimeEvents.get(plantCode) || [];

  const singleWCMap = new Map();
  singleWCMap.set(workCenterCode, reordered);

  const rescheduled = forwardScheduleMultiResource({
    ordersByWorkCenter: singleWCMap,
    changeoverMatrix: changeoverMap,
    downtimeEvents: downtimeEvts,
    startHour: 0,
    hoursPerShift: 8,
    shiftsPerDay: 2,
  });

  // Write times back to first stage
  for (const [wcCode, scheduledOrders] of rescheduled) {
    for (const order of scheduledOrders) {
      if (order.stages.length > 0 && order.stages[0].workCenter === wcCode) {
        order.stages[0].startTime = order.startTime;
        order.stages[0].endTime = order.endTime;
        order.stages[0].processingHrs = Math.round((order.qty / (STAGE_RATES[order.stages[0].stage] || 120)) * 100) / 100;
      }
    }
  }

  // Re-link subsequent stages
  for (const order of reordered) {
    for (let s = 1; s < order.stages.length; s++) {
      const prevEnd = order.stages[s - 1].endTime;
      if (prevEnd == null) continue;
      const rate = STAGE_RATES[order.stages[s].stage] || 150;
      const hrs = order.qty / rate;
      order.stages[s].processingHrs = Math.round(hrs * 100) / 100;
      order.stages[s].startTime = Math.round((prevEnd + 2) * 100) / 100;
      order.stages[s].endTime = Math.round((prevEnd + 2 + hrs) * 100) / 100;
    }
  }

  _simulateExecutionForPlant(plantCode);
  _buildScheduleResultForPlant(plantCode);

  return { success: true, schedule: getSchedule(plantCode) };
}

/**
 * Optimize sequence on a work center to minimize changeover.
 * Uses minimizeChangeover from sched-engine.
 */
export function optimizeSequence(plantCode, workCenterCode) {
  const orders = _processOrders.get(plantCode);
  if (!orders) return { error: 'Plant not found' };

  const changeoverMap = _changeoverMatrix.get(plantCode) || new Map();

  // Get orders for this work center (first stage)
  const wcOrders = orders.filter(o =>
    o.stages.length > 0 && o.stages[0].workCenter === workCenterCode
  );

  if (wcOrders.length === 0) return { error: 'No orders on this work center' };

  // Run minimizeChangeover
  const optimized = minimizeChangeover(wcOrders, changeoverMap);

  // Re-schedule with optimized order
  const downtimeEvts = _downtimeEvents.get(plantCode) || [];
  const singleWCMap = new Map();
  singleWCMap.set(workCenterCode, optimized);

  const rescheduled = forwardScheduleMultiResource({
    ordersByWorkCenter: singleWCMap,
    changeoverMatrix: changeoverMap,
    downtimeEvents: downtimeEvts,
    startHour: 0,
    hoursPerShift: 8,
    shiftsPerDay: 2,
  });

  // Write times back to first stage
  for (const [wcCode, scheduledOrders] of rescheduled) {
    for (const order of scheduledOrders) {
      if (order.stages.length > 0 && order.stages[0].workCenter === wcCode) {
        order.stages[0].startTime = order.startTime;
        order.stages[0].endTime = order.endTime;
        order.stages[0].processingHrs = Math.round((order.qty / (STAGE_RATES[order.stages[0].stage] || 120)) * 100) / 100;
      }
    }
  }

  // Re-link subsequent stages
  for (const order of optimized) {
    for (let s = 1; s < order.stages.length; s++) {
      const prevEnd = order.stages[s - 1].endTime;
      if (prevEnd == null) continue;
      const rate = STAGE_RATES[order.stages[s].stage] || 150;
      const hrs = order.qty / rate;
      order.stages[s].processingHrs = Math.round(hrs * 100) / 100;
      order.stages[s].startTime = Math.round((prevEnd + 2) * 100) / 100;
      order.stages[s].endTime = Math.round((prevEnd + 2 + hrs) * 100) / 100;
    }
  }

  _simulateExecutionForPlant(plantCode);
  _buildScheduleResultForPlant(plantCode);

  return { success: true, schedule: getSchedule(plantCode) };
}

/**
 * Get execution status for running orders at a plant.
 */
export function getExecutionStatus(plantCode) {
  const orders = _processOrders.get(plantCode) || [];
  const running = [];
  let completedCount = 0;

  for (const order of orders) {
    const exec = _executionState.get(order.id);
    if (!exec) continue;

    if (exec.status === 'complete') {
      completedCount++;
    } else if (exec.status === 'running') {
      running.push({
        orderId: order.id,
        familyId: order.familyId,
        familyName: order.familyName,
        brandColor: order.brandColor,
        workCenter: order.stages[0]?.workCenter || null,
        plannedQty: order.qty,
        unitsCompleted: exec.unitsCompleted,
        pacePercent: exec.pacePercent,
        status: exec.status,
      });
    }
  }

  return {
    plantCode,
    running,
    runningCount: running.length,
    completedCount,
    totalOrders: orders.length,
  };
}

/**
 * Get the changeover matrix for a plant.
 */
export function getChangeoverMatrix(plantCode) {
  const matrix = _changeoverMatrix.get(plantCode);
  if (!matrix) return null;

  const entries = [];
  for (const [key, hours] of matrix) {
    const [fromFam, toFam] = key.split('|');
    entries.push({ fromFamily: fromFam, toFamily: toFam, hours });
  }
  return { plantCode, entries };
}

/**
 * Update a single changeover entry.
 */
export function updateChangeoverEntry(plantCode, fromFam, toFam, hours) {
  const matrix = _changeoverMatrix.get(plantCode);
  if (!matrix) return { error: 'Plant not found' };
  matrix.set(`${fromFam}|${toFam}`, hours);
  return { success: true, fromFamily: fromFam, toFamily: toFam, hours };
}

/**
 * Get downtime events for a plant.
 */
export function getDowntimeEvents(plantCode) {
  return _downtimeEvents.get(plantCode) || [];
}

/**
 * Add a new downtime event.
 */
export function addDowntimeEvent(plantCode, event) {
  const events = _downtimeEvents.get(plantCode);
  if (!events) return { error: 'Plant not found' };

  const id = `DT-${String(events.length + 100).padStart(3, '0')}`;
  const newEvent = { id, ...event };
  events.push(newEvent);

  // Re-run scheduling to reflect new downtime
  _runSchedulingForPlant(plantCode);
  _simulateExecutionForPlant(plantCode);
  _buildScheduleResultForPlant(plantCode);

  return { success: true, event: newEvent };
}

/**
 * Remove a downtime event by ID.
 */
export function removeDowntimeEvent(eventId) {
  for (const [plantCode, events] of _downtimeEvents) {
    const idx = events.findIndex(e => e.id === eventId);
    if (idx !== -1) {
      events.splice(idx, 1);
      _runSchedulingForPlant(plantCode);
      _simulateExecutionForPlant(plantCode);
      _buildScheduleResultForPlant(plantCode);
      return { success: true, removedId: eventId };
    }
  }
  return { error: 'Downtime event not found' };
}

/**
 * Get the current sequencing rule for a plant.
 */
export function getSequencingRule(plantCode) {
  return { plantCode, rule: _sequencingRule.get(plantCode) || 'EDD' };
}

/**
 * Set the sequencing rule for a plant and re-schedule.
 */
export function setSequencingRule(plantCode, rule) {
  const validRules = ['EDD', 'SPT', 'CR', 'FIFO', 'MIN_CHANGEOVER'];
  if (!validRules.includes(rule)) {
    return { error: `Invalid rule. Must be one of: ${validRules.join(', ')}` };
  }

  _sequencingRule.set(plantCode, rule);

  if (rule === 'MIN_CHANGEOVER') {
    // Optimize all first-stage work centers
    const plantWCs = workCenters.filter(wc =>
      wc.plant === plantCode && (wc.type === 'extrusion' || wc.type === 'retort')
    );
    for (const wc of plantWCs) {
      optimizeSequence(plantCode, wc.code);
    }
  } else {
    _runSchedulingForPlant(plantCode);
    _simulateExecutionForPlant(plantCode);
    _buildScheduleResultForPlant(plantCode);
  }

  return { success: true, plantCode, rule };
}

/**
 * Get KPI summary for a plant schedule.
 */
export function getScheduleSummary(plantCode) {
  const result = _scheduleResult.get(plantCode);
  if (!result) return null;
  return { plantCode, plantName: result.plantName, ...result.summary };
}
