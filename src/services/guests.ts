const GUEST_ID_KEY = "dh_guest_id";
const GUEST_NAME_KEY = "dh_guest_name";

const generateGuestId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(bytes);
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
