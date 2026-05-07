import { useMemo, useState } from 'react';
import sanitizeFilename from 'sanitize-filename';
import { createBatchExport, getJobStatus, preprocessAudio, uploadFiles, UploadedClientFile } from '../components/api';
import { WaveformViewer } from '../components/WaveformViewer';
import type { SegmentTrim } from '../../shared/types';

type SegmentProcStatus = 'processing' | 'done' | 'error';

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

function addHour(startHour: string, offset: number, segmentsPerHour: number): string {
  const hourNum = parseInt(startHour, 10);
  if (isNaN(hourNum)) return startHour;
  const hourDelta = Math.floor(offset / Math.max(segmentsPerHour, 1));
  const hour = ((hourNum + hourDelta - 1 + 24) % 24) + 1;
  return `${hour}AM`;
}

function previewFilename(template: string, data: Record<string, string | number>): string {
  const rendered = template.replace(/\{(\w+)\}/g, (_, token: string) => String(data[token] ?? ''));
  return sanitizeFilename(rendered).replace(/\s+/g, ' ').trim();
}

export function BatchReplayPage() {
  const [segments, setSegments] = useState<UploadedClientFile[]>([]);
  const [intros, setIntros] = useState<UploadedClientFile[]>([]);
  const [outro, setOutro] = useState<UploadedClientFile | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [segmentTrims, setSegmentTrims] = useState<Record<string, SegmentTrim>>({});
  const [segmentStatus, setSegmentStatus] = useState<Record<string, SegmentProcStatus>>({});
  const [processedIdMap, setProcessedIdMap] = useState<Record<string, string>>({});
  const [uploadPhase, setUploadPhase] = useState<'idle' | 'uploading' | 'done'>('idle');
  const [sampleRate, setSampleRate] = useState(48000);
  const [format, setFormat] = useState<'mp3' | 'wav'>('mp3');
  const [template, setTemplate] = useState('{show} {hour} SEG {segment}');
  const [show, setShow] = useState('SHOW NAME');
  const [startHour, setStartHour] = useState('1');
  const [segmentsPerHour, setSegmentsPerHour] = useState(4);
  const [duplicateEnabled, setDuplicateEnabled] = useState(false);
  const [sourceHour, setSourceHour] = useState('1AM');
  const [targetHour, setTargetHour] = useState('3AM');
  const [status, setStatus] = useState('');

  const rotationHelp = useMemo(() => {
    return intros.map((intro, i) => `Slot ${i + 1}: ${intro.originalName}`).join(' • ');
  }, [intros]);

  const filenamePreviews = useMemo(() => {
    return segments.map((_, i) => {
      const hour = addHour(startHour, i, segmentsPerHour);
      const name = previewFilename(template, {
        show,
        hour,
        segment: i + 1,
        title: `SEG ${i + 1}`,
        date: new Date().toISOString().slice(0, 10)
      });
      return `${name}.${format}`;
    });
  }, [segments, template, show, startHour, segmentsPerHour, format]);

  const handleSegmentFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadPhase('uploading');
    setSegments([]);
    setSegmentStatus({});
    setProcessedIdMap({});
    setSegmentTrims({});
    setExpandedId(null);

    const uploaded = await uploadFiles(files);
    const sorted = uploaded.sort((a, b) => a.originalName.localeCompare(b.originalName, undefined, { numeric: true }));
    setSegments(sorted);
    setUploadPhase('done');

    const initialStatus: Record<string, SegmentProcStatus> = {};
    sorted.forEach((s) => { initialStatus[s.id] = 'processing'; });
    setSegmentStatus(initialStatus);

    await Promise.all(sorted.map(async (seg) => {
      try {
        const processedId = await preprocessAudio(seg.id);
        setProcessedIdMap((prev) => ({ ...prev, [seg.id]: processedId }));
        setSegmentStatus((prev) => ({ ...prev, [seg.id]: 'done' }));
      } catch {
        setSegmentStatus((prev) => ({ ...prev, [seg.id]: 'error' }));
      }
    }));
  };

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

  const setTrim = (id: string, field: 'inPoint' | 'outPoint', value: number) => {
    setSegmentTrims((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  const allReady = segments.length > 0 && segments.every((s) => segmentStatus[s.id] === 'done');

  const exportBatch = async () => {
    if (!allReady) return;
    setStatus('Submitting batch…');
    try {
      const jobId = await createBatchExport({
        segmentIds: segments.map((s) => processedIdMap[s.id] || s.id),
        segmentTrims,
        introIds: intros.map((i) => i.id),
        outroId: outro?.id,
        sampleRate,
        trimSilence: false,
        normalizeLoudness: false,
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
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : 'Export failed'}`);
    }
  };

  return (
    <div className="stack">
      <h1>Batch Replay Packager</h1>
      <section className="panel stack">
        <label>
          Raw Segment Files
          <input type="file" accept="audio/*" multiple onChange={(e) => handleSegmentFiles(e.target.files)} />
          {uploadPhase === 'uploading' && <span className="upload-indicator">Uploading files…</span>}
        </label>
        <label>Intro Rotation Assets (upload 3 for legacy slot 1/2/3 cycle)<input type="file" accept="audio/*" multiple onChange={(e) => uploadMany(e.target.files, setIntros)} /></label>
        <label>Shared Outro<input type="file" accept="audio/*" onChange={async (e) => {
          const files = e.target.files;
          if (!files?.length) return;
          const [file] = await uploadFiles(files);
          setOutro(file);
        }} /></label>
        <small>{rotationHelp || 'No intro rotation assets uploaded yet.'}</small>
      </section>

      {segments.length > 0 && (
        <section className="panel">
          <h3>Segment Order (drag to reorder)</h3>
          <ul className="segment-list">
            {segments.map((segment) => {
              const st = segmentStatus[segment.id];
              const procId = processedIdMap[segment.id];
              const trim = segmentTrims[segment.id] ?? { inPoint: 0, outPoint: 0 };
              const isExpanded = expandedId === segment.id;
              return (
                <li
                  key={segment.id}
                  draggable
                  onDragStart={() => setDragState({ draggingId: segment.id })}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDrop(segment.id)}
                  style={{ cursor: 'grab' }}
                >
                  <div className="segment-row">
                    <span className="segment-drag-handle">⠿</span>
                    <span className="segment-name">{segment.originalName}</span>
                    {st === 'processing' && <span className="seg-status-spinner" title="Preprocessing…" />}
                    {st === 'done' && <span className="seg-status-done" title="Ready">✓</span>}
                    {st === 'error' && <span className="seg-status-error" title="Preprocessing failed">✗</span>}
                    <button
                      className={`segment-trim-toggle${isExpanded ? ' active' : ''}`}
                      disabled={st !== 'done'}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedId(isExpanded ? null : segment.id);
                      }}
                    >
                      {isExpanded ? '▲ Close Trim' : '▼ Trim'}
                    </button>
                  </div>
                  {isExpanded && procId && (
                    <div onDragStart={(e) => e.stopPropagation()}>
                      <WaveformViewer
                        audioUrl={`/api/audio/${procId}`}
                        inPoint={trim.inPoint ?? 0}
                        outPoint={trim.outPoint ?? 0}
                        onInPointChange={(v) => setTrim(segment.id, 'inPoint', v)}
                        onOutPointChange={(v) => setTrim(segment.id, 'outPoint', v)}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

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
      </section>

      <section className="panel grid two">
        <label className="full">Naming Template<input value={template} onChange={(e) => setTemplate(e.target.value)} /></label>
        <label>Show Name<input value={show} onChange={(e) => setShow(e.target.value)} /></label>
        <label>Starting Hour<input value={startHour} onChange={(e) => setStartHour(e.target.value)} /></label>
        <label>Segments Per Hour<input type="number" min={1} value={segmentsPerHour} onChange={(e) => setSegmentsPerHour(Number(e.target.value))} /></label>
        <label><input type="checkbox" checked={duplicateEnabled} onChange={(e) => setDuplicateEnabled(e.target.checked)} /> Duplicate outputs into another hour block</label>
        <label>Source Hour Token<input value={sourceHour} onChange={(e) => setSourceHour(e.target.value)} /></label>
        <label>Target Hour Token<input value={targetHour} onChange={(e) => setTargetHour(e.target.value)} /></label>
        {filenamePreviews.length > 0 && (
          <div className="full filename-preview">
            <p className="filename-preview-label">File name preview</p>
            <ul className="filename-preview-list">
              {filenamePreviews.map((name, i) => (
                <li key={i}>{name}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <button className="button primary" disabled={!allReady} onClick={exportBatch}>Export Batch as ZIP</button>
      {status && <p>{status}</p>}
    </div>
  );
}
