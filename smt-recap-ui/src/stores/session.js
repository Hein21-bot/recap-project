import { defineStore } from "pinia";
import { ref } from "vue";

function generateSessionId() {
  return "sess_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const useSessionStore = defineStore("session", () => {
  // Persist sessionId in localStorage so refreshing keeps the same session
  const stored = localStorage.getItem("smt_session_id");
  const sessionId = ref(stored || generateSessionId());

  if (!stored) {
    localStorage.setItem("smt_session_id", sessionId.value);
  }

  function newSession() {
    const id = generateSessionId();
    sessionId.value = id;
    localStorage.setItem("smt_session_id", id);
    return id;
  }

  return { sessionId, newSession };
});
