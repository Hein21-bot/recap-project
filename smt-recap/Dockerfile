FROM node:20-slim

RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    pango1.0-tools \
    imagemagick \
    curl \
    fonts-noto \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# yt-dlp
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    -o /usr/local/bin/yt-dlp && chmod +x /usr/local/bin/yt-dlp

# Python dependencies: subtitle detection + forced alignment
RUN pip3 install --break-system-packages \
    Pillow \
    ctc-forced-aligner \
    torch \
    torchaudio \
    librosa \
    unidecode \
    numpy

# Symlinks to match hardcoded macOS paths in source
RUN mkdir -p /opt/homebrew/bin /opt/homebrew/Cellar/ffmpeg-full/8.1.1/bin && \
    ln -sf /usr/bin/ffmpeg  /opt/homebrew/Cellar/ffmpeg-full/8.1.1/bin/ffmpeg && \
    ln -sf /usr/bin/ffprobe /opt/homebrew/Cellar/ffmpeg-full/8.1.1/bin/ffprobe && \
    ln -sf /usr/bin/ffmpeg  /opt/homebrew/bin/ffmpeg && \
    ln -sf /usr/bin/ffprobe /opt/homebrew/bin/ffprobe && \
    ln -sf /usr/local/bin/yt-dlp   /opt/homebrew/bin/yt-dlp && \
    ln -sf /usr/bin/pango-view     /opt/homebrew/bin/pango-view && \
    ln -sf /usr/bin/convert        /opt/homebrew/bin/convert && \
    ln -sf /usr/bin/python3        /opt/homebrew/bin/python3

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

RUN mkdir -p input output/audio output/video output/subtitles output/final output/exports

EXPOSE 3000
CMD ["node", "server.js"]
