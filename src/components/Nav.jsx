import { T } from '../styles/tokens';
import Logo from './Logo';

export default function Nav({ page, setPage }) {
  return (
    <nav style={{ background: 'rgba(247,246,243,0.94)', backdropFilter: 'blur(14px)', borderBottom: `1px solid ${T.border}`, padding: '0 52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 54, position: 'sticky', top: 0, zIndex: 1000 }}>
      <div onClick={() => setPage('landing')}><Logo /></div>
      <div style={{ display: 'flex', gap: 2 }}>
        {[['workflow', 'Workflow'], ['agent', 'Agent'], ['valueLog', 'Value Log'], ['howItWorks', 'How It Works'], ['about', 'About']].map(([id, label]) => (
          <button key={id} onClick={() => setPage(id)} className="nb"
            style={{ background: 'none', border: 'none', borderBottom: `1.5px solid ${page === id ? T.ink : 'transparent'}`, color: page === id ? T.ink : T.inkLight, fontWeight: page === id ? 500 : 400, fontSize: 13, padding: '8px 14px', cursor: 'pointer', transition: 'color 0.12s', fontFamily: 'Inter' }}>
            {label}
          </button>
        ))}
      </div>
      <button onClick={() => setPage('workflow')} className="bp"
        style={{ background: T.ink, color: T.white, border: 'none', padding: '8px 20px', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'Sora', letterSpacing: -0.1, transition: 'opacity 0.15s' }}>
        Open Workflow
      </button>
    </nav>
  );
}
