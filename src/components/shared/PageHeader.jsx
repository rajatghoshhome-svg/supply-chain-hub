import { T } from '../../styles/tokens';

export default function PageHeader({ title, subtitle, children }) {
  return (
    <div style={{ borderBottom: `1px solid ${T.border}`, background: T.white, padding: '18px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        {subtitle && (
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, color: T.inkLight, letterSpacing: 1.4, marginBottom: 3, textTransform: 'uppercase' }}>{subtitle}</div>
        )}
        <div style={{ fontFamily: 'Sora', fontWeight: 600, fontSize: 18, color: T.ink, letterSpacing: -0.4 }}>{title}</div>
      </div>
      {children && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{children}</div>}
    </div>
  );
}
