import { useState, useRef } from 'react';
import { T } from '../styles/tokens';

const CANNED = {
  "What's our biggest risk right now?":
`Total network exposure if no action taken: $221,300. Want me to break that down?

The most urgent: Pedigree Dentastix Large at Atlanta DC. 1,520 available units against actual velocity of 1,860 per week — 2.7 days of supply. Storm closes Memphis outbound window Wednesday night. Walmart promotional window opens November 15th.

Customer impact: Walmart represents 45% of Atlanta's volume — 685 units directly at risk. PetSmart is 30% (456 units). Both at fill rate risk if transfer isn't approved before Wednesday.

Recommended action: consolidated FTL from Memphis, 1,400 units Dentastix Large + 380 units Greenies Medium, 91% load, $2,840 cost, $139,600 risk avoided. Rebalance Score: 94. Window closes in 36 hours.

Root cause: Atlanta has run above plan for 6 consecutive weeks, accelerating from 980 to 1,860/week. Q4 Southeast seasonal index is 1.08 — last updated Q2 2024. Correct safety stock at actual velocity is ~1,430 units, not the current 800.`,
  "Which retailer is most at risk?":
`Walmart is the most exposed retail partner across the network today.

Atlanta DC: Walmart is 45% of outbound volume — ~685 units against 2.7 days of supply. With the promotional window opening November 15th and a $45/case fill rate penalty for missed fills, this is the highest financial risk position.

Charlotte DC: Walmart is 38% of volume at a DC running 38% above plan. Not critical today but builds toward a service failure if no transfer is approved before November 8th.

PetSmart is second most exposed — 30% of Atlanta volume with a confirmed holiday end-cap display at risk.

Amazon and Chewy have lower exposure at crisis DCs. Their primary volumes run through Chicago and LA, both stable.`,
};

const SUGGESTIONS = [
  "What's our biggest risk right now?",
  "Which retailer is most at risk?",
  "What should I approve today?",
  "Why consolidate onto one truck?",
  "What's the LA Cesar Softies situation?",
];

export default function AgentChat() {
  const [msgs, setMsgs] = useState([]);
  const [inp, setInp] = useState('');
  const [load, setLoad] = useState(false);
  const btm = useRef(null);

  const send = async (q) => {
    const msg = q || inp.trim();
    if (!msg || load) return;
    setInp('');
    setMsgs(m => [...m, { role: 'user', content: msg }]);
    setLoad(true);
    await new Promise(r => setTimeout(r, 900 + Math.random() * 300));
    const reply = CANNED[msg] || `I've reviewed the current network data.\n\nMemphis DC is well-positioned as the primary transfer source with 38+ days of supply. Southeast risk is concentrated at Atlanta (2.7 days critical — Walmart and PetSmart at risk) and Charlotte (9.5 days review tier). Los Angeles has an emerging Cesar Softies overstock at 79.8 days.\n\nWould you like me to focus on a specific DC, retailer, SKU, or recommended action?`;
    setMsgs(m => [...m, { role: 'assistant', content: reply }]);
    setLoad(false);
    setTimeout(() => btm.current?.scrollIntoView({ behavior: 'smooth' }), 100);
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
