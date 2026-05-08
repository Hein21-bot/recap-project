<template>
  <div class="max-w-2xl mx-auto px-6 py-10">
    <h2 class="text-2xl font-bold mb-1">Export</h2>
    <p class="text-gray-500 text-sm mb-8">Final video ကို export လုပ်ပြီး download ရယူပါ</p>

    <!-- Watermark input -->
    <div class="mb-5">
      <label class="block text-sm text-gray-400 mb-2">Watermark Text <span class="text-gray-600">(optional)</span></label>
      <input
        v-model="watermark"
        :disabled="done"
        placeholder="e.g. @SMT Recap"
        class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-sky-500 transition-colors disabled:opacity-40"
      />
    </div>

    <!-- Resolution picker -->
    <div class="flex gap-3 mb-6">
      <button
        v-for="r in resolutions" :key="r.value"
        @click="resolution = r.value"
        :disabled="done"
        class="flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all"
        :class="resolution === r.value
          ? 'border-sky-500 bg-sky-500/10 text-sky-400'
          : 'border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700'"
      >
        {{ r.label }}
      </button>
    </div>

    <button @click="run" :disabled="running || done"
      class="w-full py-3 rounded-xl text-sm font-medium transition-colors"
      :class="done ? 'bg-emerald-600 cursor-default' : 'bg-sky-600 hover:bg-sky-500 disabled:opacity-40'">
      {{ done ? "✓ Exported" : running ? "Exporting..." : `Export ${resolution}` }}
    </button>

    <p v-if="error" class="mt-4 text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-xl px-4 py-3">{{ error }}</p>

    <LogStream :logs="logs" :done="done" />

    <!-- Result card -->
    <div v-if="done && outputInfo" class="mt-6 bg-gray-900 border border-emerald-800/50 rounded-2xl p-5">
      <p class="font-semibold text-emerald-400 mb-3">✓ Video Ready</p>

      <!-- Preview player -->
      <video
        v-if="videoUrl"
        :src="videoUrl"
        controls
        class="w-full rounded-xl mb-4 bg-black"
        style="max-height: 420px;"
      />

      <div class="flex items-center justify-between mb-2">
        <p class="text-xs text-gray-500">{{ outputInfo.fileSize }} · {{ resolution }}</p>
        <button @click="api.downloadFinal()"
          class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-medium transition-colors">
          Download
        </button>
      </div>
      <p class="text-xs text-gray-600 truncate">{{ outputInfo.outputPath }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { api } from "@/api/pipeline.js";
import { useSSE, makeJobId } from "@/composables/useSSE.js";
import { usePipelineStore } from "@/stores/pipeline.js";
import LogStream from "@/components/LogStream.vue";

const store = usePipelineStore();
const { logs, done, result, connect, startPolling } = useSSE();
const running    = ref(false);
const resolution = ref("1080p");
const watermark  = ref("");
const outputInfo = ref(null);
const error      = ref("");

const videoUrl = computed(() => {
  if (!outputInfo.value?.outputPath) return null;
  return outputInfo.value.outputPath.replace(/^\.\/output/, "/output");
});

const resolutions = [
  { value: "1080p", label: "1080p" },
  { value: "4k",    label: "4K"    },
];

onMounted(async () => {
  const s = await api.getState();
  if (s.step8?.completed) {
    done.value       = true;
    outputInfo.value = { outputPath: s.step8.exportPath, fileSize: s.step8.fileSize };
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
  if (result.value?.outputPath) outputInfo.value = result.value;
  store.loadState();
});

async function run() {
  running.value = true;
  error.value   = "";
  const jobId = makeJobId();
  connect(jobId);
  await api.exportVideo(jobId, resolution.value, watermark.value);

  startPolling(async () => {
    const s = await api.getState();
    if (!s.step8?.completed) return null;
    return { success: true, outputPath: s.step8.exportPath, fileSize: s.step8.fileSize };
  });
}
</script>
