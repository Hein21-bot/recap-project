<template>
  <div class="min-h-screen bg-gray-950 text-white flex">
    <aside class="w-60 bg-gray-900 border-r border-gray-800 p-4 flex flex-col gap-2">
      <h1 class="text-xl font-bold text-yellow-400 mb-6">Vid-Dub</h1>
      <nav class="flex flex-col gap-1">
        <router-link
          v-for="step in steps"
          :key="step.path"
          :to="step.path"
          class="px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition"
          active-class="bg-gray-800 text-white"
        >
          {{ step.label }}
        </router-link>
      </nav>
      <div class="mt-auto pt-4 border-t border-gray-800">
        <button @click="reset" class="w-full px-3 py-2 rounded-lg text-xs text-red-400 hover:bg-red-900/30 transition text-left">
          🗑 New Video (Reset)
        </button>
      </div>
    </aside>
    <main class="flex-1 p-8 overflow-y-auto">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { api } from './api/api.js';

const router = useRouter();

async function reset() {
  if (!confirm('Pipeline တစ်ခုလုံး reset လုပ်မလား? Files အားလုံး ပျက်သွားမယ်။')) return;
  await api.reset();
  router.push('/step0');
}

const steps = [
  { path: '/step0', label: '0. Upload Video' },
  { path: '/step1', label: '1. Transcribe & Detect Speakers' },
  { path: '/step2', label: '2. Translate' },
  { path: '/step4', label: '3. Generate Audio' },
  { path: '/step5', label: '4. Sync Audio' },
  { path: '/step6', label: '5. Subtitles' },
  { path: '/step7', label: '6. Export' },
];
</script>
