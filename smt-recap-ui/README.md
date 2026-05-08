# SMT Recap — Frontend

Vue 3 UI for the SMT Recap pipeline. Step-by-step interface with real-time log streaming via SSE.

## Requirements

- Node.js >= 18
- Backend running on `localhost:3000`

## Setup

```bash
npm install
npm run dev
# http://localhost:5173
```

## Build for Production

```bash
npm run build   # outputs to dist/
npm run preview
```

## Docker

```bash
# From SMT root directory
docker-compose up --build
```

## Pages

| Route | Description |
|-------|-------------|
| `/step/0` | Download YouTube video |
| `/step/1` | Generate + edit Myanmar script |
| `/step/2` | Select voice |
| `/step/3` | Select tone |
| `/step/4` | Format vocal script |
| `/step/5` | Generate audio |
| `/step/6` | Sync video + audio |
| `/step/7` | Add subtitles |
| `/step/8` | Export + preview + download |

## Tech Stack

- Vue 3 (Composition API)
- Vite
- Pinia
- Vue Router
- Tailwind CSS

## Project Structure

```
smt-recap-ui/
├── src/
│   ├── api/pipeline.js        # All backend API calls
│   ├── components/            # AppSidebar, LogStream, ProgressBar
│   ├── composables/useSSE.js  # SSE + polling fallback
│   ├── pages/                 # Step0–Step8 page components
│   ├── stores/                # pipeline.js, session.js
│   └── router.js
└── vite.config.js             # Dev proxy → localhost:3000
```
