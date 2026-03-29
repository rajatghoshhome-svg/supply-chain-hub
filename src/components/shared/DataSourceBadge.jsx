import { T } from '../../styles/tokens';

/**
 * DataSourceBadge — shows whether the module is displaying live API data or synthetic demo data.
 * Props:
 *   isLive: boolean — true if data came from API successfully
 *   label: string (optional) — override the display text
 */
export default function DataSourceBadge({ isLive, label }) {
  const text = label || (isLive ? 'Live Data' : 'Demo Data');
  const color = isLive ? T.safe : '#9a6700';
  const bg = isLive ? '#e6f4ea' : '#fef3e0';
  const border = isLive ? '#a7d9b2' : '#f0c87a';

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 4, fontSize: 10, fontWeight: 600,
      fontFamily: 'JetBrains Mono', letterSpacing: 0.3,
      background: bg, color, border: `1px solid ${border}`,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: color, display: 'inline-block',
        boxShadow: isLive ? `0 0 4px ${color}` : 'none',
      }} />
      {text}
    </span>
  );
}
