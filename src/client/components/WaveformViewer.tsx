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

  const outPointRef = useRef(outPoint);
  outPointRef.current = outPoint;
  const onOutPointChangeRef = useRef(onOutPointChange);
  onOutPointChangeRef.current = onOutPointChange;

  useEffect(() => {
    if (!hostRef.current) return;
    waveRef.current?.destroy();
    const wave = WaveSurfer.create({
      container: hostRef.current,
      waveColor: '#F5781E66',
      progressColor: '#F5781E',
      cursorColor: '#F6B01A',
      barWidth: 2,
      height: 80,
      dragToSeek: true,
      url: audioUrl
    });
    wave.on('ready', () => {
      const d = wave.getDuration();
      setDuration(d);
      if (outPointRef.current === 0) {
        onOutPointChangeRef.current(d);
      }
    });
    waveRef.current = wave;
    return () => wave.destroy();
  }, [audioUrl]);

  const seek = (value: number) => {
    if (!waveRef.current || duration <= 0) return;
    waveRef.current.seekTo(value / duration);
  };

  return (
    <div className="waveform-editor">
      <div ref={hostRef} style={{ marginBottom: '0.75rem' }} />
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
    </div>
  );
}
