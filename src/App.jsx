import { useState } from 'react';
import Fonts from './components/Fonts';
import Nav from './components/Nav';
import Landing from './pages/Landing';
import Workflow from './pages/Workflow';
import AgentPage from './pages/AgentPage';
import ValueLog from './pages/ValueLog';
import HowItWorks from './pages/HowItWorks';
import About from './pages/About';
import { T } from './styles/tokens';

export default function App() {
  const [page, setPage] = useState('landing');

  const renderPage = () => {
    switch (page) {
      case 'landing':    return <Landing    setPage={setPage} />;
      case 'workflow':   return <Workflow   setPage={setPage} />;
      case 'agent':      return <AgentPage  setPage={setPage} />;
      case 'valueLog':   return <ValueLog />;
      case 'howItWorks': return <HowItWorks />;
      case 'about':      return <About />;
      default:           return <Landing    setPage={setPage} />;
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <Fonts />
      <Nav page={page} setPage={setPage} />
      {renderPage()}
    </div>
  );
}
