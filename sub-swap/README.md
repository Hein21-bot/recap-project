# sub-swap

Chinese subtitle video tool — blurs the original Chinese subtitle region and overlays a Myanmar subtitle translated by Gemini AI. Original audio is preserved with optional anti-detection processing.

## Pipeline

| Step | Page | Description |
|------|------|-------------|
| 0 | Upload | Upload MP4/MOV/MKV video (up to 500MB) |
| 1 | Region | Drag to select the Chinese subtitle area on a frame |
| 2 | Transcribe | Gemini AI transcribes the audio into timed segments |
| 3 | Translate | Gemini AI translates segments to Myanmar |
| 4 | Render | FFmpeg blurs Chinese subtitle + burns Myanmar subtitle |
| 5 | Export | Download the finished MP4 |

## Anti-Detection Options (Step 4)

| Option | Effect |
|--------|--------|
| Video Flip (Mirror) | Horizontal flip — changes visual fingerprint |
| Audio Speed +5% | `atempo=1.05` — changes audio fingerprint |
| Pitch Shift +4% | `asetrate` + `aresample` — changes pitch without noticeable speed change |

All three are on by default. Subtitles are added **after** the flip so text remains readable.

## Stack

- **Backend** — Node.js + Express, port 3200
- **Frontend** — Vue 3 + Vite + TailwindCSS, port 5173
- **AI** — Gemini 2.5 Flash (transcription + translation)
- **Rendering** — FFmpeg, Pango (Myanmar font), ImageMagick (drop shadow)

## Setup

### System dependencies (macOS)

```bash
brew install ffmpeg-full pango imagemagick
```

### Backend

```bash
cd backend
npm install
cp .env.example .env   # add GEMINI_API_KEY
node server.js
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

```env
GEMINI_API_KEY=your_gemini_api_key
PORT=3200
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload video file |
| GET | `/api/frame` | Extract frame + get video dimensions |
| POST | `/api/frame/region` | Save blur region `{x, y, w, h}` |
| POST | `/api/transcribe` | Transcribe audio → timed segments |
| POST | `/api/translate` | Translate all segments to Myanmar |
| PUT | `/api/translate/edit` | Save user-edited translations |
| POST | `/api/render` | Render output video with options |
| GET | `/api/export/download` | Download rendered MP4 |
| POST | `/api/reset` | Clear state and uploaded files |
| GET | `/api/status` | Get current pipeline state |

## Project Structure

```
sub-swap/
├── backend/
│   ├── server.js
│   ├── src/
│   │   ├── api/           # upload, frame, transcribe, translate, render, reset
│   │   └── utils/         # state.js, ffmpeg.js
│   ├── uploads/           # uploaded input videos
│   └── output/            # state.json + rendered output.mp4
└── frontend/
    └── src/
        ├── pages/         # Step0Upload … Step5Export
        ├── api/api.js
        └── router/
```
