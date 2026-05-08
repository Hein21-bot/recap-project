import { ref, onUnmounted } from "vue";

export function useSSE() {
  const logs     = ref([]);
  const progress = ref(0);
  const done     = ref(false);
  const result   = ref(null);
  let es         = null;
  let pollTimer  = null;

  function connect(jobId) {
    logs.value     = [];
    progress.value = 0;
    done.value     = false;
    result.value   = null;

    return new Promise((resolve) => {
      es = new EventSource(`/api/events/${jobId}`);
      es.onopen = () => resolve();
      es.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "log")      logs.value.push(msg.message);
        if (msg.type === "progress") progress.value = msg.percent;
        if (msg.type === "done") {
          result.value = msg;
          done.value   = true;
          es.close();
          stopPolling();
        }
      };
      es.onerror = () => resolve();
    });
  }

  // Polling fallback: if SSE done event is missed, poll DB every 5s
  // checkFn: async fn — return truthy result when done, null/false if still running
  async function startPolling(checkFn) {
    stopPolling();
    // Check immediately first, then every 3s
    const check = async () => {
      if (done.value) { stopPolling(); return; }
      try {
        const res = await checkFn();
        if (res) { stopPolling(); result.value = res; done.value = true; }
      } catch (_) {}
    };
    await check();
    pollTimer = setInterval(check, 3000);
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  function disconnect() { es?.close(); stopPolling(); }

  onUnmounted(disconnect);

  return { logs, progress, done, result, connect, startPolling };
}

export function makeJobId() {
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
