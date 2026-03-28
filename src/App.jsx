import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Fonts from './components/Fonts';
import Nav from './components/Nav';
import Landing from './pages/Landing';
import AgentPage from './pages/AgentPage';
import DecisionsPage from './pages/DecisionsPage';
import DemandPage from './pages/DemandPage';
import ProductionPlanPage from './pages/ProductionPlanPage';
import DrpPage from './pages/DrpPage';
import SchedulingPage from './pages/SchedulingPage';
import MrpPage from './pages/MrpPage';
import { T } from './styles/tokens';

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ minHeight: '100vh', background: T.bg }}>
        <Fonts />
        <Nav />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/demand/*" element={<DemandPage />} />
          <Route path="/production-plan/*" element={<ProductionPlanPage />} />
          <Route path="/drp/*" element={<DrpPage />} />
          <Route path="/scheduling/*" element={<SchedulingPage />} />
          <Route path="/mrp/*" element={<MrpPage />} />
          <Route path="/decisions" element={<DecisionsPage />} />
          <Route path="/agent" element={<AgentPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
