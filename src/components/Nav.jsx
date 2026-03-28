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
    <nav style={{ background: 'rgba(247,246,243,0.94)', backdropFilter: 'blur(14px)', borderBottom: `1px solid ${T.border}`, padding: '0 52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 54, position: 'sticky', top: 0, zIndex: 1000 }}>
      <div onClick={() => navigate('/')} style={{ cursor: 'pointer' }}><Logo /></div>
      <div style={{ display: 'flex', gap: 2 }}>
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
      <button onClick={() => navigate('/agent')} className="bp"
        style={{ background: T.ink, color: T.white, border: 'none', padding: '8px 20px', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'Sora', letterSpacing: -0.1, transition: 'opacity 0.15s', minHeight: 44 }}>
        Ask Agent
      </button>
    </nav>
  );
}
