/**
 * Production Scheduling Engine
 *
 * ASCM MPC Framework position:
 *   Demand Plan → DRP → Production Plan → Scheduling → MRP
 *
 * Scheduling takes the aggregate production plan and sequences specific
 * production orders on work centers:
 *   - Forward scheduling from earliest available time
 *   - Sequencing rules: SPT, EDD, Critical Ratio
 *   - Changeover time between different product types
 *
 * All functions are pure — no side effects, no DB calls.
 */

/**
 * Forward schedule a pre-sequenced list of orders.
 *
 * Assigns start/end times sequentially, accounting for changeover
 * time between different SKUs.
 *
 * @param {Object} params
 * @param {Object[]} params.orders - Pre-sequenced orders
 * @param {number} [params.startTime=0] - Starting time (hours from horizon start)
 * @param {number} [params.capacityHoursPerDay=8]
 * @param {number} [params.changeoverTime=0] - Hours for changeover between different SKUs
 * @returns {Object[]} Scheduled orders with start/end times
 */
export function forwardSchedule({
  orders,
  startTime = 0,
  capacityHoursPerDay = 8,
  changeoverTime = 0,
}) {
  const schedule = [];
  let currentTime = startTime;
  let prevSkuCode = null;

  for (const order of orders) {
    // Add changeover if SKU changes
    if (prevSkuCode && order.skuCode !== prevSkuCode && changeoverTime > 0) {
      currentTime += changeoverTime;
    }

    const start = currentTime;
    const end = start + order.processingTime;

    // Determine if order will be late
    let late = false;
    let lateDays = 0;
    if (order.dueDate) {
      const endDay = end / capacityHoursPerDay;
      const dueDateObj = new Date(order.dueDate);
      const horizonStart = new Date('2026-04-07'); // Reference start
      const dueDays = (dueDateObj - horizonStart) / (1000 * 60 * 60 * 24);
      if (endDay > dueDays) {
        late = true;
        lateDays = Math.round((endDay - dueDays) * 10) / 10;
      }
    }

    schedule.push({
      ...order,
      startTime: start,
      endTime: end,
      late,
      lateDays,
    });

    currentTime = end;
    prevSkuCode = order.skuCode;
  }

  return schedule;
}

/**
 * Sequence orders by a given dispatching rule.
 *
 * @param {Object} params
 * @param {Object[]} params.orders
 * @param {string} params.rule - 'SPT' | 'EDD' | 'CR' | 'FIFO'
 * @param {string} [params.currentDate] - For CR calculation
 * @param {number} [params.capacityHoursPerDay=8]
 * @returns {Object[]} Sorted copy of orders
 */
export function sequenceOrders({
  orders,
  rule,
  currentDate,
  capacityHoursPerDay = 8,
}) {
  const sorted = [...orders];

  switch (rule) {
    case 'SPT':
      // Shortest Processing Time first
      sorted.sort((a, b) => a.processingTime - b.processingTime);
      break;

    case 'EDD':
      // Earliest Due Date first
      sorted.sort((a, b) => {
        const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return da - db;
      });
      break;

    case 'CR': {
      // Critical Ratio = (time until due) / (processing time in days)
      // Lower CR = more urgent
      const now = currentDate ? new Date(currentDate) : new Date('2026-04-07');
      sorted.sort((a, b) => {
        const aDueDays = a.dueDate
          ? (new Date(a.dueDate) - now) / (1000 * 60 * 60 * 24)
          : Infinity;
        const bDueDays = b.dueDate
          ? (new Date(b.dueDate) - now) / (1000 * 60 * 60 * 24)
          : Infinity;
        const aProcDays = a.processingTime / capacityHoursPerDay;
        const bProcDays = b.processingTime / capacityHoursPerDay;
        const crA = aProcDays > 0 ? aDueDays / aProcDays : Infinity;
        const crB = bProcDays > 0 ? bDueDays / bProcDays : Infinity;
        if (crA !== crB) return crA - crB;
        // Tie-break by processing time (SPT)
        return a.processingTime - b.processingTime;
      });
      break;
    }

    default:
      // FIFO — maintain original order
      break;
  }

  return sorted;
}

/**
 * Calculate makespan (total time from first start to last end).
 *
 * @param {Object[]} schedule - Array of { startTime, endTime }
 * @returns {number} Makespan in hours
 */
export function calculateMakespan(schedule) {
  if (!schedule || schedule.length === 0) return 0;
  const maxEnd = Math.max(...schedule.map(s => s.endTime));
  const minStart = Math.min(...schedule.map(s => s.startTime));
  return maxEnd - minStart;
}

/**
 * Run the full scheduler — sequence + forward schedule.
 *
 * @param {Object} params
 * @param {Object[]} params.orders
 * @param {string} params.rule - Primary dispatching rule
 * @param {number} [params.capacityHoursPerDay=8]
 * @param {number} [params.changeoverTime=0]
 * @param {boolean} [params.compareRules=false] - Compare all rules
 * @param {string} [params.currentDate]
 * @returns {{ schedule: Object[], makespan: number, rule: string, comparison?: Object }}
 */
