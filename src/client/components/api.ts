import type { ExportJobStatus } from '../../shared/types';

export interface UploadedClientFile {
  id: string;
  originalName: string;
}

export async function uploadFiles(files: FileList | File[]): Promise<UploadedClientFile[]> {
  const form = new FormData();
  Array.from(files).forEach((file) => form.append('files', file));
  const res = await fetch('/api/audio/upload', { method: 'POST', body: form });
  if (!res.ok) throw new Error('Upload failed');
  const data = await res.json();
  return data.files;
}

export async function preprocessAudio(id: string): Promise<string> {
  const res = await fetch(`/api/audio/preprocess/${id}`, { method: 'POST' });
  if (!res.ok) throw new Error('Preprocessing failed');
  const data = await res.json();
  return data.processedId as string;
}

export async function createBatchExport(payload: unknown): Promise<string> {
  const res = await fetch('/api/replay/batch-export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  return data.jobId;
}

export async function getJobStatus(jobId: string): Promise<ExportJobStatus> {
  const res = await fetch(`/api/replay/export-status/${jobId}`);
  if (!res.ok) throw new Error('Failed to read job');
  return res.json();
}
