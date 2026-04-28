# ReplaySnag

A browser-based radio replay packaging tool that automates turning raw radio talk breaks into broadcast-ready audio files.

## Architecture

- **Frontend**: React 18 + TypeScript + Vite (port 5000)
- **Backend**: Express + Node.js (port 3001)
- **Audio Processing**: FFmpeg
- **Routing**: React Router v6
- **Waveform Visualization**: Wavesurfer.js
- **File Handling**: Multer for uploads, Archiver for ZIP exports

## Project Structure

```
src/
  client/         # React frontend
    components/   # Reusable UI components (WaveformViewer, etc.)
    pages/        # HomePage, QuickReplayPage, BatchReplayPage
    App.tsx        # Root component with router setup
    main.tsx       # Entry point
  server/         # Express backend
    services/     # audioPipeline (FFmpeg), jobStore, naming
    utils/        # File system paths and storage management
    index.ts       # Main Express server entry
  shared/         # Shared TypeScript types (types.ts)
data/
  uploads/        # Raw uploaded audio files
  exports/        # Processed files ready for download
  work/           # Temporary processing directory
```

## Development

- `npm run dev` — Starts both frontend (Vite on port 5000) and backend (tsx watch on port 3001) concurrently
- `npm run build` — Builds client (Vite) and server (tsc) for production
- `npm start` — Runs the compiled production server

## API Endpoints

- `POST /api/audio/upload` — Upload audio files (up to 30 files, 500MB each)
- `GET /api/audio/:id` — Retrieve an uploaded audio file
- `POST /api/replay/export` — Start a quick single-file export job
- `POST /api/replay/batch-export` — Start a batch export job
- `GET /api/replay/export-status/:id` — Poll export job status
- `GET /api/replay/download/:id` — Download a completed export
- `GET /api/health` — Health check

## Deployment

- **Type**: Autoscale
- **Build**: `npm run build`
- **Run**: `node dist/server/index.js`
- The production server serves the built client from `dist/client` and runs the API
