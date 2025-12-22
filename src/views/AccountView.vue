<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/authStore";
import { useSessionStore } from "../stores/sessionStore";
import { useInviteStore } from "../stores/inviteStore";
import { useFriendStore } from "../stores/friendStore";
import UiButton from "../components/ui/UiButton.vue";
import UiCard from "../components/ui/UiCard.vue";
import UiField from "../components/ui/UiField.vue";
import UiInput from "../components/ui/UiInput.vue";
import UiPanelHeader from "../components/ui/UiPanelHeader.vue";
import UiPanelTitle from "../components/ui/UiPanelTitle.vue";
import {
  Bell,
  ClipboardCopy,
  Mail,
  Send,
  Shield,
  UserRound,
  UserRoundPlus,
  Users,
} from "lucide-vue-next";

const authStore = useAuthStore();
const sessionStore = useSessionStore();
const inviteStore = useInviteStore();
const friendStore = useFriendStore();
const router = useRouter();

const inviteCodeInput = ref("");
const inviteMessage = ref("");
const inviteSent = ref(false);
const inviteCopyStatus = ref<"idle" | "copied" | "failed">("idle");
const friendCodeInput = ref("");
const friendRequestSent = ref(false);
const friendInviteStatus = ref<Record<string, "idle" | "sending" | "sent" | "failed">>({});

const canInvite = computed(
  () =>
    !!authStore.currentUser.value &&
    !!sessionStore.activeSession.value &&
    sessionStore.isHost.value,
);

const inviteCode = computed(() => inviteStore.profile.value?.inviteCode ?? "");
const inviteCodeLabel = computed(() =>
  inviteCode.value ? inviteCode.value : "Generating...",
);

const formatDateTime = (value: Date | null) =>
  value ? value.toLocaleString() : "Unknown";

const handleCopyInviteCode = async () => {
  if (!inviteCode.value) {
    return;
  }
  try {
    await navigator.clipboard.writeText(inviteCode.value);
    inviteCopyStatus.value = "copied";
  } catch (error) {
    console.error(error);
    inviteCopyStatus.value = "failed";
  } finally {
    window.setTimeout(() => {
      inviteCopyStatus.value = "idle";
    }, 2000);
  }
};

const handleSendInvite = async () => {
  inviteSent.value = false;
  try {
    await inviteStore.sendInvite({
      inviteCode: inviteCodeInput.value,
      message: inviteMessage.value,
    });
    inviteSent.value = true;
    inviteCodeInput.value = "";
    inviteMessage.value = "";
  } catch {
    // Errors are surfaced via the store.
  }
};

const handleAcceptInvite = async (inviteId: string) => {
  const invite = inviteStore.pendingInvites.value.find(
    (item) => item.id === inviteId,
  );
  if (!invite) {
    return;
  }
  const sessionId = await inviteStore.acceptInvite(invite);
  if (sessionId) {
    router.push(`/session/${sessionId}`);
  }
};

const handleSendFriendRequest = async () => {
  friendRequestSent.value = false;
  try {
    await friendStore.sendRequest(friendCodeInput.value);
    friendRequestSent.value = true;
    friendCodeInput.value = "";
  } catch {
    // Errors are surfaced via the store.
  }
};

const handleInviteFriend = async (friendUid: string) => {
  friendInviteStatus.value = {
    ...friendInviteStatus.value,
    [friendUid]: "sending",
  };
  try {
    await inviteStore.sendInviteToUid({ toUid: friendUid });
    friendInviteStatus.value = {
      ...friendInviteStatus.value,
      [friendUid]: "sent",
    };
  } catch {
    friendInviteStatus.value = {
      ...friendInviteStatus.value,
      [friendUid]: "failed",
    };
  } finally {
    window.setTimeout(() => {
      friendInviteStatus.value = {
        ...friendInviteStatus.value,
        [friendUid]: "idle",
      };
    }, 2000);
  }
};

