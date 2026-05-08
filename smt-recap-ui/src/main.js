import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router.js";
import "./style.css";

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(router);

// Initialize session store early so localStorage is seeded before any API call
import { useSessionStore } from "./stores/session.js";
useSessionStore(pinia);

app.mount("#app");
