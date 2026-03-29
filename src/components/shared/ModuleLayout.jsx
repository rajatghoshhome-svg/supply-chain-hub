import { T } from '../../styles/tokens';

export default function ModuleLayout({ moduleContext, tabs, activeTab, onTabChange, children }) {
  return (
    <div style={{ background: T.bg, minHeight: 'calc(100vh - 54px)', fontFamily: 'Inter' }}>
      {/* Tab bar */}
      {tabs && tabs.length > 0 && (
        <div className="module-tab-bar" style={{ background: T.white, borderBottom: `1px solid ${T.border}`, padding: '0 40px', display: 'flex', alignItems: 'center' }}>
          <div role="tablist" className="module-tabs" style={{ display: 'flex', gap: 0 }}>
            {tabs.map(tab => (
              <button key={tab.id} role="tab" aria-selected={activeTab === tab.id} onClick={() => onTabChange(tab.id)}
                style={{ background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === tab.id ? T.ink : 'transparent'}`, color: activeTab === tab.id ? T.ink : T.inkLight, fontWeight: activeTab === tab.id ? 500 : 400, fontSize: 13, padding: '12px 18px', cursor: 'pointer', fontFamily: 'Inter', transition: 'color 0.12s' }}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="module-main-content">
        {children}
      </div>
    </div>
  );
}
