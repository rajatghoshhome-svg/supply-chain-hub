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
