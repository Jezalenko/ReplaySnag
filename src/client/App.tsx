import { Link, Route, Routes } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { BatchReplayPage } from './pages/BatchReplayPage';

export default function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/">
          <img src="/replaysnag-logo.png" alt="ReplaySnag" className="brand-logo" />
        </Link>
        <nav>
          <Link to="/batch">Batch Replay Packager</Link>
        </nav>
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/batch" element={<BatchReplayPage />} />
        </Routes>
      </main>
    </div>
  );
}
