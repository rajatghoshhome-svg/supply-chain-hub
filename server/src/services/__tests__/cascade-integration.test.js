import { describe, it, expect, beforeAll } from 'vitest';
import { cascade, CASCADE_EVENTS } from '../cascade.js';
import { triggerFullCascade } from '../cascade-handlers.js';

describe('Cascade Integration — Full ASCM E2E', () => {
  it('runs a full cascade: Demand → DRP → Prod Plan → Scheduling → MRP', async () => {
    const events = [];

    cascade.on(CASCADE_EVENTS.CASCADE_STARTED, () => events.push('started'));
    cascade.on(CASCADE_EVENTS.CASCADE_STEP_COMPLETE, (e) => events.push(e.step.event));
    cascade.on(CASCADE_EVENTS.CASCADE_COMPLETE, () => events.push('complete'));
    cascade.on(CASCADE_EVENTS.CASCADE_FAILED, (e) => events.push('failed:' + e.error));

    const result = await triggerFullCascade();

    expect(result.planRunId).toBeDefined();
    expect(result.queued).toBe(false);
    expect(result.rejected).toBeUndefined();

    // Verify full cascade executed
    expect(events).toContain('started');
    expect(events).toContain('complete');
    expect(events.filter(e => typeof e === 'string' && e.startsWith('failed'))).toHaveLength(0);

    // Should have hit all 5 steps
    expect(events).toContain(CASCADE_EVENTS.DEMAND_UPDATED);
    expect(events).toContain(CASCADE_EVENTS.DRP_REBALANCED);
    expect(events).toContain(CASCADE_EVENTS.PRODUCTION_PLAN_CHANGED);
    expect(events).toContain(CASCADE_EVENTS.SCHEDULE_UPDATED);
    expect(events).toContain(CASCADE_EVENTS.MRP_RUN_COMPLETE);
  }, 10000); // Allow 10s for full cascade

  it('cascade status returns idle after completion', () => {
    const status = cascade.getStatus();
    expect(status.state).toBe('idle');
    expect(status.registeredHandlers.length).toBeGreaterThanOrEqual(5);
  });
});
