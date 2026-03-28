/**
 * Cascade Orchestrator
 *
 * Event-driven planning cascade that propagates changes through modules:
 *
 *   DEMAND_UPDATED → demand engine → DEMAND_PLAN_UPDATED
 *     → MRP engine → MRP_RUN_COMPLETE
 *     → prod-plan engine → PRODUCTION_PLAN_CHANGED
 *     → scheduling engine → SCHEDULE_UPDATED
 *     → DRP engine → DRP_REBALANCED
 *     → AI exception analysis → ANALYSIS_COMPLETE
 *     → NOTIFY_USER
 *
 * Architecture:
 *   - EventEmitter-based (in-process, single-tenant)
 *   - Queue serialized (one cascade at a time)
 *   - Circuit breaker: max depth=10, dead-letter after 3 consecutive fails
 *   - plan_run_id versioning for every cascade
 *   - SSE endpoint for real-time progress updates
 *
 * This module is the orchestrator skeleton. Module-specific handlers
 * are registered by the service layer during app startup.
 */

import { EventEmitter } from 'node:events';

// ─── Event Types ──────────────────────────────────────────────────

export const CASCADE_EVENTS = {
  // Module triggers
  DEMAND_UPDATED: 'cascade:demand_updated',
  DEMAND_PLAN_UPDATED: 'cascade:demand_plan_updated',
  MRP_RUN_COMPLETE: 'cascade:mrp_run_complete',
  PRODUCTION_PLAN_CHANGED: 'cascade:production_plan_changed',
  SCHEDULE_UPDATED: 'cascade:schedule_updated',
  DRP_REBALANCED: 'cascade:drp_rebalanced',

  // Cross-cutting
  ANALYSIS_COMPLETE: 'cascade:analysis_complete',
  CASCADE_STARTED: 'cascade:started',
  CASCADE_STEP_COMPLETE: 'cascade:step_complete',
  CASCADE_COMPLETE: 'cascade:complete',
  CASCADE_FAILED: 'cascade:failed',

  // User notification
  NOTIFY_USER: 'cascade:notify_user',
};

// ─── Cascade State ──────���─────────────────────────────────────────

const STATE = {
  IDLE: 'idle',
  RUNNING: 'running',
  FAILED: 'failed',
};

// ─── Orchestrator ─────────────────────────────────────────────────

export class CascadeOrchestrator extends EventEmitter {
  constructor({ maxDepth = 10, maxRetries = 3, maxListeners = 20 } = {}) {
    super();
    this.setMaxListeners(maxListeners);

    this.maxDepth = maxDepth;
    this.maxRetries = maxRetries;

    // Queue: only one cascade runs at a time
    this.queue = [];
    this.state = STATE.IDLE;
    this.currentRun = null;

    // SSE clients watching cascade state
    this.sseClients = new Set();

    // Step handlers: event → async function(payload, context)
    this.stepHandlers = new Map();

    // Dead letter queue for failed cascades
    this.deadLetter = [];

    // Circuit breaker
    this.consecutiveFailures = 0;
    this.circuitOpen = false;
  }

  // ─── Register Step Handlers ───────────────────────────────────

  /**
   * Register a handler for a cascade event
   * @param {string} event - CASCADE_EVENTS value
   * @param {Function} handler - async (payload, context) => { nextEvent?, payload? }
   */
  registerStep(event, handler) {
    this.stepHandlers.set(event, handler);
  }

  // ─── Trigger a Cascade ────────────────────────────────────────

  /**
   * Start a new cascade. If one is running, queue it.
   * @param {string} triggerEvent - The initiating event
   * @param {Object} payload - Event-specific data
   * @param {Object} options - { planRunId, isScenario }
   * @returns {Object} - { planRunId, queued }
   */
  async trigger(triggerEvent, payload = {}, options = {}) {
    const planRunId = options.planRunId || `run_${Date.now()}`;

    const cascade = {
      planRunId,
      triggerEvent,
      payload,
      isScenario: options.isScenario || false,
      steps: [],
      depth: 0,
      createdAt: new Date(),
    };

    if (this.circuitOpen) {
      this.deadLetter.push({ ...cascade, reason: 'circuit_open' });
      this.broadcastSSE({
        type: 'cascade_rejected',
        planRunId,
        reason: 'Circuit breaker open — too many consecutive failures',
      });
      return { planRunId, queued: false, rejected: true };
    }

    if (this.state === STATE.RUNNING) {
      this.queue.push(cascade);
      this.broadcastSSE({
        type: 'cascade_queued',
        planRunId,
        position: this.queue.length,
      });
      return { planRunId, queued: true };
    }

    await this._execute(cascade);
    return { planRunId, queued: false };
  }

  // ─── Execute Cascade ──────────────────────────────────────────

