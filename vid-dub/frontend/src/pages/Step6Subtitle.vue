<template>
  <div class="max-w-2xl mx-auto px-6 py-10">
    <h2 class="text-2xl font-bold mb-1">Burn Subtitles</h2>
    <p class="text-gray-500 text-sm mb-8">Translated subtitle တွေကို video ပေါ်မှာ ထည့်မယ်</p>

    <button v-if="!done" @click="run" :disabled="loading"
      class="w-full py-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 rounded-xl font-medium text-sm transition-colors">
      {{ loading ? 'Burning subtitles...' : 'Add Subtitles' }}
    </button>

    <p v-if="error" class="text-red-400 text-sm mt-4">{{ error }}</p>

    <div v-if="done" class="mt-6 bg-emerald-900/30 border border-emerald-800 rounded-xl p-4 text-sm text-emerald-400 text-center">
      ✓ Subtitles burned — subtitled-video.mp4 ready
    </div>

    <div v-if="done" class="mt-4 text-right">
      <router-link to="/step7" class="inline-block px-6 py-2.5 bg-sky-600 hover:bg-sky-500 rounded-xl text-sm font-medium transition-colors">
        Next: Export →
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { api } from '../api/api.js';

const loading = ref(false);
const done = ref(false);
const error = ref('');

async function run() {
  loading.value = true;
  error.value = '';
  try {
    const res = await api.burnSubtitles();
    if (res.success) done.value = true;
    else error.value = res.error || 'Subtitle burn failed';
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
</script>