export function runScheduler({
  orders,
  rule = 'EDD',
  capacityHoursPerDay = 8,
  changeoverTime = 0,
  compareRules = false,
  currentDate,
}) {
  // Primary rule
  const sequenced = sequenceOrders({ orders, rule, currentDate, capacityHoursPerDay });
  const schedule = forwardSchedule({ orders: sequenced, capacityHoursPerDay, changeoverTime });
  const makespan = calculateMakespan(schedule);

  const result = {
    rule,
    schedule,
    makespan,
    lateOrders: schedule.filter(s => s.late).length,
    totalOrders: schedule.length,
  };

  // Compare all rules
  if (compareRules) {
    const rules = ['SPT', 'EDD', 'CR'];
    result.comparison = {};

    for (const r of rules) {
      const seq = sequenceOrders({ orders, rule: r, currentDate, capacityHoursPerDay });
      const sched = forwardSchedule({ orders: seq, capacityHoursPerDay, changeoverTime });
      result.comparison[r] = {
        makespan: calculateMakespan(sched),
        lateOrders: sched.filter(s => s.late).length,
        sequence: sched.map(s => s.id),
      };
    }
  }

  return result;
}

/**
 * Forward-schedule orders across multiple work centers, respecting
 * changeover times and downtime windows.
 *
 * @param {Object} params
 * @param {Map<string, Object[]>} params.ordersByWorkCenter - Orders pre-grouped by work center code
 * @param {Map<string, number>} params.changeoverMatrix - 'fromFamId|toFamId' → changeover hours
 * @param {Object[]} [params.downtimeEvents=[]] - { workCenter, startHr, endHr }
 * @param {number} [params.startHour=0]
 * @param {number} [params.hoursPerShift=8]
 * @param {number} [params.shiftsPerDay=2]
 * @returns {Map<string, Object[]>} wcCode → Order[] with startTime/endTime filled in
 */
export function forwardScheduleMultiResource({
  ordersByWorkCenter,
  changeoverMatrix,
  downtimeEvents = [],
  startHour = 0,
  hoursPerShift = 8,
  shiftsPerDay = 2,
}) {
  const result = new Map();

  for (const [wcCode, orders] of ordersByWorkCenter) {
    const wcDowntimes = downtimeEvents.filter(d => d.workCenter === wcCode);
    let clock = startHour;
    let prevFamilyId = null;
    const scheduled = [];

    for (const order of orders) {
      // (a) Skip over any downtime window the clock falls into
      for (const dt of wcDowntimes) {
        if (clock >= dt.startHr && clock < dt.endHr) {
          clock = dt.endHr;
        }
      }

      // (b) Changeover time if family changed
      if (prevFamilyId && order.familyId !== prevFamilyId) {
        const key = `${prevFamilyId}|${order.familyId}`;
        const changeover = changeoverMatrix.get(key) ?? 2.0;
        clock += changeover;
      }

      // (c) Skip over downtime again after changeover bump
      for (const dt of wcDowntimes) {
        if (clock >= dt.startHr && clock < dt.endHr) {
          clock = dt.endHr;
        }
      }

      // (d) Processing time
      const processingHrs = order.qty / order.unitsPerHour;

      // (e) Assign times
      order.startTime = clock;
      order.endTime = clock + processingHrs;

      // (f) Advance clock
      clock = order.endTime;
      prevFamilyId = order.familyId;

      scheduled.push(order);
    }

    result.set(wcCode, scheduled);
  }

  return result;
}

/**
 * Link two scheduling stages so that second-stage orders cannot start
 * until their matching first-stage order completes plus a buffer.
 *
 * If pushing an order forward causes it to overlap with later orders
 * on the same work center, those later orders are cascade-shifted.
 *
 * @param {Map<string, Object[]>} firstStageSchedule - wcCode → Order[]
 * @param {Map<string, Object[]>} secondStageSchedule - wcCode → Order[]
 * @param {number} [bufferHrs=2]
 * @returns {Map<string, Object[]>} Adjusted secondStageSchedule
 */
export function linkStages(firstStageSchedule, secondStageSchedule, bufferHrs = 2) {
  // Build lookup: orderId → first-stage order
  const firstStageByOrderId = new Map();
  for (const [, orders] of firstStageSchedule) {
    for (const order of orders) {
      firstStageByOrderId.set(order.orderId, order);
    }
  }

  // Adjust second stage
  for (const [wcCode, orders] of secondStageSchedule) {
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      const firstOrder = firstStageByOrderId.get(order.orderId);
      if (!firstOrder) continue;

      const earliestStart = firstOrder.endTime + bufferHrs;
      if (order.startTime < earliestStart) {
        const duration = order.endTime - order.startTime;
        order.startTime = earliestStart;
        order.endTime = earliestStart + duration;

        // Cascade-shift later orders on this work center
        for (let j = i + 1; j < orders.length; j++) {
          const prev = orders[j - 1];
          if (orders[j].startTime < prev.endTime) {
            const dur = orders[j].endTime - orders[j].startTime;
            orders[j].startTime = prev.endTime;
            orders[j].endTime = prev.endTime + dur;
          }
        }
      }
    }
  }

  return secondStageSchedule;
}

/**
 * Greedy nearest-neighbor heuristic to minimize total changeover time.
 *
 * Starts with the first order and greedily picks the next order that
 * has the lowest changeover cost from the current order's family.
 *
 * @param {Object[]} orders - Orders with familyId property
 * @param {Map<string, number>} changeoverMatrix - 'fromFamId|toFamId' → changeover hours
 * @returns {Object[]} Reordered copy of orders
 */
export function minimizeChangeover(orders, changeoverMatrix) {
  if (!orders || orders.length <= 1) return orders ? [...orders] : [];

  const result = [orders[0]];
  const remaining = orders.slice(1);

  while (remaining.length > 0) {
    const current = result[result.length - 1];
    let bestIdx = 0;
    let bestCost = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const key = `${current.familyId}|${remaining[i].familyId}`;
      const cost = changeoverMatrix.get(key) ?? 2.0;
      if (cost < bestCost) {
        bestCost = cost;
        bestIdx = i;
      }
    }

    result.push(remaining.splice(bestIdx, 1)[0]);
  }

  return result;
}
