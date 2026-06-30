"use client";

import { useSyncExternalStore } from "react";

const ADMIN_ACCESS_UPDATED_EVENT = "financiero_admin_access_updated";
let hasAdminAccess = false;

function getSnapshot() {
  return hasAdminAccess;
}

function getServerSnapshot() {
  return false;
}

function subscribe(callback: () => void) {
  window.addEventListener(ADMIN_ACCESS_UPDATED_EVENT, callback);

  return () => {
    window.removeEventListener(ADMIN_ACCESS_UPDATED_EVENT, callback);
  };
}

export function useAdminAccess() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function grantAdminAccess() {
  hasAdminAccess = true;
  window.dispatchEvent(new Event(ADMIN_ACCESS_UPDATED_EVENT));
}

export function revokeAdminAccess() {
  hasAdminAccess = false;
  window.dispatchEvent(new Event(ADMIN_ACCESS_UPDATED_EVENT));
}
