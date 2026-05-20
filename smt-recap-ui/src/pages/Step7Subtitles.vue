<template>
  <div class="max-w-2xl mx-auto px-6 py-10">
    <h2 class="text-2xl font-bold mb-1">Add Subtitles</h2>
    <p class="text-gray-500 text-sm mb-8">Myanmar စာတန်းထိုး ထည့်မည် (Pango render)</p>

    <button @click="run" :disabled="running || done"
      class="w-full py-3 rounded-xl text-sm font-medium transition-colors"
      :class="done ? 'bg-emerald-600 cursor-default' : 'bg-sky-600 hover:bg-sky-500 disabled:opacity-40'">
      {{ done ? "✓ Subtitles Added" : running ? "Processing..." : "Add Subtitles" }}
    </button>

    <p v-if="error" class="mt-4 text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-xl px-4 py-3">{{ error }}</p>

    <LogStream :logs="logs" :done="done" />

    <div v-if="done && !error" class="mt-6 text-right">
      <router-link to="/step/8"
        class="inline-block px-6 py-2.5 bg-sky-600 hover:bg-sky-500 rounded-xl text-sm font-medium transition-colors">
        Next: Export →
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
const error   = ref("");

onMounted(async () => {
  const s = await api.getState();
  if (s.step7?.completed) done.value = true;
});

watch(done, (isDone) => {
  if (!isDone) return;
  running.value = false;
  if (result.value?.error) {
    error.value = result.value.error;
    return;
  }
  error.value = "";
  store.loadState();
});

async function run() {
  running.value = true;
  error.value   = "";
  const jobId = makeJobId();
  connect(jobId);
  await api.addSubtitles(jobId);

  startPolling(async () => {
    const s = await api.getState();
    if (!s.step7?.completed) return null;
    return { success: true };
  });
}
</script>
