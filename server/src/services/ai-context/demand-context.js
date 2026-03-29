/**
 * Demand Planning AI Context Builder
 *
 * Translates demand forecasting results into a structured prompt for Claude.
 * The AI layer's job is to:
 *   1. Explain forecast accuracy and recommend method changes
 *   2. Identify outliers and potential root causes
 *   3. Suggest manual adjustments with rationale
 *   4. Flag demand signals that need attention (new products, phase-outs, promotions)
 *
 * Two modes:
 *   - buildDemandContext()  — deep analysis (used by /demand/analyze endpoint)
 *   - buildDemandChatContext() — lightweight chat context (used by general chat)
 */

const SYSTEM_PROMPT = `You are an ASCM/APICS-certified demand planning assistant embedded in a supply chain planning platform for Champion Pet Foods — makers of ORIJEN and ACANA premium pet nutrition.

PRODUCT CONTEXT:
- ORIJEN: premium biologically appropriate pet food (dry dog, dry cat, freeze-dried, treats)
- ACANA: high-quality heritage-class pet food (dry dog, dry cat, wet dog)
- Hierarchy: Brand → Family → Line → Product → SKU (size variant)
- Key products: ORIJEN Original (ORI-ORIG), ACANA Wild Prairie (ACA-WP), ORIJEN Amazing Grains Original (ORI-AG-ORIG)
- SKU naming: product ID + size suffix, e.g. ORI-ORIG-25 = ORIJEN Original 25 lb bag

Your role:
1. ANALYZE forecast accuracy metrics (MAPE, MAD, bias, tracking signal)
2. EXPLAIN which forecasting method fits best and why
3. IDENTIFY demand outliers, trends, and seasonal patterns
4. RECOMMEND adjustments — override specific periods with rationale
5. FLAG signals: new product launches, phase-outs, promotions, market shifts
6. Navigate the product hierarchy: aggregate/disaggregate forecasts across levels

Rules:
- Reference products by name AND ID (e.g. "ORIJEN Original (ORI-ORIG)")
- A MAPE below 20% is good for pet food. Below 10% is excellent.
- Tracking signal outside ±4 indicates systematic bias — flag it
- Positive bias = under-forecasting (risky for service levels)
- Negative bias = over-forecasting (excess inventory risk)
- Pet food demand is moderately seasonal (summer dips for dry, holiday lifts)
- For seasonal products, recommend Holt-Winters. For trending, recommend Holt. For stable, SMA or SES.
- Keep recommendations actionable with specific numbers
- NEVER fabricate data. Only analyze what's provided.`;

/**
 * Build AI context from demand forecast results
 */
export function buildDemandContext({ forecasts, history, metrics, skuCode, skuName, plannerQuestion }) {
  const sections = [];

  sections.push(`## Demand Planning Analysis`);
  sections.push(`**SKU:** ${skuCode} — ${skuName || 'Unknown'}`);

  // History summary
  if (history && history.length > 0) {
    const avg = history.reduce((s, v) => s + v, 0) / history.length;
    const min = Math.min(...history);
    const max = Math.max(...history);
    sections.push(`\n### Historical Demand (${history.length} periods)`);
    sections.push(`- **Average:** ${Math.round(avg)}`);
    sections.push(`- **Min:** ${min} | **Max:** ${max} | **Range:** ${max - min}`);
    sections.push(`- **Last 6 periods:** ${history.slice(-6).join(', ')}`);
    sections.push(`- **Full history:** ${history.join(', ')}`);
  }

  // Forecast results
  if (forecasts) {
    sections.push(`\n### Forecast Results`);
    if (forecasts.bestMethod) {
      sections.push(`**Selected method:** ${forecasts.bestMethod}`);
    }
    sections.push(`**Forecast:** ${forecasts.forecast.join(', ')}`);

    if (forecasts.allMethods && forecasts.allMethods.length > 0) {
      sections.push(`\n#### Method Comparison`);
      sections.push(`| Method | MAPE | MAD | Bias | Forecast |`);
      sections.push(`|--------|------|-----|------|----------|`);
      for (const m of forecasts.allMethods) {
        sections.push(`| ${m.method} | ${m.mape}% | ${m.mad} | ${m.bias} | ${m.forecast.slice(0, 3).join(', ')}... |`);
      }
    }
  }

  // Accuracy metrics
  if (metrics) {
    sections.push(`\n### Accuracy Metrics`);
    sections.push(`| Metric | Value | Interpretation |`);
    sections.push(`|--------|-------|----------------|`);
    sections.push(`| MAPE | ${metrics.mape}% | ${metrics.mape < 10 ? 'Excellent' : metrics.mape < 20 ? 'Good' : metrics.mape < 30 ? 'Fair' : 'Poor'} |`);
    sections.push(`| MAD | ${metrics.mad} | Average absolute error |`);
    sections.push(`| Bias | ${metrics.bias} | ${metrics.bias > 0 ? 'Under-forecasting ⚠️' : metrics.bias < 0 ? 'Over-forecasting' : 'Balanced'} |`);
    sections.push(`| Tracking Signal | ${metrics.trackingSignal} | ${Math.abs(metrics.trackingSignal) > 4 ? '⚠️ Out of control (>±4)' : 'In control'} |`);
  }

  // Task
  if (plannerQuestion) {
    sections.push(`\n## Planner Question\n${plannerQuestion}`);
  } else {
    sections.push(`\n## Task\nAnalyze this demand data. Recommend the best forecasting method, flag any concerns with accuracy, and suggest specific adjustments if needed.`);
  }

  return {
    systemPrompt: SYSTEM_PROMPT,
    userMessage: sections.join('\n'),
  };
}

