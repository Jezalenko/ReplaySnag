# ReplaySnag

ReplaySnag is a browser-based radio replay packaging tool for turning raw talk breaks into replay-ready, playout-ready files in minutes.

## Problem ReplaySnag Solves

Legacy radio replay workflows are often shell scripts glued together with ffmpeg. ReplaySnag replaces that with a UI + API workflow that keeps the same production DNA:

- clean raw breaks quickly
- package with intro and outro assets
- export with station naming conventions
- run batch jobs with progress and one download

## Product Modes

### 1) Quick Replay (`/quick`)

Single-file workflow for one-off replay exports:

- upload one source file
- waveform playback/scrub
- set in/out points (fields + slider handles)
- optional silence trim
- optional intro/outro
- optional fade in/out
- loudness normalization (enabled by default)
- export MP3 (plus WAV option)

### 2) Batch Replay Packager (`/batch`)

Batch workflow designed to replace a manual broadcast packaging script:

- upload multiple raw segments
- auto-sort + drag/drop reorder
- upload intro rotation assets (legacy 1/2/3 cycle supported via modulo)
- choose one shared outro
- select common sample rate
- trim silence on talk breaks
- naming template with tokens (`{show}`, `{hour}`, `{segment}`, `{title}`, `{daypart}`, `{date}`)
- optional duplicate/remap into another hour token (ex: `1AM` -> `3AM`)
- export full batch as ZIP with progress polling

## API (MVP)

- `POST /api/audio/upload`
- `GET /api/audio/:id`
- `POST /api/replay/export`
- `POST /api/replay/batch-export`
- `GET /api/replay/export-status/:id`
- `GET /api/replay/download/:id`

## Local Setup

### Prerequisites

- Node.js 20+
- npm 10+
- ffmpeg installed and available on PATH

### Install

```bash
npm install
```

### Run dev mode (frontend + backend)

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

### Type checks

```bash
npm run check
```

### Production build + run

```bash
npm run build
npm run start
```

## Scripts

- `npm run dev` - start Vite and Express in parallel
- `npm run build` - build frontend and backend
- `npm run start` - run compiled backend (serves API)
- `npm run check` - TypeScript checks for client and server

## Environment

See `.env.example`:

- `PORT` - backend HTTP port (default 3001)

## Architecture Notes

- **Frontend**: React + Vite + React Router (`src/client`)
- **Backend**: Express + multer + ffmpeg pipeline (`src/server`)
- **Shared Types**: shared request/response contracts (`src/shared`)
- **Storage**:
  - uploaded originals: `data/uploads`
  - exports: `data/exports`
  - temp run dirs: `data/work`

The structure is set up for future presets, station rules, transcript-assisted workflows, and account-backed storage.

## Current MVP Scope

Included:

- Quick Replay export pipeline
- Batch Replay Packager pipeline
- intro rotation by slot index (`i % introCount`)
- shared outro
- silence trim + resample + loudness normalization
- broadcast naming template tokens
- optional hour remap duplication
- ZIP download for batch outputs

Known limitations:

- job status is in-memory (not persistent across server restarts)
- progress updates are polling-based (not SSE)
- no user auth/accounts yet

## Roadmap Ideas

- saved station/show presets
- saved intro/outro profile templates
- transcript-assisted trim suggestions
- transcript search
- show-log imports
- cutting multiple replays from long-form recordings
- account/project storage integration
