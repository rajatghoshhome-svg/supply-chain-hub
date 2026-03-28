/**
 * Scheduling AI Context Builder
 *
 * Translates scheduling engine output (Gantt data, sequencing rule comparison)
 * into a structured prompt for Claude to analyze schedule efficiency,
 * identify bottlenecks, and recommend sequencing improvements.
 *
 * ASCM context: Scheduling is the operator/Gantt level. It receives
 * production orders from MPS and creates a detailed sequence on work centers.
 * CLOSED LOOP: Scheduling timing shifts → MRP material needs adjust →
 * if materials unavailable → signals back to MPS for rescheduling.
 */

const SYSTEM_PROMPT = `You are an ASCM/APICS-certified production scheduling assistant embedded in a supply chain planning platform for small and mid-size manufacturers ($50M-$500M revenue).

Your role:
1. ANALYZE schedule performance — makespan, late orders, utilization
2. COMPARE sequencing rules (SPT, EDD, CR) and recommend the best fit
3. IDENTIFY bottlenecks — changeover time waste, capacity gaps, sequencing inefficiencies
4. EXPLAIN the closed loop — how schedule changes impact MRP material timing

Rules:
- Cite specific order IDs, SKU codes, start/end times, and due dates
- SPT (Shortest Processing Time): minimizes average flow time and WIP
- EDD (Earliest Due Date): minimizes maximum lateness, best for due-date compliance
- CR (Critical Ratio): prioritizes orders with tightest time-to-due ratio
- Changeover time between different SKUs is real cost — group similar SKUs when possible
- Late orders are the primary KPI — zero late orders is the target
- If multiple rules yield zero late orders, prefer the one with shortest makespan
- Format schedule comparisons as markdown tables
- Consider the CLOSED LOOP: if a schedule shift delays production by 1 week,
  MRP planned order releases shift too, potentially causing material shortages
- Keep recommendations actionable — "resequence PO-003 before PO-005 to eliminate late delivery"
- NEVER fabricate data. Only analyze what's provided.

ASCM MPC Framework position:
  MPS → **Scheduling** ⟲ MRP
  Scheduling answers: IN WHAT SEQUENCE and WHEN EXACTLY on the shop floor.
  Timing changes feed back to MRP for material requirement adjustments.`;

/**
 * Build structured context for Claude to analyze scheduling output.
 *
 * @param {Object} params
 * @param {Object} params.scheduleResult - Scheduler output (schedule, comparison, etc.)
 * @param {string} params.plant - Plant code
 * @param {string} params.rule - Active sequencing rule
 * @param {string[]} params.periods - Period labels
 * @param {string} [params.plannerQuestion] - Optional question
 * @returns {{ systemPrompt: string, userMessage: string }}
 */
export function buildSchedulingContext({ scheduleResult, plant, rule, periods, plannerQuestion }) {
  const sections = [];

  sections.push(`## Plant: ${plant}`);
  sections.push(`Active Sequencing Rule: ${rule}`);
  if (periods) {
    sections.push(`Planning Horizon: ${periods.length} periods (${periods[0]} to ${periods[periods.length - 1]})\n`);
  }

  // Schedule summary
  if (scheduleResult) {
    sections.push(`## Schedule Summary`);
    sections.push(`- Total Orders: ${scheduleResult.totalOrders || 0}`);
    sections.push(`- Makespan: ${scheduleResult.makespan || 0} hours`);
    sections.push(`- Late Orders: ${scheduleResult.lateOrders || 0}`);
    sections.push(`- Avg Flow Time: ${scheduleResult.avgFlowTime?.toFixed(1) || 'N/A'} hours`);

    // Detailed schedule
    if (scheduleResult.schedule?.length > 0) {
      sections.push(`\n## Detailed Schedule (${rule})`);
      sections.push('| Order | SKU | Qty | Start | End | Due Date | Late? |');
      sections.push('|-------|-----|-----|-------|-----|----------|-------|');
      for (const o of scheduleResult.schedule) {
        const lateStr = o.late ? `YES (+${o.lateDays}d)` : 'No';
        sections.push(`| ${o.id} | ${o.skuCode} | ${o.qty} | ${o.startTime}h | ${o.endTime}h | ${o.dueDate} | ${lateStr} |`);
      }
    }

    // Rule comparison
    if (scheduleResult.comparison) {
      sections.push(`\n## Sequencing Rule Comparison`);
      sections.push('| Rule | Makespan | Late Orders | Avg Flow Time |');
      sections.push('|------|----------|-------------|---------------|');
      for (const [ruleName, stats] of Object.entries(scheduleResult.comparison)) {
        sections.push(`| ${ruleName} | ${stats.makespan}h | ${stats.lateOrders} | ${stats.avgFlowTime?.toFixed(1) || 'N/A'}h |`);
      }
      sections.push(`\nSequences:`);
      for (const [ruleName, stats] of Object.entries(scheduleResult.comparison)) {
        sections.push(`- ${ruleName}: ${stats.sequence?.join(' → ') || 'N/A'}`);
      }
    }
  }

  let userMessage = `Analyze this production schedule and provide recommendations:\n\n${sections.join('\n')}`;

  if (plannerQuestion) {
    userMessage += `\n\n---\nPlanner's question: ${plannerQuestion}`;
  }

  userMessage += `\n\nPlease provide:
1. Schedule performance assessment — is this schedule acceptable?
2. Sequencing rule recommendation with justification
3. Late order root cause analysis (if any late orders exist)
4. Changeover optimization opportunities
5. Closed-loop impact — how does this schedule affect MRP material timing?`;

  return { systemPrompt: SYSTEM_PROMPT, userMessage };
}

/**
 * Build lightweight chat context for the scheduling module.
 * Called from the central chat dispatcher with cached live data.
 *
 * @param {Object} params
 * @param {Object[]} params.plants - Plant list
 * @param {Object} params.plantWorkCenters - Work center data keyed by plant code
 * @param {Object} params.liveData - Cached live engine snapshot
 * @returns {{ systemPromptSection: string, dataSnapshot: object }}
 */
export function buildSchedulingChatContext({ plants, plantWorkCenters, liveData }) {
  const lines = ['\n## Scheduling Context'];
  lines.push('Rules available: SPT (shortest processing time), EDD (earliest due date), CR (critical ratio)');
  for (const plant of plants) {
    const wcs = plantWorkCenters[plant.code] || [];
    lines.push(`${plant.code}: ${wcs.map(w => `${w.code} (${w.name}, ${w.capacityHoursPerWeek}h/wk)`).join(', ')}`);
  }

  const systemPromptSection = `\n## ASCM Scheduling Methodology
Sequencing rules: SPT (minimizes avg flow time/WIP), EDD (minimizes max lateness), CR (critical ratio — prioritizes tightest due dates).
Changeover time between different SKU families is a real cost — group similar products.
Closed loop: schedule timing shifts -> MRP material needs adjust -> signals back to MPS.
Key KPIs: makespan, late orders (target zero), average flow time, utilization.
Capabilities: sequence optimization, constraint relaxation suggestions, rule comparison.`;

  let dataSnapshot = null;
  if (liveData?.schedSummaries) {
    lines.push('\nScheduling (EDD rule):');
    for (const [pc, s] of Object.entries(liveData.schedSummaries)) {
      lines.push(`  ${pc}: ${s.totalOrders} orders, makespan=${s.makespan}h, ${s.lateOrders} late`);
    }
    dataSnapshot = { schedSummaries: liveData.schedSummaries };
  }

  return {
    systemPromptSection: systemPromptSection + '\n' + lines.join('\n'),
    dataSnapshot,
  };
}
