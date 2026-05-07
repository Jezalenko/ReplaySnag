import React, { useMemo, useState } from 'react';
import sanitizeFilename from 'sanitize-filename';
import { createBatchExport, getJobStatus, preprocessAudio, uploadFiles, UploadedClientFile } from '../components/api';
import { WaveformViewer } from '../components/WaveformViewer';
import type { SegmentTrim } from '../../shared/types';

type SegmentProcStatus = 'processing' | 'done' | 'error';

interface DragState {
  draggingId: string;
}

const poll = async (
  jobId: string,
  onUpdate: (message: string, pct: number) => void
): Promise<string> => {
  while (true) {
    const status = await getJobStatus(jobId);
    onUpdate(status.message, status.progress);
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
  const [outros, setOutros] = useState<UploadedClientFile[]>([]);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedIntroId, setExpandedIntroId] = useState<string | null>(null);
  const [expandedOutroId, setExpandedOutroId] = useState<string | null>(null);
  const [segmentTrims, setSegmentTrims] = useState<Record<string, SegmentTrim>>({});
  const [segmentStatus, setSegmentStatus] = useState<Record<string, SegmentProcStatus>>({});
  const [processedIdMap, setProcessedIdMap] = useState<Record<string, string>>({});
  const [uploadPhase, setUploadPhase] = useState<'idle' | 'uploading' | 'done'>('idle');
  const [uploadCount, setUploadCount] = useState(0);
  const [introUploadPhase, setIntroUploadPhase] = useState<'idle' | 'uploading'>('idle');
  const [introUploadCount, setIntroUploadCount] = useState(0);
  const [outroUploadPhase, setOutroUploadPhase] = useState<'idle' | 'uploading'>('idle');
  const [outroUploadCount, setOutroUploadCount] = useState(0);
  const [introCrossfades, setIntroCrossfades] = useState<Record<string, number>>({});
  const [outroCrossfades, setOutroCrossfades] = useState<Record<string, number>>({});
  const [useIntros, setUseIntros] = useState(true);
  const [useOutros, setUseOutros] = useState(true);
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
  const [exportProgress, setExportProgress] = useState<number | null>(null);

  const activeIntros = useIntros ? intros : [];
  const activeOutros = useOutros ? outros : [];

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
    setUploadCount(files.length);
    setSegments([]);
    setSegmentStatus({});
    setProcessedIdMap({});
    setSegmentTrims({});
    setExpandedId(null);
    setStatus('');
    setExportProgress(null);

    let uploaded: UploadedClientFile[];
    try {
      uploaded = await uploadFiles(files);
    } catch (err) {
      setUploadPhase('idle');
      setStatus(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return;
    }
    const sorted = uploaded.sort((a, b) => a.originalName.localeCompare(b.originalName, undefined, { numeric: true }));
    setSegments(sorted);
    setUploadPhase('done');

    const initialStatus: Record<string, SegmentProcStatus> = {};
    sorted.forEach((s) => { initialStatus[s.id] = 'processing'; });
    setSegmentStatus(initialStatus);

    for (const seg of sorted) {
      try {
        const processedId = await preprocessAudio(seg.id);
        setProcessedIdMap((prev) => ({ ...prev, [seg.id]: processedId }));
        setSegmentStatus((prev) => ({ ...prev, [seg.id]: 'done' }));
      } catch {
        setSegmentStatus((prev) => ({ ...prev, [seg.id]: 'error' }));
      }
    }
  };

  const handleIntroFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setIntroUploadPhase('uploading');
    setIntroUploadCount(files.length);
    setExpandedIntroId(null);
    try {
      const uploaded = await uploadFiles(files);
      setIntros(uploaded.sort((a, b) => a.originalName.localeCompare(b.originalName, undefined, { numeric: true })));
    } finally {
      setIntroUploadPhase('idle');
    }
  };

  const handleOutroFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setOutroUploadPhase('uploading');
    setOutroUploadCount(files.length);
    setExpandedOutroId(null);
    try {
      const uploaded = await uploadFiles(files);
      setOutros(uploaded.sort((a, b) => a.originalName.localeCompare(b.originalName, undefined, { numeric: true })));
    } finally {
      setOutroUploadPhase('idle');
    }
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

  const runExport = async () => {
    if (!allReady) return;
    setStatus('Submitting batch…');
    setExportProgress(0);
    try {
      const remappedTrims: Record<string, SegmentTrim> = {};
      for (const seg of segments) {
        const pid = processedIdMap[seg.id];
        if (pid && segmentTrims[seg.id]) {
          remappedTrims[pid] = segmentTrims[seg.id];
        }
      }
      const jobId = await createBatchExport({
        segmentIds: segments.map((s) => processedIdMap[s.id] || s.id),
        segmentTrims: remappedTrims,
        introIds: activeIntros.map((i) => i.id),
        outroIds: activeOutros.map((o) => o.id),
        introCrossfades: activeIntros.map((i) => introCrossfades[i.id] ?? 0),
        outroCrossfades: activeOutros.map((o) => outroCrossfades[o.id] ?? 0),
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
      const downloadId = await poll(jobId, (msg, pct) => {
        setStatus(msg);
        setExportProgress(pct);
      });
      setExportProgress(100);
      window.location.href = `/api/replay/download/${downloadId}`;
      setStatus('Done');
    } catch (err) {
      setExportProgress(null);
      setStatus(`Error: ${err instanceof Error ? err.message : 'Export failed'}`);
    }
  };

  const RotationList = ({
    items,
    expandedId: expId,
    setExpandedId: setExpId,
    crossfadeMap,
    setCrossfadeMap,
    slotLabel
  }: {
    items: UploadedClientFile[];
    expandedId: string | null;
    setExpandedId: (id: string | null) => void;
    crossfadeMap: Record<string, number>;
    setCrossfadeMap: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    slotLabel: string;
  }) => (
    <ul className="intro-list">
      {items.map((item, i) => {
        const isExpanded = expId === item.id;
        return (
          <li key={item.id}>
            <div className="intro-row">
              <span className="intro-slot">{slotLabel} {i + 1}</span>
              <span className="intro-name">{item.originalName}</span>
              {crossfadeMap[item.id] > 0 && (
                <span className="cf-badge">{crossfadeMap[item.id]} ms</span>
              )}
              <button
                className={`segment-trim-toggle${isExpanded ? ' active' : ''}`}
                onClick={() => setExpId(isExpanded ? null : item.id)}
              >
                {isExpanded ? '▲ Close' : '▼ Preview'}
              </button>
            </div>
            {isExpanded && (
              <WaveformViewer
                audioUrl={`/api/audio/${item.id}`}
                previewOnly
                inPoint={0}
                outPoint={0}
                onInPointChange={() => {}}
                onOutPointChange={() => {}}
                crossfadeDuration={crossfadeMap[item.id] ?? 0}
                onCrossfadeDurationChange={(ms) =>
                  setCrossfadeMap((prev) => ({ ...prev, [item.id]: ms }))
                }
              />
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="stack">
      <div>
        <h1>Batch Replay Packager</h1>
        <p className="page-tagline">Upload your raw radio talk breaks, assign intros and outros, set crossfade timing, and export a broadcast-ready ZIP of labelled MP3 files in one click.</p>
      </div>

      <section className="panel stack">
        <label>
          Raw Segment Files
          <input type="file" accept="audio/*" multiple onChange={(e) => handleSegmentFiles(e.target.files)} />
          {uploadPhase === 'uploading' && <span className="upload-indicator">Uploading {uploadCount} file{uploadCount !== 1 ? 's' : ''}…</span>}
        </label>

        <div className="stack" style={{ gap: '0.5rem' }}>
          <div className="rotation-header">
            <span className="rotation-label">Intro Rotation</span>
            <small style={{ color: '#AEA098' }}>Upload up to 3 for a slot 1/2/3 cycle</small>
            <button
              className={`rotation-toggle${useIntros ? ' active' : ''}`}
              onClick={() => setUseIntros((v) => !v)}
            >
              {useIntros ? 'On' : 'Off'}
            </button>
          </div>
          {useIntros && (
            <>
              <label style={{ marginTop: 0 }}>
                <input type="file" accept="audio/*" multiple onChange={(e) => handleIntroFiles(e.target.files)} />
                {introUploadPhase === 'uploading' && <span className="upload-indicator">Uploading {introUploadCount} file{introUploadCount !== 1 ? 's' : ''}…</span>}
              </label>
              {intros.length > 0 && (
                <RotationList
                  items={intros}
                  expandedId={expandedIntroId}
                  setExpandedId={setExpandedIntroId}
                  crossfadeMap={introCrossfades}
                  setCrossfadeMap={setIntroCrossfades}
                  slotLabel="Slot"
                />
              )}
            </>
          )}
        </div>

        <div className="stack" style={{ gap: '0.5rem' }}>
          <div className="rotation-header">
            <span className="rotation-label">Outro Rotation</span>
            <small style={{ color: '#AEA098' }}>Upload multiple for a cycling rotation</small>
            <button
              className={`rotation-toggle${useOutros ? ' active' : ''}`}
              onClick={() => setUseOutros((v) => !v)}
            >
              {useOutros ? 'On' : 'Off'}
            </button>
          </div>
          {useOutros && (
            <>
              <label style={{ marginTop: 0 }}>
                <input type="file" accept="audio/*" multiple onChange={(e) => handleOutroFiles(e.target.files)} />
                {outroUploadPhase === 'uploading' && <span className="upload-indicator">Uploading {outroUploadCount} file{outroUploadCount !== 1 ? 's' : ''}…</span>}
              </label>
              {outros.length > 0 && (
                <RotationList
                  items={outros}
                  expandedId={expandedOutroId}
                  setExpandedId={setExpandedOutroId}
                  crossfadeMap={outroCrossfades}
                  setCrossfadeMap={setOutroCrossfades}
                  slotLabel="Slot"
                />
              )}
            </>
          )}
        </div>
      </section>

      {segments.length > 0 && (
        <section className="panel">
          <h3>Segment Order (drag to reorder)</h3>
          <ul className="segment-list">
            {segments.map((segment, i) => {
              const st = segmentStatus[segment.id];
              const procId = processedIdMap[segment.id];
              const trim = segmentTrims[segment.id] ?? { inPoint: 0, outPoint: 0 };
              const isExpanded = expandedId === segment.id;
              const introSlot = activeIntros.length > 0 ? (i % activeIntros.length) + 1 : null;
              const outroSlot = activeOutros.length > 0 ? (i % activeOutros.length) + 1 : null;
              return (
                <li
                  key={segment.id}
                  draggable={!isExpanded}
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
                  {(introSlot !== null || outroSlot !== null) && (
                    <div className="segment-assignment">
                      {introSlot !== null && <span className="assign-badge intro-badge">Intro {introSlot}</span>}
                      {outroSlot !== null && <span className="assign-badge outro-badge">Outro {outroSlot}</span>}
                    </div>
                  )}
                  {isExpanded && procId && (
                    <WaveformViewer
                      audioUrl={`/api/audio/${procId}`}
                      inPoint={trim.inPoint ?? 0}
                      outPoint={trim.outPoint ?? 0}
                      onInPointChange={(v) => setTrim(segment.id, 'inPoint', v)}
                      onOutPointChange={(v) => setTrim(segment.id, 'outPoint', v)}
                    />
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

      <button className="button primary" disabled={!allReady || exportProgress !== null} onClick={runExport}>
        Export Batch as ZIP
      </button>

      {exportProgress !== null && (
        <div className="export-progress-wrap">
          <div className="export-progress-bar">
            <div className="export-progress-fill" style={{ width: `${exportProgress}%` }} />
          </div>
          <span className="export-progress-label">{status || 'Processing…'} ({exportProgress}%)</span>
        </div>
      )}
      {exportProgress === null && status && <p className="export-status-msg">{status}</p>}
    </div>
  );
}
