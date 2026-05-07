import { mkdir, rm } from 'node:fs/promises';
import { createWriteStream, existsSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import archiver from 'archiver';
import sanitizeFilename from 'sanitize-filename';
import { nanoid } from 'nanoid';
import type { BatchExportRequest, QuickExportRequest, UploadedAudio } from '../../shared/types.js';
import { exportsDir, uploadsDir, workDir } from '../utils/paths.js';
import { getUpload, saveUpload } from '../utils/storage.js';
import { buildBatchFilename, remapHour } from './naming.js';

function runFfmpeg(args: string[], onProgress?: (line: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', ['-y', ...args]);
    let stderr = '';
    proc.stderr.on('data', (d) => {
      const line = d.toString();
      stderr += line;
      onProgress?.(line);
    });
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(stderr || `ffmpeg failed ${code}`))));
    proc.on('error', reject);
  });
}

async function buildQuickCommand(config: QuickExportRequest, outputPath: string): Promise<string[]> {
  const source = await getUpload(config.sourceId);
  if (!source) throw new Error('Source audio file not found.');
  const inputs: string[] = ['-i', path.join(uploadsDir, source.storedName)];
  const pieces: string[] = [];
  const chains: string[] = [];
  let inputIndex = 0;

  const intro = config.introId ? await getUpload(config.introId) : undefined;
  if (intro) {
    inputs.push('-i', path.join(uploadsDir, intro.storedName));
  }
  const outro = config.outroId ? await getUpload(config.outroId) : undefined;
  if (outro) {
    inputs.push('-i', path.join(uploadsDir, outro.storedName));
  }

  const segmentFilters: string[] = [];
  const inPoint = config.inPoint ?? 0;
  const outPoint = config.outPoint ?? 0;
  const hasInPoint = inPoint > 0;
  const hasOutPoint = outPoint > 0 && outPoint > inPoint;
  if (hasInPoint || hasOutPoint) {
    const start = Math.max(0, inPoint);
    const end = hasOutPoint ? `:end=${outPoint}` : '';
    segmentFilters.push(`atrim=start=${start}${end}`, 'asetpts=PTS-STARTPTS');
  }
  if (config.trimSilence) {
    segmentFilters.push(
      'silenceremove=start_periods=1:start_silence=0.1:start_threshold=-45dB',
      'areverse',
      'silenceremove=start_periods=1:start_silence=0.1:start_threshold=-45dB',
      'areverse'
    );
  }

  if (intro) {
    inputIndex += 1;
    chains.push(`[${inputIndex}:a]aresample=${config.sampleRate},aformat=sample_fmts=fltp:channel_layouts=stereo[a_intro]`);
    pieces.push('[a_intro]');
  }

  chains.push(`[0:a]aresample=${config.sampleRate},aformat=sample_fmts=fltp:channel_layouts=stereo${segmentFilters.length ? ',' + segmentFilters.join(',') : ''}[a_segment]`);
  pieces.push('[a_segment]');

  if (outro) {
    inputIndex += 1;
    chains.push(`[${inputIndex}:a]aresample=${config.sampleRate},aformat=sample_fmts=fltp:channel_layouts=stereo[a_outro]`);
    pieces.push('[a_outro]');
  }

  const postFilters: string[] = [];
  if (config.fadeInSeconds && config.fadeInSeconds > 0) postFilters.push(`afade=t=in:st=0:d=${config.fadeInSeconds}`);
  if (config.fadeOutSeconds && config.fadeOutSeconds > 0) postFilters.push('areverse', `afade=t=in:st=0:d=${config.fadeOutSeconds}`, 'areverse');
  if (config.normalizeLoudness) postFilters.push('loudnorm=I=-16:LRA=7:TP=-1.5');

  if (postFilters.length) {
    chains.push(`${pieces.join('')}concat=n=${pieces.length}:v=0:a=1[a_joined]`);
    chains.push(`[a_joined]${postFilters.join(',')}[a_final]`);
  } else {
    chains.push(`${pieces.join('')}concat=n=${pieces.length}:v=0:a=1[a_final]`);
  }

  const codecArgs = config.format === 'wav' ? ['-c:a', 'pcm_s16le'] : ['-codec:a', 'libmp3lame', '-q:a', '2'];

  return [...inputs, '-filter_complex', chains.join(';'), '-map', '[a_final]', ...codecArgs, outputPath];
}

