/* SMT Recap — Step-by-step pipeline controller */

const $ = (id) => document.getElementById(id);

// ── State ────────────────────────────────────────────────────────────────────
const state = {
  currentStep: 0,
  completedSteps: new Set(),
  jobId: null,
  voice: "sadaltager",
  tone: "knowledge",
  resolution: "1080p",
  sse: null,
};

const STEPS = [
  { label: "Download Video" },
  { label: "Generate Script" },
  { label: "Select Voice" },
  { label: "Set Tone" },
  { label: "Vocal Format" },
  { label: "Generate Audio" },
  { label: "Sync Video" },
  { label: "Add Subtitles" },
  { label: "Export" },
];

// ── Sidebar ──────────────────────────────────────────────────────────────────
function renderSidebar() {
  const container = $("sidebar-steps");
  container.innerHTML = STEPS.map((s, i) => {
    const cls = i === state.currentStep ? "active"
              : state.completedSteps.has(i) ? "done"
              : "pending";
    const icon = state.completedSteps.has(i) ? "✓" : i;
    return `<div class="step-item ${cls}">
      <div class="step-icon">${icon}</div>
      <div class="step-label">${s.label}</div>
    </div>`;
  }).join("");
}

// ── Navigation ────────────────────────────────────────────────────────────────
function goToStep(n) {
  document.querySelectorAll(".step-panel").forEach(p => p.classList.remove("active"));
  $(`panel-${n}`).classList.add("active");
  state.currentStep = n;
  renderSidebar();
}

function markDone(n) {
  state.completedSteps.add(n);
  renderSidebar();
}

// ── SSE helpers ───────────────────────────────────────────────────────────────
function newJobId() {
  state.jobId = Date.now().toString();
  return state.jobId;
}

function connectSSE(jobId, onDone) {
  if (state.sse) state.sse.close();
  const es = new EventSource(`/api/events/${jobId}`);
  state.sse = es;
  es.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === "log")      appendLog(msg.logBox || currentLogBox(), msg.message);
    if (msg.type === "progress") updateProgress(msg.percent);
    if (msg.type === "done") {
      es.close();
      onDone(msg);
    }
  };
}

let _currentLogBox = "log-0";
function currentLogBox() { return _currentLogBox; }

function appendLog(boxId, message, cls = "") {
  const box = $(boxId);
  if (!box) return;
  box.style.display = "block";
  const line = document.createElement("div");
  line.className = "log-line" + (cls ? " " + cls : "");
  line.textContent = message;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

function clearLog(boxId) {
  const box = $(boxId);
  if (box) { box.innerHTML = ""; box.style.display = "block"; }
}

function updateProgress(percent) {
  const fill = $("dl-progress-fill");
  if (fill) fill.style.width = percent + "%";
}

// ── Step 0: Download ──────────────────────────────────────────────────────────
async function fetchVideoInfo() {
  const url = $("yt-url").value.trim();
  if (!url) return alert("YouTube URL ထည့်ပါ");

  try {
    const res = await fetch("/api/step/0/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const info = await res.json();
    if (info.error) return alert(info.error);

    $("video-preview-card").style.display = "block";
    $("video-thumb").src = info.thumbnail || "";
    $("video-title").textContent = info.title || "Unknown";
    $("video-info").textContent =
      [info.author, info.duration ? `${Math.floor(info.duration / 60)}m ${info.duration % 60}s` : ""].filter(Boolean).join(" · ");

    $("btn-download").disabled = false;
  } catch (err) {
    alert("Error: " + err.message);
  }
}

async function startDownload() {
  const url = $("yt-url").value.trim();
  if (!url) return;

  $("btn-download").disabled = true;
  $("dl-progress-bar").style.display = "block";
  clearLog("log-0");
  _currentLogBox = "log-0";

  const jobId = newJobId();
  connectSSE(jobId, (msg) => {
    if (msg.success) {
      appendLog("log-0", "✓ ဒေါင်းလုဒ်ပြီးပါပြီ", "success");
      markDone(0);
      setTimeout(() => goToStep(1), 800);
    } else {
      appendLog("log-0", "✗ Error: " + (msg.error || "Unknown"), "error");
      $("btn-download").disabled = false;
    }
  });

  await fetch("/api/step/0/download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, jobId }),
  });
}

// ── Step 1: Script ────────────────────────────────────────────────────────────
async function generateScript() {
  $("btn-gen-script").disabled = true;
  clearLog("log-1");
  _currentLogBox = "log-1";

  const jobId = newJobId();
  connectSSE(jobId, (msg) => {
    if (msg.success) {
      $("s1-before").style.display = "none";
      $("s1-result").style.display = "block";
      $("script-text").value = msg.script || "";
      updateWordCount(msg.wordCount);
      appendLog("log-1", "✓ Script ထုတ်ပြီးပါပြီ", "success");
    } else {
      appendLog("log-1", "✗ " + (msg.error || "Failed"), "error");
      $("btn-gen-script").disabled = false;
    }
  });

  await fetch("/api/step/1/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId }),
  });
}

