import { useState } from 'react';
import { T } from '../../styles/tokens';
import AgentChat from '../AgentChat';

export default function ModuleLayout({ moduleContext, tabs, activeTab, onTabChange, children }) {
  const [showAgent, setShowAgent] = useState(false);

  return (
    <div style={{ background: T.bg, minHeight: 'calc(100vh - 54px)', fontFamily: 'Inter' }}>
      {/* Tab bar */}
      {tabs && tabs.length > 0 && (
        <div className="module-tab-bar" style={{ background: T.white, borderBottom: `1px solid ${T.border}`, padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div role="tablist" className="module-tabs" style={{ display: 'flex', gap: 0 }}>
            {tabs.map(tab => (
              <button key={tab.id} role="tab" aria-selected={activeTab === tab.id} onClick={() => onTabChange(tab.id)}
                style={{ background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === tab.id ? T.ink : 'transparent'}`, color: activeTab === tab.id ? T.ink : T.inkLight, fontWeight: activeTab === tab.id ? 500 : 400, fontSize: 13, padding: '12px 18px', cursor: 'pointer', fontFamily: 'Inter', transition: 'color 0.12s' }}>
                {tab.label}
              </button>
            ))}
          </div>
          <button onClick={() => setShowAgent(!showAgent)}
            style={{ background: showAgent ? T.ink : 'none', color: showAgent ? T.white : T.inkLight, border: `1px solid ${showAgent ? T.ink : T.border}`, padding: '5px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'Inter', transition: 'all 0.15s' }}>
            {showAgent ? 'Close Agent' : 'Ask Agent'}
          </button>
        </div>
      )}

      <div style={{ display: 'flex' }}>
        {/* Main content */}
        <div className="module-main-content" style={{ flex: 1, maxWidth: showAgent ? 'calc(100% - 380px)' : '100%', transition: 'max-width 0.2s' }}>
          {children}
        </div>

        {/* Agent panel */}
        {showAgent && (
          <div className="module-agent-panel" style={{ width: 380, flexShrink: 0, borderLeft: `1px solid ${T.border}`, background: T.white, height: 'calc(100vh - 54px - 46px)', position: 'sticky', top: 100, display: 'flex', flexDirection: 'column' }}>
            <AgentChat moduleContext={moduleContext} />
          </div>
        )}
      </div>
    </div>
  );
}
