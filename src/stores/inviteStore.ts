import { computed, ref, watch } from "vue";
import {
  createInvite,
  fetchPublicProfileByInviteCode,
  respondToInvite,
  subscribeToInvites,
  subscribeToPublicProfile,
  type InviteData,
  type InviteStatus,
  type PublicProfile,
} from "../services/invites";
import { useAuthStore } from "./authStore";
import { useSessionStore } from "./sessionStore";
import { reportError, trackFlow } from "../monitoring";

const authStore = useAuthStore();
const invites = ref<InviteData[]>([]);
const invitesLoading = ref(false);
const invitesError = ref<string | null>(null);
const profile = ref<PublicProfile | null>(null);
const profileError = ref<string | null>(null);
const sendingInvite = ref(false);
const sendInviteError = ref<string | null>(null);
const inviteActionState = ref<Record<string, "idle" | "accepting" | "declining">>({});

let initialized = false;
let inviteUnsubscribe: (() => void) | null = null;
let profileUnsubscribe: (() => void) | null = null;
let stopWatcher: (() => void) | null = null;

const signedInUid = computed(() =>
  authStore.isSignedIn.value ? authStore.currentUser.value?.uid ?? null : null,
);

const pendingInvites = computed(() =>
  invites.value.filter((invite) => invite.status === "pending"),
);

const recentInvites = computed(() =>
  invites.value.filter((invite) => invite.status !== "pending"),
);

const pendingCount = computed(() => pendingInvites.value.length);

const inviteActionFor = (inviteId: string) =>
  inviteActionState.value[inviteId] ?? "idle";

const clearSubscriptions = () => {
  if (inviteUnsubscribe) {
    inviteUnsubscribe();
    inviteUnsubscribe = null;
  }
  if (profileUnsubscribe) {
    profileUnsubscribe();
    profileUnsubscribe = null;
  }
};

const init = () => {
  if (initialized) {
    return;
  }
  initialized = true;
  stopWatcher = watch(
    () => signedInUid.value,
    (uid) => {
      clearSubscriptions();
      invites.value = [];
      profile.value = null;
      invitesError.value = null;
      profileError.value = null;
      sendInviteError.value = null;
      invitesLoading.value = false;
      inviteActionState.value = {};

      if (!uid) {
        return;
      }

      invitesLoading.value = true;
      inviteUnsubscribe = subscribeToInvites(
        uid,
        (nextInvites) => {
          invitesLoading.value = false;
          invites.value = nextInvites;
        },
        (error) => {
          reportError(error, { flow: "invite.subscribe", action: "invites" });
          invitesLoading.value = false;
          invitesError.value = "Unable to load invites.";
        },
      );

      profileUnsubscribe = subscribeToPublicProfile(
        uid,
        (nextProfile) => {
          profile.value = nextProfile;
        },
        (error) => {
          reportError(error, { flow: "invite.subscribe", action: "profile" });
          profileError.value = "Unable to load invite code.";
        },
      );
    },
    { immediate: true },
  );
};

const dispose = () => {
  clearSubscriptions();
  if (stopWatcher) {
    stopWatcher();
    stopWatcher = null;
  }
  initialized = false;
};

const sendInvite = async ({
  inviteCode,
  message,
}: {
  inviteCode: string;
  message?: string;
}) => {
  const authStore = useAuthStore();
  const sessionStore = useSessionStore();

  if (!authStore.isSignedIn.value) {
    throw new Error("Sign in to send invites.");
  }
  if (!sessionStore.activeSession.value || !sessionStore.isHost.value) {
    throw new Error("You must be hosting an active session to invite.");
  }

  const normalized = inviteCode.trim().toUpperCase();
  if (!normalized) {
    throw new Error("Invite code is required.");
  }

  sendingInvite.value = true;
  sendInviteError.value = null;
  try {
    const profileMatch = await fetchPublicProfileByInviteCode(normalized);
    if (!profileMatch) {
      throw new Error("No player found with that invite code.");
    }
    
    const fromUid = authStore.currentUser.value!.uid;
    if (profileMatch.uid === fromUid) {
      throw new Error("You can't invite yourself.");
    }

    await createInvite({
      toUid: profileMatch.uid,
      fromUid,
      fromName: authStore.displayName.value,
      sessionId: sessionStore.activeSession.value.id,
      sessionName: sessionStore.activeSession.value.name ?? null,
      sessionCode: sessionStore.activeSession.value.code,
      sessionExpiresAt: sessionStore.activeSession.value.sessionExpiresAt,
      message,
    });
  } catch (error) {
    reportError(error, { flow: "invite.send", action: "code" });
    sendInviteError.value =
      (error as Error).message || "Unable to send invite.";
    throw error;
  } finally {
    sendingInvite.value = false;
  }
};

