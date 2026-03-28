import { useState, useEffect } from 'react';
import { T } from '../styles/tokens';
import ModuleLayout from '../components/shared/ModuleLayout';
import PageHeader from '../components/shared/PageHeader';
import Card from '../components/shared/Card';
import DataTable from '../components/shared/DataTable';

const TABS = [
  { id: 'history', label: 'Demand History' },
  { id: 'forecast', label: 'Forecast' },
  { id: 'accuracy', label: 'Accuracy' },
];

export default function DemandPage() {
  const [tab, setTab] = useState('history');
  const [history, setHistory] = useState([]);
  const [skus, setSkus] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/skus').then(r => r.json()),
      fetch('/api/locations').then(r => r.json()),
    ]).then(([s, l]) => {
      setSkus(s);
      setLocations(l);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const skuMap = Object.fromEntries(skus.map(s => [s.id, s]));
  const locMap = Object.fromEntries(locations.map(l => [l.id, l]));

  const historyColumns = [
    { key: 'periodStart', label: 'Period', sortable: true },
    { key: 'skuName', label: 'SKU', sortable: true },
    { key: 'locationName', label: 'Location', sortable: true },
    { key: 'actualQty', label: 'Actual Qty', align: 'right', sortable: true, render: v => Number(v).toLocaleString() },
  ];

  return (
    <ModuleLayout moduleContext="demand" tabs={TABS} activeTab={tab} onTabChange={setTab}>
      <PageHeader title="Demand Planning" subtitle="Forecast & Analyze" />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 40px' }}>
        {tab === 'history' && (
          <Card title="Weekly Demand History">
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>Loading...</div>
            ) : (
              <DataTable columns={historyColumns} data={[]} />
            )}
            <div style={{ padding: '16px 20px', borderTop: `1px solid ${T.border}`, color: T.inkLight, fontSize: 12 }}>
              Connect to database and run seed script to populate demand history. Run: <code style={{ fontFamily: 'JetBrains Mono', background: T.bgDark, padding: '2px 6px', borderRadius: 3 }}>cd server && npm run seed</code>
            </div>
          </Card>
        )}

        {tab === 'forecast' && (
          <Card title="Demand Forecast">
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Sora', fontSize: 16, color: T.ink, marginBottom: 8 }}>Forecast Generation</div>
              <p style={{ fontSize: 13, color: T.inkLight, maxWidth: 400, margin: '0 auto 16px' }}>
                Generate statistical forecasts using moving average or exponential smoothing. AI-assisted adjustments available via the agent panel.
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                {['Moving Average', 'Exponential Smoothing', 'AI-Adjusted'].map(m => (
                  <div key={m} style={{ background: T.bgDark, border: `1px solid ${T.border}`, borderRadius: 8, padding: '12px 20px', fontSize: 13, color: T.inkMid }}>
                    {m}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {tab === 'accuracy' && (
          <Card title="Forecast Accuracy Metrics">
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, maxWidth: 600, margin: '0 auto' }}>
                {[
                  { label: 'MAPE', value: '—', desc: 'Mean Absolute Percentage Error' },
                  { label: 'Bias', value: '—', desc: 'Forecast bias (over/under)' },
                  { label: 'Tracking Signal', value: '—', desc: 'Cumulative error / MAD' },
                ].map(m => (
                  <div key={m.label} style={{ background: T.bgDark, borderRadius: 8, padding: '16px' }}>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: T.inkLight, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>{m.label}</div>
                    <div style={{ fontFamily: 'Sora', fontSize: 28, fontWeight: 600, color: T.ink, marginBottom: 4 }}>{m.value}</div>
                    <div style={{ fontSize: 11, color: T.inkLight }}>{m.desc}</div>
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
