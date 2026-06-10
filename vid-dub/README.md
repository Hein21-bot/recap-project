# vid-dub

Video dubbing tool — transcribes a video's original audio, translates to Myanmar, generates Myanmar TTS voice with Gemini, and syncs it back to the video with burned subtitles.

## Pipeline

| Step | Page | Description |
|------|------|-------------|
| 0 | Upload | Upload MP4/MOV/MKV video |
| 1 | Transcribe | Gemini AI transcribes audio → timed segments |
| 2 | Translate | Gemini AI translates segments to Myanmar |
| 3 | *(edit)* | User reviews and edits translations |
| 4 | Audio | Gemini TTS generates Myanmar voice narration |
| 5 | Sync | FFmpeg replaces original audio with Myanmar dub |
| 6 | Subtitle | Burns Myanmar subtitles onto the video |
| 7 | Export | Download the finished MP4 |

## Stack

- **Backend** — Node.js + Express, port 3100
- **Frontend** — Vue 3 + Vite + TailwindCSS, port 5174
- **AI** — Gemini 2.5 Flash (transcription + translation), Gemini TTS (voice)
- **Rendering** — FFmpeg, Pango (Myanmar font), ImageMagick

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
PORT=3100
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload video file |
| POST | `/api/transcribe` | Transcribe audio → timed segments |
| POST | `/api/translate` | Translate segments to Myanmar |
| POST | `/api/tts` | Generate Myanmar TTS audio |
| POST | `/api/sync` | Sync dubbed audio to video |
| POST | `/api/subtitle` | Burn Myanmar subtitles |
| GET | `/api/export/download` | Download final MP4 |
| POST | `/api/reset` | Clear state and files |

## Project Structure

```
vid-dub/
├── backend/
│   ├── server.js
│   ├── src/
│   │   ├── api/           # upload, transcribe, translate, tts, sync, subtitle, export, reset
│   │   └── utils/         # state.js, ffmpeg.js
│   ├── uploads/           # uploaded input videos
│   └── output/            # intermediate files + final video
└── frontend/
    └── src/
        ├── pages/         # Step0Upload … Step7Export
        ├── api/api.js
        └── router/
```