const sendInviteToUid = async ({
  toUid,
  message,
}: {
  toUid: string;
  message?: string;
}) => {
  const authStore = useAuthStore();
  const sessionStore = useSessionStore();

  if (!authStore.isSignedIn.value) {
    throw new Error("Sign in to send invites.");
  }
  if (!sessionStore.activeSession.value || !sessionStore.isHost.value) {
    throw new Error("You must be hosting an active session to invite.");
  }
  if (toUid === authStore.currentUser.value!.uid) {
    throw new Error("You can't invite yourself.");
  }

  const fromUid = authStore.currentUser.value!.uid;

  sendingInvite.value = true;
  sendInviteError.value = null;
  try {
    await createInvite({
      toUid,
      fromUid,
      fromName: authStore.displayName.value,
      sessionId: sessionStore.activeSession.value.id,
      sessionName: sessionStore.activeSession.value.name ?? null,
      sessionCode: sessionStore.activeSession.value.code,
      sessionExpiresAt: sessionStore.activeSession.value.sessionExpiresAt,
      message,
    });
  } catch (error) {
    reportError(error, { flow: "invite.send", action: "uid" });
    sendInviteError.value =
      (error as Error).message || "Unable to send invite.";
    throw error;
  } finally {
    sendingInvite.value = false;
  }
};

const respond = async (invite: InviteData, status: InviteStatus) => {
  inviteActionState.value = {
    ...inviteActionState.value,
    [invite.id]: status === "accepted" ? "accepting" : "declining",
  };
  try {
    await respondToInvite(invite.id, status);
  } catch (error) {
    reportError(error, { flow: "invite.respond", action: status });
    invitesError.value = "Unable to update that invite.";
  } finally {
    inviteActionState.value = {
      ...inviteActionState.value,
      [invite.id]: "idle",
    };
  }
};

const acceptInvite = async (invite: InviteData) => {
  const authStore = useAuthStore();
  const sessionStore = useSessionStore();
  if (!authStore.isSignedIn.value) {
    invitesError.value = "Sign in to accept invites.";
    trackFlow("invite.accept", "failure", { reason: "not_signed_in" });
    return;
  }

  inviteActionState.value = {
    ...inviteActionState.value,
    [invite.id]: "accepting",
  };

  try {
    const sessionId = await sessionStore.resumeSession({
      sessionId: invite.sessionId,
      role: "player",
      fallbackName: authStore.displayName.value,
    });
    await respondToInvite(invite.id, "accepted");
    trackFlow("invite.accept", "success");
    return sessionId;
  } catch (error) {
    const code = (error as { code?: string }).code ?? null;
    reportError(error, { flow: "invite.accept", action: "accept", code });
    trackFlow("invite.accept", "failure", { code: code ?? "unknown" });
    invitesError.value =
      (error as Error).message || "Unable to join that session.";
    return null;
  } finally {
    inviteActionState.value = {
      ...inviteActionState.value,
      [invite.id]: "idle",
    };
  }
};

const declineInvite = (invite: InviteData) => respond(invite, "declined");

export const useInviteStore = () => ({
  invites,
  invitesLoading,
  invitesError,
  profile,
  profileError,
  pendingInvites,
  recentInvites,
  pendingCount,
  sendingInvite,
  sendInviteError,
  inviteActionFor,
  init,
  dispose,
  sendInvite,
  sendInviteToUid,
  acceptInvite,
  declineInvite,
});
