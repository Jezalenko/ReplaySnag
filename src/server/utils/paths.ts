import path from 'node:path';
import { mkdirSync } from 'node:fs';

const root = process.cwd();
export const dataDir = path.join(root, 'data');
export const uploadsDir = path.join(dataDir, 'uploads');
export const exportsDir = path.join(dataDir, 'exports');
export const workDir = path.join(dataDir, 'work');

[uploadsDir, exportsDir, workDir].forEach((dir) => mkdirSync(dir, { recursive: true }));
