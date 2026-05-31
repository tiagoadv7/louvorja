import { createRouter, createWebHistory, createWebHashHistory } from "vue-router";
import Main from "@/views/Main.vue";
import Popup from "@/views/Popup.vue";

const routes = [
  {
    path: "/",
    name: "Main",
    component: Main,
  },
  {
    path: "/popup",
    name: "Popup",
    component: Popup,
  },
];

// Electron usa hash history (carrega de file://) — browser usa web history
const isElectron = typeof window !== "undefined" && navigator.userAgent.includes("Electron");
const history = isElectron
  ? createWebHashHistory()
  : createWebHistory(import.meta.env.BASE_URL ?? "/");

const router = createRouter({
  history,
  routes,
});

export default router;
