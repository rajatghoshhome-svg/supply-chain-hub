import { useState, useEffect } from 'react';
import { T } from '../styles/tokens';
import ModuleLayout from '../components/shared/ModuleLayout';
import PageHeader from '../components/shared/PageHeader';
import Card from '../components/shared/Card';

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [apiKeyInput, setApiKeyInput] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => { setSettings(d.settings); setLoading(false); })
      .catch(() => {
        // Fallback defaults when backend unavailable
        setSettings({
          ai: { provider: 'anthropic', model: 'claude-sonnet-4-20250514', apiKeyConfigured: false, apiKeyMasked: '' },
          dataSource: 'demo',
          financial: { expeditePerUnit: 15, stockoutPerUnit: 85, reschedulePerUnit: 7.5, overtimePerHour: 45, cancelPerUnit: 7.5, currency: 'USD' },
          planning: { defaultPlanningHorizon: 8, defaultSafetyStockWeeks: 2, cascadeAutoTrigger: false },
        });
        setLoading(false);
      });
  }, []);

  async function saveSettings(updates) {
    setSaving(true);
    setSaveMsg(null);
    try {
      const resp = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await resp.json();
      if (resp.ok) {
        setSettings(data.settings);
        setSaveMsg({ type: 'success', text: 'Settings saved' });
      } else {
        setSaveMsg({ type: 'error', text: data.error || 'Save failed' });
      }
    } catch {
      setSaveMsg({ type: 'error', text: 'Could not reach server' });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  }

  function updateFinancial(key, value) {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    setSettings(prev => ({
      ...prev,
      financial: { ...prev.financial, [key]: num },
    }));
  }

  if (loading || !settings) {
    return (
      <ModuleLayout>
        <div style={{ padding: 60, textAlign: 'center', color: T.inkLight }}>Loading settings...</div>
      </ModuleLayout>
    );
  }

  return (
    <ModuleLayout>
      <PageHeader
        kicker="Configuration"
        title="Settings"
        description="Manage AI configuration, financial parameters, and data source preferences."
      />

      <div style={{ padding: '0 32px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Save feedback */}
        {saveMsg && (
          <div style={{
            padding: '10px 16px', borderRadius: 8, fontSize: 13,
            background: saveMsg.type === 'success' ? T.safeBg : T.riskBg,
            color: saveMsg.type === 'success' ? T.safe : T.risk,
            border: `1px solid ${saveMsg.type === 'success' ? '#c8dcd0' : T.riskBorder}`,
          }}>
            {saveMsg.text}
          </div>
        )}

        {/* AI Configuration */}
        <Card title="AI Configuration">
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '14px 20px', alignItems: 'center', fontSize: 13 }}>
            <label style={{ color: T.inkMid, fontWeight: 500 }}>Provider</label>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: T.ink }}>{settings.ai.provider}</div>

            <label style={{ color: T.inkMid, fontWeight: 500 }}>Model</label>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: T.ink }}>{settings.ai.model}</div>

            <label style={{ color: T.inkMid, fontWeight: 500 }}>API Key</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {settings.ai.apiKeyConfigured ? (
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: T.safe }}>{settings.ai.apiKeyMasked}</span>
              ) : (
                <>
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={e => setApiKeyInput(e.target.value)}
                    placeholder="sk-ant-..."
                    style={{
                      flex: 1, maxWidth: 300, padding: '6px 10px', borderRadius: 6,
                      border: `1px solid ${T.border}`, fontSize: 12, fontFamily: 'JetBrains Mono',
                    }}
                  />
                  <button
                    onClick={() => {
                      if (apiKeyInput.trim()) {
                        saveSettings({ ai: { apiKey: apiKeyInput.trim() } });
                        setApiKeyInput('');
                      }
                    }}
                    disabled={saving || !apiKeyInput.trim()}
                    style={{
                      background: T.ink, color: T.white, border: 'none', padding: '6px 14px',
                      borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      opacity: saving || !apiKeyInput.trim() ? 0.5 : 1,
                    }}
                  >
                    Save Key
                  </button>
                </>
              )}
            </div>
          </div>
        </Card>

        {/* Data Source */}
        <Card title="Data Source">
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { value: 'demo', label: 'Demo Data', desc: 'Built-in synthetic supply chain data' },
              { value: 'imported', label: 'Imported Data', desc: 'Data from CSV onboarding wizard' },
            ].map(opt => (
              <div
                key={opt.value}
                onClick={() => {
                  setSettings(prev => ({ ...prev, dataSource: opt.value }));
                  saveSettings({ dataSource: opt.value });
                }}
                style={{
                  flex: 1, padding: '14px 16px', borderRadius: 8, cursor: 'pointer',
                  border: `1.5px solid ${settings.dataSource === opt.value ? T.accent : T.border}`,
                  background: settings.dataSource === opt.value ? T.safeBg : T.white,
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontFamily: 'Sora', fontSize: 13, fontWeight: 600, color: T.ink, marginBottom: 4 }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: T.inkMid }}>{opt.desc}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Financial Parameters */}
        <Card title="Financial Parameters">
          <p style={{ fontSize: 12, color: T.inkMid, margin: '0 0 16px' }}>
            Cost parameters used for exception impact calculations. Changes apply to new cascade runs.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { key: 'expeditePerUnit', label: 'Expedite Cost / Unit', prefix: '$' },
              { key: 'stockoutPerUnit', label: 'Stockout Cost / Unit', prefix: '$' },
              { key: 'reschedulePerUnit', label: 'Reschedule Cost / Unit', prefix: '$' },
              { key: 'overtimePerHour', label: 'Overtime Cost / Hour', prefix: '$' },
              { key: 'cancelPerUnit', label: 'Cancel Cost / Unit', prefix: '$' },
            ].map(param => (
              <div key={param.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 12, color: T.inkMid, fontWeight: 500, minWidth: 160 }}>{param.label}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 12, color: T.inkLight }}>{param.prefix}</span>
                  <input
                    type="number"
                    step="0.5"
                    value={settings.financial[param.key]}
                    onChange={e => updateFinancial(param.key, e.target.value)}
                    style={{
                      width: 80, padding: '5px 8px', borderRadius: 5,
                      border: `1px solid ${T.border}`, fontSize: 12, fontFamily: 'JetBrains Mono',
                      textAlign: 'right',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => saveSettings({ financial: settings.financial })}
              disabled={saving}
              style={{
                background: T.ink, color: T.white, border: 'none', padding: '8px 20px',
                borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                opacity: saving ? 0.5 : 1, transition: 'all 0.15s',
              }}
            >
              {saving ? 'Saving...' : 'Save Financial Parameters'}
            </button>
          </div>
        </Card>

        {/* About */}
        <Card title="About">
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px 20px', fontSize: 12 }}>
            <span style={{ color: T.inkMid, fontWeight: 500 }}>Platform</span>
            <span style={{ color: T.ink }}>Supply Chain Planning Hub</span>
            <span style={{ color: T.inkMid, fontWeight: 500 }}>Architecture</span>
            <span style={{ color: T.ink }}>React + Express + Deterministic ASCM Engines</span>
            <span style={{ color: T.inkMid, fontWeight: 500 }}>AI Layer</span>
            <span style={{ color: T.ink }}>Claude API for exception analysis and suggestions</span>
            <span style={{ color: T.inkMid, fontWeight: 500 }}>Scope</span>
            <span style={{ color: T.ink }}>3 plants, 3 DCs, 11 products, 8-week horizon</span>
            <span style={{ color: T.inkMid, fontWeight: 500 }}>Engines</span>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: T.ink }}>DRP, Production Plan, Scheduler, MRP, Demand</span>
          </div>
        </Card>
      </div>
    </ModuleLayout>
  );
}
