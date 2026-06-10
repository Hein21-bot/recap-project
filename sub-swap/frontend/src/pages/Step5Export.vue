<template>
  <div class="max-w-2xl mx-auto px-6 py-10">
    <h2 class="text-2xl font-bold mb-1">Export</h2>
    <p class="text-gray-500 text-sm mb-8">Final video ကို preview ကြည့်ပြီး download လုပ်ပါ</p>

    <div class="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mb-6">
      <video
        v-if="ready"
        :src="downloadUrl"
        controls
        class="w-full max-h-96 bg-black"
        @error="ready = false"
      />
      <div v-else class="h-48 flex items-center justify-center text-gray-600 text-sm">
        Render ပြီးမှ video preview ကြည့်ရမည်
      </div>
    </div>

    <a :href="downloadUrl" download
      class="block w-full text-center py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-medium text-sm transition-colors mb-4">
      ⬇ Download Final Video
    </a>

    <div class="text-center">
      <router-link to="/step0" class="text-sm text-gray-500 hover:text-white transition-colors">
        ← New Video
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../api/api.js';

const ready = ref(false);
const downloadUrl = api.downloadUrl();

onMounted(async () => {
  const s = await api.getStatus();
  if (s.outputPath) ready.value = true;
});
</script>
