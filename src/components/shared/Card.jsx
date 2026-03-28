import { T } from '../../styles/tokens';

export default function Card({ title, children, style = {} }) {
  return (
    <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', ...style }}>
      {title && (
        <div style={{ padding: '12px 20px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontFamily: 'Sora', fontWeight: 500, fontSize: 14, color: T.ink }}>{title}</div>
        </div>
      )}
      {children}
    </div>
  );
}