const friendStatusLabel = (friendUid: string) =>
  friendInviteStatus.value[friendUid] ?? "idle";

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
</script>

<template>
  <main class="screen split-screen account-screen">
    <div class="panel-stack">
      <UiCard as="section" variant="panel" wide>
        <UiPanelHeader>
          <template #icon>
            <UserRound />
          </template>
          <p class="eyebrow">Account</p>
          <h1>Your account sanctum</h1>
          <div class="rune-divider" aria-hidden="true"></div>
          <p class="lede">
            Manage your invite sigil and keep tabs on session invitations.
          </p>
        </UiPanelHeader>

        <div v-if="!authStore.currentUser.value" class="panel-footer">
          <p class="lede">
            Sign in to unlock invites and persistent session access.
          </p>
          <div class="cta-row">
            <UiButton variant="primary" to="/login">
              Sign in with Google
            </UiButton>
          </div>
        </div>

        <div v-else class="account-grid">
          <div>
            <span class="meta">Display name</span>
            <strong>{{ authStore.displayName.value }}</strong>
          </div>
          <div>
            <span class="meta">Email</span>
            <strong>{{ authStore.currentUser.value?.email || "Unknown" }}</strong>
          </div>
          <div class="account-invite-code">
            <span class="meta">Invite sigil</span>
            <div class="account-code-row">
              <strong class="code-text code-chip">{{ inviteCodeLabel }}</strong>
              <UiButton
                variant="ghost"
                size="compact"
                type="button"
                :disabled="!inviteCode"
                @click="handleCopyInviteCode"
              >
                <span class="icon"><ClipboardCopy /></span>
                <span v-if="inviteCopyStatus === 'copied'">Copied</span>
                <span v-else-if="inviteCopyStatus === 'failed'">Copy failed</span>
                <span v-else>Copy</span>
              </UiButton>
            </div>
            <p v-if="inviteStore.profileError.value" class="error">
              {{ inviteStore.profileError.value }}
            </p>
            <p v-else class="panel-footer">
              Share this code with friends so they can find you quickly.
            </p>
          </div>
        </div>
      </UiCard>

      <UiCard
        v-if="authStore.currentUser.value"
        as="section"
        variant="panel"
        wide
      >
        <UiPanelHeader>
          <template #icon>
            <Send />
          </template>
          <p class="eyebrow">Invite</p>
          <h2>Send an invite to your table</h2>
          <p class="lede">
            Invites go to a player sigil and open your active session.
          </p>
        </UiPanelHeader>

        <div v-if="!canInvite" class="panel-footer">
          <p class="lede">
            You must be hosting an active session to send invites.
          </p>
          <UiButton variant="ghost" to="/create">Host a session</UiButton>
        </div>

        <form
          v-else
          class="panel-form"
          @submit.prevent="handleSendInvite"
        >
          <UiField label="Player sigil" id="invite-code">
            <UiInput
              id="invite-code"
              v-model="inviteCodeInput"
              class="code-input"
              placeholder="Enter their invite code"
              maxlength="6"
              required
            />
          </UiField>
          <UiField label="Message (optional)" id="invite-message">
            <UiInput
              id="invite-message"
              v-model="inviteMessage"
              placeholder="Join us at the table"
              maxlength="80"
            />
          </UiField>
          <UiButton variant="primary" type="submit" :disabled="inviteStore.sendingInvite.value">
            <span class="icon"><Mail /></span>
            {{ inviteStore.sendingInvite.value ? "Sending..." : "Send invite" }}
          </UiButton>
          <p v-if="inviteStore.sendInviteError.value" class="error">
            {{ inviteStore.sendInviteError.value }}
          </p>
          <p v-else-if="inviteSent" class="panel-footer">
            Invite sent successfully.
          </p>
        </form>
      </UiCard>

      <UiCard
        v-if="authStore.currentUser.value"
        as="section"
        variant="panel"
        wide
      >
        <UiPanelHeader>
          <template #icon>
            <UserRoundPlus />
          </template>
          <p class="eyebrow">Friends</p>
          <h2>Add friends to your roster</h2>
          <p class="lede">
            Build a persistent roster to invite your party faster.
          </p>
        </UiPanelHeader>

        <form class="panel-form" @submit.prevent="handleSendFriendRequest">
          <UiField label="Friend sigil" id="friend-code">
            <UiInput
              id="friend-code"
              v-model="friendCodeInput"
              class="code-input"
              placeholder="Enter their invite code"
              maxlength="6"
              required
            />
          </UiField>
          <UiButton
            variant="primary"
            type="submit"
            :disabled="friendStore.sending.value || friendStore.loading.value"
          >
            {{ friendStore.sending.value ? "Sending..." : "Send friend request" }}
          </UiButton>
          <p v-if="friendStore.sendError.value" class="error">
            {{ friendStore.sendError.value }}
          </p>
          <p v-else-if="friendRequestSent" class="panel-footer">
            Friend request sent.
          </p>
        </form>

        <div class="friend-list">
          <div class="panel-title">
            <span class="icon teal"><Users /></span>
            <div>
              <h3>Your friends</h3>
              <p class="lede small">Invite them straight into your session.</p>
            </div>
          </div>

          <div v-if="friendStore.loading.value" class="panel-footer">
            Loading friends...
          </div>
          <p v-else-if="friendStore.error.value" class="error">
            {{ friendStore.error.value }}
          </p>
          <p v-else-if="!friendStore.friendsList.value.length" class="panel-footer">
            No friends yet. Add someone using their sigil.
          </p>
          <div v-else class="friend-grid">
            <article
              v-for="friend in friendStore.friendsList.value"
              :key="friend.id"
              class="friend-card"
            >
              <div class="friend-summary">
                <div class="friend-avatar">
                  {{ getInitials(friend.name || "Player") }}
                </div>
                <div>
                  <strong>{{ friend.name || "Player" }}</strong>
                  <span class="meta">Friend</span>
                </div>
              </div>
              <div class="friend-actions">
                <UiButton
                  v-if="canInvite"
                  variant="ghost"
                  size="compact"
                  type="button"
                  :disabled="friendStatusLabel(friend.uid) === 'sending'"
                  @click="handleInviteFriend(friend.uid)"
                >
                  <span v-if="friendStatusLabel(friend.uid) === 'sent'">Invited</span>
                  <span v-else-if="friendStatusLabel(friend.uid) === 'failed'">Failed</span>
                  <span v-else-if="friendStatusLabel(friend.uid) === 'sending'">Sending</span>
                  <span v-else>Invite</span>
                </UiButton>
              </div>
            </article>
          </div>
        </div>
      </UiCard>
    </div>

    <aside class="side-panel">
      <UiCard
        v-if="authStore.currentUser.value"
        as="section"
        variant="side"
      >
        <UiPanelTitle>
          <template #icon>
            <span class="icon ember"><Bell /></span>
          </template>
          <div>
            <h3>Pending invites</h3>
            <p class="lede small">Invites waiting for your response.</p>
          </div>
        </UiPanelTitle>

        <div v-if="inviteStore.invitesLoading.value" class="panel-footer">
          Loading invites...
        </div>
        <p v-else-if="inviteStore.invitesError.value" class="error">
          {{ inviteStore.invitesError.value }}
        </p>
        <div v-else-if="!inviteStore.pendingInvites.value.length" class="panel-footer">
          No pending invites right now.
        </div>
        <div v-else class="invite-list">
          <article
            v-for="invite in inviteStore.pendingInvites.value"
            :key="invite.id"
            class="invite-card"
          >
            <div>
              <strong>{{ invite.sessionName || "Untitled session" }}</strong>
              <p class="meta">From {{ invite.fromName }}</p>
              <p v-if="invite.message" class="invite-message">
                “{{ invite.message }}”
              </p>
              <p class="meta">
                Expires {{ formatDateTime(invite.sessionExpiresAt) }}
              </p>
            </div>
            <div class="invite-actions">
              <UiButton
                variant="primary"
                size="compact"
                type="button"
                :disabled="inviteStore.inviteActionFor(invite.id) !== 'idle'"
                @click="handleAcceptInvite(invite.id)"
              >
                Accept
              </UiButton>
              <UiButton
                variant="ghost"
                size="compact"
                type="button"
                :disabled="inviteStore.inviteActionFor(invite.id) !== 'idle'"
                @click="inviteStore.declineInvite(invite)"
              >
                Decline
              </UiButton>
            </div>
          </article>
        </div>
      </UiCard>

      <UiCard
        v-if="authStore.currentUser.value"
        as="section"
        variant="side"
      >
        <UiPanelTitle>
          <template #icon>
            <span class="icon teal"><Users /></span>
          </template>
          <div>
            <h3>Friend requests</h3>
            <p class="lede small">New party bonds waiting for you.</p>
          </div>
        </UiPanelTitle>

        <div v-if="friendStore.loading.value" class="panel-footer">
          Loading requests...
        </div>
        <p v-else-if="friendStore.error.value" class="error">
          {{ friendStore.error.value }}
        </p>
        <div
          v-else-if="
            !friendStore.incomingRequests.value.length &&
              !friendStore.outgoingRequests.value.length
          "
          class="panel-footer"
        >
          No friend requests right now.
        </div>
        <div class="friend-request-list">
          <article
            v-for="request in friendStore.incomingRequests.value"
            :key="request.id"
            class="friend-request-card"
          >
            <div>
              <strong>{{ request.requesterName }}</strong>
              <p class="meta">Wants to be friends</p>
            </div>
            <div class="invite-actions">
              <UiButton
                variant="primary"
                size="compact"
                type="button"
                :disabled="friendStore.actionFor(request.id) !== 'idle'"
                @click="friendStore.acceptRequest(request)"
              >
                Accept
              </UiButton>
              <UiButton
                variant="ghost"
                size="compact"
                type="button"
                :disabled="friendStore.actionFor(request.id) !== 'idle'"
                @click="friendStore.declineRequest(request)"
              >
                Decline
              </UiButton>
            </div>
          </article>

          <article
            v-for="request in friendStore.outgoingRequests.value"
            :key="request.id"
            class="friend-request-card compact"
          >
            <div>
              <strong>{{ request.addresseeName }}</strong>
              <p class="meta">Request sent</p>
            </div>
            <UiButton
              variant="ghost"
              size="compact"
              type="button"
              :disabled="friendStore.actionFor(request.id) !== 'idle'"
              @click="friendStore.cancelRequest(request)"
            >
              Cancel
            </UiButton>
          </article>
        </div>
      </UiCard>

      <UiCard
        v-if="authStore.currentUser.value"
        as="section"
        variant="side"
      >
        <UiPanelTitle>
          <template #icon>
            <span class="icon gild"><Shield /></span>
          </template>
          <div>
            <h3>Invite history</h3>
            <p class="lede small">Your recent invite responses.</p>
          </div>
        </UiPanelTitle>

        <div v-if="!inviteStore.recentInvites.value.length" class="panel-footer">
          No invite history yet.
        </div>
        <div v-else class="invite-history">
          <article
            v-for="invite in inviteStore.recentInvites.value"
            :key="invite.id"
            class="invite-card compact"
          >
            <div>
              <strong>{{ invite.sessionName || "Untitled session" }}</strong>
              <p class="meta">From {{ invite.fromName }}</p>
            </div>
            <span class="status-pill" :class="`status-${invite.status}`">
              {{ invite.status }}
            </span>
          </article>
        </div>
      </UiCard>
    </aside>
  </main>
</template>
