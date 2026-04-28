import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <div className="stack">
      <section className="hero panel">
        <h1>ReplaySnag</h1>
        <p>Build replay ready radio segments from raw breaks in one pass.</p>
      </section>
      <section className="grid">
        <article className="panel">
          <h2>Batch Replay Packager</h2>
          <p>Package multiple segments with intro rotation, naming templates, and one-run export.</p>
          <Link className="button" to="/batch">Open Batch Replay Packager</Link>
        </article>
      </section>
    </div>
  );
}
