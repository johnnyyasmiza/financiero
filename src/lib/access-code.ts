export const ACCESS_GRANTED_KEY = "financiero_access_granted";
export const ACCESS_EXPIRES_AT_KEY = "financiero_access_expires_at";
const ACCESS_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

function canUseStorage() {
  return typeof window !== "undefined" && "localStorage" in window;
}

export function isAccessGranted() {
  if (!canUseStorage()) {
    return false;
  }

  const granted = window.localStorage.getItem(ACCESS_GRANTED_KEY) === "true";
  const expiresAt = Number(window.localStorage.getItem(ACCESS_EXPIRES_AT_KEY) ?? 0);

  if (!granted || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    clearAccess();
    return false;
  }

  return true;
}

export function grantAccess() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(ACCESS_GRANTED_KEY, "true");
  window.localStorage.setItem(ACCESS_EXPIRES_AT_KEY, String(Date.now() + ACCESS_DURATION_MS));
}

export function clearAccess() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(ACCESS_GRANTED_KEY);
  window.localStorage.removeItem(ACCESS_EXPIRES_AT_KEY);
}
