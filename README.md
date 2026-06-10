# SMT — Myanmar Video Tools

A collection of AI-powered video processing tools built for Myanmar content creators.

## Projects

| Project | Description | Port |
|---------|-------------|------|
| [smt-recap](./smt-recap/) | YouTube video → Myanmar narrated recap video | BE: 3000 |
| [smt-recap-ui](./smt-recap-ui/) | Vue.js frontend for smt-recap | FE: 5174 |
| [vid-dub](./vid-dub/) | Video dubbing — replace voice with Myanmar TTS | BE: 3100, FE: 5174 |
| [sub-swap](./sub-swap/) | Chinese subtitle video → blur Chinese + add Myanmar subtitle | BE: 3200, FE: 5173 |

## Requirements (all projects)

```bash
brew install ffmpeg-full pango imagemagick yt-dlp python3
pip3 install Pillow
```

Node.js >= 18, Gemini API key required for AI features.

## Docker (smt-recap only)

```bash
docker-compose up --build
```
