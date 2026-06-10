<template>
  <div class="max-w-2xl mx-auto px-6 py-10">
    <h2 class="text-2xl font-bold mb-1">Translate</h2>
    <p class="text-gray-500 text-sm mb-8">Chinese text ကို target language သို့ ဘာသာပြန်မယ် — ပြီးရင် edit လုပ်လို့ရတယ်</p>

    <div class="mb-6">
      <label class="text-sm text-gray-400 mb-2 block">Target Language</label>
      <select v-model="targetLang" :disabled="done" class="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm w-full focus:outline-none focus:border-sky-500 disabled:opacity-50">
        <option value="Myanmar (Burmese)">Myanmar (Burmese)</option>
        <option value="English">English</option>
        <option value="Thai">Thai</option>
        <option value="Japanese">Japanese</option>
      </select>
    </div>

    <button v-if="!done" @click="run" :disabled="loading"
      class="w-full py-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 rounded-xl font-medium text-sm transition-colors">
      {{ loading ? 'Translating...' : 'Start Translate' }}
    </button>

    <p v-if="error" class="text-red-400 text-sm mt-4">{{ error }}</p>

    <!-- Editable segments -->
    <div v-if="segments.length" class="mt-6 space-y-2 max-h-[500px] overflow-y-auto">
      <div v-for="(seg, i) in segments" :key="i" class="bg-gray-900 border border-gray-800 rounded-xl p-3">
        <p class="text-xs text-gray-500 mb-1">{{ fmt(seg.start) }} → {{ fmt(seg.end) }}
          <span v-if="seg.speaker" class="ml-2 text-gray-600">· {{ seg.speaker }}</span>
        </p>
        <p class="text-xs text-gray-500 mb-2">{{ seg.text }}</p>
        <textarea
          v-model="seg.translatedText"
          rows="2"
          class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-yellow-300 focus:outline-none focus:border-sky-500 resize-none"
          @input="edited = true"
        />
      </div>
    </div>

    <!-- Save edits button -->
    <div v-if="done && edited" class="mt-4">
      <button @click="saveEdits" :disabled="saving"
        class="w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 rounded-xl text-sm font-medium transition-colors">
        {{ saving ? 'Saving...' : 'Save Edits' }}
      </button>
      <p v-if="saved" class="text-emerald-400 text-xs text-center mt-2">✓ Saved</p>
    </div>

    <div v-if="done" class="mt-4 bg-emerald-900/30 border border-emerald-800 rounded-xl p-4 text-sm text-emerald-400 text-center">
      ✓ Translated {{ segments.length }} segments to {{ targetLang }} — edit ပြီးရင် Next သွားပါ
    </div>

    <div v-if="done" class="mt-4 text-right">
      <router-link to="/step4" class="inline-block px-6 py-2.5 bg-sky-600 hover:bg-sky-500 rounded-xl text-sm font-medium transition-colors">
        Next: Generate Audio →
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
const targetLang = ref('Myanmar (Burmese)');
const edited = ref(false);
const saving = ref(false);
const saved = ref(false);

function fmt(s) {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1);
  return `${m}:${String(sec).padStart(4, '0')}`;
}

async function run() {
  loading.value = true;
  error.value = '';
  try {
    const res = await api.translate(targetLang.value);
    if (res.success) { segments.value = res.segments; done.value = true; }
    else error.value = res.error || 'Translation failed';
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function saveEdits() {
  saving.value = true;
  try {
    await api.saveTranslation(segments.value);
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
