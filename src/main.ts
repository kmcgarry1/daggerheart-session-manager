import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import router from "./router";
import { initMonitoring } from "./monitoring";

const app = createApp(App);
app.use(router);
initMonitoring(app);
app.mount("#app");
