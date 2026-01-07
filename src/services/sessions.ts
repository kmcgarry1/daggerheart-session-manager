import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";

const SESSION_COLLECTION = "sessions";
const SESSION_CODE_COLLECTION = "sessionCodes";
const CODE_LENGTH = 6;
const CODE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_TTL_MS = 60 * 60 * 1000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const CODE_ATTEMPTS = 5;
const HEARTBEAT_INTERVAL_MS = 30 * 1000; // 30 seconds
const STALE_MEMBER_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

export { HEARTBEAT_INTERVAL_MS, STALE_MEMBER_THRESHOLD_MS };

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

export type MemberData = {
  id: string;
  name: string;
  uid: string | null;
  isGuest: boolean;
  role: "host" | "player";
  joinedAt: Date | null;
  lastSeenAt: Date | null;
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

type MemberDoc = Omit<MemberData, "id" | "joinedAt" | "lastSeenAt"> & {
  joinedAt?: Timestamp;
  lastSeenAt?: Timestamp;
};

type SessionCodeDoc = {
  sessionId: string;
  codeExpiresAt?: Timestamp;
  sessionExpiresAt?: Timestamp;
};

type CreateSessionParams = {
  hostName: string;
  sessionName?: string;
  hostUid?: string | null;
  hostMemberId: string;
  hostIsGuest?: boolean;
};

type JoinSessionParams = {
  sessionId: string;
  memberId: string;
  name: string;
  uid?: string | null;
  role?: "host" | "player";
  isGuest?: boolean;
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
  const randomValues = new Uint32Array(CODE_LENGTH);
  crypto.getRandomValues(randomValues);
  
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    const randomValue = randomValues[i];
    if (randomValue === undefined) {
      throw new Error("Failed to generate random value");
    }
    const index = randomValue % CODE_CHARSET.length;
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

const mapMemberData = (id: string, data: MemberDoc): MemberData => ({
  id,
  name: data.name,
  uid: data.uid ?? null,
  isGuest: data.isGuest ?? true,
  role: data.role ?? "player",
  joinedAt: data.joinedAt ? data.joinedAt.toDate() : null,
  lastSeenAt: data.lastSeenAt ? data.lastSeenAt.toDate() : null,
});

const isCodeAvailable = async (code: string) => {
  const snapshot = await getDoc(doc(db, SESSION_CODE_COLLECTION, code));
  return !snapshot.exists();
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
  hostIsGuest,
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

  const resolvedHostUid = hostUid ?? null;
  const resolvedHostGuest = hostIsGuest ?? !resolvedHostUid;

  const docRef = await addDoc(collection(db, SESSION_COLLECTION), {
    code,
    name: trimmedSession || null,
    host: {
      name: trimmedHost,
      uid: resolvedHostUid,
      memberId: trimmedMember,
      isGuest: resolvedHostGuest,
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
      uid: resolvedHostUid,
      isGuest: resolvedHostGuest,
      role: "host",
      joinedAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
    },
    { merge: true },
  );

  await setDoc(doc(db, SESSION_CODE_COLLECTION, code), {
    sessionId: docRef.id,
    codeExpiresAt: Timestamp.fromDate(codeExpiresAt),
    sessionExpiresAt: Timestamp.fromDate(sessionExpiresAt),
    createdAt: serverTimestamp(),
  });

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

  const codeSnapshot = await getDoc(
    doc(db, SESSION_CODE_COLLECTION, normalized),
  );

  if (!codeSnapshot.exists()) {
    return null;
  }

  const codeData = codeSnapshot.data() as SessionCodeDoc;
  if (!codeData?.sessionId) {
    return null;
  }

  const codeExpiresAt = codeData.codeExpiresAt?.toDate() ?? null;
  if (codeExpiresAt && codeExpiresAt.getTime() <= Date.now()) {
    return null;
  }

  const sessionExpiresAt = codeData.sessionExpiresAt?.toDate() ?? null;
  if (sessionExpiresAt && sessionExpiresAt.getTime() <= Date.now()) {
    return null;
  }

  return fetchSessionById(codeData.sessionId);
};

export const joinSession = async ({
  sessionId,
  memberId,
  name,
  uid = null,
  role,
  isGuest,
}: JoinSessionParams) => {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Display name is required.");
  }

  const resolvedIsGuest = isGuest ?? !uid;

  await setDoc(
    doc(db, SESSION_COLLECTION, sessionId, "members", memberId),
    {
      name: trimmedName,
      uid,
      isGuest: resolvedIsGuest,
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

export const subscribeToMembers = (
  sessionId: string,
  onChange: (members: MemberData[]) => void,
  onError?: (error: Error) => void,
) =>
  onSnapshot(
    query(
      collection(db, SESSION_COLLECTION, sessionId, "members"),
      orderBy("joinedAt", "asc"),
    ),
    (snapshot) => {
      const members = snapshot.docs.map((docSnap) =>
        mapMemberData(docSnap.id, docSnap.data() as MemberDoc),
      );
      onChange(members);
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

export const updateMemberHeartbeat = async (
  sessionId: string,
  memberId: string,
) => {
  await updateDoc(doc(db, SESSION_COLLECTION, sessionId, "members", memberId), {
    lastSeenAt: serverTimestamp(),
  });
};

export const removeStaleMembers = async (sessionId: string) => {
  const membersRef = collection(db, SESSION_COLLECTION, sessionId, "members");
  const membersSnapshot = await getDocs(membersRef);
  const now = Date.now();
  const staleThreshold = now - STALE_MEMBER_THRESHOLD_MS;

  const deletePromises = membersSnapshot.docs
    .filter((memberDoc) => {
      const data = memberDoc.data() as MemberDoc;
      const lastSeen = data.lastSeenAt?.toDate()?.getTime();
      
      // Skip members without lastSeenAt - they just joined and haven't had a heartbeat yet
      if (!lastSeen) {
        return false;
      }
      
      return lastSeen < staleThreshold;
    })
    .map((memberDoc) =>
      deleteDoc(doc(db, SESSION_COLLECTION, sessionId, "members", memberDoc.id)),
    );

  await Promise.all(deletePromises);
};
