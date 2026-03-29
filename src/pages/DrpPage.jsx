import { useState, useEffect, useCallback } from 'react';
import { T } from '../styles/tokens';
import ModuleLayout from '../components/shared/ModuleLayout';
import PageHeader from '../components/shared/PageHeader';
import DistributionPlannerTab from '../components/drp/DistributionPlannerTab';
import LoadManagerTab from '../components/drp/LoadManagerTab';
import MoveVsMakeTab from '../components/drp/MoveVsMakeTab';

const TABS = [
  { id: 'planner', label: 'Distribution Planner' },
  { id: 'loads', label: 'Load Manager' },
  { id: 'moveVsMake', label: 'Move vs Make' },
];

const API = '/api/drp';

export default function DrpPage() {
  const [activeTab, setActiveTab] = useState('planner');
  const [plan, setPlan] = useState(null);
  const [shipmentData, setShipmentData] = useState(null);
  const [scenarios, setScenarios] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchPlan = useCallback(() => {
    fetch(`${API}/distribution-plan`)
      .then(r => r.json())
      .then(setPlan)
      .catch(() => {});
  }, []);

  const fetchShipments = useCallback(() => {
    fetch(`${API}/recommended-shipments`)
      .then(r => r.json())
      .then(setShipmentData)
      .catch(() => {});
  }, []);

  const fetchScenarios = useCallback(() => {
    fetch(`${API}/move-vs-make/scenarios`)
      .then(r => r.json())
      .then(data => setScenarios(data.scenarios || []))
      .catch(() => {});
  }, []);

  // Fetch data for the active tab
  useEffect(() => {
    setLoading(true);
    if (activeTab === 'planner') {
      fetchPlan();
    } else if (activeTab === 'loads') {
      fetchShipments();
    } else if (activeTab === 'moveVsMake') {
      fetchScenarios();
    }
    setLoading(false);
  }, [activeTab, fetchPlan, fetchShipments, fetchScenarios]);

  const handleUpdateSplit = async (familyId, allocations) => {
    try {
      await fetch(`${API}/demand-split`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyId, allocations }),
      });
      fetchPlan();
    } catch (e) { /* ignore */ }
  };

  const handleUpdateCalendar = async (laneKey, updates) => {
    try {
      await fetch(`${API}/shipping-calendar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ laneKey, ...updates }),
      });
      fetchPlan();
    } catch (e) { /* ignore */ }
  };

  return (
    <ModuleLayout moduleContext="drp" tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}>
      <PageHeader
        title="Distribution Planning"
        subtitle="Champion Pet Foods — DRP"
      />

      {activeTab === 'planner' && (
        <DistributionPlannerTab
          plan={plan}
          onUpdateSplit={handleUpdateSplit}
          onUpdateCalendar={handleUpdateCalendar}
        />
      )}

      {activeTab === 'loads' && (
        <LoadManagerTab
          shipmentData={shipmentData}
          onRefresh={fetchShipments}
        />
      )}

      {activeTab === 'moveVsMake' && (
        <MoveVsMakeTab
          scenarios={scenarios}
          onRefresh={fetchScenarios}
        />
      )}
    </ModuleLayout>
  );
}
