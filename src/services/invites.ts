import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

export type InviteStatus = "pending" | "accepted" | "declined" | "revoked";

export type InviteData = {
  id: string;
  toUid: string;
  fromUid: string;
  fromName: string;
  sessionId: string;
  sessionName: string | null;
  sessionCode: string;
  sessionExpiresAt: Date | null;
  message: string | null;
  status: InviteStatus;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type InviteDoc = Omit<InviteData, "id" | "createdAt" | "updatedAt" | "sessionExpiresAt"> & {
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  sessionExpiresAt?: Timestamp | null;
};

export type PublicProfile = {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  inviteCode: string;
};

type PublicProfileDoc = Omit<PublicProfile, "uid">;

const mapInviteData = (id: string, data: InviteDoc): InviteData => ({
  id,
  toUid: data.toUid,
  fromUid: data.fromUid,
  fromName: data.fromName,
  sessionId: data.sessionId,
  sessionName: data.sessionName ?? null,
  sessionCode: data.sessionCode,
  sessionExpiresAt: data.sessionExpiresAt ? data.sessionExpiresAt.toDate() : null,
  message: data.message ?? null,
  status: data.status,
  createdAt: data.createdAt ? data.createdAt.toDate() : null,
  updatedAt: data.updatedAt ? data.updatedAt.toDate() : null,
});

const mapPublicProfile = (uid: string, data: PublicProfileDoc): PublicProfile => ({
  uid,
  displayName: data.displayName ?? null,
  photoURL: data.photoURL ?? null,
  inviteCode: data.inviteCode,
});

export const createInvite = async ({
  toUid,
  fromUid,
  fromName,
  sessionId,
  sessionName,
  sessionCode,
  sessionExpiresAt,
  message,
}: {
  toUid: string;
  fromUid: string;
  fromName: string;
  sessionId: string;
  sessionName: string | null;
  sessionCode: string;
  sessionExpiresAt: Date | null;
  message?: string | null;
}) => {
  const payload: Omit<InviteDoc, "createdAt" | "updatedAt"> = {
    toUid,
    fromUid,
    fromName,
    sessionId,
    sessionName: sessionName ?? null,
    sessionCode,
    sessionExpiresAt: sessionExpiresAt ? Timestamp.fromDate(sessionExpiresAt) : null,
    message: message?.trim() || null,
    status: "pending",
  };

  return addDoc(collection(db, "invites"), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const subscribeToInvites = (
  uid: string,
  onChange: (invites: InviteData[]) => void,
  onError: (error: unknown) => void,
) => {
  const inviteQuery = query(
    collection(db, "invites"),
    where("toUid", "==", uid),
    orderBy("createdAt", "desc"),
    limit(25),
  );

  return onSnapshot(
    inviteQuery,
    (snapshot) => {
      const nextInvites = snapshot.docs.map((docSnap) =>
        mapInviteData(docSnap.id, docSnap.data() as InviteDoc),
      );
      onChange(nextInvites);
    },
    onError,
  );
};

export const respondToInvite = async (
  inviteId: string,
  status: InviteStatus,
) => {
  await updateDoc(doc(db, "invites", inviteId), {
    status,
    updatedAt: serverTimestamp(),
  });
};

export const subscribeToPublicProfile = (
  uid: string,
  onChange: (profile: PublicProfile | null) => void,
  onError: (error: unknown) => void,
) =>
  onSnapshot(
    doc(db, "publicProfiles", uid),
    (snapshot) => {
      if (!snapshot.exists()) {
        onChange(null);
        return;
      }
      onChange(mapPublicProfile(snapshot.id, snapshot.data() as PublicProfileDoc));
    },
    onError,
  );

export const fetchPublicProfileByInviteCode = async (inviteCode: string) => {
  const normalized = inviteCode.trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  const snapshot = await getDocs(
    query(
      collection(db, "publicProfiles"),
      where("inviteCode", "==", normalized),
      limit(1),
    ),
  );

  const docSnap = snapshot.docs[0];
  if (!docSnap) {
    return null;
  }

  return mapPublicProfile(docSnap.id, docSnap.data() as PublicProfileDoc);
};
