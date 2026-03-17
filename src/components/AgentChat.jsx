import { useState, useRef } from 'react';
import { T } from '../styles/tokens';
import { DCS } from '../data/dcs';
import { LOG } from '../data/log';

// ─── System prompt ────────────────────────────────────────────────────────────
function buildSystemPrompt() {
  const dcContext = DCS.map(dc => {
    const customerLines = dc.customers
      .map(c => `    - ${c.name}: ${c.pct}% (${c.units.toLocaleString()} units)${c.atRisk ? '  ⚠ AT RISK' : ''}`)
      .join('\n');
    return `DC: ${dc.id} — ${dc.city}, ${dc.state}
  Status: ${dc.statusLabel}
  Available: ${dc.available.toLocaleString()} units | Days of Supply: ${dc.daysSupply} | Fill Rate: ${dc.fillRate}%
  Customer Mix:
${customerLines}`;
  }).join('\n\n');

  const recentLog = LOG.slice(0, 5).map(r =>
    `  ${r.id} (${r.date}): ${r.from} → ${r.to} | ${r.skus} | Cost: $${r.cost.toLocaleString()} | Avoided: $${r.avoided.toLocaleString()} | ${r.status}`
  ).join('\n');

  const avgFR = (DCS.reduce((s, dc) => s + dc.fillRate, 0) / DCS.length).toFixed(1);

  return `You are the Uranus PetCare Supply Execution Agent — a supply chain decision-support system for Mars Petcare (synthetic demo data). You help supply chain managers make inventory transfer decisions across a network of 6 US distribution centers.

CURRENT DATE: November 4, 2024

════════════════════════════════════════
NETWORK SNAPSHOT — 6 DISTRIBUTION CENTERS
════════════════════════════════════════
${dcContext}

════════════════════════════════════════
REBALANCE SCORE MATRIX (SKU × DC)
Score ≥ 75 = Act now · 40–74 = Review · < 40 = Stable
════════════════════════════════════════
SKU               | MEM | ATL | CLT | CHI |  LA | DFW
Dentastix Large   |   8 |  94 |  74 |  22 |  15 |  12
Greenies Medium   |   9 |  88 |  71 |  28 |  14 |  10
Dentastix Small   |   7 |  58 |  44 |  18 |  12 |   9
Cesar Softies     |   6 |  12 |  10 |   8 |  42 |   8

════════════════════════════════════════
PENDING STOCK TRANSFER ORDERS
════════════════════════════════════════
STO-001 — URGENT (36hr window)
  Route:     Memphis DC → Atlanta DC
  SKUs:      Dentastix Large (1,400u) + Greenies Medium (380u)
  Mode:      FTL Consolidated · 91% load
  Cost:      $2,840 | Risk avoided: $139,600 | Rebalance Score: 94
  Customers: Walmart (45%) · PetSmart (30%) · Chewy (15%)
  Reason:    Atlanta at 2.7 days supply. Storm closes Memphis outbound Wednesday 8pm.
             Walmart promo window opens Nov 15. Fill rate penalty $45/case.

STO-002 — Review (72hr window)
  Route:     Memphis DC → Charlotte DC
  SKUs:      Dentastix Large (900u)
  Mode:      FTL · 74% load
  Cost:      $1,980 | Risk avoided: $38,200 | Rebalance Score: 74
  Customers: Walmart (38%) · PetSmart (32%)
  Reason:    Charlotte running 38% above plan for 4 consecutive weeks. Review before Nov 8.

════════════════════════════════════════
WEATHER & TIMING SIGNALS
════════════════════════════════════════
- Storm system closing Memphis outbound window: Wednesday night (~36 hours)
- Southeast transfer window is time-critical — Atlanta and Charlotte at risk
- No weather disruption forecast for Chicago, LA, or Dallas lanes

════════════════════════════════════════
ROOT CAUSES TO ADDRESS (longer-term)
════════════════════════════════════════
1. Safety stock (Dentastix Large, SE DCs): sized at Q2 velocity 1,200/wk — Atlanta now running 1,860/wk. Correct SS = ~1,430 units vs current 800.
2. Seasonal index (SE region): Q4 index = 1.08, last updated Q2 2024. Actual Q4 velocity implies 1.55. Affects Atlanta, Charlotte, Chicago.
3. LA overstock (Cesar Softies): 8,120 units at 79.8 days supply. Shelf life 330 days remaining — write-off risk in ~5 months. Reposition 4,000 to Chicago, 2,000 to Dallas.
4. Lead time master data (Dentastix Large): planning system shows 18 days — actual carrier performance consistently 12 days on Memphis→SE lanes.

════════════════════════════════════════
RECENT DECISION HISTORY (Value Log)
════════════════════════════════════════
${recentLog}

════════════════════════════════════════
NETWORK SUMMARY
════════════════════════════════════════
Total exposure if no action today: $221,300
Network average fill rate: ${avgFR}%
Retailers with units at risk: Walmart, PetSmart, Chewy (Atlanta and Charlotte)
FTL consolidation savings available: $4,360
Transfer source with most supply: Memphis DC (38.5 days, 16,200 units available)

════════════════════════════════════════
RESPONSE GUIDELINES
════════════════════════════════════════
- Be direct and specific — cite DC IDs, SKU names, unit counts, and dollar amounts
- Lead with the most urgent risk; don't bury the headline
- When recommending actions, state the financial case: cost vs. risk avoided vs. score
- Use short paragraphs and line breaks — this is a decision-support tool, not a report
- You may ask one focused clarifying question if the intent is genuinely ambiguous
- All data is synthetic demo data — do not present it as real Mars Petcare information`;
}

