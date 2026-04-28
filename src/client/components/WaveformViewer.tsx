import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';

interface Props {
  audioUrl: string;
  inPoint: number;
  outPoint: number;
  onInPointChange: (value: number) => void;
  onOutPointChange: (value: number) => void;
}

export function WaveformViewer({ audioUrl, inPoint, outPoint, onInPointChange, onOutPointChange }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const waveRef = useRef<WaveSurfer | null>(null);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!hostRef.current) return;
    waveRef.current?.destroy();
    const wave = WaveSurfer.create({
      container: hostRef.current,
      waveColor: '#f59e0b66',
      progressColor: '#f59e0b',
      cursorColor: '#fb923c',
      barWidth: 2,
      height: 100,
      dragToSeek: true,
      url: audioUrl
    });
    wave.on('ready', () => {
      const d = wave.getDuration();
      setDuration(d);
      onOutPointChange(d);
    });
    waveRef.current = wave;
    return () => wave.destroy();
  }, [audioUrl, onOutPointChange]);

  const seek = (value: number) => {
    if (!waveRef.current || duration <= 0) return;
    waveRef.current.seekTo(value / duration);
  };

  return (
    <section className="panel">
      <h3>Waveform Editor</h3>
      <div ref={hostRef} />
      <div className="grid two">
        <label>
          In Point (sec)
          <input type="number" min={0} step="0.1" value={inPoint} onChange={(e) => onInPointChange(Number(e.target.value))} />
        </label>
        <label>
          Out Point (sec)
          <input type="number" min={0} step="0.1" value={outPoint} onChange={(e) => onOutPointChange(Number(e.target.value))} />
        </label>
      </div>
      <div className="grid two">
        <label>
          In Handle
          <input type="range" min={0} max={duration || 0} step="0.1" value={Math.min(inPoint, duration)} onChange={(e) => {
            const next = Number(e.target.value);
            onInPointChange(next);
            seek(next);
          }} />
        </label>
        <label>
          Out Handle
          <input type="range" min={0} max={duration || 0} step="0.1" value={Math.min(outPoint, duration)} onChange={(e) => {
            const next = Number(e.target.value);
            onOutPointChange(next);
            seek(next);
          }} />
        </label>
      </div>
    </section>
  );
}