  async _execute(cascade) {
    this.state = STATE.RUNNING;
    this.currentRun = cascade;

    this.emit(CASCADE_EVENTS.CASCADE_STARTED, {
      planRunId: cascade.planRunId,
      triggerEvent: cascade.triggerEvent,
    });

    this.broadcastSSE({
      type: 'cascade_started',
      planRunId: cascade.planRunId,
      triggerEvent: cascade.triggerEvent,
    });

    let currentEvent = cascade.triggerEvent;
    let currentPayload = cascade.payload;
    let retries = 0;

    try {
      while (currentEvent && cascade.depth < this.maxDepth) {
        const handler = this.stepHandlers.get(currentEvent);
        if (!handler) {
          // No handler for this event — cascade ends naturally
          break;
        }

        const stepStart = Date.now();
        cascade.depth++;

        const context = {
          planRunId: cascade.planRunId,
          depth: cascade.depth,
          isScenario: cascade.isScenario,
          previousSteps: cascade.steps,
        };

        try {
          const result = await handler(currentPayload, context);

          const step = {
            event: currentEvent,
            durationMs: Date.now() - stepStart,
            status: 'complete',
            depth: cascade.depth,
          };

          cascade.steps.push(step);

          this.emit(CASCADE_EVENTS.CASCADE_STEP_COMPLETE, {
            planRunId: cascade.planRunId,
            step,
          });

          this.broadcastSSE({
            type: 'step_complete',
            planRunId: cascade.planRunId,
            step: currentEvent,
            depth: cascade.depth,
            durationMs: step.durationMs,
            nextEvent: result?.nextEvent || null,
          });

          // Move to next step
          currentEvent = result?.nextEvent || null;
          currentPayload = result?.payload || {};
          retries = 0; // reset on success

        } catch (stepError) {
          retries++;
          if (retries >= this.maxRetries) {
            throw stepError; // will be caught by outer catch
          }
          // Retry the same step
          cascade.depth--; // don't count retry as depth
          console.warn(`[CASCADE] Step ${currentEvent} failed (attempt ${retries}/${this.maxRetries}):`, stepError.message);
        }
      }

      // Max depth check
      if (cascade.depth >= this.maxDepth) {
        console.warn(`[CASCADE] Max depth (${this.maxDepth}) reached for ${cascade.planRunId}`);
      }

      // Success
      this.consecutiveFailures = 0;
      this.emit(CASCADE_EVENTS.CASCADE_COMPLETE, {
        planRunId: cascade.planRunId,
        steps: cascade.steps,
        totalSteps: cascade.steps.length,
      });

      this.broadcastSSE({
        type: 'cascade_complete',
        planRunId: cascade.planRunId,
        totalSteps: cascade.steps.length,
        totalDurationMs: cascade.steps.reduce((s, step) => s + step.durationMs, 0),
      });

    } catch (error) {
      this.consecutiveFailures++;
      cascade.error = error.message;

      if (this.consecutiveFailures >= this.maxRetries) {
        this.circuitOpen = true;
        console.error(`[CASCADE] Circuit breaker OPEN after ${this.consecutiveFailures} consecutive failures`);
        // Auto-reset after 60 seconds
        setTimeout(() => {
          this.circuitOpen = false;
          this.consecutiveFailures = 0;
          console.log('[CASCADE] Circuit breaker reset');
        }, 60000);
      }

      this.deadLetter.push({ ...cascade, reason: error.message });

      this.emit(CASCADE_EVENTS.CASCADE_FAILED, {
        planRunId: cascade.planRunId,
        error: error.message,
        step: currentEvent,
        depth: cascade.depth,
      });

      this.broadcastSSE({
        type: 'cascade_failed',
        planRunId: cascade.planRunId,
        error: error.message,
        step: currentEvent,
      });

    } finally {
      this.state = STATE.IDLE;
      this.currentRun = null;

      // Process next in queue
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        // Use setImmediate to avoid deep call stacks
        setImmediate(() => this._execute(next));
      }
    }
  }

  // ─── SSE Support ──────────────────────────────────────────────

  /**
   * Add an SSE client for real-time cascade updates
   * @param {Response} res - Express response object
   */
  addSSEClient(res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send current state immediately
    res.write(`data: ${JSON.stringify({
      type: 'state',
      state: this.state,
      currentRun: this.currentRun?.planRunId || null,
      queueLength: this.queue.length,
      circuitOpen: this.circuitOpen,
    })}\n\n`);

    this.sseClients.add(res);

    res.on('close', () => {
      this.sseClients.delete(res);
    });
  }

  broadcastSSE(data) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    for (const client of this.sseClients) {
      try {
        client.write(message);
      } catch {
        this.sseClients.delete(client);
      }
    }
  }

  // ─── Status ───────────────────────────────────────────────────

  getStatus() {
    return {
      state: this.state,
      currentRun: this.currentRun ? {
        planRunId: this.currentRun.planRunId,
        triggerEvent: this.currentRun.triggerEvent,
        depth: this.currentRun.depth,
        steps: this.currentRun.steps.length,
      } : null,
      queueLength: this.queue.length,
      circuitOpen: this.circuitOpen,
      consecutiveFailures: this.consecutiveFailures,
      deadLetterCount: this.deadLetter.length,
      registeredHandlers: [...this.stepHandlers.keys()],
    };
  }

  /**
   * Reset circuit breaker manually
   */
  resetCircuitBreaker() {
    this.circuitOpen = false;
    this.consecutiveFailures = 0;
  }
}

// ─── Singleton Instance ──────────���────────────────────────────────
// Single-tenant app → one orchestrator instance

export const cascade = new CascadeOrchestrator();
