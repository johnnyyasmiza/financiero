"use client";

import { useEffect, useSyncExternalStore } from "react";
import { clearAccess, grantAccess, isAccessGranted } from "@/lib/access-code";

const ADMIN_ACCESS_UPDATED_EVENT = "financiero_admin_access_updated";

type AccessSnapshot = {
  isChecking: boolean;
  hasAccess: boolean;
};

let snapshot: AccessSnapshot = {
  isChecking: true,
  hasAccess: false,
};
const serverSnapshot: AccessSnapshot = {
  isChecking: true,
  hasAccess: false,
};

function emitAccessUpdate() {
  window.dispatchEvent(new Event(ADMIN_ACCESS_UPDATED_EVENT));
}

function setSnapshot(nextSnapshot: AccessSnapshot) {
  if (snapshot.isChecking === nextSnapshot.isChecking && snapshot.hasAccess === nextSnapshot.hasAccess) {
    return;
  }

  snapshot = nextSnapshot;
  emitAccessUpdate();
}

function refreshAccessSnapshot() {
  setSnapshot({ isChecking: false, hasAccess: isAccessGranted() });
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot(): AccessSnapshot {
  return serverSnapshot;
}

function subscribe(callback: () => void) {
  window.addEventListener(ADMIN_ACCESS_UPDATED_EVENT, callback);
  window.addEventListener("storage", refreshAccessSnapshot);

  return () => {
    window.removeEventListener(ADMIN_ACCESS_UPDATED_EVENT, callback);
    window.removeEventListener("storage", refreshAccessSnapshot);
  };
}

export function useAdminAccessStatus() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    refreshAccessSnapshot();
  }, []);

  return state;
}

export function useAdminAccess() {
  return useAdminAccessStatus().hasAccess;
}

export function grantAdminAccess() {
  grantAccess();
  setSnapshot({ isChecking: false, hasAccess: true });
}

export function revokeAdminAccess() {
  clearAccess();
  setSnapshot({ isChecking: false, hasAccess: false });
}
