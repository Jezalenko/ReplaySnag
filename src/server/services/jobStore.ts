import type { ExportJobStatus } from '../../shared/types.js';

const jobs = new Map<string, ExportJobStatus>();

export function createJob(job: ExportJobStatus): void {
  jobs.set(job.id, job);
}

export function updateJob(id: string, patch: Partial<ExportJobStatus>): void {
  const current = jobs.get(id);
  if (!current) return;
  jobs.set(id, { ...current, ...patch });
}

export function getJob(id: string): ExportJobStatus | undefined {
  return jobs.get(id);
}
