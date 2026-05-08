<template>
  <div class="max-w-2xl mx-auto px-6 py-10">
    <div class="flex items-center justify-between mb-1">
      <h2 class="text-2xl font-bold">Download Video</h2>
      <button @click="resetPipeline"
        class="text-xs px-3 py-1.5 bg-red-900/50 hover:bg-red-800 border border-red-800 text-red-400 hover:text-red-300 rounded-lg transition-colors">
        🗑 New Video
      </button>
    </div>
    <p class="text-gray-500 text-sm mb-8">YouTube / Shorts URL ထည့်ပြီး ဒေါင်းလုဒ် လုပ်ပါ</p>

    <!-- URL input -->
    <div class="flex gap-3 mb-4">
      <input
        v-model="url"
        @keyup.enter="preview"
        placeholder="https://youtube.com/shorts/..."
        class="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-sky-500 transition-colors"
      />
      <button @click="preview" :disabled="!url || previewing || done"
        class="px-5 py-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 rounded-xl text-sm font-medium transition-colors">
        Preview
      </button>
    </div>

    <!-- Video info card -->
    <div v-if="info" class="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6 flex gap-4">
      <img v-if="info.thumbnail" :src="info.thumbnail" class="w-24 h-24 object-cover rounded-xl shrink-0" />
      <div class="min-w-0">
        <p class="font-semibold truncate">{{ info.title }}</p>
        <p class="text-sm text-gray-500 mt-1">{{ info.author }} · {{ fmtDuration(info.duration) }}</p>
      </div>
    </div>

    <!-- Error -->
    <p v-if="error" class="text-red-400 text-sm mb-4">{{ error }}</p>

    <!-- Download button — hidden when done -->
    <button
      v-if="info && !done"
      @click="download"
      :disabled="downloading"
      class="w-full py-3 rounded-xl font-medium text-sm transition-colors bg-sky-600 hover:bg-sky-500 disabled:opacity-40"
    >
      {{ downloading ? "Downloading..." : "Download" }}
    </button>

    <!-- Done state -->
    <div v-if="done" class="bg-emerald-900/30 border border-emerald-800 rounded-xl p-4 text-sm text-emerald-400 text-center">
      ✓ Downloaded
    </div>

    <!-- Next -->
    <div v-if="done" class="mt-6 text-right">
      <router-link to="/step/2"
        class="inline-block px-6 py-2.5 bg-sky-600 hover:bg-sky-500 rounded-xl text-sm font-medium transition-colors">
        Next: Select Voice →
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { api } from "@/api/pipeline.js";
import { usePipelineStore } from "@/stores/pipeline.js";

const store       = usePipelineStore();
const router      = useRouter();
const url         = ref("");
const info        = ref(null);
const error       = ref("");
const previewing  = ref(false);
const downloading = ref(false);
const done        = ref(false);
let   downloadPoll = null;

onMounted(async () => {
  const s = await api.getState();
  if (s.step0?.completed) done.value = true;
});

async function preview() {
  if (!url.value) return;
  previewing.value = true;
  error.value = "";
  info.value  = null;
  try {
    const data = await api.getVideoInfo(url.value);
    if (data.error) throw new Error(data.error);
    info.value = data;
  } catch (e) {
    error.value = e.message;
  } finally {
    previewing.value = false;
  }
}

async function download() {
  downloading.value = true;
  error.value = "";

  try {
    await api.download(url.value, "job-" + Date.now());
  } catch (_) {}

  // Poll every 2s until DB confirms done
  downloadPoll = setInterval(async () => {
    try {
      const s = await api.getState();
      if (s.step0?.completed) {
        clearInterval(downloadPoll);
        downloadPoll = null;
        downloading.value = false;
        done.value = true;
        store.loadState();
      }
    } catch (_) {}
  }, 2000);
}

onUnmounted(() => {
  if (downloadPoll) clearInterval(downloadPoll);
});

async function resetPipeline() {
  await api.reset();
  await store.loadState();
  url.value         = "";
  info.value        = null;
  error.value       = "";
  done.value        = false;
  downloading.value = false;
  router.push("/step/0");
}

function fmtDuration(s) {
  if (!s) return "";
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}
</script>
