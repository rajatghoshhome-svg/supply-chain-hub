import { useLocation, useNavigate } from 'react-router-dom';
import { T } from '../styles/tokens';
import Logo from './Logo';

const NAV_ITEMS = [
  ['/demand', 'Demand'],
  ['/production-plan', 'Production Plan'],
  ['/drp', 'DRP'],
  ['/scheduling', 'Scheduling'],
  ['/mrp', 'MRP'],
  ['/decisions', 'Decisions'],
  ['/agent', 'Agent'],
];

export default function Nav() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  return (
    <nav aria-label="Main navigation" className="nav-bar" style={{ background: 'rgba(247,246,243,0.94)', backdropFilter: 'blur(14px)', borderBottom: `1px solid ${T.border}`, padding: '0 52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 54, position: 'sticky', top: 0, zIndex: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div role="link" tabIndex={0} aria-label="Home" onClick={() => navigate('/')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/'); }} style={{ cursor: 'pointer' }}><Logo /></div>
        <button onClick={() => navigate('/setup')} className="nb" style={{ background: 'none', border: `1px solid ${path === '/setup' ? T.accent : T.border}`, color: path === '/setup' ? T.accent : T.inkLight, fontSize: 10, fontFamily: 'JetBrains Mono', fontWeight: 500, letterSpacing: 0.5, padding: '4px 10px', borderRadius: 5, cursor: 'pointer', transition: 'all 0.15s', textTransform: 'uppercase', minHeight: 28 }}>Setup</button>
      </div>
      <div className="nav-items" style={{ display: 'flex', gap: 2 }}>
        {NAV_ITEMS.map(([to, label]) => {
          const active = path === to || path.startsWith(to + '/');
          return (
            <button key={to} onClick={() => navigate(to)} className="nb"
              style={{ background: 'none', border: 'none', borderBottom: `1.5px solid ${active ? T.ink : 'transparent'}`, color: active ? T.ink : T.inkLight, fontWeight: active ? 500 : 400, fontSize: 13, padding: '14px 14px', cursor: 'pointer', transition: 'color 0.12s', fontFamily: 'Inter', outline: 'none', minHeight: 44 }}>
              {label}
            </button>
          );
        })}
      </div>
      <button onClick={() => navigate('/agent')} className="bp nav-cta"
        style={{ background: T.ink, color: T.white, border: 'none', padding: '8px 20px', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'Sora', letterSpacing: -0.1, transition: 'opacity 0.15s', minHeight: 44 }}>
        Ask Agent
      </button>
    </nav>
  );
}
