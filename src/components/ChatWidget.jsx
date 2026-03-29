import { useState, useRef, useEffect } from 'react';
import { T } from '../styles/tokens';

/**
 * ChatWidget — Floating bottom-right AI chat (Intercom-style)
 *
 * Collapsed: 56px circular button, bottom-right corner
 * Expanded: 380×520px panel anchored bottom-right
 * Context-aware: reads current module from URL
 */

// Simulated AI responses when API is unavailable (e.g. Vercel, no backend)
const FALLBACK_RESPONSES = {
  general: [
    "Based on Champion Pet Foods' current position:\n\n**Top Risks This Week:**\n1. DC-DEN is at 9 days of supply for Acana Dry Dog — below the 14-day safety target\n2. 2 scheduling orders are behind pace at DogStar Kitchens (Extruder 1 & 2)\n3. Orijen Freeze-Dried has cross-border transit variability on DEN→TOR lane\n\n**Recommended Actions:**\n- Prioritize the STO transfer DC-ATL → DC-DEN for Orijen Original (saves $8,150 vs new production)\n- Review Extruder 1 pace — currently at 104 u/hr vs 120 u/hr target\n- Firm Period 3 on NorthStar Kitchen to lock freeze-dry capacity",
    "Champion Pet Foods top movers (last 12 weeks):\n\n| Rank | Product | Avg Weekly | Trend |\n|------|---------|-----------|-------|\n| 1 | Orijen Original Dry Dog 25lb | 23,252 | ↗ +4.2% |\n| 2 | Acana Wild Prairie Dry Dog 25lb | 18,400 | → flat |\n| 3 | Orijen Dry Cat Tundra 12lb | 15,800 | ↗ +6.1% |\n| 4 | Orijen Freeze-Dried Dog 16oz | 8,200 | ↘ -2.3% |\n| 5 | Acana Wet Dog Lamb 12.8oz | 7,600 | ↗ +3.8% |\n\nOrijen Original and Cat Tundra are accelerating — ensure DogStar extrusion capacity can handle the ramp in W5-W6.",
  ],
  demand: [
    "**Orijen Original Dry Dog — Demand Analysis:**\n\nForecast method: Holt-Winters + ML Ensemble (MAPE: 6.2%)\n\n| Period | Forecast | Actuals | Variance |\n|--------|----------|---------|----------|\n| W1 | 23,252 | 23,890 | +2.7% |\n| W2 | 21,957 | 22,104 | +0.7% |\n| W3 | 22,508 | — | pending |\n| W4 | 23,092 | — | pending |\n\n📈 Weeks 5-6 show a seasonal ramp to 32-35k units. The statistical forecast captures this well but consider a +5% manual override if retailer promotions are confirmed.\n\n3 overrides are active across the consensus plan.",
    "**Forecast Accuracy — All Families:**\n\n| Family | MAPE | Bias | Method |\n|--------|------|------|--------|\n| Orijen Dry Dog | 6.2% | +1.1% | HW+ML Ensemble |\n| Orijen Dry Cat | 7.8% | -0.4% | HW+ML Ensemble |\n| Acana Dry Dog | 8.1% | +2.3% | Exp. Smoothing |\n| Orijen Freeze-Dried | 11.4% | -3.2% | Moving Avg |\n| Acana Wet Dog | 9.6% | +0.8% | HW Seasonal |\n\nOrijen Freeze-Dried has the weakest accuracy — the category is growing fast and historical patterns don't capture the acceleration well. Consider switching to the ML ensemble method.",
  ],
  drp: [
    "**DC Inventory Position Summary:**\n\n| DC | SKUs | On-Hand | Below SS | Avg DOH |\n|----|------|---------|----------|---------|\n| DC-ATL | 4 | 42,500 | 0 | 18d ✅ |\n| DC-DEN | 4 | 28,300 | 1 | 12d ⚠️ |\n| DC-TOR | 4 | 34,100 | 1 | 17d |\n\n**Action Required:** DC-DEN Acana Dry Dog is below safety stock (5,200 on-hand vs 5,500 SS). Recommended STO transfer from DC-ATL (9,800 on-hand, 18 DOH).\n\nThe Move vs Make analysis shows transferring 2,400 units saves $8,150 vs new production at DogStar. Lead time: 3 days (STO) vs 10 days (make).",
  ],
  production_plan: [
    "**DogStar Kitchens — Production Plan Summary:**\n\nCurrent strategy: **Hybrid** ($966,223)\n- Chase: $926,278 (REC — lowest cost, variable workforce)\n- Level: $912,418 (2 exceptions — inventory risk W5-W6)\n\n**Key Observations:**\n- W5-W6 seasonal ramp requires 28-32k units/week (vs 21.5k base)\n- Hybrid uses overtime for peaks: 6,482 OT units in W5, 10,482 in W6\n- Chase is recommended — eliminates overtime premium but requires workforce flexibility\n\n**Capacity Alert:** Extruders 1-4 will hit 92% utilization in W6 under any strategy. Consider firming Periods 3-4 to lock in capacity allocation.",
  ],
  scheduling: [
    "**DogStar Kitchens — Schedule Status:**\n\n| Metric | Value |\n|--------|-------|\n| Total Orders | 35 |\n| Running | 4 (across extruders) |\n| Completed | 12 |\n| Behind Pace | 2 ⚠️ |\n| Avg Utilization | 78% |\n| Total Changeover | 8.5h |\n\n**Behind Pace:**\n1. **Extruder 1** — Acana Heritage Dog Dry: 390/520 units (75%), 104 u/hr vs 120 target\n2. **Extruder 2** — Orijen Tundra Cat Dry: 236/380 units (62%), 95 u/hr vs 110 target\n\n**Recommendation:** Extruder 1 may recover if pace improves in next 2 hours. Extruder 2 is at risk — consider reassigning the next order to Extruder 3 (currently idle after CIP).",
  ],
  mrp: [
    "**Open MRP Exceptions:**\n\n| Priority | Type | Item | Action |\n|----------|------|------|--------|\n| 🔴 Critical | Shortage | Fresh Chicken Meal | Expedite PO — 3-day gap in W3 |\n| 🔴 Critical | Capacity | Extrusion Line 1 | Overloaded W5-W6, split batch |\n| 🟡 Warning | Reschedule In | Turkey Meal | Pull forward 1 week for Cat Tundra |\n| 🟡 Warning | Excess | Lamb Meal | Push out — 2 weeks excess on-hand |\n| 🟢 Info | New PO | Freeze-Dry Coating | Auto-generated for W4 requirement |\n\n**Top Priority:** Fresh Chicken Meal expedite. This is the primary ingredient for Orijen Original (25% of revenue). Current supplier lead time is 14 days — premium freight can reduce to 7 days at $2,400 cost, avoiding a $15,000 stockout risk.",
  ],
};

