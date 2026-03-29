import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Fonts from './components/Fonts';
import Nav from './components/Nav';
import ChatWidget from './components/ChatWidget';
import { T } from './styles/tokens';

const Landing = lazy(() => import('./pages/Landing'));
const DemandPage = lazy(() => import('./pages/DemandPage'));
const DrpPage = lazy(() => import('./pages/DrpPage'));
const ProductionPlanPage = lazy(() => import('./pages/ProductionPlanPage'));
const SchedulingPage = lazy(() => import('./pages/SchedulingPage'));
const MrpPage = lazy(() => import('./pages/MrpPage'));
const DecisionsPage = lazy(() => import('./pages/DecisionsPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ minHeight: '100vh', background: T.bg }}>
        <Fonts />
        <Nav />
        <Suspense fallback={
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', fontFamily: 'Inter', color: '#8C8A87', fontSize: 13 }}>
            Loading...
          </div>
        }>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/demand/*" element={<DemandPage />} />
            <Route path="/production-plan/*" element={<ProductionPlanPage />} />
            <Route path="/drp/*" element={<DrpPage />} />
            <Route path="/scheduling/*" element={<SchedulingPage />} />
            <Route path="/mrp/*" element={<MrpPage />} />
            <Route path="/decisions" element={<DecisionsPage />} />
            <Route path="/setup" element={<OnboardingPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Suspense>
        <ChatWidget />
      </div>
    </BrowserRouter>
  );
}
