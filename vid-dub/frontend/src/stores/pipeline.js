import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '../api/api.js';

export const usePipelineStore = defineStore('pipeline', () => {
  const state = ref({});
  const loading = ref(false);

  async function refresh() {
    state.value = await api.getStatus();
  }

  return { state, loading, refresh };
});
