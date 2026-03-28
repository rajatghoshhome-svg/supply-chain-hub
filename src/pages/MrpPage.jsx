import { useState } from 'react';
import { T } from '../styles/tokens';
import ModuleLayout from '../components/shared/ModuleLayout';
import PageHeader from '../components/shared/PageHeader';
import Card from '../components/shared/Card';

const TABS = [
  { id: 'bom', label: 'Bill of Materials' },
  { id: 'records', label: 'MRP Records' },
  { id: 'exceptions', label: 'Exceptions' },
];

export default function MrpPage() {
  const [tab, setTab] = useState('bom');

  return (
    <ModuleLayout moduleContext="mrp" tabs={TABS} activeTab={tab} onTabChange={setTab}>
      <PageHeader title="Material Requirements Planning" subtitle="MRP" />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 40px' }}>
        {tab === 'bom' && (
          <Card title="Bill of Materials">
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Sora', fontSize: 16, color: T.ink, marginBottom: 8 }}>BOM Management</div>
              <p style={{ fontSize: 13, color: T.inkLight, maxWidth: 440, margin: '0 auto 20px' }}>
                Define parent-child material relationships with quantities per assembly, scrap factors, and lead time offsets.
              </p>
              {/* Placeholder BOM tree */}
              <div style={{ maxWidth: 400, margin: '0 auto', textAlign: 'left' }}>
                {[
                  { level: 0, name: 'Dentastix Large (Finished)', qty: '1 unit' },
                  { level: 1, name: 'Dental compound mix', qty: '0.85 kg' },
                  { level: 1, name: 'Packaging sleeve', qty: '1 ea' },
                  { level: 2, name: 'Film roll stock', qty: '0.12 m²' },
                  { level: 2, name: 'Printed label', qty: '1 ea' },
                  { level: 1, name: 'Outer carton', qty: '0.083 ea' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', paddingLeft: item.level * 24, borderBottom: `1px solid ${T.border}` }}>
                    <div style={{ width: 8, height: 8, borderRadius: item.level === 0 ? 2 : '50%', background: item.level === 0 ? T.ink : item.level === 1 ? T.accent : T.inkGhost, marginRight: 10 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: T.ink }}>{item.name}</div>
                    </div>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: T.inkLight }}>{item.qty}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {tab === 'records' && (
          <Card title="Time-Phased MRP Records">
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: T.inkLight, maxWidth: 440, margin: '0 auto' }}>
                MRP explosion results showing gross requirements, scheduled receipts, projected on-hand, net requirements, planned order releases, and planned order receipts.
              </p>
            </div>
          </Card>
        )}

        {tab === 'exceptions' && (
          <Card title="MRP Exceptions">
            <div style={{ padding: '24px 20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'Expedite', count: 0, color: T.risk },
                  { label: 'Reschedule In', count: 0, color: T.warn },
                  { label: 'Reschedule Out', count: 0, color: T.safe },
                  { label: 'Cancel', count: 0, color: T.inkLight },
                ].map(e => (
                  <div key={e.label} style={{ background: T.bgDark, borderRadius: 8, padding: '14px 16px', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'Sora', fontSize: 28, fontWeight: 600, color: e.color }}>{e.count}</div>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkLight, letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 }}>{e.label}</div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 12, color: T.inkLight, textAlign: 'center' }}>No exceptions. Run MRP explosion to generate action messages.</p>
            </div>
          </Card>
        )}
      </div>
    </ModuleLayout>
  );
}
