<template>
  <div class="max-w-2xl mx-auto px-6 py-10">
    <h2 class="text-2xl font-bold mb-1">Sync Video</h2>
    <p class="text-gray-500 text-sm mb-8">ဗီဒီယိုနှင့် TTS အသံကို ပေါင်းစပ်မည်</p>

    <button @click="run" :disabled="running || done"
      class="w-full py-3 rounded-xl text-sm font-medium transition-colors"
      :class="done ? 'bg-emerald-600 cursor-default' : 'bg-sky-600 hover:bg-sky-500 disabled:opacity-40'">
      {{ done ? "✓ Video Synced" : running ? "Syncing..." : "Sync Video & Audio" }}
    </button>

    <p v-if="error" class="mt-4 text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-xl px-4 py-3">{{ error }}</p>

    <LogStream :logs="logs" :done="done" />

    <div v-if="info" class="mt-6 grid grid-cols-2 gap-4">
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
        <p class="text-xs text-gray-500 mb-1">Video Duration</p>
        <p class="text-xl font-bold text-sky-400">{{ info.videoDuration?.toFixed(1) }}s</p>
      </div>
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
        <p class="text-xs text-gray-500 mb-1">Audio Duration</p>
        <p class="text-xl font-bold text-emerald-400">{{ info.audioDuration?.toFixed(1) }}s</p>
      </div>
    </div>

    <div v-if="done" class="mt-6 text-right">
      <router-link to="/step/7"
        class="inline-block px-6 py-2.5 bg-sky-600 hover:bg-sky-500 rounded-xl text-sm font-medium transition-colors">
        Next: Add Subtitles →
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from "vue";
import { api } from "@/api/pipeline.js";
import { useSSE, makeJobId } from "@/composables/useSSE.js";
import { usePipelineStore } from "@/stores/pipeline.js";
import LogStream from "@/components/LogStream.vue";

const store = usePipelineStore();
const { logs, done, result, connect, startPolling } = useSSE();
const running = ref(false);
const info    = ref(null);
const error   = ref("");

onMounted(async () => {
  const s = await api.getState();
  if (s.step6?.completed) {
    done.value = true;
    info.value = { videoDuration: s.step6.videoDuration, audioDuration: s.step6.audioDuration };
  }
});

watch(done, (isDone) => {
  if (!isDone) return;
  running.value = false;
  if (result.value?.error) {
    error.value = result.value.error;
    return;
  }
  error.value = "";
  if (result.value?.videoDuration) info.value = result.value;
  store.loadState();
});

async function run() {
  running.value = true;
  error.value   = "";
  const jobId = makeJobId();
  connect(jobId);
  await api.syncVideo(jobId);

  startPolling(async () => {
    const s = await api.getState();
    if (!s.step6?.completed) return null;
    return { success: true, videoDuration: s.step6.videoDuration, audioDuration: s.step6.audioDuration };
  });
}
</script>
