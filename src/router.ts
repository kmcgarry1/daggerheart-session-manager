import { createRouter, createWebHistory } from "vue-router";
const WelcomeView = () => import("./views/WelcomeView.vue");
const LoginView = () => import("./views/LoginView.vue");
const SignupView = () => import("./views/SignupView.vue");
const CreateView = () => import("./views/CreateView.vue");
const JoinView = () => import("./views/JoinView.vue");
const SessionView = () => import("./views/SessionView.vue");
const AccountView = () => import("./views/AccountView.vue");

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
