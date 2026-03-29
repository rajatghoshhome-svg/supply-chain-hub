import { useState, useRef, useEffect } from 'react';
import { T } from '../styles/tokens';

/**
 * ChatWidget — Floating bottom-right AI chat (Intercom-style)
 *
 * Collapsed: 56px circular button, bottom-right corner
 * Expanded: 380×520px panel anchored bottom-right
 * Context-aware: reads current module from URL
 */

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
    } catch (err) {
      setLoading(false);
      setMsgs(m => [...m, { role: 'assistant', content: `Error: ${err.message}` }]);
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
