const GUEST_ID_KEY = "dh_guest_id";
const GUEST_NAME_KEY = "dh_guest_name";

type CryptoLike = {
  randomUUID?: () => string;
  getRandomValues?: (array: Uint8Array) => Uint8Array;
};

const getCrypto = (): CryptoLike | null => {
  if (typeof globalThis === "undefined") {
    return null;
  }
  const cryptoRef = (globalThis as { crypto?: CryptoLike }).crypto;
  return cryptoRef ?? null;
};

const generateGuestId = () => {
  const cryptoRef = getCrypto();
  if (cryptoRef?.randomUUID) {
    return cryptoRef.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (cryptoRef?.getRandomValues) {
    cryptoRef.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
};

export const getGuestIdentity = () => {
  let guestId = localStorage.getItem(GUEST_ID_KEY);
  if (!guestId) {
    guestId = generateGuestId();
    localStorage.setItem(GUEST_ID_KEY, guestId);
  }

  return {
    id: guestId,
    name: localStorage.getItem(GUEST_NAME_KEY) ?? "",
  };
};

export const setGuestName = (name: string) => {
  const trimmed = name.trim();
  if (trimmed) {
    localStorage.setItem(GUEST_NAME_KEY, trimmed);
  }
};

export const getMemberId = (uid: string | null | undefined, guestId: string) =>
  uid ? uid : `guest-${guestId}`;
