import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';

interface Props {
  audioUrl: string;
  inPoint: number;
  outPoint: number;
  onInPointChange: (value: number) => void;
  onOutPointChange: (value: number) => void;
  previewOnly?: boolean;
  crossfadeDuration?: number;
  onCrossfadeDurationChange?: (ms: number) => void;
}

export function WaveformViewer({
  audioUrl,
  inPoint,
  outPoint,
  onInPointChange,
  onOutPointChange,
  previewOnly,
  crossfadeDuration,
  onCrossfadeDurationChange
}: Props) {
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
    setDuration(0);
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

  const cfDurSec = (crossfadeDuration ?? 0) / 1000;
  const cfPoint = duration > 0 ? Math.max(0, duration - cfDurSec) : duration;
  const cfMarkerPct = duration > 0 && cfDurSec > 0 ? (cfPoint / duration) * 100 : null;

  const handleCfSlider = (newPoint: number) => {
    if (!onCrossfadeDurationChange || duration <= 0) return;
    const durMs = Math.round((duration - newPoint) * 1000);
    onCrossfadeDurationChange(Math.max(0, durMs));
    seek(newPoint);
  };

  return (
    <div
      className="waveform-editor"
      onMouseDown={stopBubble}
      onPointerDown={stopBubble}
      onDragStart={stopBubble}
    >
      <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
        <div ref={hostRef} />
        {cfMarkerPct !== null && (
          <div className="cf-marker" style={{ left: `${cfMarkerPct}%` }} />
        )}
      </div>
      <button className="play-pause-btn" onClick={togglePlay} onMouseDown={stopBubble}>
        {playing ? '⏸ Pause' : '▶ Play'}
      </button>

      {previewOnly && onCrossfadeDurationChange && duration > 0 && (
        <div style={{ marginTop: '0.75rem' }}>
          <label>
            Crossfade Start
            <div className="crossfade-row">
              <input
                type="range"
                min={0}
                max={duration}
                step={0.05}
                value={cfPoint}
                onMouseDown={stopBubble}
                onPointerDown={stopBubble}
                onChange={(e) => handleCfSlider(Number(e.target.value))}
              />
              <span className="crossfade-value">
                {cfDurSec <= 0.01 ? 'Off' : `${cfDurSec.toFixed(1)} s`}
              </span>
            </div>
            <small>Drag left to set where this breaker crossfades into the segment.</small>
          </label>
        </div>
      )}

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
