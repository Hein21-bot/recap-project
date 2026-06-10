<template>
  <div class="max-w-2xl mx-auto px-6 py-10">
    <h2 class="text-2xl font-bold mb-1">Transcribe</h2>
    <p class="text-gray-500 text-sm mb-8">Gemini AI ဖြင့် Chinese audio ကို transcribe လုပ်မည်</p>

    <button v-if="!done && !loading" @click="run"
      class="w-full py-3 bg-sky-600 hover:bg-sky-500 rounded-xl font-medium text-sm transition-colors">
      Start Transcribe
    </button>

    <div v-if="loading" class="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
      <div class="flex justify-center mb-3">
        <svg class="animate-spin w-6 h-6 text-sky-400" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
      </div>
      <p class="text-gray-400 text-sm">Audio ထုတ်ပြီး Gemini ဆီ ပို့နေသည်... ခဏစောင့်ပါ</p>
    </div>

    <p v-if="error" class="text-red-400 text-sm mt-4">{{ error }}</p>

    <div v-if="done" class="mt-6 space-y-2 max-h-[500px] overflow-y-auto">
      <div v-for="(seg, i) in segments" :key="i"
        class="bg-gray-900 border border-gray-800 rounded-xl p-3 text-sm">
        <p class="text-xs text-gray-500 mb-1">{{ fmt(seg.start) }} → {{ fmt(seg.end) }}</p>
        <p class="text-gray-200">{{ seg.text }}</p>
      </div>
    </div>

    <div v-if="done" class="mt-6 bg-emerald-900/30 border border-emerald-800 rounded-xl p-4 text-sm text-emerald-400 text-center">
      ✓ {{ segments.length }} segments transcribed
    </div>

    <div v-if="done" class="mt-4 text-right">
      <router-link to="/step3"
        class="inline-block px-6 py-2.5 bg-sky-600 hover:bg-sky-500 rounded-xl text-sm font-medium transition-colors">
        Next: Translate →
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../api/api.js';

const loading  = ref(false);
const done     = ref(false);
const error    = ref('');
const segments = ref([]);

onMounted(async () => {
  const s = await api.getStatus();
  if (s.transcript?.length) {
    segments.value = s.transcript;
    done.value = true;
  }
});

function fmt(s) {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1);
  return `${m}:${String(sec).padStart(4, '0')}`;
}

async function run() {
  loading.value = true;
  error.value = '';
  try {
    const res = await api.transcribe();
    if (!res.success) throw new Error(res.error || 'Transcription မအောင်မြင်ပါ');
    segments.value = res.segments;
    done.value = true;
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
</script>
