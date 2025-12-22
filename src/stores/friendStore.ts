import { computed, ref, watch } from "vue";
import { useAuthStore } from "./authStore";
import {
  respondToFriendRequest,
  sendFriendRequest,
  subscribeToFriendships,
  type FriendshipData,
  type FriendshipStatus,
} from "../services/friends";
import { fetchPublicProfileByInviteCode } from "../services/invites";

const friendships = ref<FriendshipData[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const sending = ref(false);
const sendError = ref<string | null>(null);
const actionState = ref<Record<string, "idle" | "accepting" | "declining" | "cancelling">>({});

let initialized = false;
let unsubscribe: (() => void) | null = null;
let stopWatcher: (() => void) | null = null;

const clearSubscriptions = () => {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
};

const authStore = useAuthStore();
const currentUid = computed(() => authStore.currentUser.value?.uid ?? null);

const pendingRequests = computed(() =>
  friendships.value.filter((friendship) => friendship.status === "pending"),
);

const incomingRequests = computed(() =>
  pendingRequests.value.filter(
    (friendship) => friendship.addresseeUid === currentUid.value,
  ),
);

const outgoingRequests = computed(() =>
  pendingRequests.value.filter(
    (friendship) => friendship.requesterUid === currentUid.value,
  ),
);

const pendingIncomingCount = computed(() => incomingRequests.value.length);

const acceptedFriends = computed(() =>
  friendships.value.filter((friendship) => friendship.status === "accepted"),
);

const friendsList = computed(() =>
  acceptedFriends.value.map((friendship) => {
    const isRequester = friendship.requesterUid === currentUid.value;
    return {
      id: friendship.id,
      uid: isRequester ? friendship.addresseeUid : friendship.requesterUid,
      name: isRequester ? friendship.addresseeName : friendship.requesterName,
      photoURL: isRequester
        ? friendship.addresseePhotoURL
        : friendship.requesterPhotoURL,
      since: friendship.updatedAt ?? friendship.createdAt,
    };
  }),
);

const init = () => {
  if (initialized) {
    return;
  }
  initialized = true;
  stopWatcher = watch(
    () => currentUid.value,
    (uid) => {
      clearSubscriptions();
      friendships.value = [];
      loading.value = false;
      error.value = null;
      sendError.value = null;
      actionState.value = {};

      if (!uid) {
        return;
      }

      loading.value = true;
      unsubscribe = subscribeToFriendships(
        uid,
        (nextFriendships) => {
          friendships.value = nextFriendships;
          loading.value = false;
        },
        (err) => {
          console.error(err);
          loading.value = false;
          error.value = "Unable to load friends.";
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

const sendRequest = async (inviteCode: string) => {
  if (!authStore.currentUser.value) {
    throw new Error("Sign in to add friends.");
  }

  const normalized = inviteCode.trim().toUpperCase();
  if (!normalized) {
    throw new Error("Invite code is required.");
  }

  sending.value = true;
  sendError.value = null;
  try {
    const profileMatch = await fetchPublicProfileByInviteCode(normalized);
    if (!profileMatch) {
      throw new Error("No player found with that invite code.");
    }
    if (profileMatch.uid === authStore.currentUser.value.uid) {
      throw new Error("You can't add yourself.");
    }

    await sendFriendRequest({
      fromUid: authStore.currentUser.value.uid,
      fromName: authStore.displayName.value,
      fromPhotoURL: authStore.currentUser.value.photoURL ?? null,
      toUid: profileMatch.uid,
      toName: profileMatch.displayName ?? "Player",
      toPhotoURL: profileMatch.photoURL ?? null,
    });
  } catch (err) {
    console.error(err);
    sendError.value =
      (err as Error).message || "Unable to send that request.";
    throw err;
  } finally {
    sending.value = false;
  }
};

const respond = async (friendship: FriendshipData, status: FriendshipStatus) => {
  actionState.value = {
    ...actionState.value,
    [friendship.id]:
      status === "accepted"
        ? "accepting"
        : status === "declined"
          ? "declining"
          : "cancelling",
  };
  try {
    await respondToFriendRequest(friendship.id, status);
  } catch (err) {
    console.error(err);
    error.value = "Unable to update that request.";
  } finally {
    actionState.value = {
      ...actionState.value,
      [friendship.id]: "idle",
    };
  }
};

const acceptRequest = (friendship: FriendshipData) =>
  respond(friendship, "accepted");
const declineRequest = (friendship: FriendshipData) =>
  respond(friendship, "declined");
const cancelRequest = (friendship: FriendshipData) =>
  respond(friendship, "cancelled");

const actionFor = (friendshipId: string) =>
  actionState.value[friendshipId] ?? "idle";

export const useFriendStore = () => ({
  friendships,
  loading,
  error,
  sending,
  sendError,
  incomingRequests,
  outgoingRequests,
  friendsList,
  pendingIncomingCount,
  actionFor,
  init,
  dispose,
  sendRequest,
  acceptRequest,
  declineRequest,
  cancelRequest,
});