// ─── Suggestions ─────────────────────────────────────────────────────────────
const SUGGESTIONS = [
  "What's our biggest risk right now?",
  "Which retailer is most at risk?",
  "What should I approve today?",
  "Why consolidate onto one truck?",
  "What's the LA Cesar Softies situation?",
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function AgentChat() {
  const [msgs, setMsgs] = useState([]);
  const [inp, setInp] = useState('');
  const [load, setLoad] = useState(false);
  const btm = useRef(null);

  const send = async (q) => {
    const msg = q || inp.trim();
    if (!msg || load) return;
    setInp('');

    const nextMsgs = [...msgs, { role: 'user', content: msg }];
    setMsgs(nextMsgs);
    setLoad(true);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': import.meta.env.VITE_CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 1024,
          system: buildSystemPrompt(),
          stream: true,
          messages: nextMsgs.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${response.status}`);
      }

      // Stream the response
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
                setLoad(false);
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
          } catch {
            // skip malformed SSE lines
          }
        }
      }

      if (!started) setLoad(false);
      setTimeout(() => btm.current?.scrollIntoView({ behavior: 'smooth' }), 100);

    } catch (err) {
      console.error('Claude API error:', err);
      setLoad(false);
      setMsgs(m => [...m, {
        role: 'assistant',
        content: `Error: ${err.message ?? 'Could not reach the API. Check VITE_CLAUDE_API_KEY in your .env file.'}`,
      }]);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {msgs.length === 0 && (
          <div style={{ paddingTop: 16, textAlign: 'center' }}>
            <div style={{ fontFamily: 'Sora', fontWeight: 400, fontSize: 18, color: T.ink, letterSpacing: -0.4, marginBottom: 8 }}>How can I help?</div>
            <p style={{ fontSize: 13, color: T.inkLight, lineHeight: 1.7, maxWidth: 360, margin: '0 auto 16px' }}>Ask about any risk position, retail partner, or transfer recommendation.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => send(s)} className="bg"
                  style={{ background: T.white, border: `1px solid ${T.border}`, color: T.inkMid, padding: '7px 12px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontFamily: 'Inter', transition: 'background 0.1s', textAlign: 'left' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className="fade" style={{ marginBottom: 18, display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {m.role === 'assistant' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="4" fill={T.ink} />
                  <ellipse cx="12" cy="12" rx="10.5" ry="3.8" stroke={T.ink} strokeWidth="1.3" fill="none" transform="rotate(-22 12 12)" opacity="0.28" />
                </svg>
                <span style={{ fontFamily: 'Sora', fontSize: 11.5, fontWeight: 500, color: T.inkMid }}>Uranus PetCare Agent</span>
              </div>
            )}
            <div style={{ maxWidth: m.role === 'user' ? '72%' : '100%', padding: m.role === 'user' ? '9px 14px' : '0', borderRadius: m.role === 'user' ? '10px 10px 2px 10px' : 0, background: m.role === 'user' ? T.ink : 'transparent', color: m.role === 'user' ? T.white : T.ink, fontSize: 13.5, lineHeight: 1.8, whiteSpace: 'pre-line', letterSpacing: -0.1 }}>
              {m.content}
            </div>
          </div>
        ))}
        {load && (
          <div className="fade" style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="4" fill={T.ink} />
                <ellipse cx="12" cy="12" rx="10.5" ry="3.8" stroke={T.ink} strokeWidth="1.3" fill="none" transform="rotate(-22 12 12)" opacity="0.28" />
              </svg>
              <span style={{ fontFamily: 'Sora', fontSize: 11.5, fontWeight: 500, color: T.inkMid }}>Uranus PetCare Agent</span>
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: T.inkGhost, animation: `blink 1.3s infinite ${i * 0.22}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={btm} />
      </div>
      <div style={{ padding: '10px 24px 14px', borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
        <div style={{ background: T.white, border: `1.5px solid ${T.borderMid}`, borderRadius: 10, padding: '4px 4px 4px 14px', display: 'flex', alignItems: 'flex-end', gap: 7 }}>
          <textarea
            value={inp}
            onChange={e => setInp(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask about the network, a retailer, or a recommended action…"
            rows={1}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', resize: 'none', fontSize: 13.5, color: T.ink, lineHeight: 1.6, padding: '8px 0', fontFamily: 'Inter', letterSpacing: -0.1 }}
          />
          <button onClick={() => send()} disabled={!inp.trim() || load}
            style={{ background: inp.trim() && !load ? T.ink : T.bgDark, color: inp.trim() && !load ? T.white : T.inkGhost, border: 'none', padding: '8px 15px', borderRadius: 7, cursor: inp.trim() && !load ? 'pointer' : 'default', fontWeight: 500, fontSize: 13, fontFamily: 'Sora', transition: 'all 0.15s', marginBottom: 2, flexShrink: 0 }}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
