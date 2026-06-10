<template>
  <div class="max-w-2xl mx-auto px-6 py-10">
    <h2 class="text-2xl font-bold mb-1">Upload Video</h2>
    <p class="text-gray-500 text-sm mb-8">Chinese video file ကို upload လုပ်ပါ</p>

    <div
      class="border-2 border-dashed border-gray-700 rounded-2xl p-12 text-center cursor-pointer hover:border-sky-600 transition-colors"
      @click="inputRef.click()"
      @dragover.prevent
      @drop.prevent="onDrop"
    >
      <input type="file" accept="video/*" @change="onFile" class="hidden" ref="inputRef" />
      <p class="text-4xl mb-4">🎬</p>
      <p class="text-gray-400 mb-2">Click or drag & drop video file</p>
      <p class="text-gray-600 text-xs">MP4, MOV, AVI — max 500MB</p>
    </div>

    <div v-if="file" class="mt-4 bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
      <div>
        <p class="text-sm font-medium">{{ file.name }}</p>
        <p class="text-xs text-gray-500 mt-1">{{ (file.size / 1024 / 1024).toFixed(1) }} MB</p>
      </div>
      <button @click="file = null" class="text-gray-600 hover:text-red-400 text-xl">✕</button>
    </div>

    <p v-if="error" class="text-red-400 text-sm mt-4">{{ error }}</p>

    <button
      v-if="file && !done"
      @click="upload"
      :disabled="uploading"
      class="mt-6 w-full py-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 rounded-xl font-medium text-sm transition-colors"
    >
      {{ uploading ? 'Uploading...' : 'Upload & Continue' }}
    </button>

    <div v-if="done" class="mt-6 bg-emerald-900/30 border border-emerald-800 rounded-xl p-4 text-sm text-emerald-400 text-center">
      ✓ Video uploaded successfully
    </div>

    <div v-if="done" class="mt-4 text-right">
      <router-link to="/step1" class="inline-block px-6 py-2.5 bg-sky-600 hover:bg-sky-500 rounded-xl text-sm font-medium transition-colors">
        Next: Transcribe →
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { api } from '../api/api.js';

const inputRef = ref(null);
const file = ref(null);
const uploading = ref(false);
const done = ref(false);
const error = ref('');

function onFile(e) { file.value = e.target.files[0]; }
function onDrop(e) { file.value = e.dataTransfer.files[0]; }

async function upload() {
  uploading.value = true;
  error.value = '';
  try {
    const res = await api.uploadVideo(file.value);
    if (res.success) done.value = true;
    else error.value = res.error || 'Upload failed';
  } catch (e) {
    error.value = e.message;
  } finally {
    uploading.value = false;
  }
}
</script>
