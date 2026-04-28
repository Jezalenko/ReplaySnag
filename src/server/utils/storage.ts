import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { UploadedAudio } from '@shared/types';
import { uploadsDir } from './paths.js';

const manifestPath = path.join(uploadsDir, 'manifest.json');

async function readManifest(): Promise<Record<string, UploadedAudio>> {
  if (!existsSync(manifestPath)) return {};
  const raw = await readFile(manifestPath, 'utf8');
  return JSON.parse(raw) as Record<string, UploadedAudio>;
}

export async function saveUpload(file: UploadedAudio): Promise<void> {
  const manifest = await readManifest();
  manifest[file.id] = file;
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
}

export async function getUpload(id: string): Promise<UploadedAudio | undefined> {
  const manifest = await readManifest();
  return manifest[id];
}

export async function listUploads(): Promise<UploadedAudio[]> {
  const manifest = await readManifest();
  return Object.values(manifest);
}

export async function cleanDanglingManifestEntries(): Promise<void> {
  const manifest = await readManifest();
  const files = new Set(await readdir(uploadsDir));
  let dirty = false;
  for (const [id, entry] of Object.entries(manifest)) {
    if (!files.has(entry.storedName)) {
      delete manifest[id];
      dirty = true;
    }
  }
  if (dirty) {
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  }
}
