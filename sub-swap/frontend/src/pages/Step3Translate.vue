<template>
  <div class="max-w-2xl mx-auto px-6 py-10">
    <h2 class="text-2xl font-bold mb-1">Translate</h2>
    <p class="text-gray-500 text-sm mb-8">Chinese ကို မြန်မာဘာသာ ဘာသာပြန်မည် — ပြီးရင် edit လုပ်လို့ရသည်</p>

    <button v-if="!done && !loading" @click="run"
      class="w-full py-3 bg-sky-600 hover:bg-sky-500 rounded-xl font-medium text-sm transition-colors">
      Start Translate
    </button>

    <div v-if="loading" class="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
      <div class="flex justify-center mb-3">
        <svg class="animate-spin w-6 h-6 text-sky-400" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
      </div>
      <p class="text-gray-400 text-sm">Gemini ဖြင့် ဘာသာပြန်နေသည်...</p>
    </div>

    <p v-if="error" class="text-red-400 text-sm mt-4">{{ error }}</p>

    <!-- Editable segments -->
    <div v-if="segments.length" class="mt-6 space-y-2 max-h-[500px] overflow-y-auto">
      <div v-for="(seg, i) in segments" :key="i"
        class="bg-gray-900 border border-gray-800 rounded-xl p-3">
        <p class="text-xs text-gray-500 mb-1">{{ fmt(seg.start) }} → {{ fmt(seg.end) }}</p>
        <p class="text-xs text-gray-600 mb-2">{{ seg.text }}</p>
        <textarea
          v-model="seg.translatedText"
          rows="2"
          class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-yellow-300 focus:outline-none focus:border-sky-500 resize-none"
          @input="edited = true"
        />
      </div>
    </div>

    <div v-if="done && edited" class="mt-4">
      <button @click="saveEdits" :disabled="saving"
        class="w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 rounded-xl text-sm font-medium transition-colors">
        {{ saving ? 'Saving...' : 'Save Edits' }}
      </button>
      <p v-if="saved" class="text-emerald-400 text-xs text-center mt-2">✓ Saved</p>
    </div>

    <div v-if="done" class="mt-4 bg-emerald-900/30 border border-emerald-800 rounded-xl p-4 text-sm text-emerald-400 text-center">
      ✓ {{ segments.length }} segments translated to Myanmar
    </div>

    <div v-if="done" class="mt-4 text-right">
      <router-link to="/step4"
        class="inline-block px-6 py-2.5 bg-sky-600 hover:bg-sky-500 rounded-xl text-sm font-medium transition-colors">
        Next: Render →
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
const edited   = ref(false);
const saving   = ref(false);
const saved    = ref(false);

onMounted(async () => {
  const s = await api.getStatus();
  if (s.segments?.length) {
    segments.value = s.segments;
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
    const res = await api.translate();
    if (!res.success) throw new Error(res.error || 'Translation မအောင်မြင်ပါ');
    segments.value = res.segments;
    done.value = true;
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function saveEdits() {
  saving.value = true;
  try {
    await api.saveEdits(segments.value);
    edited.value = false;
    saved.value = true;
    setTimeout(() => saved.value = false, 2000);
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}
</script>
