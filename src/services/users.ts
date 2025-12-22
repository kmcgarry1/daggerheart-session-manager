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

  if (!snapshot.exists()) {
    await setDoc(ref, {
      displayName: user.displayName ?? null,
      email: user.email ?? null,
      photoURL: user.photoURL ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return;
  }

  await setDoc(
    ref,
    {
      displayName: user.displayName ?? null,
      email: user.email ?? null,
      photoURL: user.photoURL ?? null,
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
