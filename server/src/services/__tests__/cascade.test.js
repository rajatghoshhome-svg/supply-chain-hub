import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CascadeOrchestrator, CASCADE_EVENTS } from '../cascade.js';

describe('Cascade Orchestrator', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new CascadeOrchestrator({ maxDepth: 5, maxRetries: 2 });
  });

  describe('Basic Cascade Flow', () => {
    it('executes a single-step cascade', async () => {
      orchestrator.registerStep(CASCADE_EVENTS.DEMAND_UPDATED, async (payload) => {
        return { nextEvent: null, payload: { done: true } };
      });

      const { planRunId, queued } = await orchestrator.trigger(CASCADE_EVENTS.DEMAND_UPDATED, { skuCode: 'MTR-100' });

      expect(planRunId).toBeDefined();
      expect(queued).toBe(false);
      expect(orchestrator.state).toBe('idle');
    });

    it('chains multiple steps together', async () => {
      const steps = [];

      orchestrator.registerStep(CASCADE_EVENTS.DEMAND_UPDATED, async () => {
        steps.push('demand');
        return { nextEvent: CASCADE_EVENTS.DEMAND_PLAN_UPDATED };
      });

      orchestrator.registerStep(CASCADE_EVENTS.DEMAND_PLAN_UPDATED, async () => {
        steps.push('mrp');
        return { nextEvent: CASCADE_EVENTS.MRP_RUN_COMPLETE };
      });

      orchestrator.registerStep(CASCADE_EVENTS.MRP_RUN_COMPLETE, async () => {
        steps.push('analysis');
        return { nextEvent: null };
      });

      await orchestrator.trigger(CASCADE_EVENTS.DEMAND_UPDATED);

      expect(steps).toEqual(['demand', 'mrp', 'analysis']);
    });

    it('passes payload between steps', async () => {
      orchestrator.registerStep(CASCADE_EVENTS.DEMAND_UPDATED, async (payload) => {
        return {
          nextEvent: CASCADE_EVENTS.MRP_RUN_COMPLETE,
          payload: { ...payload, mrpResult: 'done' },
        };
      });

      let receivedPayload;
      orchestrator.registerStep(CASCADE_EVENTS.MRP_RUN_COMPLETE, async (payload) => {
        receivedPayload = payload;
        return { nextEvent: null };
      });

      await orchestrator.trigger(CASCADE_EVENTS.DEMAND_UPDATED, { skuCode: 'SKU-A' });

      expect(receivedPayload.mrpResult).toBe('done');
      expect(receivedPayload.skuCode).toBe('SKU-A');
    });
  });

  describe('Queue Serialization', () => {
    it('queues cascades when one is already running', async () => {
      let resolve1;
      const blocker = new Promise(r => { resolve1 = r; });

      orchestrator.registerStep(CASCADE_EVENTS.DEMAND_UPDATED, async () => {
        await blocker;
        return { nextEvent: null };
      });

      // Start first cascade (will block)
      const p1 = orchestrator.trigger(CASCADE_EVENTS.DEMAND_UPDATED);

      // Try second cascade (should be queued)
      const result = await orchestrator.trigger(CASCADE_EVENTS.DEMAND_UPDATED);
      expect(result.queued).toBe(true);
      expect(orchestrator.queue.length).toBe(1);

      // Unblock
      resolve1();
      await p1;
    });
  });

  describe('Max Depth Protection', () => {
    it('stops at max depth', async () => {
      let depth = 0;

      // Create an infinite loop
      orchestrator.registerStep(CASCADE_EVENTS.DEMAND_UPDATED, async () => {
        depth++;
        return { nextEvent: CASCADE_EVENTS.DEMAND_UPDATED };
      });

      await orchestrator.trigger(CASCADE_EVENTS.DEMAND_UPDATED);

      expect(depth).toBe(5); // maxDepth
    });
  });

  describe('Circuit Breaker', () => {
    it('opens after consecutive failures', async () => {
      orchestrator.registerStep(CASCADE_EVENTS.DEMAND_UPDATED, async () => {
        throw new Error('Engine failed');
      });

      // First cascade fails
      await orchestrator.trigger(CASCADE_EVENTS.DEMAND_UPDATED);
      expect(orchestrator.circuitOpen).toBe(false);

      // Second cascade fails
      await orchestrator.trigger(CASCADE_EVENTS.DEMAND_UPDATED);
      expect(orchestrator.circuitOpen).toBe(true);

      // Third cascade should be rejected
      const result = await orchestrator.trigger(CASCADE_EVENTS.DEMAND_UPDATED);
      expect(result.rejected).toBe(true);
      expect(orchestrator.deadLetter.length).toBeGreaterThan(0);
    });

    it('resets circuit breaker manually', async () => {
      orchestrator.circuitOpen = true;
      orchestrator.resetCircuitBreaker();
      expect(orchestrator.circuitOpen).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('retries failed steps before giving up', async () => {
      let attempts = 0;

      orchestrator.registerStep(CASCADE_EVENTS.DEMAND_UPDATED, async () => {
        attempts++;
        if (attempts < 2) throw new Error('Transient failure');
        return { nextEvent: null };
      });

      await orchestrator.trigger(CASCADE_EVENTS.DEMAND_UPDATED);

      expect(attempts).toBe(2); // 1 fail + 1 success
    });

    it('emits CASCADE_FAILED on unrecoverable error', async () => {
      orchestrator.registerStep(CASCADE_EVENTS.DEMAND_UPDATED, async () => {
        throw new Error('Fatal error');
      });

      const failed = vi.fn();
      orchestrator.on(CASCADE_EVENTS.CASCADE_FAILED, failed);

      await orchestrator.trigger(CASCADE_EVENTS.DEMAND_UPDATED);

      expect(failed).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Fatal error',
        })
      );
    });
  });

  describe('Events', () => {
    it('emits CASCADE_STARTED on trigger', async () => {
      orchestrator.registerStep(CASCADE_EVENTS.DEMAND_UPDATED, async () => ({
        nextEvent: null,
      }));

      const started = vi.fn();
      orchestrator.on(CASCADE_EVENTS.CASCADE_STARTED, started);

      await orchestrator.trigger(CASCADE_EVENTS.DEMAND_UPDATED);

      expect(started).toHaveBeenCalledTimes(1);
    });

    it('emits CASCADE_STEP_COMPLETE for each step', async () => {
      orchestrator.registerStep(CASCADE_EVENTS.DEMAND_UPDATED, async () => ({
        nextEvent: CASCADE_EVENTS.MRP_RUN_COMPLETE,
      }));
      orchestrator.registerStep(CASCADE_EVENTS.MRP_RUN_COMPLETE, async () => ({
        nextEvent: null,
      }));

      const stepComplete = vi.fn();
      orchestrator.on(CASCADE_EVENTS.CASCADE_STEP_COMPLETE, stepComplete);

      await orchestrator.trigger(CASCADE_EVENTS.DEMAND_UPDATED);

      expect(stepComplete).toHaveBeenCalledTimes(2);
    });

    it('emits CASCADE_COMPLETE on success', async () => {
      orchestrator.registerStep(CASCADE_EVENTS.DEMAND_UPDATED, async () => ({
        nextEvent: null,
      }));

      const complete = vi.fn();
      orchestrator.on(CASCADE_EVENTS.CASCADE_COMPLETE, complete);

      await orchestrator.trigger(CASCADE_EVENTS.DEMAND_UPDATED);

      expect(complete).toHaveBeenCalledWith(
        expect.objectContaining({
          totalSteps: 1,
        })
      );
    });
  });

  describe('Status', () => {
    it('returns correct idle status', () => {
      const status = orchestrator.getStatus();
      expect(status.state).toBe('idle');
      expect(status.currentRun).toBeNull();
      expect(status.queueLength).toBe(0);
      expect(status.circuitOpen).toBe(false);
    });

    it('reports registered handlers', () => {
      orchestrator.registerStep(CASCADE_EVENTS.DEMAND_UPDATED, async () => ({}));
      orchestrator.registerStep(CASCADE_EVENTS.MRP_RUN_COMPLETE, async () => ({}));

      const status = orchestrator.getStatus();
      expect(status.registeredHandlers).toContain(CASCADE_EVENTS.DEMAND_UPDATED);
      expect(status.registeredHandlers).toContain(CASCADE_EVENTS.MRP_RUN_COMPLETE);
    });
  });

  describe('Scenario Support', () => {
    it('passes isScenario flag through context', async () => {
      let receivedContext;

      orchestrator.registerStep(CASCADE_EVENTS.DEMAND_UPDATED, async (payload, context) => {
        receivedContext = context;
        return { nextEvent: null };
      });

      await orchestrator.trigger(CASCADE_EVENTS.DEMAND_UPDATED, {}, {
        planRunId: 'scenario_1',
        isScenario: true,
      });

      expect(receivedContext.isScenario).toBe(true);
      expect(receivedContext.planRunId).toBe('scenario_1');
    });
  });
});
