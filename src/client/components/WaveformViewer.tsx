import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';

interface Props {
  audioUrl: string;
  inPoint: number;
  outPoint: number;
  onInPointChange: (value: number) => void;
  onOutPointChange: (value: number) => void;
  previewOnly?: boolean;
}

export function WaveformViewer({ audioUrl, inPoint, outPoint, onInPointChange, onOutPointChange, previewOnly }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const waveRef = useRef<WaveSurfer | null>(null);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);

  const outPointRef = useRef(outPoint);
  outPointRef.current = outPoint;
  const onOutPointChangeRef = useRef(onOutPointChange);
  onOutPointChangeRef.current = onOutPointChange;

  useEffect(() => {
    if (!hostRef.current) return;
    waveRef.current?.destroy();
    setPlaying(false);
    const wave = WaveSurfer.create({
      container: hostRef.current,
      waveColor: '#F5781E66',
      progressColor: '#F5781E',
      cursorColor: '#F6B01A',
      barWidth: 2,
      height: 80,
      dragToSeek: false,
      url: audioUrl
    });
    wave.on('ready', () => {
      const d = wave.getDuration();
      setDuration(d);
      if (!previewOnly && outPointRef.current === 0) {
        onOutPointChangeRef.current(d);
      }
    });
    wave.on('finish', () => setPlaying(false));
    waveRef.current = wave;
    return () => { wave.destroy(); };
  }, [audioUrl]);

  const seek = (value: number) => {
    if (!waveRef.current || duration <= 0) return;
    waveRef.current.seekTo(value / duration);
  };

  const togglePlay = () => {
    if (!waveRef.current) return;
    if (waveRef.current.isPlaying()) {
      waveRef.current.pause();
      setPlaying(false);
    } else {
      waveRef.current.play();
      setPlaying(true);
    }
  };

  const stopBubble = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div
      className="waveform-editor"
      onMouseDown={stopBubble}
      onPointerDown={stopBubble}
      onDragStart={stopBubble}
    >
      <div ref={hostRef} style={{ marginBottom: '0.75rem' }} />
      <button className="play-pause-btn" onClick={togglePlay} onMouseDown={stopBubble}>
        {playing ? '⏸ Pause' : '▶ Play'}
      </button>
      {!previewOnly && (
        <>
          <div className="grid two" style={{ marginTop: '0.75rem' }}>
            <label>
              In Point (sec)
              <input type="number" min={0} step="0.1" value={inPoint} onChange={(e) => onInPointChange(Number(e.target.value))} onMouseDown={stopBubble} onPointerDown={stopBubble} />
            </label>
            <label>
              Out Point (sec)
              <input type="number" min={0} step="0.1" value={outPoint} onChange={(e) => onOutPointChange(Number(e.target.value))} onMouseDown={stopBubble} onPointerDown={stopBubble} />
            </label>
          </div>
          <div className="grid two">
            <label>
              In Handle
              <input
                type="range"
                min={0}
                max={duration || 0}
                step="0.1"
                value={Math.min(inPoint, duration)}
                onMouseDown={stopBubble}
                onPointerDown={stopBubble}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  onInPointChange(next);
                  seek(next);
                }}
              />
            </label>
            <label>
              Out Handle
              <input
                type="range"
                min={0}
                max={duration || 0}
                step="0.1"
                value={Math.min(outPoint, duration)}
                onMouseDown={stopBubble}
                onPointerDown={stopBubble}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  onOutPointChange(next);
                  seek(next);
                }}
              />
            </label>
          </div>
        </>
      )}
    </div>
  );
}
