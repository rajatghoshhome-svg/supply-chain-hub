import { useState, useRef } from 'react';
import { T } from '../styles/tokens';

// ─── Suggestions per module ─────────────────────────────────────────────────
const MODULE_SUGGESTIONS = {
  general: [
    "What's our biggest risk right now?",
    "Which retailer is most at risk?",
    "What should I approve today?",
    "Give me a network summary.",
    "Where should we focus this week?",
  ],
  drp: [
    "Which DCs are below safety stock?",
    "What transfers should I approve?",
    "Show me the Atlanta inventory position.",
    "Why consolidate onto one truck?",
    "What's the rebalance priority?",
  ],
  demand: [
    "Which SKUs are trending above forecast?",
    "What's our forecast accuracy this month?",
    "Show me demand patterns for Dentastix Large.",
    "Where is bias highest?",
    "Should we adjust the seasonal index?",
  ],
  production_plan: [
    "Are we over capacity next week?",
    "Compare chase vs level strategy.",
    "Which product families need attention?",
    "What's the capacity utilization trend?",
    "Should we plan overtime?",
  ],
  scheduling: [
    "What's the schedule for today?",
    "Where are the bottlenecks?",
    "Can we reduce changeover time?",
    "What orders are at risk of delay?",
    "Optimize the sequence for Line 1.",
  ],
  mrp: [
    "Are there any material shortages?",
    "Show me open MRP exceptions.",
    "What planned orders should we release?",
    "Which BOMs have long lead times?",
    "What should we expedite?",
  ],
};

// ─── Component ──────────────────────────────────────────────────────────────
export default function AgentChat({ moduleContext = 'general' }) {
  const [msgs, setMsgs] = useState([]);
  const [inp, setInp] = useState('');
  const [load, setLoad] = useState(false);
  const btm = useRef(null);

  const suggestions = MODULE_SUGGESTIONS[moduleContext] || MODULE_SUGGESTIONS.general;

  const send = async (q) => {
    const msg = q || inp.trim();
    if (!msg || load) return;
    setInp('');

    const nextMsgs = [...msgs, { role: 'user', content: msg }];
    setMsgs(nextMsgs);
    setLoad(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          module: moduleContext,
          messages: nextMsgs.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${response.status}`);
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
      console.error('Agent API error:', err);
      setLoad(false);
      setMsgs(m => [...m, {
        role: 'assistant',
        content: `Error: ${err.message ?? 'Could not reach the API. Check server connection.'}`,
      }]);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {msgs.length === 0 && (
          <div style={{ paddingTop: 16, textAlign: 'center' }}>
            <div style={{ fontFamily: 'Sora', fontWeight: 400, fontSize: 18, color: T.ink, letterSpacing: -0.4, marginBottom: 8 }}>How can I help?</div>
            <p style={{ fontSize: 13, color: T.inkLight, lineHeight: 1.7, maxWidth: 360, margin: '0 auto 16px' }}>Ask about any risk position, planning decision, or recommendation.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
              {suggestions.map((s, i) => (
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
                <span style={{ fontFamily: 'Sora', fontSize: 11.5, fontWeight: 500, color: T.inkMid }}>Supply Chain Agent</span>
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
              <span style={{ fontFamily: 'Sora', fontSize: 11.5, fontWeight: 500, color: T.inkMid }}>Supply Chain Agent</span>
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
            placeholder="Ask about the network, a plan, or a recommended action…"
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
