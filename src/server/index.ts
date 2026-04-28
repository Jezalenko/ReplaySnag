import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import { nanoid } from 'nanoid';
import sanitizeFilename from 'sanitize-filename';
import type { BatchExportRequest, ExportJobStatus, QuickExportRequest, UploadedAudio } from '../shared/types.js';
import { cleanDanglingManifestEntries, getUpload, saveUpload } from './utils/storage.js';
import { exportsDir, uploadsDir } from './utils/paths.js';
import { createJob, getJob, updateJob } from './services/jobStore.js';
import { exportBatch, exportQuick } from './services/audioPipeline.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.bin';
    cb(null, `${nanoid()}-${sanitizeFilename(path.basename(file.originalname, ext))}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }
});

app.post('/api/audio/upload', upload.array('files', 30), async (req, res) => {
  const files = req.files as Express.Multer.File[];
  if (!files?.length) return res.status(400).json({ error: 'No files uploaded' });

  const saved: UploadedAudio[] = [];
  for (const file of files) {
    const record: UploadedAudio = {
      id: nanoid(),
      originalName: file.originalname,
      storedName: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      createdAt: new Date().toISOString()
    };
    await saveUpload(record);
    saved.push(record);
  }

  res.json({ files: saved });
});

app.get('/api/audio/:id', async (req, res) => {
  const file = await getUpload(req.params.id);
  if (!file) return res.status(404).json({ error: 'Audio not found' });
  return res.sendFile(path.join(uploadsDir, file.storedName));
});

app.post('/api/replay/export', async (req, res) => {
  const payload = req.body as QuickExportRequest;
  const jobId = nanoid();
  const job: ExportJobStatus = {
    id: jobId,
    mode: 'quick',
    status: 'queued',
    progress: 0,
    message: 'Queued'
  };
  createJob(job);
  res.json({ jobId });

  updateJob(jobId, { status: 'processing', message: 'Starting quick export', progress: 5 });
  try {
    const file = await exportQuick(payload, (progress, message) => updateJob(jobId, { progress, message }));
    updateJob(jobId, { status: 'completed', progress: 100, message: 'Complete', downloadId: file });
  } catch (error) {
    updateJob(jobId, {
      status: 'failed',
      message: 'Export failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/replay/batch-export', async (req, res) => {
  const payload = req.body as BatchExportRequest;
  const jobId = nanoid();
  createJob({
    id: jobId,
    mode: 'batch',
    status: 'queued',
    progress: 0,
    message: 'Queued'
  });
  res.json({ jobId });

  updateJob(jobId, { status: 'processing', message: 'Starting batch export', progress: 5 });
  try {
    const file = await exportBatch(payload, (progress, message) => updateJob(jobId, { progress, message }));
    updateJob(jobId, { status: 'completed', progress: 100, message: 'Complete', downloadId: file });
  } catch (error) {
    updateJob(jobId, {
      status: 'failed',
      message: 'Batch export failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/replay/export-status/:id', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  return res.json(job);
});

app.get('/api/replay/download/:id', (req, res) => {
  const fullPath = path.join(exportsDir, req.params.id);
  return res.download(fullPath);
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, product: 'ReplaySnag' });
});

const port = Number.parseInt(process.env.PORT ?? '3001', 10);
cleanDanglingManifestEntries().catch(() => null);
app.listen(port, () => {
  console.log(`ReplaySnag backend running on http://localhost:${port}`);
});
