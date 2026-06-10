<template>
  <div class="max-w-2xl mx-auto px-6 py-10">
    <h2 class="text-2xl font-bold mb-1">Generate Audio</h2>
    <p class="text-gray-500 text-sm mb-8">Speaker တစ်ယောက်စီကို voice သပ်သပ်စီနဲ့ Gemini TTS generate လုပ်မယ်</p>

    <button v-if="!done && !loading" @click="run"
      class="w-full py-3 bg-sky-600 hover:bg-sky-500 rounded-xl font-medium text-sm transition-colors">
      Generate Audio
    </button>

    <!-- Live progress -->
    <div v-if="loading" class="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div class="flex justify-between text-sm mb-3">
        <span class="text-gray-400">Generating segment {{ progress.current }} / {{ progress.total }}</span>
        <span class="text-sky-400">{{ progress.speaker }} → {{ progress.voice }}</span>
      </div>
      <div class="h-2 bg-gray-800 rounded-full overflow-hidden mb-3">
        <div class="h-full bg-sky-600 rounded-full transition-all duration-500"
          :style="{ width: progressPct + '%' }"></div>
      </div>
      <div class="space-y-1 max-h-48 overflow-y-auto">
        <div v-for="log in logs" :key="log.id" class="text-xs text-gray-500 flex gap-2">
          <span class="text-emerald-500">✓</span>
          <span>{{ log.text }}</span>
        </div>
      </div>
    </div>

    <p v-if="error" class="text-red-400 text-sm mt-4">{{ error }}</p>

    <div v-if="done" class="mt-6 bg-emerald-900/30 border border-emerald-800 rounded-xl p-4 text-sm text-emerald-400 text-center">
      ✓ Generated {{ progress.total }} audio segments
    </div>

    <div v-if="done" class="mt-4 text-right">
      <router-link to="/step5" class="inline-block px-6 py-2.5 bg-sky-600 hover:bg-sky-500 rounded-xl text-sm font-medium transition-colors">
        Next: Sync Audio →
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue';
import { api } from '../api/api.js';

const loading = ref(false);
const done = ref(false);
const error = ref('');
const progress = ref({ current: 0, total: 0, speaker: '', voice: '' });
const logs = ref([]);
let logId = 0;
let sse = null;

const progressPct = computed(() => {
  if (!progress.value.total) return 0;
  return Math.round((progress.value.current / progress.value.total) * 100);
});

function connectSSE() {
  sse = new EventSource(api.ttsProgressUrl());
  sse.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.status === 'done') {
      progress.value = { ...progress.value, current: data.total, total: data.total };
      loading.value = false;
      done.value = true;
      sse.close();
    } else if (data.status === 'error') {
      error.value = data.error;
      loading.value = false;
      sse.close();
    } else if (data.status === 'generating') {
      progress.value = data;
      logs.value.push({ id: logId++, text: `Seg ${data.current}/${data.total} · ${data.speaker} · ${data.voice}` });
    }
  };
  sse.onerror = () => {
    if (done.value) { sse.close(); return; }
  };
}

async function run() {
  loading.value = true;
  error.value = '';
  logs.value = [];
  progress.value = { current: 0, total: 0, speaker: '', voice: '' };

  connectSSE();

  try {
    const res = await api.generateAudio();
    if (!res.success && res.error) {
      error.value = res.error;
      loading.value = false;
      sse?.close();
    } else {
      progress.value.total = res.total;
    }
  } catch (e) {
    error.value = e.message;
    loading.value = false;
    sse?.close();
  }
}

onUnmounted(() => sse?.close());
</script>
