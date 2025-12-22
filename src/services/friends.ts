import {
  Timestamp,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  limit,
} from "firebase/firestore";
import { db } from "../firebase";

export type FriendshipStatus = "pending" | "accepted" | "declined" | "cancelled";

export type FriendshipData = {
  id: string;
  users: [string, string];
  requesterUid: string;
  requesterName: string;
  requesterPhotoURL: string | null;
  addresseeUid: string;
  addresseeName: string;
  addresseePhotoURL: string | null;
  status: FriendshipStatus;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type FriendshipDoc = Omit<
  FriendshipData,
  "id" | "createdAt" | "updatedAt"
> & {
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

const mapFriendshipData = (id: string, data: FriendshipDoc): FriendshipData => ({
  id,
  users: data.users,
  requesterUid: data.requesterUid,
  requesterName: data.requesterName,
  requesterPhotoURL: data.requesterPhotoURL ?? null,
  addresseeUid: data.addresseeUid,
  addresseeName: data.addresseeName,
  addresseePhotoURL: data.addresseePhotoURL ?? null,
  status: data.status,
  createdAt: data.createdAt ? data.createdAt.toDate() : null,
  updatedAt: data.updatedAt ? data.updatedAt.toDate() : null,
});

const getFriendshipId = (uidA: string, uidB: string) =>
  [uidA, uidB].sort().join("_");

export const sendFriendRequest = async ({
  fromUid,
  fromName,
  fromPhotoURL,
  toUid,
  toName,
  toPhotoURL,
}: {
  fromUid: string;
  fromName: string;
  fromPhotoURL: string | null;
  toUid: string;
  toName: string;
  toPhotoURL: string | null;
}) => {
  const friendshipId = getFriendshipId(fromUid, toUid);
  const ref = doc(db, "friendships", friendshipId);
  const snapshot = await getDoc(ref);

  if (snapshot.exists()) {
    const existing = snapshot.data() as FriendshipDoc;
    if (existing.status === "accepted") {
      throw new Error("You're already friends.");
    }
    if (existing.status === "pending") {
      if (existing.requesterUid === fromUid) {
        throw new Error("Friend request already sent.");
      }
      throw new Error("They already sent you a friend request.");
    }
    throw new Error("That request was closed. Ask them to send a new one.");
  }

  const payload: FriendshipDoc = {
    users: [fromUid, toUid].sort() as [string, string],
    requesterUid: fromUid,
    requesterName: fromName,
    requesterPhotoURL: fromPhotoURL,
    addresseeUid: toUid,
    addresseeName: toName,
    addresseePhotoURL: toPhotoURL,
    status: "pending",
  };

  await setDoc(
    ref,
    {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: false },
  );
};

export const respondToFriendRequest = async (
  friendshipId: string,
  status: FriendshipStatus,
) => {
  await updateDoc(doc(db, "friendships", friendshipId), {
    status,
    updatedAt: serverTimestamp(),
  });
};

export const subscribeToFriendships = (
  uid: string,
  onChange: (friendships: FriendshipData[]) => void,
  onError: (error: unknown) => void,
) => {
  const friendshipsQuery = query(
    collection(db, "friendships"),
    where("users", "array-contains", uid),
    orderBy("updatedAt", "desc"),
    limit(50),
  );

  return onSnapshot(
    friendshipsQuery,
    (snapshot) => {
      const nextFriendships = snapshot.docs.map((docSnap) =>
        mapFriendshipData(docSnap.id, docSnap.data() as FriendshipDoc),
      );
      onChange(nextFriendships);
    },
    onError,
  );
};
