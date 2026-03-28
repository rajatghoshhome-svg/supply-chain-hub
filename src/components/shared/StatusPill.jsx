import { T } from '../../styles/tokens';

const SEVERITY_STYLES = {
  critical: { background: T.riskBg, color: T.risk, border: T.riskBorder },
  warning: { background: T.warnBg, color: T.warn, border: T.warnBorder },
  info: { background: T.safeBg, color: T.safe, border: `1px solid ${T.safe}20` },
};

export default function StatusPill({ severity, children }) {
  const s = SEVERITY_STYLES[severity] || SEVERITY_STYLES.info;
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 600,
      fontFamily: "'JetBrains Mono'",
      background: s.background,
      color: s.color,
      border: `1px solid ${s.border}`,
    }}>
      {children}
    </span>
  );
}
