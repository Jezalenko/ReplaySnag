import sanitizeFilename from 'sanitize-filename';
import { BatchNamingConfig } from '@shared/types';

function addHour(startHour: string, offset: number, segmentsPerHour: number): string {
  const hourNum = Number.parseInt(startHour, 10);
  if (Number.isNaN(hourNum)) return startHour;
  const hourDelta = Math.floor(offset / Math.max(segmentsPerHour, 1));
  const hour = ((hourNum + hourDelta - 1 + 24) % 24) + 1;
  return `${hour}AM`;
}

export function renderFilename(template: string, data: Record<string, string | number>): string {
  const rendered = template.replace(/\{(\w+)\}/g, (_, token: string) => String(data[token] ?? ''));
  return sanitizeFilename(rendered).replace(/\s+/g, ' ').trim();
}

export function buildBatchFilename(config: BatchNamingConfig, segmentIndex: number, title: string): string {
  const segment = segmentIndex + 1;
  const hour = addHour(config.startHour, segmentIndex, config.segmentsPerHour);
  return renderFilename(config.template, {
    show: config.show,
    hour,
    segment,
    title,
    daypart: config.daypart ?? '',
    date: config.date ?? new Date().toISOString().slice(0, 10)
  });
}

export function remapHour(name: string, sourceHour: string, targetHour: string): string {
  if (!sourceHour || !targetHour) return name;
  return name.replace(sourceHour, targetHour);
}