async function processSingleBatchSegment(
  segmentId: string,
  introId: string | undefined,
  outroId: string | undefined,
  sampleRate: number,
  trimSilence: boolean,
  normalizeLoudness: boolean,
  outputPath: string,
  trim?: { inPoint?: number; outPoint?: number }
): Promise<void> {
  const segment = await getUpload(segmentId);
  if (!segment) throw new Error(`Segment ${segmentId} not found`);
  const quick: QuickExportRequest = {
    sourceId: segmentId,
    introId,
    outroId,
    trimSilence,
    normalizeLoudness,
    sampleRate,
    outputFilename: outputPath,
    format: outputPath.endsWith('.wav') ? 'wav' : 'mp3',
    inPoint: trim?.inPoint,
    outPoint: trim?.outPoint
  };
  const args = await buildQuickCommand(quick, outputPath);
  await runFfmpeg(args);
}

export async function preprocessSegment(sourceId: string): Promise<string> {
  const source = await getUpload(sourceId);
  if (!source) throw new Error(`Upload ${sourceId} not found`);
  const newId = nanoid();
  const newStoredName = `${newId}-pre.mp3`;
  const outputPath = path.join(uploadsDir, newStoredName);
  const args = [
    '-i', path.join(uploadsDir, source.storedName),
    '-af', [
      'silenceremove=start_periods=1:start_silence=0.1:start_threshold=-45dB',
      'areverse',
      'silenceremove=start_periods=1:start_silence=0.1:start_threshold=-45dB',
      'areverse',
      'loudnorm=I=-16:LRA=7:TP=-1.5'
    ].join(','),
    '-codec:a', 'libmp3lame', '-q:a', '2',
    outputPath
  ];
  await runFfmpeg(args);
  const record: UploadedAudio = {
    id: newId,
    originalName: source.originalName,
    storedName: newStoredName,
    mimeType: 'audio/mpeg',
    size: 0,
    createdAt: new Date().toISOString()
  };
  await saveUpload(record);
  return newId;
}

export async function exportQuick(config: QuickExportRequest, onProgress?: (pct: number, message: string) => void): Promise<string> {
  const outputName = `${sanitizeFilename(config.outputFilename || 'replay')}.${config.format}`;
  const outputPath = path.join(exportsDir, `${nanoid()}-${outputName}`);
  onProgress?.(15, 'Preparing export pipeline');
  const args = await buildQuickCommand(config, outputPath);
  await runFfmpeg(args, () => onProgress?.(65, 'Processing audio'));
  onProgress?.(100, 'Replay export complete');
  return path.basename(outputPath);
}

export async function exportBatch(config: BatchExportRequest, onProgress?: (pct: number, message: string) => void): Promise<string> {
  const runId = nanoid();
  const runDir = path.join(workDir, runId);
  await mkdir(runDir, { recursive: true });
  try {
    const produced: string[] = [];
    for (let i = 0; i < config.segmentIds.length; i += 1) {
      const introId = config.introIds.length ? config.introIds[i % config.introIds.length] : undefined;
      const nameBase = buildBatchFilename(config.naming, i, `SEG ${i + 1}`) || `segment-${i + 1}`;
      const fileName = `${nameBase}.${config.format}`;
      const outPath = path.join(runDir, fileName);
      const trim = config.segmentTrims?.[config.segmentIds[i]];
      await processSingleBatchSegment(
        config.segmentIds[i],
        introId,
        config.outroId,
        config.sampleRate,
        config.trimSilence,
        config.normalizeLoudness,
        outPath,
        trim
      );
      produced.push(fileName);
      const progress = Math.round(((i + 1) / config.segmentIds.length) * 90);
      onProgress?.(progress, `Packaged ${i + 1}/${config.segmentIds.length} segments`);

      if (config.duplication.enabled) {
        const duplicateName = remapHour(fileName, config.duplication.sourceHour, config.duplication.targetHour);
        if (duplicateName !== fileName) {
          await processSingleBatchSegment(
            config.segmentIds[i],
            introId,
            config.outroId,
            config.sampleRate,
            config.trimSilence,
            config.normalizeLoudness,
            path.join(runDir, duplicateName),
            trim
          );
          produced.push(duplicateName);
        }
      }
    }

    const zipName = `${runId}-batch.zip`;
    const zipPath = path.join(exportsDir, zipName);
    await new Promise<void>((resolve, reject) => {
      const stream = createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      stream.on('close', () => resolve());
      archive.on('error', reject);
      archive.pipe(stream);
      produced.forEach((file) => archive.file(path.join(runDir, file), { name: file }));
      archive.finalize().catch(reject);
    });

    onProgress?.(100, 'Batch export complete');
    return zipName;
  } finally {
    if (existsSync(runDir)) {
      await rm(runDir, { recursive: true, force: true });
    }
  }
}
