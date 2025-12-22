import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

const SESSION_COLLECTION = "sessions";
const CODE_LENGTH = 6;
const CODE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_TTL_MS = 60 * 60 * 1000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const CODE_ATTEMPTS = 5;

export type SessionHost = {
  name: string;
  uid: string | null;
  memberId: string;
  isGuest: boolean;
};

export type SessionData = {
  id: string;
  code: string;
  name: string | null;
  host: SessionHost;
  fear: number;
  codeExpiresAt: Date;
  sessionExpiresAt: Date;
};

export type CountdownData = {
  id: string;
  name: string | null;
  max: number;
  value: number;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type SessionDoc = Omit<SessionData, "id" | "codeExpiresAt" | "sessionExpiresAt"> & {
  codeExpiresAt: Timestamp;
  sessionExpiresAt: Timestamp;
};

type CountdownDoc = Omit<CountdownData, "id" | "createdAt" | "updatedAt"> & {
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: {
    name: string;
    uid: string | null;
    memberId: string;
    isGuest: boolean;
  };
};

type CreateSessionParams = {
  hostName: string;
  sessionName?: string;
  hostUid?: string | null;
  hostMemberId: string;
};

type JoinSessionParams = {
  sessionId: string;
  memberId: string;
  name: string;
  uid?: string | null;
  role?: "host" | "player";
};

type CreatedSession = {
  id: string;
  code: string;
  codeExpiresAt: Date;
  sessionExpiresAt: Date;
};

type CreateCountdownParams = {
  name: string;
  max: number;
  createdBy: {
    name: string;
    uid: string | null;
    memberId: string;
    isGuest: boolean;
  };
};

const generateJoinCode = () => {
  const chars = [];
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    const index = Math.floor(Math.random() * CODE_CHARSET.length);
    chars.push(CODE_CHARSET[index]);
  }
  return chars.join("");
};

const normalizeCode = (code: string) => code.trim().toUpperCase();

const mapSessionData = (id: string, data: SessionDoc): SessionData => ({
  id,
  code: data.code,
  name: data.name ?? null,
  host: data.host,
  fear: data.fear ?? 0,
  codeExpiresAt: data.codeExpiresAt.toDate(),
  sessionExpiresAt: data.sessionExpiresAt.toDate(),
});

const mapCountdownData = (id: string, data: CountdownDoc): CountdownData => ({
  id,
  name: data.name ?? null,
  max: data.max,
  value: data.value ?? 0,
  createdAt: data.createdAt ? data.createdAt.toDate() : null,
  updatedAt: data.updatedAt ? data.updatedAt.toDate() : null,
});

const isCodeAvailable = async (code: string) => {
  const sessionsRef = collection(db, SESSION_COLLECTION);
  const existing = await getDocs(
    query(sessionsRef, where("code", "==", code), limit(1)),
  );
  return existing.empty;
};

const reserveJoinCode = async () => {
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
    const code = generateJoinCode();
    if (await isCodeAvailable(code)) {
      return code;
    }
  }
  throw new Error("Unable to reserve a unique join code.");
};

export const createSession = async ({
  hostName,
  sessionName,
  hostUid = null,
  hostMemberId,
}: CreateSessionParams): Promise<CreatedSession> => {
  const trimmedHost = hostName.trim();
  const trimmedSession = sessionName?.trim();
  const trimmedMember = hostMemberId.trim();
  if (!trimmedHost) {
    throw new Error("Host name is required.");
  }
  if (!trimmedMember) {
    throw new Error("Host member id is required.");
  }

  const code = await reserveJoinCode();
  const now = Date.now();
  const codeExpiresAt = new Date(now + CODE_TTL_MS);
  const sessionExpiresAt = new Date(now + SESSION_TTL_MS);

  const docRef = await addDoc(collection(db, SESSION_COLLECTION), {
    code,
    name: trimmedSession || null,
    host: {
      name: trimmedHost,
      uid: hostUid,
      memberId: trimmedMember,
      isGuest: !hostUid,
    },
    fear: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    codeExpiresAt: Timestamp.fromDate(codeExpiresAt),
    sessionExpiresAt: Timestamp.fromDate(sessionExpiresAt),
  });

  await setDoc(
    doc(db, SESSION_COLLECTION, docRef.id, "members", trimmedMember),
    {
      name: trimmedHost,
      uid: hostUid,
      isGuest: !hostUid,
      role: "host",
      joinedAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
    },
    { merge: true },
  );

  return {
    id: docRef.id,
    code,
    codeExpiresAt,
    sessionExpiresAt,
  };
};

