import { T } from '../styles/tokens';

export default function Logo({ compact = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
      <svg width={21} height={21} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="4" fill={T.ink} />
        <ellipse cx="12" cy="12" rx="10.5" ry="3.8" stroke={T.ink} strokeWidth="1.3" fill="none" transform="rotate(-22 12 12)" opacity="0.28" />
      </svg>
      <div>
        <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 13.5, color: T.ink, letterSpacing: -0.2, lineHeight: 1.1 }}>Uranus PetCare</div>
        {!compact && (
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 8.5, color: T.inkLight, letterSpacing: 1.3, marginTop: 1.5, textTransform: 'uppercase' }}>
            Supply Execution Agent
          </div>
        )}
      </div>
    </div>
  );
}
