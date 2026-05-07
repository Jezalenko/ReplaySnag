export type ExportFormat = 'mp3' | 'wav';

export interface UploadedAudio {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface QuickExportRequest {
  sourceId: string;
  introId?: string;
  outroId?: string;
  inPoint?: number;
  outPoint?: number;
  trimSilence: boolean;
  fadeInSeconds?: number;
  fadeOutSeconds?: number;
  normalizeLoudness: boolean;
  sampleRate: number;
  outputFilename: string;
  format: ExportFormat;
  crossfadeDuration?: number;
  outroCrossfadeDuration?: number;
}

export interface BatchNamingConfig {
  template: string;
  show: string;
  startHour: string;
  segmentsPerHour: number;
  daypart?: string;
  date?: string;
}

export interface BatchDuplicationConfig {
  enabled: boolean;
  sourceHour: string;
  targetHour: string;
}

export interface SegmentTrim {
  inPoint?: number;
  outPoint?: number;
}

export interface BatchExportRequest {
  segmentIds: string[];
  segmentTrims?: Record<string, SegmentTrim>;
  introIds: string[];
  outroIds?: string[];
  sampleRate: number;
  trimSilence: boolean;
  normalizeLoudness: boolean;
  introCrossfades?: number[];
  outroCrossfades?: number[];
  naming: BatchNamingConfig;
  duplication: BatchDuplicationConfig;
  format: ExportFormat;
}

export interface ExportJobStatus {
  id: string;
  mode: 'quick' | 'batch';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  downloadId?: string;
  error?: string;
}