const MODULE_SUGGESTIONS = {
  general: [
    "What's the biggest risk today?",
    "Show me top-moving Orijen products",
    "Where should I focus this week?",
  ],
  demand: [
    "Show me Orijen Original demand trend",
    "What's forecast accuracy for Acana Singles?",
    "Which SKUs are trending above forecast?",
    "Compare Petco vs Chewy demand",
  ],
  drp: [
    "Which DCs are below safety stock?",
    "What transfers should I prioritize?",
    "Show Atlanta DC inventory position",
  ],
  production_plan: [
    "Are we over capacity next week?",
    "Compare chase vs level strategy",
    "Which product families need attention?",
  ],
  scheduling: [
    "What's the schedule for today?",
    "Where are the bottlenecks?",
    "What orders are at risk of delay?",
  ],
  mrp: [
    "Show me open MRP exceptions",
    "What should we expedite?",
    "Which BOMs have long lead times?",
  ],
};

const MODULE_LABELS = {
  demand: 'Demand Planning',
  drp: 'DRP',
  production_plan: 'Production',
  scheduling: 'Scheduling',
  mrp: 'MRP',
};

function detectModule() {
  const path = window.location.pathname;
  if (path.includes('demand')) return 'demand';
  if (path.includes('drp')) return 'drp';
  if (path.includes('production')) return 'production_plan';
  if (path.includes('scheduling')) return 'scheduling';
  if (path.includes('mrp')) return 'mrp';
  return 'general';
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [inp, setInp] = useState('');
  const [loading, setLoading] = useState(false);
  const [module, setModule] = useState('general');
  const btmRef = useRef(null);

  // Detect module on route change
  useEffect(() => {
    const detect = () => setModule(detectModule());
    detect();
    window.addEventListener('popstate', detect);
    return () => window.removeEventListener('popstate', detect);
  }, []);

  // Also detect on open
  useEffect(() => {
    if (open) setModule(detectModule());
  }, [open]);

  const suggestions = MODULE_SUGGESTIONS[module] || MODULE_SUGGESTIONS.general;
  const moduleLabel = MODULE_LABELS[module] || 'Supply Chain Hub';

  const send = async (q) => {
    const msg = q || inp.trim();
    if (!msg || loading) return;
    setInp('');

    const nextMsgs = [...msgs, { role: 'user', content: msg }];
    setMsgs(nextMsgs);
    setLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          module,
          messages: nextMsgs.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let started = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const event = JSON.parse(data);
            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
              const text = event.delta.text;
              if (!started) {
                started = true;
                setLoading(false);
                setMsgs(m => [...m, { role: 'assistant', content: text }]);
              } else {
                setMsgs(m => {
                  const updated = [...m];
                  updated[updated.length - 1] = {
                    role: 'assistant',
                    content: updated[updated.length - 1].content + text,
                  };
                  return updated;
                });
              }
            }
          } catch { /* skip */ }
        }
      }

      if (!started) setLoading(false);
      setTimeout(() => btmRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch {
      // API unavailable — use fallback responses for local dev without backend
      setLoading(false);
      const pool = FALLBACK_RESPONSES[module] || FALLBACK_RESPONSES.general;
      const fallback = pool[Math.floor(Math.random() * pool.length)];
      setMsgs(m => [...m, { role: 'assistant', content: fallback }]);
      setTimeout(() => btmRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  return (
    <>
      {/* Expanded panel */}
      {open && (
        <div style={{
          position: 'fixed',
          bottom: 80,
          right: 24,
          width: 380,
          height: 520,
          background: T.white,
          borderRadius: 16,
          boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: `1px solid ${T.border}`,
          animation: 'chatSlideUp 0.2s ease-out',
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px',
            background: T.ink,
            color: T.white,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}>
            <div>
              <div style={{ fontFamily: T.fontHeading, fontSize: 13, fontWeight: 500 }}>Supply Chain Agent</div>
              <div style={{
                fontSize: 10,
                opacity: 0.7,
                background: 'rgba(255,255,255,0.15)',
                display: 'inline-block',
                padding: '1px 6px',
                borderRadius: 3,
                marginTop: 2,
              }}>
                {moduleLabel}
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', color: T.white, cursor: 'pointer', fontSize: 18, padding: 4 }}
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
            {msgs.length === 0 && (
              <div style={{ textAlign: 'center', paddingTop: 10 }}>
                <div style={{ fontFamily: T.fontHeading, fontSize: 15, color: T.ink, marginBottom: 6 }}>How can I help?</div>
                <p style={{ fontSize: 12, color: T.inkLight, lineHeight: 1.6, marginBottom: 12 }}>
                  Ask about Champion's supply chain, demand trends, or planning decisions.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch' }}>
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => send(s)}
                      style={{
                        background: T.bg, border: `1px solid ${T.border}`, color: T.inkMid,
                        padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                        fontSize: 12, fontFamily: T.fontBody, textAlign: 'left',
                        transition: 'background 0.1s',
                      }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {msgs.map((m, i) => (
              <div key={i} style={{
                marginBottom: 12,
                display: 'flex',
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '85%',
                  padding: '8px 12px',
                  borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  background: m.role === 'user' ? T.ink : T.bg,
                  color: m.role === 'user' ? T.white : T.ink,
                  fontSize: 13,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-line',
                }}>
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', gap: 4, padding: '8px 12px' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: T.inkGhost,
                    animation: `blink 1.3s infinite ${i * 0.22}s`,
                  }} />
                ))}
              </div>
            )}
            <div ref={btmRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '10px 12px',
            borderTop: `1px solid ${T.border}`,
            flexShrink: 0,
          }}>
            <div style={{
              display: 'flex',
              gap: 6,
              background: T.bg,
              border: `1px solid ${T.border}`,
              borderRadius: 10,
              padding: '4px 4px 4px 12px',
            }}>
              <input
                value={inp}
                onChange={e => setInp(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send(); } }}
                placeholder="Ask anything..."
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  fontSize: 13, color: T.ink, fontFamily: T.fontBody,
                }}
              />
              <button
                onClick={() => send()}
                disabled={!inp.trim() || loading}
                style={{
                  background: inp.trim() && !loading ? T.ink : T.bgDark,
                  color: inp.trim() && !loading ? T.white : T.inkGhost,
                  border: 'none', padding: '6px 12px', borderRadius: 7,
                  cursor: inp.trim() && !loading ? 'pointer' : 'default',
                  fontWeight: 500, fontSize: 12, fontFamily: T.fontHeading,
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: T.ink,
          color: T.white,
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        )}
      </button>

      <style>{`
        @keyframes chatSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
