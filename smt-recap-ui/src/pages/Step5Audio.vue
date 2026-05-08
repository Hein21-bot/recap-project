<template>
  <div class="max-w-2xl mx-auto px-6 py-10">
    <h2 class="text-2xl font-bold mb-1">Generate Audio</h2>
    <p class="text-gray-500 text-sm mb-8">Gemini TTS ဖြင့် Myanmar AI narration အသံဖိုင် ထုတ်မည်</p>

    <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 text-sm text-gray-400">
      ℹ️ ဤ audio သည် original video ၏ အသံ <strong class="text-white">မဟုတ်ပါ</strong> —
      Step 1 မှ script ကို Gemini AI voice ဖြင့် ဖတ်ထားသော Myanmar narration ဖြစ်သည်။
    </div>

    <button @click="run" :disabled="running"
      class="w-full py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 mb-4"
      :class="running ? 'bg-sky-700 opacity-80 cursor-wait' : 'bg-sky-600 hover:bg-sky-500'">
      <svg v-if="running" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
      </svg>
      {{ running ? "Generating..." : done ? "Regenerate Audio" : "Generate Audio" }}
    </button>

    <p v-if="error" class="mt-4 text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-xl px-4 py-3">{{ error }}</p>

    <LogStream :logs="logs" :done="done" />

    <!-- Audio player — only shown after generating in this session -->
    <div v-if="audioReady" class="mt-6 bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <p class="text-sm text-gray-400 mb-1">🎙 AI Myanmar Narration</p>
      <audio controls class="w-full" :src="audioSrc" :key="audioKey" />
    </div>

    <div v-if="done" class="mt-6 text-right">
      <router-link to="/step/6"
        class="inline-block px-6 py-2.5 bg-sky-600 hover:bg-sky-500 rounded-xl text-sm font-medium transition-colors">
        Next: Sync Video →
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

const store     = usePipelineStore();
const { logs, done, result, connect, startPolling } = useSSE();
const running    = ref(false);
const audioSrc   = ref("/output/audio/narration.wav");
const audioKey   = ref(0);
const audioReady = ref(false);
const generated  = ref(false);
const error      = ref("");

onMounted(async () => {
  const s = await api.getState();
  if (s.step5?.completed) done.value = true;
});

watch(done, (isDone) => {
  if (!isDone) return;
  running.value = false;
  if (result.value?.error) {
    error.value = result.value.error;
    return;
  }
  error.value = "";
  if (generated.value) {
    audioSrc.value   = "/output/audio/narration.wav";
    audioKey.value++;
    audioReady.value = true;
  }
  store.loadState();
});

async function run() {
  running.value    = true;
  done.value       = false;
  audioReady.value = false;
  generated.value  = true;
  error.value      = "";
  const jobId = makeJobId();
  connect(jobId);
  await api.generateAudio(jobId);

  startPolling(async () => {
    const s = await api.getState();
    if (!s.step5?.completed) return null;
    return { success: true };
  });
}
</script>
