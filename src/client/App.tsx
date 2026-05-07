import { Navigate, Route, Routes } from 'react-router-dom';
import { BatchReplayPage } from './pages/BatchReplayPage';

export default function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <img src="/replaysnag-logo.png" alt="ReplaySnag" className="brand-logo" />
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/batch" replace />} />
          <Route path="/batch" element={<BatchReplayPage />} />
        </Routes>
      </main>
    </div>
  );
}
