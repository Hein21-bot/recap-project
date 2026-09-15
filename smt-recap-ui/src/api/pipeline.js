const BASE = "/api";

function getSessionId() {
  return localStorage.getItem("smt_session_id") || "default";
}

async function post(url, body = {}) {
  const res = await fetch(BASE + url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, sessionId: getSessionId() }),
  });
  return res.json();
}

async function get(url) {
  const res = await fetch(`${BASE}${url}?sessionId=${getSessionId()}`);
  return res.json();
}

export const api = {
  getState:        ()             => get("/state"),
  reset:           ()             => post("/reset"),
  getVideoInfo:    (url)          => post("/step/0/info",        { url }),
  download:        (url, jobId)   => post("/step/0/download",    { url, jobId }),
  generateScript:  (jobId)        => post("/step/1/generate",    { jobId }),
  saveScript:      (script)       => post("/step/1/save",        { script }),
  selectVoice:     (voiceKey)     => post("/step/2/select",      { voiceKey }),
  selectTone:      (tone)         => post("/step/3/select",      { tone }),
  formatVocal:     ()             => post("/step/4/format-sync", {}),
  generateAudio:   (jobId, provider) => post("/step/5/generate", { jobId, provider }),
  syncVideo:       (jobId)        => post("/step/6/sync",        { jobId }),
  framePreviewUrl: (t = 3)        => `${BASE}/step/frame?t=${t}&_=${Date.now()}`,
  getSubtitleRegion: ()          => get("/step/7/region"),
  saveSubtitleRegion: (region)   => post("/step/7/region",      { region }),
  getBlurRegions:  ()             => get("/step/7/blur-regions"),
  saveBlurRegions: (regions)      => post("/step/7/blur-regions", { regions }),
  addSubtitles:    (jobId)        => post("/step/7/subtitles",   { jobId }),
  getAssetImages:  ()             => get("/assets"),
  assetUrl:        (file)         => `/assets/${file}`,
  getWatermark:    ()             => get("/step/8/watermark"),
  saveWatermark:   (image, position, sizePct, paddingPct) => post("/step/8/watermark", { image, position, sizePct, paddingPct }),
  exportVideo:     (jobId, res, watermark, thumbnailText) => post("/step/8/export", { jobId, resolution: res, watermark, thumbnailText }),
  downloadFinal:   ()             => window.open(`${BASE}/download?sessionId=${getSessionId()}`, "_blank"),
};
