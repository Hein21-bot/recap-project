<template>
  <div class="max-w-2xl mx-auto px-6 py-10">
    <h2 class="text-2xl font-bold mb-1">Processing</h2>
    <p class="text-gray-500 text-sm mb-8">Step 4 မှ Step 7 အထိ အလိုအလျောက် run နေသည်...</p>

    <!-- Step cards -->
    <div class="space-y-3 mb-8">
      <div
        v-for="step in steps" :key="step.key"
        class="flex items-center gap-4 px-4 py-3 rounded-xl border transition-colors"
        :class="cardClass(step.status)"
      >
        <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
          :class="iconClass(step.status)">
          <svg v-if="step.status === 'done'" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <svg v-else-if="step.status === 'running'" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
          </svg>
          <svg v-else-if="step.status === 'error'" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span v-else class="w-2 h-2 rounded-full bg-gray-600 block"></span>
        </div>

        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium">{{ step.label }}</p>
          <p class="text-xs mt-0.5" :class="{
            'text-sky-400':    step.status === 'running',
            'text-emerald-400': step.status === 'done',
            'text-red-400':    step.status === 'error',
            'text-gray-600':   step.status === 'pending',
          }">
            {{ statusLabel(step) }}
          </p>
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-if="fatalError" class="bg-red-900/20 border border-red-800 rounded-xl px-4 py-3 text-red-400 text-sm">
      {{ fatalError }}
    </div>

    <!-- Done -->
    <div v-if="allDone" class="mt-8 text-right">
      <router-link to="/step/8"
        class="inline-block px-6 py-2.5 bg-sky-600 hover:bg-sky-500 rounded-xl text-sm font-medium transition-colors">
        Next: Export →
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { api } from "@/api/pipeline.js";
import { makeJobId } from "@/composables/useSSE.js";
import { usePipelineStore } from "@/stores/pipeline.js";

const store = usePipelineStore();

const steps = ref([
  { n: 4, key: "step4", label: "Format Vocal",  status: "pending", error: "" },
  { n: 5, key: "step5", label: "Generate Audio", status: "pending", error: "" },
  { n: 6, key: "step6", label: "Sync Video",     status: "pending", error: "" },
  { n: 7, key: "step7", label: "Add Subtitles",  status: "pending", error: "" },
]);

const fatalError = ref("");
const allDone    = computed(() => steps.value.every(s => s.status === "done"));
let   pollTimer  = null;

function setStatus(key, status, error = "") {
  const s = steps.value.find(s => s.key === key);
  if (s) { s.status = status; s.error = error; }
}

function statusLabel(step) {
  if (step.status === "running") return "Running...";
  if (step.status === "done")    return "Done";
  if (step.status === "error")   return step.error || "Error";
  return "Waiting...";
}

function cardClass(status) {
  if (status === "running") return "border-sky-700 bg-sky-500/5";
  if (status === "done")    return "border-emerald-800 bg-emerald-500/5";
  if (status === "error")   return "border-red-800 bg-red-500/5";
  return "border-gray-800 bg-gray-900";
}

function iconClass(status) {
  if (status === "running") return "bg-sky-500/20 text-sky-400";
  if (status === "done")    return "bg-emerald-500/20 text-emerald-400";
  if (status === "error")   return "bg-red-500/20 text-red-400";
  return "bg-gray-800 text-gray-600";
}

function pollUntilDone(key) {
  return new Promise((resolve, reject) => {
    pollTimer = setInterval(async () => {
      try {
        const s = await api.getState();
        if (s[key]?.completed) {
          clearInterval(pollTimer);
          pollTimer = null;
          resolve();
        }
      } catch (e) {
        clearInterval(pollTimer);
        pollTimer = null;
        reject(e);
      }
    }, 2000);
  });
}

async function runAll() {
  try {
    const state = await api.getState();

    // Step 4 — synchronous
    if (state.step4?.completed) {
      setStatus("step4", "done");
    } else {
      setStatus("step4", "running");
      const res = await api.formatVocal();
      if (res?.error) throw new Error(res.error);
      setStatus("step4", "done");
    }

    // Step 5
    if (state.step5?.completed) {
      setStatus("step5", "done");
    } else {
      setStatus("step5", "running");
      await api.generateAudio(makeJobId());
      await pollUntilDone("step5");
      setStatus("step5", "done");
    }

    // Step 6
    if (state.step6?.completed) {
      setStatus("step6", "done");
    } else {
      setStatus("step6", "running");
      await api.syncVideo(makeJobId());
      await pollUntilDone("step6");
      setStatus("step6", "done");
    }

    // Step 7
    if (state.step7?.completed) {
      setStatus("step7", "done");
    } else {
      setStatus("step7", "running");
      await api.addSubtitles(makeJobId());
      await pollUntilDone("step7");
      setStatus("step7", "done");
    }

    store.loadState();
  } catch (e) {
    fatalError.value = e.message;
  }
}

onMounted(runAll);
onUnmounted(() => { if (pollTimer) clearInterval(pollTimer); });
</script>
