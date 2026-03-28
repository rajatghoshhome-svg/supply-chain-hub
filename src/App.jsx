import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Fonts from './components/Fonts';
import Nav from './components/Nav';
import Landing from './pages/Landing';
import Workflow from './pages/Workflow';
import AgentPage from './pages/AgentPage';
import ValueLog from './pages/ValueLog';
import HowItWorks from './pages/HowItWorks';
import About from './pages/About';
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
          <Route path="/workflow" element={<Workflow />} />
          <Route path="/agent" element={<AgentPage />} />
          <Route path="/decisions" element={<ValueLog />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/about" element={<About />} />
          <Route path="/demand/*" element={<DemandPage />} />
          <Route path="/production-plan/*" element={<ProductionPlanPage />} />
          <Route path="/drp/*" element={<DrpPage />} />
          <Route path="/scheduling/*" element={<SchedulingPage />} />
          <Route path="/mrp/*" element={<MrpPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
