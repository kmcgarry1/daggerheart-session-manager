import { createRouter, createWebHistory } from "vue-router";
import WelcomeView from "./views/WelcomeView.vue";
import LoginView from "./views/LoginView.vue";
import SignupView from "./views/SignupView.vue";
import CreateView from "./views/CreateView.vue";
import JoinView from "./views/JoinView.vue";
import SessionView from "./views/SessionView.vue";
import AccountView from "./views/AccountView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "welcome",
      component: WelcomeView,
    },
    {
      path: "/login",
      name: "login",
      component: LoginView,
      meta: { hideNav: true },
    },
    {
      path: "/signup",
      name: "signup",
      component: SignupView,
      meta: { hideNav: true },
    },
    {
      path: "/create",
      name: "create",
      component: CreateView,
    },
    {
      path: "/join",
      name: "join",
      component: JoinView,
    },
    {
      path: "/session/:sessionId",
      name: "session",
      component: SessionView,
    },
    {
      path: "/account",
      name: "account",
      component: AccountView,
    },
  ],
});

export default router;
