import { useMemo, useState } from 'react';
import { createBatchExport, getJobStatus, uploadFiles, UploadedClientFile } from '../components/api';

interface DragState {
  draggingId: string;
}

const poll = async (jobId: string, onUpdate: (message: string) => void): Promise<string> => {
  while (true) {
    const status = await getJobStatus(jobId);
    onUpdate(`${status.message} (${status.progress}%)`);
    if (status.status === 'completed' && status.downloadId) return status.downloadId;
    if (status.status === 'failed') throw new Error(status.error || 'Failed');
    await new Promise((r) => setTimeout(r, 1500));
  }
};

export function BatchReplayPage() {
  const [segments, setSegments] = useState<UploadedClientFile[]>([]);
  const [intros, setIntros] = useState<UploadedClientFile[]>([]);
  const [outro, setOutro] = useState<UploadedClientFile | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [sampleRate, setSampleRate] = useState(48000);
  const [trimSilence, setTrimSilence] = useState(true);
  const [normalizeLoudness, setNormalizeLoudness] = useState(true);
  const [format, setFormat] = useState<'mp3' | 'wav'>('mp3');
  const [template, setTemplate] = useState('{show} {hour} SEG {segment}');
  const [show, setShow] = useState('C&T DAWN');
  const [startHour, setStartHour] = useState('1');
  const [segmentsPerHour, setSegmentsPerHour] = useState(4);
  const [duplicateEnabled, setDuplicateEnabled] = useState(false);
  const [sourceHour, setSourceHour] = useState('1AM');
  const [targetHour, setTargetHour] = useState('3AM');
  const [status, setStatus] = useState('Idle');

  const rotationHelp = useMemo(() => {
    return intros.map((intro, i) => `Slot ${i + 1}: ${intro.originalName}`).join(' • ');
  }, [intros]);

  const uploadMany = async (files: FileList | null, setter: (value: UploadedClientFile[]) => void) => {
    if (!files?.length) return;
    const uploaded = await uploadFiles(files);
    setter(uploaded.sort((a, b) => a.originalName.localeCompare(b.originalName, undefined, { numeric: true })));
  };

  const onDrop = (targetId: string) => {
    if (!dragState) return;
    const from = segments.findIndex((s) => s.id === dragState.draggingId);
    const to = segments.findIndex((s) => s.id === targetId);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...segments];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setSegments(next);
    setDragState(null);
  };

  const exportBatch = async () => {
    if (!segments.length) return;
    setStatus('Submitting batch...');
    const jobId = await createBatchExport({
      segmentIds: segments.map((s) => s.id),
      introIds: intros.map((i) => i.id),
      outroId: outro?.id,
      sampleRate,
      trimSilence,
      normalizeLoudness,
      format,
      naming: {
        template,
        show,
        startHour,
        segmentsPerHour,
        date: new Date().toISOString().slice(0, 10)
      },
      duplication: {
        enabled: duplicateEnabled,
        sourceHour,
        targetHour
      }
    });
    const downloadId = await poll(jobId, setStatus);
    window.location.href = `/api/replay/download/${downloadId}`;
    setStatus('Done');
  };

  return (
    <div className="stack">
      <h1>Batch Replay Packager</h1>
      <section className="panel stack">
        <label>Raw Segment Files<input type="file" accept="audio/*" multiple onChange={(e) => uploadMany(e.target.files, setSegments)} /></label>
        <label>Intro Rotation Assets (upload 3 for legacy slot 1/2/3 cycle)<input type="file" accept="audio/*" multiple onChange={(e) => uploadMany(e.target.files, setIntros)} /></label>
        <label>Shared Outro<input type="file" accept="audio/*" onChange={async (e) => {
          const files = e.target.files;
          if (!files?.length) return;
          const [file] = await uploadFiles(files);
          setOutro(file);
        }} /></label>
        <small>{rotationHelp || 'No intro rotation assets uploaded yet.'}</small>
      </section>

      <section className="panel">
        <h3>Segment Order (drag to reorder)</h3>
        <ul className="segment-list">
          {segments.map((segment) => (
            <li
              key={segment.id}
              draggable
              onDragStart={() => setDragState({ draggingId: segment.id })}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(segment.id)}
            >
              {segment.originalName}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel grid two">
        <label>Sample Rate
          <select value={sampleRate} onChange={(e) => setSampleRate(Number(e.target.value))}>
            <option value={44100}>44.1 kHz</option>
            <option value={48000}>48 kHz</option>
          </select>
        </label>
        <label>Format
          <select value={format} onChange={(e) => setFormat(e.target.value as 'mp3' | 'wav')}>
            <option value="mp3">MP3</option>
            <option value="wav">WAV</option>
          </select>
        </label>
        <label><input type="checkbox" checked={trimSilence} onChange={(e) => setTrimSilence(e.target.checked)} /> Trim silence from talk breaks</label>
        <label><input type="checkbox" checked={normalizeLoudness} onChange={(e) => setNormalizeLoudness(e.target.checked)} /> Normalize loudness</label>
      </section>

      <section className="panel grid two">
        <label className="full">Naming Template<input value={template} onChange={(e) => setTemplate(e.target.value)} /></label>
        <label>Show Name<input value={show} onChange={(e) => setShow(e.target.value)} /></label>
        <label>Starting Hour<input value={startHour} onChange={(e) => setStartHour(e.target.value)} /></label>
        <label>Segments Per Hour<input type="number" min={1} value={segmentsPerHour} onChange={(e) => setSegmentsPerHour(Number(e.target.value))} /></label>
        <label><input type="checkbox" checked={duplicateEnabled} onChange={(e) => setDuplicateEnabled(e.target.checked)} /> Duplicate outputs into another hour block</label>
        <label>Source Hour Token<input value={sourceHour} onChange={(e) => setSourceHour(e.target.value)} /></label>
        <label>Target Hour Token<input value={targetHour} onChange={(e) => setTargetHour(e.target.value)} /></label>
      </section>

      <button className="button primary" disabled={!segments.length} onClick={exportBatch}>Export Batch</button>
      <p>{status}</p>
    </div>
  );
}
