<template>
  <div class="max-w-2xl mx-auto px-6 py-10">
    <h2 class="text-2xl font-bold mb-1">Export</h2>
    <p class="text-gray-500 text-sm mb-8">Final video preview ကြည့်ပြီး download လုပ်ပါ</p>

    <!-- Video Preview -->
    <div class="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mb-6">
      <video
        v-if="videoReady"
        :src="previewUrl"
        controls
        class="w-full max-h-96 bg-black"
        @error="videoReady = false"
      />
      <div v-else class="h-48 flex items-center justify-center text-gray-600 text-sm">
        Video preview မရနိုင်ဘူး — တိုက်ရိုက် download လုပ်ပါ
      </div>
    </div>

    <!-- Info -->
    <div class="grid grid-cols-2 gap-3 text-sm mb-6">
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-3">
        <p class="text-gray-500 text-xs mb-1">Language</p>
        <p class="font-medium">{{ status.targetLang || '—' }}</p>
      </div>
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-3">
        <p class="text-gray-500 text-xs mb-1">Speakers</p>
        <p class="font-medium">{{ speakerCount }}</p>
      </div>
    </div>

    <a :href="downloadUrl" download
      class="block w-full text-center py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-medium text-sm transition-colors mb-4">
      Download Final Video
    </a>

    <div class="text-center">
      <router-link to="/step0" class="text-sm text-gray-500 hover:text-white transition-colors">← Start New Video</router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { api } from '../api/api.js';

const status = ref({});
const videoReady = ref(false);
const downloadUrl = api.downloadUrl();
const previewUrl = downloadUrl;

const speakerCount = computed(() => {
  const map = status.value.speakerVoiceMap || {};
  const count = Object.keys(map).length;
  return count ? `${count} speaker(s)` : '—';
});

onMounted(async () => {
  status.value = await api.getStatus();
  // Check if video exists by trying to fetch headers
  if (status.value.subtitledVideoPath || status.value.dubbedVideoPath) {
    videoReady.value = true;
  }
});
</script>