export const fetchSessionById = async (sessionId: string) => {
  const snapshot = await getDoc(doc(db, SESSION_COLLECTION, sessionId));
  if (!snapshot.exists()) {
    return null;
  }
  return mapSessionData(snapshot.id, snapshot.data() as SessionDoc);
};

export const findSessionByCode = async (code: string) => {
  const normalized = normalizeCode(code);
  if (!normalized) {
    throw new Error("Join code is required.");
  }

  const sessionsRef = collection(db, SESSION_COLLECTION);
  const snapshot = await getDocs(
    query(sessionsRef, where("code", "==", normalized), limit(1)),
  );

  if (snapshot.empty) {
    return null;
  }

  const docSnap = snapshot.docs[0];
  if (!docSnap) {
    return null;
  }
  return mapSessionData(docSnap.id, docSnap.data() as SessionDoc);
};

export const joinSession = async ({
  sessionId,
  memberId,
  name,
  uid = null,
  role,
}: JoinSessionParams) => {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Display name is required.");
  }

  await setDoc(
    doc(db, SESSION_COLLECTION, sessionId, "members", memberId),
    {
      name: trimmedName,
      uid,
      isGuest: !uid,
      role: role ?? "player",
      joinedAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
    },
    { merge: true },
  );
};

export const subscribeToSession = (
  sessionId: string,
  onChange: (session: SessionData | null) => void,
  onError?: (error: Error) => void,
) =>
  onSnapshot(
    doc(db, SESSION_COLLECTION, sessionId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onChange(null);
        return;
      }
      onChange(mapSessionData(snapshot.id, snapshot.data() as SessionDoc));
    },
    (error) => {
      if (onError) {
        onError(error);
      }
    },
  );

export const subscribeToCountdowns = (
  sessionId: string,
  onChange: (countdowns: CountdownData[]) => void,
  onError?: (error: Error) => void,
) =>
  onSnapshot(
    query(
      collection(db, SESSION_COLLECTION, sessionId, "countdowns"),
      orderBy("createdAt", "asc"),
    ),
    (snapshot) => {
      const countdowns = snapshot.docs.map((docSnap) =>
        mapCountdownData(docSnap.id, docSnap.data() as CountdownDoc),
      );
      onChange(countdowns);
    },
    (error) => {
      if (onError) {
        onError(error);
      }
    },
  );

export const updateFear = async (sessionId: string, fear: number) => {
  const clampedFear = Math.min(Math.max(fear, 0), 12);
  await updateDoc(doc(db, SESSION_COLLECTION, sessionId), {
    fear: clampedFear,
    updatedAt: serverTimestamp(),
  });
};

export const addCountdown = async (
  sessionId: string,
  { name, max, createdBy }: CreateCountdownParams,
) => {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Countdown name is required.");
  }

  const trimmedMax = Math.max(1, Math.floor(max));
  await addDoc(collection(db, SESSION_COLLECTION, sessionId, "countdowns"), {
    name: trimmedName,
    max: trimmedMax,
    value: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy,
  });
};

export const updateCountdown = async (
  sessionId: string,
  countdownId: string,
  value: number,
) => {
  await updateDoc(
    doc(db, SESSION_COLLECTION, sessionId, "countdowns", countdownId),
    {
      value,
      updatedAt: serverTimestamp(),
    },
  );
};

export const removeCountdown = async (
  sessionId: string,
  countdownId: string,
) =>
  deleteDoc(doc(db, SESSION_COLLECTION, sessionId, "countdowns", countdownId));
