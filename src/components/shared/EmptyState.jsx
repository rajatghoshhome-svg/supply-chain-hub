import { T } from '../../styles/tokens';

/**
 * EmptyState — standardized empty state with message and optional action.
 * Props:
 *   icon: string (emoji or character)
 *   title: string
 *   message: string
 *   action: { label: string, onClick: function } (optional)
 */
export default function EmptyState({ icon = '📋', title, message, action }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '48px 24px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.7 }}>{icon}</div>
      {title && (
        <div style={{ fontFamily: 'Sora', fontSize: 15, fontWeight: 600, color: T.ink, marginBottom: 6 }}>
          {title}
        </div>
      )}
      {message && (
        <div style={{ fontSize: 12, color: T.inkLight, maxWidth: 320, lineHeight: 1.5 }}>
          {message}
        </div>
      )}
      {action && (
        <button
          onClick={action.onClick}
          style={{
            marginTop: 16, padding: '8px 20px', borderRadius: 6,
            background: T.accent, color: T.white, border: 'none',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'Sora',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
