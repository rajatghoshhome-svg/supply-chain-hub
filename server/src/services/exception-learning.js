/**
 * Exception Resolution Learning
 *
 * Analyzes past decisions from the decision log to:
 * 1. Find similar exceptions that were resolved before
 * 2. Suggest resolutions based on historical patterns
 * 3. Calculate confidence scores from acceptance rates
 */

import { getDecisions } from './decision-service.js';

// Pattern matching rules: map exception types to decision patterns
const EXCEPTION_PATTERNS = [
  {
    exceptionType: 'expedite',
    modules: ['mrp', 'drp'],
    keywords: ['expedite', 'shortage', 'stockout', 'urgent'],
    matchField: 'action', // match against decision action field
  },
  {
    exceptionType: 'reschedule-in',
    modules: ['mrp', 'scheduling'],
    keywords: ['reschedule', 'early', 'pull-in', 'advance'],
    matchField: 'action',
  },
  {
    exceptionType: 'reschedule-out',
    modules: ['mrp', 'scheduling'],
    keywords: ['defer', 'push-out', 'delay', 'postpone'],
    matchField: 'action',
  },
  {
    exceptionType: 'capacity-overload',
    modules: ['production', 'scheduling'],
    keywords: ['overtime', 'capacity', 'overload', 'bottleneck'],
    matchField: 'action',
  },
  {
    exceptionType: 'safety-stock-violation',
    modules: ['drp', 'mrp'],
    keywords: ['safety stock', 'below minimum', 'reorder'],
    matchField: 'action',
  },
  {
    exceptionType: 'demand-anomaly',
    modules: ['demand'],
    keywords: ['spike', 'anomaly', 'outlier', 'forecast'],
    matchField: 'action',
  },
];

/**
 * Find past decisions that match a given exception
 * @param {Object} exception - { module, severity, message, type }
 * @returns {Object} - { suggestedAction, confidence, matchCount, totalDecisions, history[] }
 */
export function suggestResolution(exception) {
  const decisions = getDecisions();

  // Find matching pattern
  const pattern = EXCEPTION_PATTERNS.find(p => {
    const moduleMatch = p.modules.includes(exception.module?.toLowerCase());
    const keywordMatch = p.keywords.some(kw =>
      (exception.message || '').toLowerCase().includes(kw) ||
      (exception.type || '').toLowerCase().includes(kw)
    );
    return moduleMatch && keywordMatch;
  });

  if (!pattern) {
    return { suggestedAction: null, confidence: 0, matchCount: 0, totalDecisions: 0, history: [] };
  }

  // Find decisions matching this pattern
  const matches = decisions.filter(d => {
    const moduleMatch = d.module?.toLowerCase() === exception.module?.toLowerCase();
    const keywordMatch = pattern.keywords.some(kw =>
      (d.action || '').toLowerCase().includes(kw) ||
      (d.rationale || '').toLowerCase().includes(kw)
    );
    return moduleMatch || keywordMatch;
  });

  if (matches.length === 0) {
    return { suggestedAction: null, confidence: 0, matchCount: 0, totalDecisions: decisions.length, history: [] };
  }

  // Calculate acceptance rate for this pattern
  const accepted = matches.filter(m => m.status === 'accepted');
  const deferred = matches.filter(m => m.status === 'deferred');
  const dismissed = matches.filter(m => m.status === 'dismissed');

  const confidence = matches.length > 0
    ? Math.round((accepted.length / matches.length) * 100)
    : 0;

  // Determine suggested action from most common accepted action
  const actionCounts = {};
  accepted.forEach(d => {
    const action = d.action || 'accept';
    actionCounts[action] = (actionCounts[action] || 0) + 1;
  });

  const suggestedAction = Object.entries(actionCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || (accepted.length > dismissed.length ? 'accept' : 'review');

  return {
    suggestedAction,
    confidence,
    matchCount: matches.length,
    acceptedCount: accepted.length,
    deferredCount: deferred.length,
    dismissedCount: dismissed.length,
    totalDecisions: decisions.length,
    pattern: pattern.exceptionType,
    history: matches.slice(0, 5).map(m => ({
      id: m.id,
      date: m.date,
      action: m.action,
      status: m.status,
      rationale: m.rationale,
      financialImpact: m.financialImpact,
    })),
  };
}

/**
 * Batch suggest resolutions for multiple exceptions
 */
export function suggestResolutions(exceptions) {
  return exceptions.map(exc => ({
    exception: exc,
    suggestion: suggestResolution(exc),
  }));
}

/**
 * Get learning stats — how well the system is learning
 */
export function getLearningStats() {
  const decisions = getDecisions();
  const moduleStats = {};

  for (const d of decisions) {
    const mod = d.module || 'unknown';
    if (!moduleStats[mod]) {
      moduleStats[mod] = { total: 0, accepted: 0, deferred: 0, dismissed: 0, aiRecommended: 0 };
    }
    moduleStats[mod].total++;
    if (d.status === 'accepted') moduleStats[mod].accepted++;
    if (d.status === 'deferred') moduleStats[mod].deferred++;
    if (d.status === 'dismissed') moduleStats[mod].dismissed++;
    if (d.source === 'ai') moduleStats[mod].aiRecommended++;
  }

  const patternCoverage = EXCEPTION_PATTERNS.length;
  const totalDecisions = decisions.length;
  const overallAcceptance = totalDecisions > 0
    ? Math.round((decisions.filter(d => d.status === 'accepted').length / totalDecisions) * 100)
    : 0;

  return {
    totalDecisions,
    overallAcceptance,
    patternCoverage,
    moduleStats,
    learningMaturity: totalDecisions >= 50 ? 'high' : totalDecisions >= 20 ? 'medium' : 'low',
  };
}