function updateWordCount(count) {
  const el = $("script-word-count");
  const cls = (count >= 180 && count <= 220) ? "good" : "warn";
  el.className = "word-count " + cls;
  el.textContent = `${count} words ${count < 180 ? "— တိုနေသည်" : count > 220 ? "— ရှည်နေသည်" : "— ✓ ကောင်းသည်"}`;
}

// Live word count as user edits
document.addEventListener("DOMContentLoaded", () => {
  renderSidebar();
  $("yt-url").addEventListener("keydown", (e) => { if (e.key === "Enter") fetchVideoInfo(); });
  $("script-text").addEventListener("input", () => {
    const count = $("script-text").value.split(/\s+/).filter(Boolean).length;
    updateWordCount(count);
  });
});

async function confirmScript() {
  const script = $("script-text").value.trim();
  if (!script) return;

  await fetch("/api/step/1/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ script }),
  });

  markDone(1);
  goToStep(2);
}

function rerunStep(n) {
  if (n === 1) {
    $("s1-before").style.display = "block";
    $("s1-result").style.display = "none";
    $("btn-gen-script").disabled = false;
    clearLog("log-1");
  } else if (n === 4) {
    $("s4-before").style.display = "block";
    $("s4-result").style.display = "none";
    $("btn-format").disabled = false;
    clearLog("log-4");
  } else if (n === 5) {
    $("s5-before").style.display = "block";
    $("s5-result").style.display = "none";
    $("btn-audio").disabled = false;
    clearLog("log-5");
  } else if (n === 6) {
    $("s6-before").style.display = "block";
    $("s6-result").style.display = "none";
    $("btn-sync").disabled = false;
    clearLog("log-6");
  } else if (n === 7) {
    $("s7-before").style.display = "block";
    $("s7-result").style.display = "none";
    $("btn-subs").disabled = false;
    clearLog("log-7");
  }
}

// ── Step 2: Voice ─────────────────────────────────────────────────────────────
function selectVoice(el) {
  document.querySelectorAll(".select-card[data-voice]").forEach(c => c.classList.remove("selected"));
  el.classList.add("selected");
  state.voice = el.dataset.voice;
}

async function confirmVoice() {
  await fetch("/api/step/2/select", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ voiceKey: state.voice }),
  });
  markDone(2);
  goToStep(3);
}

// ── Step 3: Tone ──────────────────────────────────────────────────────────────
function selectTone(el) {
  document.querySelectorAll(".select-card[data-tone]").forEach(c => c.classList.remove("selected"));
  el.classList.add("selected");
  state.tone = el.dataset.tone;
}

async function confirmTone() {
  await fetch("/api/step/3/select", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tone: state.tone }),
  });
  markDone(3);
  goToStep(4);
}

