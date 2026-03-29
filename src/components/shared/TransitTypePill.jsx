import { T } from '../../styles/tokens';

const TYPE_STYLES = {
  truck: { bg: '#EEF0FB', color: '#2563EB', label: 'Truck' },
  rail: { bg: '#EBF2EE', color: T.safe, label: 'Rail' },
  STO: { bg: '#FAF5EB', color: T.warn, label: 'STO' },
  FTL: { bg: '#EBF2EE', color: T.safe, label: 'FTL' },
  LTL: { bg: '#FAF5EB', color: T.warn, label: 'LTL' },
  Partial: { bg: '#EEF0FB', color: '#4F46E5', label: 'Partial' },
};

export default function TransitTypePill({ type }) {
  const s = TYPE_STYLES[type] || { bg: T.bgDark, color: T.inkMid, label: type || '—' };
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 10,
      fontWeight: 600,
      fontFamily: T.fontMono,
      background: s.bg,
      color: s.color,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    }}>
      {s.label}
    </span>
  );
}
