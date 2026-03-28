import { useState } from 'react';
import { T } from '../styles/tokens';
import ModuleLayout from '../components/shared/ModuleLayout';
import PageHeader from '../components/shared/PageHeader';
import Card from '../components/shared/Card';

const TABS = [
  { id: 'orders', label: 'Production Orders' },
  { id: 'gantt', label: 'Gantt Chart' },
  { id: 'optimize', label: 'Sequence Optimizer' },
];

export default function SchedulingPage() {
  const [tab, setTab] = useState('orders');

  return (
    <ModuleLayout moduleContext="scheduling" tabs={TABS} activeTab={tab} onTabChange={setTab}>
      <PageHeader title="Production Scheduling" subtitle="Detailed Schedule" />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 40px' }}>
        {tab === 'orders' && (
          <Card title="Production Orders">
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Sora', fontSize: 16, color: T.ink, marginBottom: 8 }}>Work Center Schedule</div>
              <p style={{ fontSize: 13, color: T.inkLight, maxWidth: 440, margin: '0 auto' }}>
                Create and manage production orders by work center. Set quantities, planned start/end times, priorities, and sequences.
              </p>
            </div>
          </Card>
        )}

        {tab === 'gantt' && (
          <Card title="Gantt Chart">
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Sora', fontSize: 16, color: T.ink, marginBottom: 8 }}>Visual Schedule</div>
              <p style={{ fontSize: 13, color: T.inkLight, maxWidth: 440, margin: '0 auto' }}>
                SVG-based Gantt chart showing production orders per work center on a time axis. Drag to reschedule, click to edit.
              </p>
              {/* Placeholder Gantt bars */}
              <div style={{ maxWidth: 700, margin: '24px auto 0' }}>
                {['Line 1', 'Line 2', 'Line 3'].map((line, i) => (
                  <div key={line} style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ width: 60, fontFamily: 'JetBrains Mono', fontSize: 10, color: T.inkLight, textAlign: 'right', marginRight: 12 }}>{line}</div>
                    <div style={{ flex: 1, height: 24, background: T.bgDark, borderRadius: 4, position: 'relative' }}>
                      <div style={{ position: 'absolute', left: `${i * 15}%`, width: `${30 + i * 5}%`, height: '100%', background: T.inkGhost, borderRadius: 4 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {tab === 'optimize' && (
          <Card title="Sequence Optimizer">
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: T.inkLight, maxWidth: 440, margin: '0 auto' }}>
                AI-assisted sequence optimization to minimize changeover time and maximize throughput. Configure constraints per work center.
              </p>
            </div>
          </Card>
        )}
      </div>
    </ModuleLayout>
  );
}
