<template>
  <div class="max-w-2xl mx-auto px-6 py-10">
    <h2 class="text-2xl font-bold mb-1">Transcribe Audio</h2>
    <p class="text-gray-500 text-sm mb-8">Gemini နဲ့ Chinese audio ကို text ဖြုတ်ပြီး speaker detect လုပ်မယ်</p>

    <button v-if="!done" @click="run" :disabled="loading"
      class="w-full py-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 rounded-xl font-medium text-sm transition-colors">
      {{ loading ? 'Transcribing... (ခဏစောင့်ပါ)' : 'Start Transcribe' }}
    </button>

    <p v-if="error" class="text-red-400 text-sm mt-4">{{ error }}</p>

    <!-- Speaker summary -->
    <div v-if="speakerVoiceMap && Object.keys(speakerVoiceMap).length" class="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p class="text-sm font-medium mb-3">Detected Speakers — Auto Voice Assigned</p>
      <div class="flex flex-wrap gap-2">
        <div v-for="(voice, speaker) in speakerVoiceMap" :key="speaker"
          class="flex items-center gap-2 bg-gray-800 px-3 py-1.5 rounded-lg text-xs">
          <span class="w-2 h-2 rounded-full" :class="speakerColor(speaker)"></span>
          <span class="text-gray-300">{{ speaker }}</span>
          <span class="text-yellow-400">→ {{ voice }}</span>
        </div>
      </div>
    </div>

    <!-- Segments -->
    <div v-if="segments.length" class="mt-4 space-y-2 max-h-96 overflow-y-auto">
      <div v-for="(seg, i) in segments" :key="i"
        class="bg-gray-900 border border-gray-800 rounded-xl p-3">
        <div class="flex items-center gap-2 mb-1">
          <span class="w-2 h-2 rounded-full" :class="speakerColor(seg.speaker)"></span>
          <span class="text-xs text-gray-500">{{ seg.speaker || 'SPEAKER_1' }} · {{ fmt(seg.start) }} → {{ fmt(seg.end) }}</span>
        </div>
        <p class="text-sm">{{ seg.text }}</p>
      </div>
    </div>

    <div v-if="done" class="mt-6 bg-emerald-900/30 border border-emerald-800 rounded-xl p-4 text-sm text-emerald-400 text-center">
      ✓ Transcribed {{ segments.length }} segments · {{ uniqueSpeakers.length }} speaker(s) detected
    </div>

    <div v-if="done" class="mt-4 text-right">
      <router-link to="/step2" class="inline-block px-6 py-2.5 bg-sky-600 hover:bg-sky-500 rounded-xl text-sm font-medium transition-colors">
        Next: Translate →
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
const segments = ref([]);
const uniqueSpeakers = ref([]);
const speakerVoiceMap = ref({});

const SPEAKER_COLORS = ['bg-sky-500', 'bg-pink-500', 'bg-green-500', 'bg-orange-500', 'bg-purple-500'];
function speakerColor(speaker) {
  const index = parseInt((speaker || 'SPEAKER_1').replace(/\D/g, '') || '1') - 1;
  return SPEAKER_COLORS[index % SPEAKER_COLORS.length];
}

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
    if (res.success) {
      segments.value = res.segments;
      uniqueSpeakers.value = res.uniqueSpeakers || [];
      speakerVoiceMap.value = res.speakerVoiceMap || {};
      done.value = true;
    } else {
      error.value = res.error || 'Transcription failed';
    }
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
</script>
