import { useState, useEffect } from 'react';
import { T } from '../styles/tokens';
import ModuleLayout from '../components/shared/ModuleLayout';
import PageHeader from '../components/shared/PageHeader';
import Card from '../components/shared/Card';
import DataTable from '../components/shared/DataTable';

const TABS = [
  { id: 'inventory', label: 'Inventory Position' },
  { id: 'requirements', label: 'Requirements' },
  { id: 'network', label: 'Network' },
  { id: 'transfers', label: 'Transfers' },
];

export default function DrpPage() {
  const [tab, setTab] = useState('inventory');
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/locations').then(r => r.json())
      .then(l => { setLocations(l); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const locColumns = [
    { key: 'code', label: 'Code', sortable: true },
    { key: 'name', label: 'Location', sortable: true },
    { key: 'city', label: 'City', sortable: true },
    { key: 'state', label: 'State', sortable: true },
    { key: 'status', label: 'Status', sortable: true, render: (v) => (
      <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: v === 'crisis' ? T.risk : v === 'review' || v === 'overstock' ? T.warn : T.safe, fontWeight: 500, textTransform: 'uppercase' }}>{v}</span>
    )},
  ];

  return (
    <ModuleLayout moduleContext="drp" tabs={TABS} activeTab={tab} onTabChange={setTab}>
      <PageHeader title="Distribution Requirements Planning" subtitle="DRP" />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 40px' }}>
        {tab === 'inventory' && (
          <Card title="Inventory Position by Location">
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: T.inkLight }}>Loading...</div>
            ) : (
              <DataTable columns={locColumns} data={locations} />
            )}
          </Card>
        )}

        {tab === 'requirements' && (
          <Card title="Time-Phased Requirements">
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Sora', fontSize: 16, color: T.ink, marginBottom: 8 }}>Gross-to-Net Requirements</div>
              <p style={{ fontSize: 13, color: T.inkLight, maxWidth: 440, margin: '0 auto' }}>
                Time-phased DRP records showing gross requirements, scheduled receipts, projected on-hand, net requirements, and planned shipments per SKU per location.
              </p>
            </div>
          </Card>
        )}

        {tab === 'network' && (
          <Card title="Distribution Network">
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: T.inkLight }}>Network visualization with lanes and lead times will be displayed here.</p>
            </div>
          </Card>
        )}

        {tab === 'transfers' && (
          <Card title="Planned Transfers">
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: T.inkLight }}>Stock transfer orders and rebalancing recommendations. Connect to database to see pending transfers.</p>
            </div>
          </Card>
        )}
      </div>
    </ModuleLayout>
  );
}
