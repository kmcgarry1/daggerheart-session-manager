import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "../firebase";

const INVITE_CODE_LENGTH = 6;
const INVITE_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

type CryptoLike = {
  getRandomValues?: (array: Uint8Array) => Uint8Array;
};

const getCrypto = (): CryptoLike | null => {
  if (typeof globalThis === "undefined") {
    return null;
  }
  const cryptoRef = (globalThis as { crypto?: CryptoLike }).crypto;
  return cryptoRef ?? null;
};

const generateInviteCode = () => {
  const cryptoRef = getCrypto();
  const bytes = new Uint8Array(INVITE_CODE_LENGTH);
  if (cryptoRef?.getRandomValues) {
    cryptoRef.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(bytes, (byte) => INVITE_CODE_CHARS[byte % INVITE_CODE_CHARS.length])
    .join("")
    .toUpperCase();
};

export type UserSessionRecord = {
  id: string;
  code: string;
  name: string | null;
  role: "host" | "player";
  lastSeenAt: Date | null;
  codeExpiresAt: Date | null;
  sessionExpiresAt: Date | null;
};

export const ensureUserProfile = async (user: User) => {
  const ref = doc(db, "users", user.uid);
  const snapshot = await getDoc(ref);
  const existingInviteCode =
    (snapshot.data()?.inviteCode as string | undefined) ?? null;
  const inviteCode = existingInviteCode ?? generateInviteCode();
  const emailLower = user.email ? user.email.toLowerCase() : null;

  if (!snapshot.exists()) {
    await setDoc(ref, {
      displayName: user.displayName ?? null,
      email: user.email ?? null,
      emailLower,
      photoURL: user.photoURL ?? null,
      inviteCode,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, "publicProfiles", user.uid), {
      displayName: user.displayName ?? null,
      photoURL: user.photoURL ?? null,
      inviteCode,
      updatedAt: serverTimestamp(),
    });
    return;
  }

  await setDoc(
    ref,
    {
      displayName: user.displayName ?? null,
      email: user.email ?? null,
      emailLower,
      photoURL: user.photoURL ?? null,
      inviteCode,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await setDoc(
    doc(db, "publicProfiles", user.uid),
    {
      displayName: user.displayName ?? null,
      photoURL: user.photoURL ?? null,
      inviteCode,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
};

export const saveUserSession = async ({
  uid,
  sessionId,
  code,
  name,
  role,
  codeExpiresAt,
  sessionExpiresAt,
}: {
  uid: string;
  sessionId: string;
  code: string;
  name: string | null;
  role: "host" | "player";
  codeExpiresAt: Date;
  sessionExpiresAt: Date;
}) =>
  setDoc(
    doc(db, "users", uid, "sessions", sessionId),
    {
      code,
      name: name ?? null,
      role,
      lastSeenAt: serverTimestamp(),
      codeExpiresAt: Timestamp.fromDate(codeExpiresAt),
      sessionExpiresAt: Timestamp.fromDate(sessionExpiresAt),
    },
    { merge: true },
  );

export const fetchUserSessions = async (uid: string) => {
  const snapshot = await getDocs(
    query(
      collection(db, "users", uid, "sessions"),
      orderBy("lastSeenAt", "desc"),
      limit(5),
    ),
  );

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as {
      code: string;
      name?: string | null;
      role: "host" | "player";
      lastSeenAt?: Timestamp;
      codeExpiresAt?: Timestamp;
      sessionExpiresAt?: Timestamp;
    };

    return {
      id: docSnap.id,
      code: data.code,
      name: data.name ?? null,
      role: data.role,
      lastSeenAt: data.lastSeenAt ? data.lastSeenAt.toDate() : null,
      codeExpiresAt: data.codeExpiresAt ? data.codeExpiresAt.toDate() : null,
      sessionExpiresAt: data.sessionExpiresAt
        ? data.sessionExpiresAt.toDate()
        : null,
    } satisfies UserSessionRecord;
  });
};