// ── Step 4: Vocal Format ──────────────────────────────────────────────────────
async function formatVocal() {
  $("btn-format").disabled = true;
  clearLog("log-4");
  _currentLogBox = "log-4";

  const jobId = newJobId();
  connectSSE(jobId, (msg) => {
    if (msg.success) {
      $("s4-before").style.display = "none";
      $("s4-result").style.display = "block";
      $("formatted-text-display").textContent = msg.formattedText || "";
      markDone(4);
    } else {
      appendLog("log-4", "✗ " + (msg.error || "Failed"), "error");
      $("btn-format").disabled = false;
    }
  });

  await fetch("/api/step/4/format", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId }),
  });
}

// ── Step 5: Audio ─────────────────────────────────────────────────────────────
async function generateAudio() {
  $("btn-audio").disabled = true;
  clearLog("log-5");
  _currentLogBox = "log-5";
  appendLog("log-5", "Gemini TTS API ကိုဆက်သွယ်နေသည်... (1-2 minutes ကြာနိုင်သည်)");

  const jobId = newJobId();
  connectSSE(jobId, (msg) => {
    if (msg.success) {
      $("s5-before").style.display = "none";
      $("s5-result").style.display = "block";
      $("audio-player").src = "/" + msg.audioPath.replace("./", "");
      markDone(5);
    } else {
      appendLog("log-5", "✗ " + (msg.error || "Failed"), "error");
      $("btn-audio").disabled = false;
    }
  });

  await fetch("/api/step/5/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId }),
  });
}

// ── Step 6: Sync ──────────────────────────────────────────────────────────────
async function syncVideo() {
  $("btn-sync").disabled = true;
  clearLog("log-6");
  _currentLogBox = "log-6";

  const jobId = newJobId();
  connectSSE(jobId, (msg) => {
    if (msg.success) {
      $("s6-before").style.display = "none";
      $("s6-result").style.display = "block";
      $("video-dur").textContent = msg.videoDuration ? msg.videoDuration.toFixed(1) + "s" : "—";
      $("audio-dur").textContent = msg.audioDuration ? msg.audioDuration.toFixed(1) + "s" : "—";
      markDone(6);
    } else {
      appendLog("log-6", "✗ " + (msg.error || "Failed"), "error");
      $("btn-sync").disabled = false;
    }
  });

  await fetch("/api/step/6/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId }),
  });
}

// ── Step 7: Subtitles ─────────────────────────────────────────────────────────
async function addSubtitles() {
  $("btn-subs").disabled = true;
  clearLog("log-7");
  _currentLogBox = "log-7";

  const jobId = newJobId();
  connectSSE(jobId, (msg) => {
    if (msg.success) {
      $("s7-before").style.display = "none";
      $("s7-result").style.display = "block";
      $("srt-path").textContent = msg.srtPath || "";
      $("ass-path").textContent = msg.assPath || "";
      markDone(7);
    } else {
      appendLog("log-7", "✗ " + (msg.error || "Failed"), "error");
      $("btn-subs").disabled = false;
    }
  });

  await fetch("/api/step/7/subtitles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId }),
  });
}

// ── Step 8: Export ────────────────────────────────────────────────────────────
function selectRes(el) {
  document.querySelectorAll(".res-btn").forEach(b => b.classList.remove("selected"));
  el.classList.add("selected");
  state.resolution = el.dataset.res;
}

async function exportVideo() {
  $("btn-export").disabled = true;
  clearLog("log-8");
  _currentLogBox = "log-8";
  appendLog("log-8", `${state.resolution} ဖြင့် encoding လုပ်နေသည်... (ကြာနိုင်သည်)`);

  const jobId = newJobId();
  connectSSE(jobId, (msg) => {
    if (msg.success) {
      $("s8-before").style.display = "none";
      $("s8-result").style.display = "block";
      $("export-info").textContent = `${msg.outputPath} · ${msg.fileSize}`;
      markDone(8);
    } else {
      appendLog("log-8", "✗ " + (msg.error || "Failed"), "error");
      $("btn-export").disabled = false;
    }
  });

  await fetch("/api/step/8/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, resolution: state.resolution }),
  });
}