/**
 * Build lightweight chat context for the demand module.
 * Called from the central chat dispatcher with cached live data.
 *
 * @param {Object} params
 * @param {Object[]} params.products - Product catalog (legacy data-provider)
 * @param {Object[]} params.productFamilies - Product family groupings (legacy)
 * @param {Object} params.liveData - Cached live engine snapshot (from getLiveData)
 * @param {Object} [params.championStore] - Champion Pet Foods store data (if initialized)
 * @returns {{ systemPromptSection: string, dataSnapshot: object }}
 */
export function buildDemandChatContext({ products, productFamilies, liveData, championStore }) {
  const lines = ['\n## Demand Planning Context'];

  // ── Champion Pet Foods context (preferred when available) ──
  if (championStore) {
    const { summary, brands, families, lines: catLines, products: catProducts, skus, getAccuracyMetrics, getSkuIdsForLevel } = championStore;

    lines.push(`\n### Champion Pet Foods Catalog`);
    lines.push(`${summary.skus} SKUs across ${summary.brands} brands, ${summary.families} families, ${summary.lines} lines, ${summary.products} products`);
    lines.push(`${summary.customers} customers | ${summary.totalForecasts} active forecasts | ${summary.totalOverrides} manual overrides`);
    lines.push(`Horizon: ${summary.historyPeriods}-week history, ${summary.forecastPeriods}-week forecast`);

    // Brand breakdown
    lines.push(`\nBrands:`);
    for (const brand of brands) {
      const brandFamilies = families.filter(f => f.brandId === brand.id);
      const brandSkuCount = skus.filter(s => s.brandId === brand.id).length;
      lines.push(`  ${brand.name}: ${brandFamilies.length} families, ${brandSkuCount} SKUs`);
      for (const fam of brandFamilies) {
        lines.push(`    - ${fam.name} (${fam.species}, ${fam.format})`);
      }
    }

    // Top movers — products with highest base demand
    const topProducts = [...catProducts]
      .sort((a, b) => {
        const aSkus = getSkuIdsForLevel('product', a.id);
        const bSkus = getSkuIdsForLevel('product', b.id);
        return bSkus.length - aSkus.length;
      })
      .slice(0, 10);
    lines.push(`\nTop products (by SKU breadth): ${topProducts.map(p => `${p.name} (${p.id})`).join(', ')}`);

    // Accuracy summary at brand level (if available)
    try {
      for (const brand of brands) {
        const metrics = getAccuracyMetrics('brand', brand.id);
        if (metrics?.statMetrics) {
          const m = metrics.statMetrics;
          lines.push(`\n${brand.name} forecast accuracy: MAPE=${m.mape != null ? Math.round(m.mape) + '%' : 'N/A'}, MAD=${m.mad != null ? Math.round(m.mad) : 'N/A'}, Bias=${m.bias != null ? Math.round(m.bias) : 'N/A'}`);
        }
      }
    } catch { /* metrics may not be ready */ }

  } else {
    // Fallback: legacy product context
    lines.push(`${products.length} products tracked: ${products.map(p => `${p.code} (${p.name})`).join(', ')}`);
    if (productFamilies) {
      lines.push(`Families: ${productFamilies.map(f => `${f.code} (${f.products.join(', ')})`).join('; ')}`);
    }
  }

  const systemPromptSection = `\n## ASCM Demand Planning Methodology
Statistical forecasting methods: SMA, SES (exponential smoothing), Holt (trend), Holt-Winters (seasonal).
Accuracy metrics: MAPE (mean absolute percentage error), MAD, bias, tracking signal.
Tracking signal outside +/-4 indicates systematic bias requiring method change.
Capabilities: forecast adjustments, outlier explanations, method selection guidance, hierarchy aggregation/disaggregation.
Product hierarchy navigation: Brand → Family → Line → Product → SKU. Forecasts can be viewed and edited at any level.`;

  let dataSnapshot = null;
  if (liveData?.demandSnapshots?.length > 0) {
    lines.push('\nDemand Forecasts (legacy engine):');
    for (const d of liveData.demandSnapshots) {
      lines.push(`  ${d.sku}: best method=${d.method}, MAPE=${d.mape}%, next 4 periods=[${d.forecast.join(', ')}]`);
    }
    dataSnapshot = { demandSnapshots: liveData.demandSnapshots };
  }

  if (championStore) {
    dataSnapshot = {
      ...dataSnapshot,
      championSummary: championStore.summary,
    };
  }

  return {
    systemPromptSection: systemPromptSection + '\n' + lines.join('\n'),
    dataSnapshot,
  };
}
