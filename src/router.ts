import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "welcome",
      component: () => import("./views/WelcomeView.vue"),
    },
    {
      path: "/login",
      name: "login",
      component: () => import("./views/LoginView.vue"),
      meta: { hideNav: true },
    },
    {
      path: "/signup",
      name: "signup",
      component: () => import("./views/SignupView.vue"),
      meta: { hideNav: true },
    },
    {
      path: "/create",
      name: "create",
      component: () => import("./views/CreateView.vue"),
    },
    {
      path: "/join",
      name: "join",
      component: () => import("./views/JoinView.vue"),
    },
    {
      path: "/session/:sessionId",
      name: "session",
      component: () => import("./views/SessionView.vue"),
    },
    {
      path: "/account",
      name: "account",
      component: () => import("./views/AccountView.vue"),
    },
  ],
});

export default router;
