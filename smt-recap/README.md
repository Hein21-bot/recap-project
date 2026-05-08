# SMT Recap — Backend

Myanmar AI Video Recap Pipeline. An 8-step Express API server that takes a YouTube video and produces a narrated, subtitled Myanmar-language recap video.

## Pipeline Steps

| Step | Endpoint | Description |
|------|----------|-------------|
| 0 | `POST /api/step/0/download` | Download YouTube video + transcript via yt-dlp |
| 1 | `POST /api/step/1/generate` | Generate Myanmar script with Gemini AI |
| 1 | `POST /api/step/1/save` | Save edited script |
| 2 | `POST /api/step/2/select` | Select TTS voice |
| 3 | `POST /api/step/3/select` | Select tone/mood |
| 4 | `POST /api/step/4/format-sync` | Format script with pause markers |
| 5 | `POST /api/step/5/generate` | Generate audio with Gemini TTS |
| 6 | `POST /api/step/6/sync` | Sync audio + video with ffmpeg |
| 7 | `POST /api/step/7/subtitles` | Burn Myanmar subtitles (Pango/HarfBuzz) |
| 8 | `POST /api/step/8/export` | Export final video (1080p / 4K) |

## Requirements

### System Dependencies (macOS)

```bash
brew install yt-dlp
brew install ffmpeg-full
brew install pango
brew install imagemagick
brew install python3
pip3 install Pillow
```

### PostgreSQL

```bash
brew install postgresql@14
brew services start postgresql@14
createdb smt_recap
```

### Node.js >= 18

## Setup

```bash
npm install
cp .env.example .env
# Add your GEMINI_API_KEY to .env
```

## Environment Variables

```env
GEMINI_API_KEY=your_gemini_api_key        # Required
DEFAULT_VOICE_NAME=Sadaltager
DB_HOST=localhost
DB_PORT=5432
DB_NAME=smt_recap
DB_USER=your_postgres_user
DB_PASSWORD=
PORT=3000
```

## Running

```bash
node server.js
# http://localhost:3000
```

## Docker

```bash
# From SMT root directory
docker-compose up --build
```

## Project Structure

```
smt-recap/
├── server.js              # Express API + SSE routes
├── src/
│   ├── steps/             # step3-script-generator.js, step4–step8
│   ├── utils/             # db.js, logger.js, file-helper.js
│   ├── config/            # voices.js
│   └── youtube-downloader.js
├── input/                 # Downloaded video
└── output/                # Generated audio, video, subtitles, exports
```

## Other Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/state?sessionId=` | Get pipeline state |
| `POST /api/reset` | Reset session and clear output |
| `GET /api/events/:jobId` | SSE real-time log stream |
| `GET /api/download?sessionId=` | Download exported video |
| `GET /output/*` | Static output file serving |
