<template>
  <div class="flex min-h-screen">
    <!-- Sidebar -->
    <aside class="w-56 bg-gray-950 border-r border-gray-800 flex flex-col py-8 px-4 shrink-0">
      <div class="text-xs font-bold text-sky-400 uppercase tracking-widest mb-8 px-2">Sub Swap</div>

      <nav class="flex flex-col gap-1 flex-1">
        <router-link v-for="step in steps" :key="step.path"
          :to="step.path"
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors"
          :class="isActive(step.path)
            ? 'bg-sky-600 text-white font-medium'
            : 'text-gray-400 hover:text-white hover:bg-gray-800'">
          <span class="text-base">{{ step.icon }}</span>
          <span>{{ step.label }}</span>
        </router-link>
      </nav>

      <button @click="reset"
        class="mt-6 flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:text-red-400 hover:bg-gray-900 transition-colors">
        <span>🗑</span>
        <span>Reset</span>
      </button>
    </aside>

    <!-- Main -->
    <main class="flex-1 overflow-y-auto">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { useRouter, useRoute } from 'vue-router';
import { api } from './api/api.js';

const router = useRouter();
const route  = useRoute();

const steps = [
  { path: '/step0', icon: '📁', label: 'Upload Video' },
  { path: '/step1', icon: '🎯', label: 'Select Region' },
  { path: '/step2', icon: '🎙', label: 'Transcribe' },
  { path: '/step3', icon: '🌐', label: 'Translate' },
  { path: '/step4', icon: '🎬', label: 'Render' },
  { path: '/step5', icon: '⬇️', label: 'Export' },
];

function isActive(p) { return route.path === p; }

async function reset() {
  if (!confirm('Pipeline အားလုံး ပြန်စမည်လား?')) return;
  await api.reset();
  router.push('/step0');
}
</script>
