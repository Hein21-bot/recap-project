<template>
  <div class="max-w-xl mx-auto px-6 py-10">
    <h2 class="text-2xl font-bold mb-1">Upload Video</h2>
    <p class="text-gray-500 text-sm mb-8">Chinese subtitle ပါတဲ့ ဗီဒီယို upload လုပ်ပါ</p>

    <div
      class="border-2 border-dashed border-gray-700 rounded-2xl p-12 text-center cursor-pointer hover:border-sky-500 transition-colors"
      :class="{ 'border-sky-500 bg-sky-950/20': dragging }"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
      @click="$refs.fileInput.click()">
      <div class="text-4xl mb-3">🎬</div>
      <p class="text-gray-400 text-sm">Drag & drop သို့မဟုတ် click လုပ်ပါ</p>
      <p class="text-gray-600 text-xs mt-1">MP4, MOV, MKV, AVI — max 500MB</p>
      <input ref="fileInput" type="file" accept="video/*" class="hidden" @change="onFileSelect" />
    </div>

    <div v-if="file" class="mt-4 bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
      <span class="text-xl">🎥</span>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium truncate">{{ file.name }}</p>
        <p class="text-xs text-gray-500">{{ (file.size / 1024 / 1024).toFixed(1) }} MB</p>
      </div>
    </div>

    <p v-if="error" class="text-red-400 text-sm mt-4">{{ error }}</p>

    <button v-if="file" @click="upload" :disabled="loading"
      class="mt-4 w-full py-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 rounded-xl font-medium text-sm transition-colors">
      {{ loading ? 'Uploading...' : 'Upload & Continue' }}
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api/api.js';

const router  = useRouter();
const file    = ref(null);
const dragging = ref(false);
const loading  = ref(false);
const error    = ref('');

function onDrop(e) {
  dragging.value = false;
  const f = e.dataTransfer.files[0];
  if (f) file.value = f;
}

function onFileSelect(e) {
  file.value = e.target.files[0] || null;
}

async function upload() {
  loading.value = true;
  error.value = '';
  try {
    const res = await api.upload(file.value);
    if (!res.success) throw new Error(res.error || 'Upload မအောင်မြင်ပါ');
    router.push('/step1');
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
</script>
