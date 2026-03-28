import { useState } from 'react';
import { T } from '../styles/tokens';
import ModuleLayout from '../components/shared/ModuleLayout';
import PageHeader from '../components/shared/PageHeader';
import Card from '../components/shared/Card';

const TABS = [
  { id: 'aggregate', label: 'Aggregate Plan' },
  { id: 'capacity', label: 'Capacity' },
  { id: 'strategy', label: 'Strategy Comparison' },
];

export default function ProductionPlanPage() {
  const [tab, setTab] = useState('aggregate');

  return (
    <ModuleLayout moduleContext="production_plan" tabs={TABS} activeTab={tab} onTabChange={setTab}>
      <PageHeader title="Production Planning" subtitle="Aggregate & Capacity" />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 40px' }}>
        {tab === 'aggregate' && (
          <Card title="Aggregate Production Plan">
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Sora', fontSize: 16, color: T.ink, marginBottom: 8 }}>Production Plan by Product Family</div>
              <p style={{ fontSize: 13, color: T.inkLight, maxWidth: 440, margin: '0 auto 16px' }}>
                Plan production quantities at the product family level. Balance demand with available capacity across work centers.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, maxWidth: 500, margin: '0 auto' }}>
                {['Dental Treats', 'Soft Treats'].map(f => (
                  <div key={f} style={{ background: T.bgDark, border: `1px solid ${T.border}`, borderRadius: 8, padding: '16px 20px' }}>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkLight, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>Product Family</div>
                    <div style={{ fontFamily: 'Sora', fontSize: 15, fontWeight: 500, color: T.ink }}>{f}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {tab === 'capacity' && (
          <Card title="Capacity vs Demand">
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: T.inkLight }}>Capacity chart will display here once work centers are configured.</p>
            </div>
          </Card>
        )}

        {tab === 'strategy' && (
          <Card title="Strategy Comparison">
            <div style={{ padding: '24px 20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {[
                  { name: 'Chase', desc: 'Match production to demand each period. Higher hiring/layoff costs, lower inventory.' },
                  { name: 'Level', desc: 'Constant production rate. Lower workforce costs, higher inventory carrying cost.' },
                  { name: 'Hybrid', desc: 'Blend of chase and level. Balance workforce stability with inventory costs.' },
                ].map(s => (
                  <div key={s.name} style={{ background: T.bgDark, border: `1px solid ${T.border}`, borderRadius: 10, padding: '20px' }}>
                    <div style={{ fontFamily: 'Sora', fontSize: 15, fontWeight: 600, color: T.ink, marginBottom: 8 }}>{s.name}</div>
                    <p style={{ fontSize: 12.5, color: T.inkMid, lineHeight: 1.6 }}>{s.desc}</p>
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkLight, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Total Cost</div>
                      <div style={{ fontFamily: 'Sora', fontSize: 22, fontWeight: 600, color: T.inkMid }}>—</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>
    </ModuleLayout>
  );
}
