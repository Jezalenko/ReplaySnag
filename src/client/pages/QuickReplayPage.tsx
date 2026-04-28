import { useMemo, useState } from 'react';
import { createQuickExport, getJobStatus, uploadFiles, UploadedClientFile } from '../components/api';
import { WaveformViewer } from '../components/WaveformViewer';

const poll = async (jobId: string, onUpdate: (message: string) => void): Promise<string> => {
  while (true) {
    const status = await getJobStatus(jobId);
    onUpdate(`${status.message} (${status.progress}%)`);
    if (status.status === 'completed' && status.downloadId) return status.downloadId;
    if (status.status === 'failed') throw new Error(status.error || 'Failed');
    await new Promise((r) => setTimeout(r, 1200));
  }
};

export function QuickReplayPage() {
  const [source, setSource] = useState<UploadedClientFile | null>(null);
  const [intro, setIntro] = useState<UploadedClientFile | null>(null);
  const [outro, setOutro] = useState<UploadedClientFile | null>(null);
  const [inPoint, setInPoint] = useState(0);
  const [outPoint, setOutPoint] = useState(0);
  const [trimSilence, setTrimSilence] = useState(true);
  const [normalizeLoudness, setNormalizeLoudness] = useState(true);
  const [fadeInSeconds, setFadeInSeconds] = useState(0);
  const [fadeOutSeconds, setFadeOutSeconds] = useState(0);
  const [format, setFormat] = useState<'mp3' | 'wav'>('mp3');
  const [sampleRate, setSampleRate] = useState(48000);
  const [outputFilename, setOutputFilename] = useState('Replay Export');
  const [status, setStatus] = useState('Idle');

  const sourceUrl = useMemo(() => (source ? `/api/audio/${source.id}` : ''), [source]);

  const onUpload = async (files: FileList | null, setter: (f: UploadedClientFile) => void) => {
    if (!files?.length) return;
    const uploaded = await uploadFiles(files);
    setter(uploaded[0]);
  };

  const runExport = async () => {
    if (!source) return;
    setStatus('Submitting export...');
    const jobId = await createQuickExport({
      sourceId: source.id,
      introId: intro?.id,
      outroId: outro?.id,
      inPoint,
      outPoint,
      trimSilence,
      fadeInSeconds,
      fadeOutSeconds,
      normalizeLoudness,
      sampleRate,
      format,
      outputFilename
    });
    const downloadId = await poll(jobId, setStatus);
    window.location.href = `/api/replay/download/${downloadId}`;
    setStatus('Done');
  };

  return (
    <div className="stack">
      <h1>Quick Replay</h1>
      <section className="panel stack">
        <label>Source Audio <input type="file" accept="audio/*" onChange={(e) => onUpload(e.target.files, setSource)} /></label>
        <label>Intro Asset (optional) <input type="file" accept="audio/*" onChange={(e) => onUpload(e.target.files, setIntro)} /></label>
        <label>Outro Asset (optional) <input type="file" accept="audio/*" onChange={(e) => onUpload(e.target.files, setOutro)} /></label>
      </section>

      {source && <WaveformViewer audioUrl={sourceUrl} inPoint={inPoint} outPoint={outPoint} onInPointChange={setInPoint} onOutPointChange={setOutPoint} />}

      <section className="panel grid two">
        <label><input type="checkbox" checked={trimSilence} onChange={(e) => setTrimSilence(e.target.checked)} /> Trim Silence</label>
        <label><input type="checkbox" checked={normalizeLoudness} onChange={(e) => setNormalizeLoudness(e.target.checked)} /> Loudness Normalization</label>
        <label>Fade In (seconds)<input type="number" min={0} step="0.1" value={fadeInSeconds} onChange={(e) => setFadeInSeconds(Number(e.target.value))} /></label>
        <label>Fade Out (seconds)<input type="number" min={0} step="0.1" value={fadeOutSeconds} onChange={(e) => setFadeOutSeconds(Number(e.target.value))} /></label>
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
        <label className="full">Output Filename<input type="text" value={outputFilename} onChange={(e) => setOutputFilename(e.target.value)} /></label>
      </section>

      <button className="button primary" onClick={runExport} disabled={!source}>Export Replay</button>
      <p>{status}</p>
    </div>
  );
}
