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
  generateAudio:   (jobId)        => post("/step/5/generate",    { jobId }),
  syncVideo:       (jobId)        => post("/step/6/sync",        { jobId }),
  addSubtitles:    (jobId)        => post("/step/7/subtitles",   { jobId }),
  exportVideo:     (jobId, res, watermark, thumbnailText) => post("/step/8/export", { jobId, resolution: res, watermark, thumbnailText }),
  downloadFinal:   ()             => window.open(`${BASE}/download?sessionId=${getSessionId()}`, "_blank"),
};
